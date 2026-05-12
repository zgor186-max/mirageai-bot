import json
import base64
import aiohttp
from aiogram import Router, F, Bot
from aiogram.types import Message, BufferedInputFile
from bot.database import get_coins, spend_coins, save_history
from bot.utils.image_gen import save_result
from bot.templates import TEMPLATES

router = Router()

@router.message(F.web_app_data)
async def handle_webapp_data(message: Message, bot: Bot):
    try:
        data = json.loads(message.web_app_data.data)
        action = data.get("action")

        if action == "result":
            user_id = message.from_user.id
            result_url = data.get("result_url", "")
            template_id = data.get("template_id", 0)
            template_name = data.get("template_name", "Карточка товара")

            if not result_url:
                await message.answer("❌ Ошибка: нет изображения.")
                return

            wait_msg = await message.answer("⏳ Сохраняю результат...")

            # Получаем байты изображения
            if result_url.startswith("data:"):
                # Base64 изображение (карточка товара)
                header, b64data = result_url.split(",", 1)
                image_bytes = base64.b64decode(b64data)
            else:
                # Обычный URL (face swap)
                async with aiohttp.ClientSession() as session:
                    async with session.get(result_url) as resp:
                        image_bytes = await resp.read()

            # Списываем монеты только для шаблонов
            template = next((t for t in TEMPLATES if t["id"] == template_id), None)
            caption = f"✅ *{template_name}* готово!"

            if template and not data.get("already_paid"):
                coins = await get_coins(user_id)
                price = template["price"]
                if coins < price:
                    await message.answer(
                        f"❌ Недостаточно монет!\nНужно: *{price}*, у тебя: *{coins}*",
                        parse_mode="Markdown"
                    )
                    return
                await spend_coins(user_id, price)
                remaining = await get_coins(user_id)
                caption += f"\n🪙 Списано {price} монет. Остаток: *{remaining}*"

            await bot.delete_message(message.chat.id, wait_msg.message_id)

            photo = BufferedInputFile(image_bytes, filename="result.jpg")
            await message.answer_photo(
                photo=photo,
                caption=caption,
                parse_mode="Markdown"
            )

    except Exception as e:
        print(f"Error in handle_webapp_data: {e}")
        import traceback
        traceback.print_exc()
        await message.answer("❌ Произошла ошибка. Попробуй ещё раз.")
