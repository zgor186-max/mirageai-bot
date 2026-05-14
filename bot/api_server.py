import asyncio
import aiohttp
import base64
import uuid
import json as _json
from aiohttp import web
import os

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")
REPLICATE_MODEL = "black-forest-labs/flux-kontext-pro"
REPLICATE_TEXT2IMG = "black-forest-labs/flux-dev"
FACESWAP_VERSION = "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34"

# Temp image hosting (fallback when Replicate Files API is unavailable)
TEMP_DIR = "/tmp/mirageai_imgs"
os.makedirs(TEMP_DIR, exist_ok=True)
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://mirageai.duckdns.org")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


async def generate_handler(request):
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=CORS_HEADERS)

    try:
        data = await request.json()
        photo_b64 = data.get("photo", "")
        prompt = data.get("prompt", "")

        if not photo_b64 or not prompt:
            return web.json_response(
                {"error": "photo and prompt are required"},
                status=400,
                headers=CORS_HEADERS,
            )

        if photo_b64.startswith("data:"):
            photo_b64 = photo_b64.split(",", 1)[1]

        print(f"[API] photo b64 length={len(photo_b64)}")
        print(f"[API] prompt={prompt[:100]}")

        image_url = await call_replicate(photo_b64, prompt)

        if not image_url:
            return web.json_response(
                {"error": "Generation failed"},
                status=500,
                headers=CORS_HEADERS,
            )

        image_b64 = await download_image_as_base64(image_url)
        if image_b64:
            return web.json_response({"url": image_b64}, headers=CORS_HEADERS)

        return web.json_response({"url": image_url}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


async def generate_card_handler(request):
    """Two-step generation: scene first, then place product in it"""
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=CORS_HEADERS)

    try:
        data = await request.json()
        photo_b64    = data.get("photo", "")
        scene_prompt = data.get("scene_prompt", "")
        product_name = data.get("product_name", "product")
        category     = data.get("category", "other")
        card_data    = data.get("card", {})

        if not photo_b64 or not scene_prompt:
            return web.json_response({"error": "photo and scene_prompt required"}, status=400, headers=CORS_HEADERS)

        if photo_b64.startswith("data:"):
            photo_b64 = photo_b64.split(",", 1)[1]

        print(f"[Card] category={category} scene={scene_prompt[:80]}")

        # Category-specific placement instructions
        PLACEMENT = {
            "clothing": (
                "is unfolded and laid completely flat on the surface in a flat lay arrangement, "
                "positioned in the RIGHT half of the frame, filling 55% of the total frame. "
                "The top and bottom parts are separated and displayed together, fully visible. "
                "Every part of the fabric is touching the surface — NO parts floating or hanging. "
                "NO hanger anywhere. Viewed from slightly above (40-degree angle). "
                "The LEFT third of the frame remains open with scene background for text overlay."
            ),
            "footwear": (
                "is placed on the RIGHT side of the frame at a natural 3/4 angle (from the front-side). "
                "The shoe/sneaker/boot stands upright on the surface — NOT flat, NOT disassembled. "
                "Show the complete shoe as one intact unit, filling 55% of the total frame. "
                "The LEFT third of the frame remains open with scene background for text overlay. "
                "CRITICAL: the shoe must look EXACTLY like the original — same shape, same sole."
            ),
            "accessories": (
                "is placed upright on the RIGHT side of the frame, filling 50% of the total frame. "
                "Firmly on the surface. The LEFT third stays open with scene background. NOT floating."
            ),
            "food": (
                "is placed on the RIGHT side of the frame, filling 50% of the total frame. "
                "Firmly on the surface. The LEFT third stays open with scene background."
            ),
            "beauty": (
                "is standing upright on the RIGHT side of the frame, filling 50% of the total frame. "
                "Firmly on the surface. The LEFT third stays open with scene background. NOT floating."
            ),
            "gadgets": (
                "is placed at a hero angle on the RIGHT side of the frame, filling 50% of the total frame. "
                "Firmly on the surface. The LEFT third stays open with scene background. NOT floating."
            ),
            "home": (
                "is placed naturally on the RIGHT side of the frame as it would be used, filling 50% of the total frame. "
                "Firmly on the surface. The LEFT third stays open with scene background. NOT floating."
            ),
            "other": (
                "is placed prominently on the RIGHT side of the frame, filling 50% of the total frame. "
                "Firmly on the surface. The LEFT third stays open with scene background. NOT floating."
            ),
        }
        placement_instruction = PLACEMENT.get(category, PLACEMENT["other"])

        place_prompt = (
            f"Take the COMPLETE product shown in the reference image (every part, every component, the entire item as shown) "
            f"and integrate it fully into this scene: {scene_prompt}. "
            f"The product {placement_instruction} "
            f"CRITICAL COMPOSITION: the product must be in the RIGHT half of the frame — "
            f"the left 40% of the image must remain as clean scene background (no product there). "
            f"IMPORTANT: reproduce ALL parts of the product — do not crop or cut any component. "
            f"Preserve exact colors, patterns, textures of the original product. "
            f"Photorealistic commercial product photography, warm cinematic lighting. NO text, NO watermarks."
        )

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=300)) as session:
                # Step 1: Generate background scene (no product)
                print(f"[Card] Step 1 — generating scene")
                bg_url = await call_text2img(session, scene_prompt)

                if bg_url:
                    print(f"[Card] Step 1 done: {bg_url[:60]}")
                    print(f"[Card] Step 2 — placing product in scene")

                    # Upload product photo (Replicate API or local temp server)
                    product_url = await upload_image_to_replicate(session, photo_b64)

                    # Download bg and upload it too
                    bg_b64 = await download_as_b64(session, bg_url)
                    bg_upload_url = await upload_image_to_replicate(session, bg_b64) if bg_b64 else None

                    result_url = await call_kontext_two_images(session, product_url, bg_upload_url, place_prompt)

                    if result_url:
                        image_b64 = await download_image_as_base64(result_url)
                        print(f"[Card] Two-step done ✓")
                        final = await _apply_card_overlay(image_b64, card_data)
                        return web.json_response({"url": final}, headers=CORS_HEADERS)

                # Fallback: single step
                print("[Card] Falling back to single-step generation")

        except Exception as e:
            print(f"[Card] Two-step error: {e}, falling back")

        # Single-step fallback
        result_url = await call_replicate(photo_b64, place_prompt)
        if not result_url:
            return web.json_response({"error": "Generation failed"}, status=500, headers=CORS_HEADERS)

        image_b64 = await download_image_as_base64(result_url)
        print(f"[Card] Single-step fallback done ✓")
        final = await _apply_card_overlay(image_b64, card_data)
        return web.json_response({"url": final}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


async def call_text2img(session: aiohttp.ClientSession, prompt: str) -> str | None:
    """Step 1: Generate background scene without product"""
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "input": {
            "prompt": f"{prompt}. Empty scene, no products present, photorealistic commercial photography background, ultra detailed",
            "aspect_ratio": "3:4",
            "output_format": "jpg",
        }
    }
    try:
        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_TEXT2IMG}/predictions",
            api_headers, payload, label="Text2Img"
        )
        status = result.get("status")
        pred_id = result.get("id")
        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        print(f"[Text2Img] failed: {result.get('error')}")
        return None
    except Exception as e:
        print(f"[Text2Img] error: {e}")
        return None


