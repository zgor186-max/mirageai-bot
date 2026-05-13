import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.exceptions import TelegramNetworkError
from bot.config import BOT_TOKEN
from bot.database import init_db
from bot.handlers import start, generate, balance
from bot.api_server import start_api_server

logging.basicConfig(level=logging.INFO)


async def main():
    await init_db()
    await start_api_server()

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="Markdown"))
    dp = Dispatcher()

    dp.include_router(start.router)
    dp.include_router(generate.router)
    dp.include_router(balance.router)

    print("Bot started!")
    while True:
        try:
            await dp.start_polling(bot)
        except TelegramNetworkError as e:
            logging.warning(f"Telegram network error, retrying in 5s: {e}")
            await asyncio.sleep(5)
        except Exception as e:
            logging.error(f"Polling error, retrying in 10s: {e}")
            await asyncio.sleep(10)


if __name__ == "__main__":
    asyncio.run(main())
