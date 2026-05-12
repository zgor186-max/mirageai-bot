# Mirage AI Bot — Инструкция по запуску

## 1. Установка Python зависимостей
```
pip install -r requirements.txt
```

## 2. Заполни .env файл
Открой файл `.env` и вставь:
- `BOT_TOKEN` — токен от @BotFather (уже вставлен)
- `HF_TOKEN` — токен от huggingface.co/settings/tokens
- `WEBAPP_URL` — URL где будет размещён папка webapp/

## 3. Хостинг Mini App (webapp/)

Папку `webapp/` нужно разместить на любом HTTPS хостинге:

**Бесплатные варианты:**
- **GitHub Pages** — бесплатно, просто
- **Netlify** — перетащи папку webapp/ на netlify.com/drop
- **Vercel** — аналогично

После размещения скопируй URL и вставь в `.env` → `WEBAPP_URL`

## 4. Запуск бота
```
python -m bot.main
```

## 5. Проверка
Напиши боту /start в Telegram — появится кнопка "Открыть Mirage AI"