async def call_kontext_two_images(session, product_url: str, bg_url: str | None, prompt: str) -> str | None:
    """Step 2: Place product into scene using flux-kontext-pro"""
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    input_images = [product_url]
    if bg_url:
        input_images.append(bg_url)

    payload = {
        "input": {
            "prompt": prompt,
            "input_image": product_url,
            **({"input_images": input_images} if bg_url else {}),
            "aspect_ratio": "3:4",
            "output_format": "jpg",
            "safety_tolerance": 2,
        }
    }
    try:
        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            api_headers, payload, label="Kontext2"
        )
        status = result.get("status")
        pred_id = result.get("id")
        print(f"[Kontext2] status={status} id={pred_id}")
        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        if status == "failed":
            print(f"[Kontext2] FAILED: {result.get('error')}")
        return None
    except Exception as e:
        print(f"[Kontext2] error: {e}")
        return None


async def download_as_b64(session: aiohttp.ClientSession, url: str) -> str | None:
    try:
        async with session.get(url) as resp:
            if resp.status == 200:
                return base64.b64encode(await resp.read()).decode()
    except Exception as e:
        print(f"[download_as_b64] error: {e}")
    return None


async def faceswap_handler(request):
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=CORS_HEADERS)

    try:
        data = await request.json()
        template_b64 = data.get("template", "")
        user_photo_b64 = data.get("user_photo", "")

        if not template_b64 or not user_photo_b64:
            return web.json_response(
                {"error": "template and user_photo are required"},
                status=400,
                headers=CORS_HEADERS,
            )

        if template_b64.startswith("data:"):
            template_b64 = template_b64.split(",", 1)[1]
        if user_photo_b64.startswith("data:"):
            user_photo_b64 = user_photo_b64.split(",", 1)[1]

        print(f"[FaceSwap] template size={len(template_b64)}, user_photo size={len(user_photo_b64)}")

        result_url = await call_faceswap(template_b64, user_photo_b64)

        if not result_url:
            return web.json_response(
                {"error": "Face swap failed"},
                status=500,
                headers=CORS_HEADERS,
            )

        image_b64 = await download_image_as_base64(result_url)
        if image_b64:
            return web.json_response({"url": image_b64}, headers=CORS_HEADERS)

        return web.json_response({"url": result_url}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


async def call_faceswap(template_b64: str, user_photo_b64: str) -> str | None:
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }

    timeout = aiohttp.ClientTimeout(total=180)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        template_url = await upload_image_to_replicate(session, template_b64)
        user_photo_url = await upload_image_to_replicate(session, user_photo_b64)

        if not template_url or not user_photo_url:
            print("[FaceSwap] Failed to upload images")
            return None

        payload = {
            "version": FACESWAP_VERSION,
            "input": {
                "input_image": template_url,
                "swap_image": user_photo_url,
            }
        }

        async with session.post(
            "https://api.replicate.com/v1/predictions",
            headers=api_headers,
            json=payload,
        ) as resp:
            raw = await resp.text()
            print(f"[FaceSwap] HTTP={resp.status} raw={raw[:300]}")
            try:
                result = await resp.json(content_type=None)
            except Exception:
                import json
                result = json.loads(raw)

            status = result.get("status")
            pred_id = result.get("id")
            print(f"[FaceSwap] status={status} id={pred_id}")

            if status == "succeeded":
                return _extract_output(result)
            if status in ("starting", "processing"):
                return await _poll(session, pred_id, api_headers)
            if status == "failed":
                print(f"[FaceSwap] FAILED: {result.get('error')}")
                return None
            return None


