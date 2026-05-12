#!/bin/bash
cd /root/mirageai_bot

git fetch origin main 2>/dev/null

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[deploy $(date)] New version detected, updating..."
    git reset --hard origin/main
    fuser -k 8080/tcp 2>/dev/null || true
    sleep 2
    nohup python3 -m bot.main >> /root/mirageai_bot/bot.log 2>&1 &
    echo "[deploy $(date)] Bot restarted. PID=$!"
fi
