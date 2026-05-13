import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from bot.config import BOT_TOKEN
from bot.database import init_db
from bot.handlers import start, generate, balance
from bot.api_server import start_api_server

logging.basicConfig(level=logging.INFO)


async def main():
    await init_db()

    # Запускаем API сервер для webapp
    await start_api_server()

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="Markdown"))
    dp = Dispatcher()

    dp.include_router(start.router)
    dp.include_router(generate.router)
    dp.include_router(balance.router)

    print("Bot started!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