async def download_image_as_base64(url: str) -> str | None:
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    img_bytes = await resp.read()
                    b64 = base64.b64encode(img_bytes).decode()
                    return f"data:image/jpeg;base64,{b64}"
                print(f"[Replicate] download failed: {resp.status}")
                return None
    except Exception as e:
        print(f"[Replicate] download error: {e}")
        return None


async def _save_image_locally(photo_b64: str) -> str | None:
    """Save base64 image to local temp dir and return a public URL."""
    try:
        raw_b64 = photo_b64.split(",", 1)[1] if photo_b64.startswith("data:") else photo_b64
        img_bytes = base64.b64decode(raw_b64)
        filename = f"{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(TEMP_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        url = f"{PUBLIC_BASE_URL}/img/{filename}"
        print(f"[Upload] Saved locally → {url}")
        # Auto-delete after 10 minutes
        asyncio.create_task(_delete_after(filepath, 600))
        return url
    except Exception as e:
        print(f"[Upload] Local save failed: {e}")
        return None


async def _delete_after(filepath: str, delay: int):
    await asyncio.sleep(delay)
    try:
        os.unlink(filepath)
    except Exception:
        pass


async def serve_temp_image(request):
    filename = request.match_info["filename"]
    if "/" in filename or ".." in filename or not filename.endswith(".jpg"):
        return web.Response(status=404)
    filepath = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(filepath):
        return web.Response(status=404)
    return web.FileResponse(filepath, headers={"Content-Type": "image/jpeg",
                                                "Access-Control-Allow-Origin": "*"})


async def upload_image_to_replicate(session: aiohttp.ClientSession, photo_b64: str) -> str | None:
    """Upload image: try Replicate Files API, then fall back to local temp server."""
    if photo_b64.startswith("data:"):
        photo_b64 = photo_b64.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(photo_b64)
        headers = {
            "Authorization": f"Token {REPLICATE_TOKEN}",
            "Content-Type": "image/jpeg",
        }
        async with session.post(
            "https://api.replicate.com/v1/files",
            headers=headers,
            data=img_bytes,
        ) as resp:
            raw = await resp.text()
            print(f"[Replicate] file upload HTTP={resp.status} response={raw[:300]}")
            import json as _json
            try:
                result = _json.loads(raw)
            except Exception:
                result = {}
            url = result.get("urls", {}).get("get") or result.get("url")
            if url:
                print(f"[Replicate] uploaded to Replicate: {url}")
                return url
    except Exception as e:
        print(f"[Replicate] file upload exception: {e}")

    # Fallback: serve from our own server
    print("[Upload] Replicate upload failed → using local temp server")
    return await _save_image_locally(photo_b64)


