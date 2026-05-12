import asyncio
import aiohttp
import base64
from aiohttp import web
import os

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")
REPLICATE_MODEL = "black-forest-labs/flux-kontext-pro"
REPLICATE_TEXT2IMG = "black-forest-labs/flux-1.1-pro"
FACESWAP_VERSION = "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34"

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

        if not photo_b64 or not scene_prompt:
            return web.json_response({"error": "photo and scene_prompt required"}, status=400, headers=CORS_HEADERS)

        if photo_b64.startswith("data:"):
            photo_b64 = photo_b64.split(",", 1)[1]

        print(f"[Card] scene_prompt={scene_prompt[:80]}")

        place_prompt = (
            f"Place the {product_name} from the reference image naturally into this scene: {scene_prompt}. "
            f"The product rests firmly on the surface with a soft realistic shadow beneath it. "
            f"The product is fully integrated into the scene, not floating in the air. "
            f"Keep the product's exact appearance, colors and details. "
            f"Photorealistic commercial product photography. NO text, NO watermarks."
        )

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=300)) as session:
                # Step 1: Generate background scene (no product)
                print(f"[Card] Step 1 — generating scene")
                bg_url = await call_text2img(session, scene_prompt)

                if bg_url:
                    print(f"[Card] Step 1 done: {bg_url[:60]}")
                    print(f"[Card] Step 2 — placing product in scene")

                    # Try to upload product photo; fall back to data URI if upload fails
                    product_url = await upload_image_to_replicate(session, photo_b64)
                    if not product_url:
                        print("[Card] Upload failed, using base64 data URI for product")
                        product_url = f"data:image/jpeg;base64,{photo_b64}"

                    # Download bg and upload (or use data URI fallback)
                    bg_b64 = await download_as_b64(session, bg_url)
                    if bg_b64:
                        bg_upload_url = await upload_image_to_replicate(session, bg_b64)
                        if not bg_upload_url:
                            print("[Card] BG upload failed, using base64 data URI")
                            bg_upload_url = f"data:image/jpeg;base64,{bg_b64}"
                    else:
                        bg_upload_url = None

                    result_url = await call_kontext_two_images(session, product_url, bg_upload_url, place_prompt)

                    if result_url:
                        image_b64 = await download_image_as_base64(result_url)
                        print(f"[Card] Two-step done ✓")
                        return web.json_response({"url": image_b64 or result_url}, headers=CORS_HEADERS)

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
        return web.json_response({"url": image_b64 or result_url}, headers=CORS_HEADERS)

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
        async with session.post(
            f"https://api.replicate.com/v1/models/{REPLICATE_TEXT2IMG}/predictions",
            headers=api_headers,
            json=payload,
        ) as resp:
            result = await resp.json(content_type=None)
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
    # flux-kontext-pro supports input_images array
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
        async with session.post(
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            headers=api_headers,
            json=payload,
        ) as resp:
            raw = await resp.text()
            print(f"[Kontext2] HTTP={resp.status} raw={raw[:200]}")
            result = await resp.json(content_type=None)
            status = result.get("status")
            pred_id = result.get("id")
            if status == "succeeded":
                return _extract_output(result)
            if status in ("starting", "processing"):
                return await _poll(session, pred_id, api_headers)
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


async def upload_image_to_replicate(session: aiohttp.ClientSession, photo_b64: str) -> str | None:
    # Skip upload if already a data URI
    if photo_b64.startswith("data:"):
        return None
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
            print(f"[Replicate] uploaded file url={url}")
            return url
    except Exception as e:
        print(f"[Replicate] file upload failed: {e}")
        return None


async def call_replicate(photo_b64: str, prompt: str) -> str | None:
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }

    timeout = aiohttp.ClientTimeout(total=180)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        image_url = await upload_image_to_replicate(session, photo_b64)

        if not image_url:
            image_url = "data:image/jpeg;base64," + photo_b64
            print("[Replicate] using base64 fallback")

        payload = {
            "input": {
                "prompt": prompt,
                "input_image": image_url,
                "aspect_ratio": "3:4",
                "output_format": "jpg",
                "safety_tolerance": 2,
            }
        }

        async with session.post(
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            headers=api_headers,
            json=payload,
        ) as resp:
            raw = await resp.text()
            print(f"[Replicate] HTTP={resp.status} raw={raw[:300]}")
            try:
                result = await resp.json(content_type=None)
            except Exception:
                import json
                result = json.loads(raw)

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
            print(f"[Replicate] unexpected: {raw[:300]}")
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


async def health_handler(request):
    return web.Response(text="OK", headers=CORS_HEADERS)


def create_app() -> web.Application:
    app = web.Application(client_max_size=10 * 1024 * 1024)
    app.router.add_get("/health", health_handler)
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
