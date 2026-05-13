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
                "filling 70% of the frame. The top and bottom parts are separated and displayed together. "
                "Every part of the fabric is touching the surface — NO parts floating, hovering or hanging in air. "
                "NO hanger anywhere. Viewed from slightly above (40-degree angle). "
                "Soft drop shadow beneath the fabric edges."
            ),
            "accessories": (
                "is placed upright and prominently on the surface, hero shot angle, filling 65% of the frame. "
                "Firmly resting on the surface with a soft shadow beneath. NOT floating."
            ),
            "food": (
                "is placed on the surface surrounded by the scene props, filling 65% of the frame. "
                "Firmly on the surface. Appetizing food photography angle."
            ),
            "beauty": (
                "is standing upright on the surface, hero beauty shot, filling 65% of the frame. "
                "Firmly on the surface. Soft specular highlights on packaging. NOT floating."
            ),
            "gadgets": (
                "is placed at a 45-degree hero angle on the surface, filling 65% of the frame. "
                "Firmly on the surface. Premium tech product shot. NOT floating."
            ),
            "home": (
                "is placed naturally on the surface as it would be used, filling 65% of the frame. "
                "Firmly on the surface. Lifestyle product photography. NOT floating."
            ),
            "other": (
                "is placed prominently on the surface, filling 65% of the frame. "
                "Firmly on the surface with soft shadow beneath. NOT floating."
            ),
        }
        placement_instruction = PLACEMENT.get(category, PLACEMENT["other"])

        place_prompt = (
            f"Take the {product_name} from the reference image and integrate it into this scene: {scene_prompt}. "
            f"The {product_name} {placement_instruction} "
            f"Preserve the exact colors, pattern and details of the original {product_name}. "
            f"The props from the scene (cup, candles, books etc.) remain visible around the product. "
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
    """Try Playwright render; fall back to raw image if unavailable."""
    if not image_b64:
        return image_b64
    raw_b64 = image_b64.split(",", 1)[1] if image_b64.startswith("data:") else image_b64
    if card_data:
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
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:800px; height:1100px; overflow:hidden; }}
body {{ font-family: Arial, sans-serif; position:relative; background:#111; }}
.bg {{
    position:absolute; inset:0;
    background-image: url('{image_url}');
    background-size: cover;
    background-position: center right;
    filter: brightness(1.1);
}}
.content {{
    position:absolute; inset:0;
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
    font-size:64px; font-weight:700; color:{title_color};
    line-height:1.0;
    text-transform:uppercase; margin-bottom:12px;
}}
.subtitle {{
    font-size:15px; color:{subtitle_color};
    line-height:1.5;
    margin-bottom:auto;
}}
.features {{
    display:flex; flex-direction:column; gap:18px;
    margin-top:36px;
}}
.feat {{
    display:flex; align-items:center; gap:14px;
}}
.feat-icon {{
    width:48px; height:48px; border-radius:50%;
    background:rgba(255,255,255,0.15);
    border:1.5px solid {accent};
    display:flex; align-items:center; justify-content:center;
    font-size:22px; flex-shrink:0;
}}
.feat-text {{
    font-size:15px; font-weight:700; color:{feat_color};
    text-transform:uppercase; letter-spacing:0.4px;
}}
.texture {{
    position:absolute; bottom:36px; left:40px;
    width:92px; height:92px; border-radius:50%;
    overflow:hidden;
    border:2.5px solid {accent};
    box-shadow:0 4px 20px rgba(0,0,0,0.3);
    background-image:url('{image_url}');
    background-size:320%; background-position:center;
}}
</style></head>
<body>
<div class="bg"></div>
<div class="content">
    {badge_html}
    <div class="title">{name}</div>
    {subtitle_html}
    <div class="features">{features_html}</div>
</div>
<div class="texture"></div>
</body></html>"""


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

    # Save image to temp file and use file:// URL — reliable, no HTTP needed
    img_filename = f"{uuid.uuid4().hex}.jpg"
    img_path = os.path.join(TEMP_DIR, img_filename)
    with open(img_path, "wb") as f:
        f.write(base64.b64decode(image_b64))
    asyncio.create_task(_delete_after(img_path, 120))
    image_url = f"file://{img_path}"

    # Build HTML parts
    badge = card.get("badge", "")
    badge_html = f'<div class="badge">{badge}</div>' if badge else ""
    subtitle = card.get("subtitle", "")
    subtitle_html = f'<div class="subtitle">{subtitle}</div>' if subtitle else ""

    feats = []
    for i in range(1, 4):
        feat = card.get(f"feat{i}", "")
        icon = card.get(f"icon{i}", "✦")
        if feat:
            feats.append(f'<div class="feat"><div class="feat-icon">{icon}</div><div class="feat-text">{feat}</div></div>')
    features_html = "\n".join(feats)

    html = CARD_HTML_TEMPLATE.format(
        image_url=image_url,
        accent=accent,
        title_color=tc["title"],
        subtitle_color=tc["subtitle"],
        feat_color=tc["feat"],
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
                "--disable-dev-shm-usage", "--disable-gpu"
            ])
            page = await browser.new_page(viewport={"width": 800, "height": 1100})
            # No external resources — block fonts to be safe
            await page.route("**://fonts.googleapis.com/**", lambda route: route.abort())
            await page.route("**://fonts.gstatic.com/**", lambda route: route.abort())
            await page.set_content(html, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(500)
            screenshot = await page.screenshot(type="jpeg", quality=92,
                                               clip={"x":0,"y":0,"width":800,"height":1100})
            await browser.close()

        b64 = base64.b64encode(screenshot).decode()
        print(f"[Playwright] Card rendered successfully ({len(screenshot)//1024}KB)")
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
