#!/bin/bash
echo "[Setup] Installing Playwright..."
pip3 install playwright
python3 -m playwright install chromium
python3 -m playwright install-deps chromium
echo "[Setup] Playwright installed ✓"