async def _post_with_retry(session: aiohttp.ClientSession, url: str, headers: dict, payload: dict,
                           label: str = "Replicate", max_retries: int = 4) -> dict:
    """POST to Replicate API with automatic retry on 429 rate-limit responses."""
    import json as _json
    for attempt in range(max_retries):
        async with session.post(url, headers=headers, json=payload) as resp:
            raw = await resp.text()
            try:
                result = _json.loads(raw)
            except Exception:
                result = {}
            http_status = resp.status
            api_status = result.get("status")
            # Rate-limited — wait and retry
            if http_status == 429 or api_status == 429:
                retry_after = int(result.get("retry_after", 10)) + 2
                print(f"[{label}] 429 rate-limited (attempt {attempt+1}/{max_retries}), waiting {retry_after}s...")
                await asyncio.sleep(retry_after)
                continue
            return result
    print(f"[{label}] All {max_retries} attempts rate-limited, giving up")
    return {}


async def call_replicate(photo_b64: str, prompt: str) -> str | None:
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }

    timeout = aiohttp.ClientTimeout(total=300)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        image_url = await upload_image_to_replicate(session, photo_b64)

        payload = {
            "input": {
                "prompt": prompt,
                "input_image": image_url,
                "aspect_ratio": "3:4",
                "output_format": "jpg",
                "safety_tolerance": 2,
            }
        }

        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            api_headers, payload, label="Replicate"
        )

        status = result.get("status")
        pred_id = result.get("id")
        print(f"[Replicate] status={status} id={pred_id}")

        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        if status == "failed":
            print(f"[Replicate] FAILED: error={result.get('error')} logs={result.get('logs','')[:200]}")
            return None
        if result:
            print(f"[Replicate] unexpected: {result}")
        return None


async def _poll(session, prediction_id: str, headers: dict) -> str | None:
    for i in range(40):
        await asyncio.sleep(3)
        async with session.get(
            f"https://api.replicate.com/v1/predictions/{prediction_id}",
            headers=headers,
        ) as resp:
            result = await resp.json(content_type=None)
            status = result.get("status")
            print(f"[Replicate] poll #{i+1} status={status}")

            if status == "succeeded":
                return _extract_output(result)
            if status == "failed":
                print(f"[Replicate] poll FAILED: {result.get('error')} logs={result.get('logs','')[:200]}")
                return None
    print("[Replicate] poll timeout")
    return None


def _extract_output(result: dict) -> str | None:
    output = result.get("output")
    if isinstance(output, list) and output:
        return output[0]
    if isinstance(output, str):
        return output
    return None


async def _apply_card_overlay(image_b64: str | None, card_data: dict) -> str:
    """Render text overlay via Cairo."""
    if not image_b64:
        return image_b64
    raw_b64 = image_b64.split(",", 1)[1] if image_b64.startswith("data:") else image_b64
    if card_data:
        rendered = await render_card_cairo(raw_b64, card_data)
        if rendered:
            return rendered
    return image_b64


ACCENT_COLORS = {
    "warm": "#d4a017", "dark": "#c9a84c", "tech": "#00c8ff",
    "workshop": "#ffc200", "nature": "#4caf50"
}



def _svg_esc(text: str) -> str:
    import html
    return html.escape(str(text))


