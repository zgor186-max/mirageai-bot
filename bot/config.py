import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
HF_TOKEN = os.getenv("HF_TOKEN")
POLZA_KEY = os.getenv("POLZA_KEY")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-domain.com")

START_COINS = 10
