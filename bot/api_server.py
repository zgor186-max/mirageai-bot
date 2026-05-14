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

        # Category-specific placement — professional angles per product type
        PLACEMENT = {
            "clothing": (
                "is hanging on a wooden hanger, full-length frontal view, "
                "gentle natural fabric drape clearly showing texture and fit. "
                "Camera at eye-level with a slight 5-degree downward tilt. "
                "The complete garment — top and bottom — fully visible, filling the RIGHT 55% of the frame. "
                "The LEFT 40% of the frame is a clean, light, uncluttered background for text overlay. "
                "Soft directional light from upper-left. Natural shadow grounds the product."
            ),
            "footwear": (
                "is shown as a pair placed together, left shoe slightly in front, "
                "at a 3/4 front-side angle — camera 30 degrees from the side and 20 degrees above. "
                "Both shoes completely visible, sole edge slightly showing to convey depth. "
                "The shoes stand firmly on the surface — NOT floating, NOT disassembled. "
                "Filling the RIGHT 55% of the frame. "
                "The LEFT 40% is a clean, light background for text overlay. "
                "Sharp focus preserving exact original colors, patterns and sole design."
            ),
            "accessories": (
                "is positioned at a 45-degree rotation, camera 15 degrees above eye-level, "
                "showing both the front face and side profile simultaneously. "
                "All handles, straps or key design elements clearly visible. "
                "Filling the RIGHT 50% of the frame, firmly on the surface. "
                "The LEFT 40% is a clean, light background for text overlay."
            ),
            "food": (
                "Packaged food: eye-level shot, front label fully facing the camera, filling RIGHT 50%. "
                "Fresh or prepared food: 45-degree overhead flat lay, beautiful arrangement with props. "
                "Drinks: eye-level with condensation droplets visible. "
                "The LEFT 40% is a clean, light background for text overlay."
            ),
            "beauty": (
                "is standing upright with the label directly facing the camera, eye-level shot (0-degree elevation). "
                "If multiple items — arranged in a tight triangular group. "
                "Cap or lid clean and fully visible. Filling the RIGHT 50% of the frame. "
                "The LEFT 40% is a clean, light background for text overlay. "
                "Soft light from upper-left, subtle highlight on packaging."
            ),
            "gadgets": (
                "is shown at a 3/4 rear-side hero angle — camera 40 degrees above, 35 degrees from the side. "
                "The screen or main surface is angled toward the viewer showing depth and premium feel. "
                "Dynamic perspective revealing key product features. Filling the RIGHT 50% of the frame. "
                "The LEFT 40% is a clean, dark or gradient background for text overlay. "
                "Dramatic lighting with edge highlight emphasising the form."
            ),
            "home": (
                "is shown in its natural context of use, camera at 30-40 degree angle revealing depth and form. "
                "Textiles: gently draped or folded showing texture and material quality. "
                "Furniture: perspective angle showing all key dimensions. "
                "Filling the RIGHT 50% of the frame. "
                "The LEFT 40% is a clean, light background for text overlay."
            ),
            "other": (
                "is placed prominently on the RIGHT side of the frame at its most flattering angle, "
                "filling 50% of the total frame, firmly on the surface. "
                "The LEFT 40% is a clean, light background for text overlay."
            ),
        }
        placement_instruction = PLACEMENT.get(category, PLACEMENT["other"])

        place_prompt = (
            f"Take the COMPLETE product shown in the reference image and integrate it into this scene: {scene_prompt}. "
            f"The product {placement_instruction} "
            f"CRITICAL — QUANTITY: show EXACTLY the same number of items as in the reference — do NOT reduce, merge or remove any. "
            f"CRITICAL — INTEGRITY: reproduce every part, every component exactly — same shape, colors, patterns, textures. "
            f"CRITICAL — LEFT SIDE: LEFT 40% of frame must be clean and uncluttered — suitable for text overlay. "
            f"LIGHTING: soft directional light from upper-left, natural shadow grounding the product on the surface. "
            f"FOCUS: sharp focus on product, background slightly softened (shallow depth of field). "
            f"Photorealistic commercial product photography. NO text, NO watermarks, NO extra objects."
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
    """Marketplace-style card: dynamic color from product, dividers, macro circle."""
    try:
        import cairosvg
    except ImportError:
        return None

    import io as _io
    import numpy as np
    from PIL import Image, ImageDraw as _ImageDraw
    from sklearn.cluster import KMeans

    raw_bytes = base64.b64decode(image_b64)
    pil_img   = Image.open(_io.BytesIO(raw_bytes)).convert("RGB")
    img_arr   = np.array(pil_img)
    H, W      = img_arr.shape[:2]

    # ── 1. KMeans: найти доминирующий цвет товара ────────────────
    small  = np.array(pil_img.resize((150, 200))).reshape(-1, 3).astype(float)
    km     = KMeans(n_clusters=6, n_init=8, random_state=42)
    km.fit(small)
    centers = km.cluster_centers_
    sizes   = np.bincount(km.labels_)

    best, best_score = None, -1
    for i, c in enumerate(centers):
        brightness = float(np.mean(c))
        mx = float(np.max(c))
        sat = (mx - float(np.min(c))) / (mx + 1e-6)
        if 45 < brightness < 215 and sat > 0.12:
            score = sat * (sizes[i] / len(km.labels_))
            if score > best_score:
                best_score, best = score, c

    dr, dg, db = (int(best[0]), int(best[1]), int(best[2])) if best is not None else (120, 90, 60)
    accent_hex = f"#{dr:02x}{dg:02x}{db:02x}"
    dark_hex   = f"#{int(dr*.50):02x}{int(dg*.50):02x}{int(db*.50):02x}"  # текст заголовка
    feat_hex   = f"#{int(dr*.42):02x}{int(dg*.42):02x}{int(db*.42):02x}"  # текст фич

    # ── 2. Яркость левой зоны → светлый или тёмный фон ──────────
    lw = W // 2
    left_bright = float(np.mean(img_arr[200:900, :lw, :]))
    light_bg    = left_bright > 148

    if light_bg:
        t_col  = dark_hex;  s_col = dark_hex;  f_col = feat_hex
        sk_col = accent_hex; sk_w_t = "1.2"; sk_w_f = "0.6"; sk_op = "0.25"
        shd_op = "0.12"
    else:
        t_col  = "#ffffff";  s_col = "#ffffff"; f_col = "#ffffff"
        sk_col = "#000000";  sk_w_t = "5";      sk_w_f = "1.5";  sk_op = "0.85"
        shd_op = "0.90"

    print(f"[Cairo] dominant=({dr},{dg},{db}) bright={left_bright:.0f} light={light_bg}")

    # ── 3. Умная зона для фич ────────────────────────────────────
    ZONES = {
        "mid":    img_arr[400:640, :lw, :],
        "lower":  img_arr[640:860, :lw, :],
        "bottom": img_arr[860:1060, :lw, :],
    }
    zone_std     = {n: float(np.std(z)) for n, z in ZONES.items()}
    best_zone    = min(zone_std, key=zone_std.get)
    ZONE_Y       = {"mid": 420, "lower": 655, "bottom": 875}
    row_gap      = 88
    feat_zone_top = min(ZONE_Y[best_zone], 1080 - 3 * row_gap - 44)

    # ── 4. Данные карточки ───────────────────────────────────────
    badge        = _svg_esc(card.get("badge", ""))
    name         = _svg_esc(card.get("name", "")).upper()
    tagline_raw  = _svg_esc(card.get("tagline", ""))
    subtitle_raw = _svg_esc(card.get("subtitle", ""))

    feats = []
    for i in range(1, 6):
        feat = card.get(f"feat{i}", "")
        icon = card.get(f"icon{i}", "✦")
        if feat:
            # Первая буква заглавная, остальное строчные — как в эталоне
            txt = feat.strip()
            txt = txt[0].upper() + txt[1:].lower() if txt else txt
            feats.append({"icon": icon, "text": _svg_esc(txt)})

    FONT_TITLE = "'Bebas Neue', 'Bebas Neue Bold', sans-serif"
    FONT       = "'Open Sans', 'Liberation Sans', 'DejaVu Sans', sans-serif"
    FONT_EMOJI = "Noto Color Emoji, Segoe UI Emoji, Apple Color Emoji, sans-serif"

    els = []

    # Shadow filter
    els.append(
        f'<defs><filter id="ts" x="-10%" y="-10%" width="130%" height="130%">'
        f'<feDropShadow dx="0" dy="1" stdDeviation="2" '
        f'flood-color="#000" flood-opacity="{shd_op}"/>'
        f'</filter></defs>'
    )

    # ── Бейдж: сверху-слева ──────────────────────────────────────
    if badge:
        bw = min(len(badge) * 11 + 34, 280)
        els.append(f'<rect x="28" y="26" width="{bw}" height="32" rx="16" fill="{accent_hex}"/>')
        els.append(
            f'<text x="{28 + bw//2}" y="48" text-anchor="middle" '
            f'font-family="{FONT}" font-size="13" font-weight="700" '
            f'letter-spacing="0.8" fill="#ffffff">{badge}</text>'
        )

    # ── Заголовок: Bebas Neue, левый край, цветной ───────────────
    ty = 88
    for line in _svg_wrap(name, max_chars=14):
        els.append(
            f'<text x="28" y="{ty}" '
            f'font-family="{FONT_TITLE}" font-size="110" font-weight="700" '
            f'fill="{t_col}" stroke="{sk_col}" stroke-width="{sk_w_t}" '
            f'stroke-opacity="{sk_op}" paint-order="stroke fill" '
            f'filter="url(#ts)">{line}</text>'
        )
        ty += 115

    # ── Tagline: italic, 2 строки ────────────────────────────────
    if tagline_raw:
        ty += 10
        for line in _svg_wrap(tagline_raw, max_chars=36)[:2]:
            els.append(
                f'<text x="28" y="{ty}" font-family="{FONT}" font-size="22" '
                f'font-style="italic" fill="{s_col}" '
                f'stroke="{sk_col}" stroke-width="0.6" stroke-opacity="0.15" '
                f'paint-order="stroke fill">{line}</text>'
            )
            ty += 30

    # ── Слоган ───────────────────────────────────────────────────
    if subtitle_raw:
        ty += 6
        els.append(
            f'<text x="28" y="{ty}" font-family="{FONT}" font-size="24" '
            f'font-weight="600" fill="{s_col}" '
            f'stroke="{sk_col}" stroke-width="0.8" stroke-opacity="0.15" '
            f'paint-order="stroke fill">{_svg_wrap(subtitle_raw, max_chars=30)[0]}</text>'
        )
        ty += 34

    # ── Фичи: левая колонка, разделители, 2 строки ───────────────
    if feats:
        feats = feats[:4]
        feat_r    = 26
        feat_fs   = 20
        feat_lh   = 24
        feat_icon = 20
        cx_f      = 54
        tx_f      = 92

        for idx, feat in enumerate(feats):
            cy = feat_zone_top + idx * row_gap

            # Разделитель
            if idx > 0:
                els.append(
                    f'<line x1="{cx_f - feat_r}" y1="{cy - 15}" x2="340" y2="{cy - 15}" '
                    f'stroke="{accent_hex}" stroke-width="0.8" stroke-opacity="0.35"/>'
                )
            # Круг + иконка
            els.append(f'<circle cx="{cx_f}" cy="{cy}" r="{feat_r}" fill="{accent_hex}"/>')
            els.append(
                f'<text x="{cx_f}" y="{cy + 7}" text-anchor="middle" '
                f'font-family="{FONT_EMOJI}" font-size="{feat_icon}" '
                f'filter="url(#ts)">{feat["icon"]}</text>'
            )
            # Текст: 2 строки
            flines = _svg_wrap(feat["text"], max_chars=22)[:2]
            start_y = cy - (len(flines) - 1) * feat_lh // 2
            for li, fl in enumerate(flines):
                els.append(
                    f'<text x="{tx_f}" y="{start_y + li * feat_lh}" '
                    f'font-family="{FONT}" font-size="{feat_fs}" font-weight="700" '
                    f'fill="{f_col}" stroke="{sk_col}" stroke-width="{sk_w_f}" '
                    f'stroke-opacity="{sk_op}" paint-order="stroke fill" '
                    f'filter="url(#ts)">{fl}</text>'
                )

    # Макро-кружок удалён навсегда — не восстанавливать

    # ── Сборка SVG ───────────────────────────────────────────────
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'xmlns:xlink="http://www.w3.org/1999/xlink" '
        'width="800" height="1100">\n'
        + "\n".join(els) + "\n</svg>"
    )

    print(f"[Cairo] SVG {len(svg)//1024}KB feats={len(feats)} zone={best_zone}")

    try:
        overlay_png = cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            output_width=800, output_height=1100,
        )
    except Exception as e:
        print(f"[Cairo] svg2png error: {e}")
        import traceback; traceback.print_exc()
        return None

    bg = Image.open(_io.BytesIO(raw_bytes)).convert("RGBA")
    bg = bg.resize((800, 1100), Image.LANCZOS)
    overlay = Image.open(_io.BytesIO(overlay_png)).convert("RGBA")
    bg.paste(overlay, (0, 0), overlay)
    out = _io.BytesIO()
    bg.convert("RGB").save(out, format="JPEG", quality=93)
    b64 = base64.b64encode(out.getvalue()).decode()
    print(f"[Cairo] OK ({len(out.getvalue())//1024}KB)")
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
