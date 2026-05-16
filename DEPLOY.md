# Deploy

SSH: `ssh -i ~/.ssh/mirageai_deploy root@mirageai.duckdns.org`
Path: `/root/mirageai_bot`

Deploy command:
```
cd /root/mirageai_bot && git checkout -- bot/api_server.py && git pull origin main && systemctl restart mirageai
```

## Важные правила

### НЕ ИЗМЕНЯТЬ исходное фото товара
- Flux-kontext НЕ должен убирать/добавлять/менять количество предметов
- Если загружено 2 кроссовка — на карточке должно быть 2 кроссовка
- Промпт ВСЕГДА должен содержать: "preserve EXACT quantity of items shown in reference"
- Никогда не упрощать и не интерпретировать исходное фото

### НИКОГДА не делать макро-кружок
- Круглый кружок (macro circle, thumbnail) на карточке — ЗАПРЕЩЁН навсегда
- Не делать ни снизу-слева, ни снизу-справа, ни где-либо ещё
- Удалён из кода, больше не возвращать
