from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart
from bot.database import create_user, get_user, get_coins
from bot.config import WEBAPP_URL, START_COINS

router = Router()

@router.message(CommandStart())
async def start(message: Message):
    user_id = message.from_user.id
    username = message.from_user.username or message.from_user.first_name

    await create_user(user_id, username)
    coins = await get_coins(user_id)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎨 Открыть Mirage AI",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])

    await message.answer(
        f"👋 Добро пожаловать в *Mirage AI*, {message.from_user.first_name}!\n\n"
        f"✨ *Как это работает:*\n"
        f"1️⃣ Отправь своё фото в этот чат\n"
        f"2️⃣ Выбери шаблон в мини-апп\n"
        f"3️⃣ AI создаст твой уникальный образ!\n\n"
        f"👇 *Отправь своё фото прямо сейчас!*\n\n"
        f"🪙 Твой баланс: *{coins} монет*",
        reply_markup=kb,
        parse_mode="Markdown"
    )