def _svg_wrap(text: str, max_chars: int = 12) -> list:
    """Split text into lines of at most max_chars characters."""
    words = str(text).split()
    if not words:
        return [""]
    lines, current = [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


async def render_card_cairo(image_b64: str, card: dict) -> str | None:
    """Render card text overlay via CairoSVG — zero alpha/darkening artifacts."""
    try:
        import cairosvg
    except ImportError:
        print("[Cairo] cairosvg not installed, will fall back to Playwright")
        return None

    import io as _io
    from PIL import Image

    scheme   = card.get("scheme", "warm")
    accent   = ACCENT_COLORS.get(scheme, "#d4a017")
    raw_bytes = base64.b64decode(image_b64)

    import io as _io2
    from PIL import ImageDraw as _ImageDraw

    import numpy as np
    pil_img = Image.open(_io.BytesIO(raw_bytes)).convert("RGB")
    img_arr = np.array(pil_img)   # shape (H, W, 3)
    H, W    = img_arr.shape[:2]

    # ── Text: always white + black stroke — readable on ANY background ──
    title_color  = "#ffffff"
    sub_color    = "#ffffff"
    feat_color   = "#ffffff"
    stroke_col   = "#000000"
    stroke_op    = "0.85"
    badge_text_c = "#111111"

    # ── Smart feature zone: find cleanest area in left half ──────────────
    # Left half only (product is always placed right).
    # Title occupies y≈0-360, so feature zones start below that.
    # Three candidate zones: mid-left, lower-left, bottom strip.
    lw = W // 2   # left half width
    ZONES = {
        "mid":    img_arr[350:620,  :lw, :],   # y 350-620
        "lower":  img_arr[620:870,  :lw, :],   # y 620-870
        "bottom": img_arr[870:1080, :lw, :],   # y 870-1080
    }
    zone_std = {name: float(np.std(z)) for name, z in ZONES.items()}
    best_zone = min(zone_std, key=zone_std.get)
    ZONE_Y = {"mid": 380, "lower": 640, "bottom": 890}
    feat_zone_top = ZONE_Y[best_zone]
    print(f"[Cairo] feature zone={best_zone} stds={zone_std} top_y={feat_zone_top}, scheme={scheme}")

    # ── Circular thumbnail: pre-crop in PIL (more reliable than SVG clip-path) ──
    thumb_size = 88
    thumb = pil_img.resize((thumb_size, thumb_size), Image.LANCZOS).convert("RGBA")
    mask  = Image.new("L", (thumb_size, thumb_size), 0)
    _ImageDraw.Draw(mask).ellipse((0, 0, thumb_size - 1, thumb_size - 1), fill=255)
    thumb.putalpha(mask)
    _tbuf = _io2.BytesIO()
    thumb.save(_tbuf, format="PNG")
    thumb_uri = "data:image/png;base64," + base64.b64encode(_tbuf.getvalue()).decode()

    badge        = _svg_esc(card.get("badge", ""))
    name         = _svg_esc(card.get("name", "")).upper()
    subtitle_raw = _svg_esc(card.get("subtitle", ""))

    feats = []
    for i in range(1, 6):
        feat = card.get(f"feat{i}", "")
        icon = card.get(f"icon{i}", "✦")
        if feat:
            feats.append({"icon": icon, "text": _svg_esc(feat.upper())})

    # Single font family used everywhere for visual consistency
    FONT       = "'Georgia', 'Liberation Serif', 'DejaVu Serif', serif"
    FONT_EMOJI = "Noto Color Emoji, Segoe UI Emoji, Apple Color Emoji, sans-serif"

    els = []

    # ── SVG filter: strong drop shadow — works on any background ───
    els.append(
        f'<defs>'
        f'<filter id="ts" x="-10%" y="-10%" width="120%" height="120%">'
        f'<feDropShadow dx="0" dy="1.5" stdDeviation="3" '
        f'flood-color="#000000" flood-opacity="0.90"/>'
        f'</filter>'
        f'</defs>'
    )

    # ── Badge (top-right corner) ────────────────────────────
    if badge:
        bw  = min(max(int((len(badge) * 9 + 28) * 1.1), 88), 418)
        bh  = 31
        brx = 15
        bx  = 800 - bw - 40
        by  = 44
        els.append(
            f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="{brx}" fill="{accent}"/>'
        )
        els.append(
            f'<text x="{bx + bw // 2}" y="{by + 21}" text-anchor="middle" '
            f'font-family="{FONT}" font-size="13" font-weight="700" '
            f'fill="{badge_text_c}">{badge}</text>'
        )

    # ── Title ────────────────────────────────────────────────────
    title_lines = _svg_wrap(name, max_chars=12)
    title_fs = 70
    title_lh = 78
    ty = 90
    for line in title_lines:
        els.append(
            f'<text x="40" y="{ty}" '
            f'font-family="{FONT}" font-size="{title_fs}" font-weight="900" '
            f'fill="{title_color}" '
            f'stroke="{stroke_col}" stroke-width="3.5" stroke-opacity="{stroke_op}" '
            f'paint-order="stroke fill" filter="url(#ts)">{line}</text>'
        )
        ty += title_lh

    # ── Subtitle: 1 line max, under title ────────────────────
    if subtitle_raw:
        sy = ty + 12
        for line in _svg_wrap(subtitle_raw, max_chars=32)[:1]:
            els.append(
                f'<text x="40" y="{sy}" '
                f'font-family="{FONT}" font-size="22" '
                f'fill="{sub_color}" '
                f'stroke="{stroke_col}" stroke-width="1.5" stroke-opacity="{stroke_op}" '
                f'paint-order="stroke fill" filter="url(#ts)">{line}</text>'
            )

    # ── Features: single LEFT column, zone chosen by image analysis ─
    # feat_zone_top = cleanest y in left half (product always in right half).
    # All 4 features stacked vertically on the LEFT side only (x < 350).
    if feats:
        feats = feats[:4]
        feat_r    = 20
        feat_fs   = 14
        feat_icon = 17
        row_gap   = 68   # vertical spacing between features
        cx        = 50   # circle center x — strictly left
        tx        = 80   # text start x

        for idx, feat in enumerate(feats):
            cy = feat_zone_top + idx * row_gap

            els.append(f'<circle cx="{cx}" cy="{cy}" r="{feat_r}" fill="{accent}"/>')
            els.append(
                f'<text x="{cx}" y="{cy + 6}" text-anchor="middle" '
                f'font-family="{FONT_EMOJI}" font-size="{feat_icon}" '
                f'filter="url(#ts)">{feat["icon"]}</text>'
            )
            flines = _svg_wrap(feat["text"], max_chars=20)[:1]
            for fl in flines:
                els.append(
                    f'<text x="{tx}" y="{cy + 5}" '
                    f'font-family="{FONT}" font-size="{feat_fs}" font-weight="700" '
                    f'fill="{feat_color}" filter="url(#ts)">{fl}</text>'
                )

    # ── Thumbnail (bottom-right corner, away from features) ──
    thumb_cx = 726   # 800 - 44 - 30
    thumb_cy = 1056  # bottom edge lands at y=1100
    thumb_r  = 44
    els.append(
        f'<image href="{thumb_uri}" '
        f'x="{thumb_cx - thumb_r}" y="{thumb_cy - thumb_r}" '
        f'width="{thumb_r * 2}" height="{thumb_r * 2}"/>'
    )
    els.append(
        f'<circle cx="{thumb_cx}" cy="{thumb_cy}" r="{thumb_r}" fill="none" '
        f'stroke="{accent}" stroke-width="2.5"/>'
    )

    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'xmlns:xlink="http://www.w3.org/1999/xlink" '
        'width="800" height="1100">\n'
        + "\n".join(els)
        + "\n</svg>"
    )

    print(f"[Cairo] SVG size={len(svg)//1024}KB feats={len(feats)} scheme={scheme}")

    try:
        overlay_png = cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            output_width=800,
            output_height=1100,
        )
    except Exception as e:
        print(f"[Cairo] svg2png error: {e}")
        import traceback; traceback.print_exc()
        return None

    # Composite: background photo + SVG overlay
    bg = Image.open(_io.BytesIO(raw_bytes)).convert("RGBA")
    bg = bg.resize((800, 1100), Image.LANCZOS)
    overlay = Image.open(_io.BytesIO(overlay_png)).convert("RGBA")
    bg.paste(overlay, (0, 0), overlay)
    out = _io.BytesIO()
    bg.convert("RGB").save(out, format="JPEG", quality=93)
    b64 = base64.b64encode(out.getvalue()).decode()
    print(f"[Cairo] Composited OK ({len(out.getvalue()) // 1024}KB)")
    return f"data:image/jpeg;base64,{b64}"




async def health_handler(request):
    return web.Response(text="OK", headers=CORS_HEADERS)


def create_app() -> web.Application:
    app = web.Application(client_max_size=10 * 1024 * 1024)
    app.router.add_get("/health", health_handler)
    app.router.add_get("/img/{filename}", serve_temp_image)
    app.router.add_post("/generate", generate_handler)
    app.router.add_route("OPTIONS", "/generate", generate_handler)
    app.router.add_post("/generate-card", generate_card_handler)
    app.router.add_route("OPTIONS", "/generate-card", generate_card_handler)
    app.router.add_post("/faceswap", faceswap_handler)
    app.router.add_route("OPTIONS", "/faceswap", faceswap_handler)
    return app


async def start_api_server():
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()
    print("[API] Server started on http://0.0.0.0:8080")
