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
    """Render text overlay: Cairo first, Playwright fallback, raw image last."""
    if not image_b64:
        return image_b64
    raw_b64 = image_b64.split(",", 1)[1] if image_b64.startswith("data:") else image_b64
    if card_data:
        rendered = await render_card_cairo(raw_b64, card_data)
        if rendered:
            return rendered
        rendered = await render_card_playwright(raw_b64, card_data)
        if rendered:
            return rendered
    return image_b64


ACCENT_COLORS = {
    "warm": "#d4a017", "dark": "#c9a84c", "tech": "#00c8ff",
    "workshop": "#ffc200", "nature": "#4caf50"
}

# Text colors that feel native to each scheme's background tone
TEXT_COLORS = {
    "warm":     {"title": "#3d1800", "subtitle": "#6b3a10", "feat": "#4a2200"},
    "dark":     {"title": "#f0e0c0", "subtitle": "#c8b898", "feat": "#e0d0b0"},
    "tech":     {"title": "#c8eeff", "subtitle": "#7ec8e8", "feat": "#a0d8f0"},
    "workshop": {"title": "#3a2200", "subtitle": "#6b4400", "feat": "#4a2e00"},
    "nature":   {"title": "#0f2d0a", "subtitle": "#2a5220", "feat": "#1a3d10"},
}

