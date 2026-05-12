from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command
from bot.database import get_coins

router = Router()

@router.message(Command("balance"))
async def balance(message: Message):
    coins = await get_coins(message.from_user.id)
    await message.answer(
        f"🪙 Твой баланс: *{coins} монет*\n\n"
        f"Пополнить баланс: /buy",
        parse_mode="Markdown"
    )

@router.message(Command("buy"))
async def buy(message: Message):
    await message.answer(
        "💳 *Покупка монет:*\n\n"
        "🪙 50 монет — 99₽\n"
        "🪙 120 монет — 199₽\n"
        "🪙 300 монет — 399₽\n\n"
        "_(Оплата через Telegram Stars — скоро)_",
        parse_mode="Markdown"
    )
