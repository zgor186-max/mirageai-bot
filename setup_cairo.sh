#!/bin/bash
echo "[Setup] Installing CairoSVG system dependencies..."
apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    fonts-noto-color-emoji

echo "[Setup] Installing cairosvg Python package..."
pip3 install cairosvg==2.7.1 numpy==1.26.4

echo "[Setup] CairoSVG installed ✓"
cairosvg --version