CARD_HTML_TEMPLATE = """<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&display=swap');
* {{ margin:0; padding:0; box-sizing:border-box;
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale; }}
html, body {{ width:800px; height:1100px; overflow:hidden; background:transparent; }}
.content {{
    position:absolute; top:0; left:0; bottom:0;
    padding: 44px 40px 160px 40px;
    display:flex; flex-direction:column;
    width:450px;
}}
.badge {{
    display:inline-flex; align-items:center;
    background:{accent}; color:#111;
    font-size:12px; font-weight:700;
    padding:5px 14px; border-radius:20px;
    text-transform:uppercase; letter-spacing:0.8px;
    margin-bottom:16px; align-self:flex-start;
}}
.title {{
    font-family:'Oswald', 'Arial Black', 'Impact', Arial, sans-serif;
    font-size:64px; font-weight:700; color:#fff;
    line-height:1.0;
    text-transform:uppercase; margin-bottom:12px;
    -webkit-text-stroke: 2px rgba(255,255,255,0.15);
    paint-order: stroke fill;
}}
.subtitle {{
    font-size:15px; color:#fff;
    line-height:1.5;
    margin-bottom:auto;
}}
.features {{
    display:flex; flex-direction:column; gap:12px;
    margin-top:24px;
}}
.feat {{
    display:flex; align-items:center; gap:14px;
}}
.feat-icon {{
    width:42px; height:42px; border-radius:50%;
    background:rgba(255,255,255,0.15);
    border:1.5px solid {accent};
    display:flex; align-items:center; justify-content:center;
    font-size:19px; flex-shrink:0;
}}
.feat-text {{
    font-size:13px; font-weight:700; color:#fff;
    text-transform:uppercase; letter-spacing:0.4px;
}}
.texture {{
    position:absolute; bottom:36px; left:40px;
    width:92px; height:92px; border-radius:50%;
    overflow:hidden;
    border:2.5px solid {accent};
    background-image:url('{image_url}');
    background-size:320%; background-position:center;
}}
</style></head>
<body>
<div class="content">
    {badge_html}
    <div class="title">{name}</div>
    {subtitle_html}
    <div class="features">{features_html}</div>
</div>
<div class="texture"></div>
</body></html>"""


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

    # ── Auto-detect background brightness (left 450px = text area) ──
    bg_arr   = np.array(pil_img.resize((800, 1100), Image.LANCZOS))
    left_avg = bg_arr[:, :450, :].mean()
    is_dark_bg   = left_avg < 140
    title_color  = "#ffffff" if is_dark_bg else TEXT_COLORS.get(scheme, TEXT_COLORS["warm"])["title"]
    sub_color    = "#ffffff" if is_dark_bg else TEXT_COLORS.get(scheme, TEXT_COLORS["warm"])["subtitle"]
    feat_color   = "#ffffff" if is_dark_bg else TEXT_COLORS.get(scheme, TEXT_COLORS["warm"])["feat"]
    badge_text_c = "#111111"
    print(f"[Cairo] bg brightness={left_avg:.1f} → {'dark' if is_dark_bg else 'light'} → text={title_color}")

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

    els = []

    # ── Badge ──────────────────────────────────────────────
    if badge:
        bw = min(max(len(badge) * 9 + 28, 80), 380)
        els.append(f'<rect x="40" y="44" width="{bw}" height="28" rx="14" fill="{accent}"/>')
        els.append(
            f'<text x="{40 + bw // 2}" y="63" text-anchor="middle" '
            f'font-family="Arial, Liberation Sans, sans-serif" '
            f'font-size="12" font-weight="700" fill="{badge_text_c}">{badge}</text>'
        )

    # ── Title ──────────────────────────────────────────────
    title_lines = _svg_wrap(name, max_chars=11)
    ty = 108
    for line in title_lines:
        els.append(
            f'<text x="40" y="{ty}" '
            f'font-family="\'Arial Black\', \'Liberation Sans\', \'DejaVu Sans\', sans-serif" '
            f'font-size="62" font-weight="900" fill="{title_color}">{line}</text>'
        )
        ty += 68

    # ── Subtitle ───────────────────────────────────────────
    if subtitle_raw:
        # Decorative accent line above subtitle
        els.append(
            f'<line x1="40" y1="{ty + 10}" x2="140" y2="{ty + 10}" '
            f'stroke="{accent}" stroke-width="2.5"/>'
        )
        sy = ty + 28
        for line in _svg_wrap(subtitle_raw, max_chars=38):
            els.append(
                f'<text x="40" y="{sy}" '
                f'font-family="Arial, Liberation Sans, sans-serif" '
                f'font-size="15" fill="{sub_color}">{line}</text>'
            )
            sy += 22

    # ── Features ───────────────────────────────────────────
    # 5 rows × 62px, anchored above thumbnail (top of thumbnail = 974, gap 36)
    if feats:
        feat_h    = 62
        fz_bottom = 938
        fz_top    = max(fz_bottom - len(feats) * feat_h, 550)

        for idx, feat in enumerate(feats):
            cy = fz_top + idx * feat_h + 21

            # Separator line between features (not before first)
            if idx > 0:
                els.append(
                    f'<line x1="40" y1="{cy - 27}" x2="420" y2="{cy - 27}" '
                    f'stroke="white" stroke-opacity="0.2" stroke-width="1"/>'
                )

            # Filled icon circle (solid accent color)
            els.append(f'<circle cx="61" cy="{cy}" r="21" fill="{accent}"/>')

            # Emoji inside circle
            els.append(
                f'<text x="61" y="{cy + 7}" text-anchor="middle" '
                f'font-family="Noto Color Emoji, Segoe UI Emoji, Apple Color Emoji, sans-serif" '
                f'font-size="17">{feat["icon"]}</text>'
            )

            # Feature text — up to 2 lines
            flines = _svg_wrap(feat["text"], max_chars=24)
            if len(flines) == 1:
                els.append(
                    f'<text x="92" y="{cy + 6}" '
                    f'font-family="Arial, Liberation Sans, sans-serif" '
                    f'font-size="14" font-weight="700" fill="{feat_color}">{flines[0]}</text>'
                )
            else:
                els.append(
                    f'<text x="92" y="{cy - 4}" '
                    f'font-family="Arial, Liberation Sans, sans-serif" '
                    f'font-size="14" font-weight="700" fill="{feat_color}">{flines[0]}</text>'
                )
                els.append(
                    f'<text x="92" y="{cy + 13}" '
                    f'font-family="Arial, Liberation Sans, sans-serif" '
                    f'font-size="14" font-weight="700" fill="{feat_color}">{flines[1]}</text>'
                )

    # ── Thumbnail circle (pre-cropped as circular PNG in PIL) ─
    els.append(
        f'<image href="{thumb_uri}" x="37" y="974" width="88" height="88"/>'
    )
    els.append(
        f'<circle cx="81" cy="1018" r="44" fill="none" '
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


async def render_card_playwright(image_b64: str, card: dict) -> str | None:
    """Render card HTML with Playwright and return base64 JPEG."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[Playwright] Not installed, skipping render")
        return None

    scheme = card.get("scheme", "warm")
    accent = ACCENT_COLORS.get(scheme, "#d4a017")
    tc = TEXT_COLORS.get(scheme, TEXT_COLORS["warm"])

    import io as _io
    raw_bytes = base64.b64decode(image_b64)

    # Save texture image for the circle (file:// for HTML)
    img_filename = f"{uuid.uuid4().hex}.jpg"
    img_path = os.path.join(TEMP_DIR, img_filename)
    with open(img_path, "wb") as f:
        f.write(raw_bytes)
    asyncio.create_task(_delete_after(img_path, 120))
    image_url = f"file://{img_path}"

    # Build HTML parts
    badge = card.get("badge", "")
    badge_html = f'<div class="badge">{badge}</div>' if badge else ""
    subtitle = card.get("subtitle", "")
    subtitle_html = f'<div class="subtitle">{subtitle}</div>' if subtitle else ""

    feats = []
    # Поддержка нового формата: массив features [{icon, text}]
    for i in range(1, 6):
        feat = card.get(f"feat{i}", "")
        icon = card.get(f"icon{i}", "✦")
        if feat:
            feats.append(f'<div class="feat"><div class="feat-icon">{icon}</div><div class="feat-text">{feat.upper()}</div></div>')
    print(f"[Card] feats built: {len(feats)} items")
    features_html = "\n".join(feats)

    html = CARD_HTML_TEMPLATE.format(
        image_url=image_url,
        accent=accent,
        name=card.get("name", "").upper(),
        badge_html=badge_html,
        subtitle_html=subtitle_html,
        features_html=features_html,
    )

    print(f"[Playwright] HTML size={len(html)//1024}KB, scheme={scheme}")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=[
                "--no-sandbox", "--disable-setuid-sandbox",
                "--disable-dev-shm-usage", "--disable-gpu",
                "--disable-font-subpixel-positioning",
                "--force-color-profile=srgb",
            ])
            page = await browser.new_page(viewport={"width": 800, "height": 1100})
            await page.route("**://fonts.googleapis.com/**", lambda route: route.abort())
            await page.route("**://fonts.gstatic.com/**", lambda route: route.abort())
            await page.set_content(html, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(400)

            # Two-render alpha extraction: render on black, then white background.
            # This gives mathematically exact alpha with zero dark-halo artifacts.
            await page.evaluate(
                "document.documentElement.style.background='#000';"
                "document.body.style.background='#000';"
            )
            await page.wait_for_timeout(100)
            black_png = await page.screenshot(
                type="png", clip={"x": 0, "y": 0, "width": 800, "height": 1100}
            )

            await page.evaluate(
                "document.documentElement.style.background='#fff';"
                "document.body.style.background='#fff';"
            )
            await page.wait_for_timeout(100)
            white_png = await page.screenshot(
                type="png", clip={"x": 0, "y": 0, "width": 800, "height": 1100}
            )

            await browser.close()

        # Extract true RGBA overlay from two renders:
        #   alpha = 1 - (white_render - black_render) / 255
        #   color = black_render / alpha
        from PIL import Image
        import numpy as np
        b_img = np.array(Image.open(_io.BytesIO(black_png)).convert("RGB")).astype(np.float32)
        w_img = np.array(Image.open(_io.BytesIO(white_png)).convert("RGB")).astype(np.float32)

        diff = np.clip(w_img - b_img, 0, 255)           # white - black per channel
        alpha = np.max(1.0 - diff / 255.0, axis=2)      # alpha = max across R,G,B
        alpha = np.clip(alpha, 0.0, 1.0)

        alpha_safe = np.where(alpha > 1e-3, alpha, 1.0)
        r_ch = np.clip(b_img[:, :, 0] / alpha_safe, 0, 255)
        g_ch = np.clip(b_img[:, :, 1] / alpha_safe, 0, 255)
        b_ch = np.clip(b_img[:, :, 2] / alpha_safe, 0, 255)
        a_ch = np.clip(alpha * 255, 0, 255)
        a_ch[alpha <= 1e-3] = 0  # fully transparent where no content

        # Remove dark semi-transparent pixels (anti-aliasing artifacts from subpixel rendering).
        # Dark = luminance < 80, semi-transparent = alpha < 230.
        # Fully-opaque dark pixels (badge text etc.) are kept (alpha >= 230).
        luminance = (r_ch + g_ch + b_ch) / 3.0
        dark_semi = (luminance < 80) & (a_ch < 230)
        a_ch[dark_semi] = 0

        overlay = Image.fromarray(
            np.stack([r_ch, g_ch, b_ch, a_ch], axis=2).astype(np.uint8), "RGBA"
        )

        # Composite onto background photo
        bg = Image.open(_io.BytesIO(raw_bytes)).convert("RGBA")
        bg = bg.resize((800, 1100), Image.LANCZOS)
        bg.paste(overlay, (0, 0), overlay)
        out = _io.BytesIO()
        bg.convert("RGB").save(out, format="JPEG", quality=93)
        b64 = base64.b64encode(out.getvalue()).decode()
        print(f"[Playwright] Card composited successfully ({len(out.getvalue())//1024}KB)")
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        print(f"[Playwright] Render error: {e}")
        import traceback; traceback.print_exc()
        return None


async def health_handler(request):
    return web.Response(text="OK", headers=CORS_HEADERS)


async def test_playwright_handler(request):
    """Quick Playwright smoke test — open in browser to check if it works."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return web.Response(text="ERROR: playwright not installed", headers=CORS_HEADERS)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"])
            page = await browser.new_page()
            await page.set_content("<h1>Playwright OK</h1>", wait_until="domcontentloaded")
            await browser.close()
        return web.Response(text="OK: Playwright works", headers=CORS_HEADERS)
    except Exception as e:
        import traceback
        return web.Response(text=f"ERROR: {e}\n{traceback.format_exc()}", headers=CORS_HEADERS)


def create_app() -> web.Application:
    app = web.Application(client_max_size=10 * 1024 * 1024)
    app.router.add_get("/health", health_handler)
    app.router.add_get("/test-playwright", test_playwright_handler)
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
