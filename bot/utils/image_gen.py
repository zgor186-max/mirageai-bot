import asyncio
import os


async def save_result(image_bytes: bytes, user_id: int) -> str:
    os.makedirs("results", exist_ok=True)
    path = f"results/{user_id}_{asyncio.get_event_loop().time():.0f}.jpg"
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path
