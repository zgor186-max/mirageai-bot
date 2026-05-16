# MirageAI — Генератор маркетплейс-карточек
## Сводка проекта

---

## 📁 Структура проекта

```
/root/mirageai_bot/
├── bot/
│   ├── main.py          — запуск бота + API сервера
│   ├── api_server.py    — основная логика генерации карточек
│   ├── handlers/        — обработчики команд Telegram
│   └── database.py      — БД
└── webapp/
    └── js/
        └── app.js       — фронтенд, Gemini-анализ, AI-копирайтинг
```

**Сервер:** `root@5.42.112.194`  
**SSH ключ:** `/c/Users/ivanf/.ssh/mirageai_deploy`  
**Сервис:** `mirageai.service`  
**Deploy:**
```bash
scp -i /c/Users/ivanf/.ssh/mirageai_deploy -o StrictHostKeyChecking=no \
  "локальный файл" root@5.42.112.194:/root/mirageai_bot/путь/к/файлу
ssh -i /c/Users/ivanf/.ssh/mirageai_deploy root@5.42.112.194 \
  "systemctl restart mirageai.service"
```

---

## 🎨 Дизайн карточки (Вариант 1 — WB/Ozon стиль)

### Шрифты (все Montserrat)
| Элемент | Вес | Размер |
|---------|-----|--------|
| Name (название товара) | ExtraBold 800 | 68px, lh=75 |
| Tagline | Light 300 | 16px, lh=23 |
| Features (текст) | Medium / SemiBold | ~20px |
| Badge | ExtraBold | — |

### Раскладка (подогнана под конкурента)
| Элемент | Позиция |
|---------|---------|
| Badge | y ≈ 120 |
| Name | y = 155 (с badge) / 100 (без) |
| Tagline | сразу после name, без воздуха (`ty - lh + 40`) |
| Features 1–5 | старт y = 340, шаг = 100px |
| Feat зона | max(340, ty + 40) |

### Цвета — **не менялись**

---

## ⚙️ api_server.py — ключевые константы

### Категории и размеры продукта
```python
CATEGORY_SIZING = {
    "clothing":    (0.95, 0.65, 0.01),  # h%, w%, y_offset
    "footwear":    (0.55, 0.48, 0.35),
    "accessories": (0.55, 0.46, 0.38),  # y_offset увеличен — на поверхности
    "food":        (0.65, 0.44, 0.18),
    "beauty":      (0.68, 0.40, 0.16),
    "gadgets":     (0.62, 0.46, 0.20),
    "home":        (0.72, 0.50, 0.16),
    "other":       (0.68, 0.48, 0.18),
}
```

### Умная раскладка (smart layout)
- `paste_info` — PIL возвращает `{x, y, w, h}` позиции товара, передаётся в Cairo
- `left_free = paste_info["x"]` — свободное место слева от товара
- Порог: **≥ 120px → layout="left"**, иначе → layout="bottom"
- **bottom** используется только если снизу реально есть место

```python
if left_free >= 120:
    layout = "left"
else:
    layout = "bottom"
```

### Промпты для Kontext (фоны по категориям)

**Одежда** — вешалка/рейл в интерьере (living room, bedroom)  
**Аксессуары / головные уборы / еда / красота / гаджеты / дом** — товар лежит на поверхности (стол, полка, тумба)

Запрет для аксессуаров:
> STRICTLY FORBIDDEN: mannequin heads, head-shaped holders, acrylic stands, transparent stands.  
> Cap or hat: lies with brim resting on the table, crown tilted toward camera.

---

## 🧠 app.js — ключевая логика

### Фильтр названия товара (name normalization)

**Правило:** 1 слово если нет бренда (тип товара), 2 слова если бренд виден на товаре (ТИП БРЕНД).

```javascript
if (data.name) {
    const parts = data.name.trim().toUpperCase().split(/\s+/);
    const PREPOSITIONS = new Set(['В','НА','К','С','ДЛЯ','ПО','ОТ','ДО','ЗА','ИЗ','ПРИ','НАД','ПОД','ОБ','ПРО','У','О','А','И','НО']);
    const adjEndings  = /АЯ$|ЯЯ$|ОЕ$|ЕЕ$|ЫЙ$|ИЙ$|ОЙ$|ЫЕ$|ИЕ$|ЫХ$|ИХ$/;
    const caseEndings = /[УЮ]$/; // косвенные падежи: клетку, полоску...
    const latParts = parts.filter(w => /[a-zA-Z]/.test(w));
    const cyrGood  = parts.filter(w =>
        /^[А-ЯЁ\-]+$/.test(w) &&
        !PREPOSITIONS.has(w) &&
        !adjEndings.test(w) &&
        !(caseEndings.test(w) && w.length > 3)
    );
    const type = cyrGood.length > 0 ? cyrGood[0] : parts.filter(w => /^[А-ЯЁ\-]+$/.test(w))[0] || parts[0];
    data.name = latParts.length > 0 ? `${type} ${latParts[0]}` : type;
}
```

**Примеры работы:**
| Вход от Gemini | Результат |
|----------------|-----------|
| ФЛАНЕЛЕВАЯ ПИЖАМА | ПИЖАМА ✅ |
| ПИЖАМА КЛЕТЧАТАЯ | ПИЖАМА ✅ |
| ПИЖАМА В КЛЕТКУ | ПИЖАМА ✅ |
| ШУРУПОВЁРТ MAKITA | ШУРУПОВЁРТ MAKITA ✅ |

### AI копирайтинг — промпт features
- Ровно **5 элементов**
- Каждый: **2–3 слова**, конкретное свойство
- Пример: `МЯГКИЙ МАТЕРИАЛ`, `БЫСТРАЯ ЗАРЯДКА`

### Location seeds (фоны) — на английском
- Для каждой категории — несколько вариантов окружения
- Передаются в Kontext как часть промпта

---

## 🐛 Решённые проблемы

| Проблема | Причина | Решение |
|----------|---------|---------|
| Features уходили за экран у одежды | Порог bottom layout = 300px, но у одежды bottom_free = 22px | Порог снижен до 120px |
| Название всегда 2 слова | Gemini игнорировал промпт | JS постобработка с фильтром |
| "ФЛАНЕЛЕВАЯ ПИЖАМА" | Прилагательное шло первым | Фильтр окончаний прилагательных |
| "ПИЖАМА КЛЕТЧАТАЯ" | Прилагательное шло последним | Тот же фильтр окончаний |
| "ПИЖАМА В КЛЕТКУ" | Предлог + существительное в косвенном падеже | Добавлен PREPOSITIONS set + caseEndings |
| Шрифт не загружался | GitHub вернул HTML вместо бинарника | Переключились на прямую ссылку |
| Tagline с воздухом | Неверная формула отступа | `ty = ty - title_lh + 40` |
| Аксессуары на стойке | Kontext ставил на подставку | Запрет в промпте + y_offset = 0.38 |

---

## 📌 Текущий статус

- ✅ Раскладка подогнана под конкурента (y=340, шаг 100px, 5 features)
- ✅ Tagline без воздуха сразу после name
- ✅ Шрифт Montserrat ExtraBold на сервере
- ✅ Smart layout (left / bottom) по paste_info
- ✅ Фильтр названия (прилагательные + предлоги + косвенные падежи)
- ✅ Аксессуары на поверхности, не на подставке
- 🔄 Тестирование фильтра названия (последняя версия только что задеплоена)
- ⏳ Возможно: уменьшить feat text с 20px до 18–19px под конкурента
