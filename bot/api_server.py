import asyncio
import aiohttp
from aiohttp import web
import os
import json

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")
REPLICATE_MODEL = "black-forest-labs/flux-kontext-schnell"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


async def generate_handler(request):
    # Preflight CORS
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

        # Ensure data URI format
        if not photo_b64.startswith("data:"):
            photo_b64 = "data:image/jpeg;base64," + photo_b64

        image_url = await call_replicate(photo_b64, prompt)

        if not image_url:
            return web.json_response(
                {"error": "Generation failed"},
                status=500,
                headers=CORS_HEADERS,
            )

        return web.json_response({"url": image_url}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


async def call_replicate(photo_b64: str, prompt: str) -> str | None:
    headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",  # ждём результата синхронно (до 60 сек)
    }

    payload = {
        "input": {
            "prompt": prompt,
            "input_image": photo_b64,
            "aspect_ratio": "custom",
            "width": 800,
            "height": 1100,
            "output_format": "jpg",
            "output_quality": 90,
            "num_inference_steps": 4,
            "guidance": 3.5,
            "go_fast": True,
            "megapixels": "1",
        }
    }

    timeout = aiohttp.ClientTimeout(total=120)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            headers=headers,
            json=payload,
        ) as resp:
            result = await resp.json()
            print(f"[Replicate] status={result.get('status')} id={result.get('id')}")

            status = result.get("status")

            if status == "succeeded":
                return _extract_output(result)

            if status in ("starting", "processing"):
                # Prefer: wait не сработал — поллим вручную
                return await _poll(session, result.get("id"), headers)

            print(f"[Replicate] error: {result.get('error')}")
            return None


async def _poll(session, prediction_id: str, headers: dict) -> str | None:
    for _ in range(40):  # 40 × 3s = 2 минуты максимум
        await asyncio.sleep(3)
        async with session.get(
            f"https://api.replicate.com/v1/predictions/{prediction_id}",
            headers=headers,
        ) as resp:
            result = await resp.json()
            status = result.get("status")
            print(f"[Replicate] poll status={status}")

            if status == "succeeded":
                return _extract_output(result)
            if status == "failed":
                print(f"[Replicate] failed: {result.get('error')}")
                return None
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
    app = web.Application()
    app.router.add_get("/health", health_handler)
    app.router.add_post("/generate", generate_handler)
    app.router.add_route("OPTIONS", "/generate", generate_handler)
    return app


async def start_api_server():
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()
    print("[API] Server started on http://0.0.0.0:8080")
