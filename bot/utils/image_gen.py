import aiohttp
import asyncio
import base64
import os
from bot.config import POLZA_KEY

POLZA_URL = "https://polza.ai/api/v1/media"

async def generate_image(user_photo_bytes: bytes, prompt: str) -> bytes | None:
    photo_b64 = base64.b64encode(user_photo_bytes).decode("utf-8")

    headers = {
        "Authorization": f"Bearer {POLZA_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "google/gemini-3.1-flash-image-preview",
        "prompt": f"Transform the person in this photo: {prompt}. Keep the face and identity of the person exactly the same, only change the style and background.",
        "images": [
            {
                "data": photo_b64,
                "media_type": "image/jpeg"
            }
        ]
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(POLZA_URL, headers=headers, json=payload) as resp:
            if resp.status != 200:
                error = await resp.text()
                print(f"Polza API error {resp.status}: {error}")
                return None

            result = await resp.json()
            print(f"Polza response: {result}")

            # Получаем URL изображения из ответа
            image_url = None
            if "data" in result and len(result["data"]) > 0:
                image_url = result["data"][0].get("url")
            elif "url" in result:
                image_url = result["url"]

            if not image_url:
                print(f"No image URL in response: {result}")
                return None

            # Скачиваем изображение
            async with session.get(image_url) as img_resp:
                if img_resp.status == 200:
                    return await img_resp.read()
                return None

async def save_result(image_bytes: bytes, user_id: int) -> str:
    os.makedirs("results", exist_ok=True)
    path = f"results/{user_id}_{asyncio.get_event_loop().time():.0f}.jpg"
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path
