import asyncio
import aiohttp
import base64
import uuid
import json as _json
from aiohttp import web
import os

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")
REPLICATE_MODEL = "black-forest-labs/flux-kontext-pro"
REPLICATE_TEXT2IMG = "black-forest-labs/flux-dev"
FACESWAP_VERSION = "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34"

# Temp image hosting (fallback when Replicate Files API is unavailable)
TEMP_DIR = "/tmp/mirageai_imgs"
os.makedirs(TEMP_DIR, exist_ok=True)
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://mirageai.duckdns.org")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


async def generate_handler(request):
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=CORS_HEADERS)

    try:
        data = await request.json()
        photo_b64 = data.get("photo", "")
        prompt = data.get("prompt", "")

        if not photo_b64 or not prompt:
            return web.json_response(
                {"error": "photo and prompt are required"},
                status=400,
                headers=CORS_HEADERS,
            )

        if photo_b64.startswith("data:"):
            photo_b64 = photo_b64.split(",", 1)[1]

        print(f"[API] photo b64 length={len(photo_b64)}")
        print(f"[API] prompt={prompt[:100]}")

        image_url = await call_replicate(photo_b64, prompt)

        if not image_url:
            return web.json_response(
                {"error": "Generation failed"},
                status=500,
                headers=CORS_HEADERS,
            )

        image_b64 = await download_image_as_base64(image_url)
        if image_b64:
            return web.json_response({"url": image_b64}, headers=CORS_HEADERS)

        return web.json_response({"url": image_url}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


async def generate_card_handler(request):
    """
    Card generation pipeline:
      1. rembg — remove background from product photo (local, guaranteed)
      2. flux-dev — generate background scene
      3. PIL composite — place product on RIGHT side of background (guaranteed composition)
      4. Cairo overlay — draw text/badges on top
    """
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=CORS_HEADERS)

    try:
        data = await request.json()
        photo_b64    = data.get("photo", "")
        scene_prompt = data.get("scene_prompt", "")
        product_name = data.get("product_name", "product")
        category     = data.get("category", "other")
        card_data    = data.get("card", {})

        if not photo_b64 or not scene_prompt:
            return web.json_response({"error": "photo and scene_prompt required"}, status=400, headers=CORS_HEADERS)

        if photo_b64.startswith("data:"):
            photo_b64 = photo_b64.split(",", 1)[1]

        print(f"[Card] category={category} scene={scene_prompt[:80]}")

        # ── Step 1: Remove background from product photo ──────────────
        print("[Card] Step 1 — removing background (rembg)")
        product_no_bg = await asyncio.get_event_loop().run_in_executor(
            None, _remove_bg, photo_b64
        )
        if not product_no_bg:
            return web.json_response({"error": "Background removal failed"}, status=500, headers=CORS_HEADERS)
        print("[Card] Step 1 done ✓")

        # ── Step 2: Generate background scene ────────────────────────
        print("[Card] Step 2 — generating background scene")
        bg_scene_prompt = (
            f"{scene_prompt}. "
            f"Empty scene — absolutely NO products, NO clothing, NO garments, NO fabric items, "
            f"NO checkered or plaid patterns anywhere in the scene. "
            f"Clean minimal background suitable for product photography. "
            f"Photorealistic, soft natural lighting from upper-left. Ultra detailed."
        )

        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=300)) as session:
            bg_url = await call_text2img(session, bg_scene_prompt)
            if bg_url:
                bg_b64 = await download_as_b64(session, bg_url)
            else:
                bg_b64 = None

        if not bg_b64:
            print("[Card] Step 2 failed — using plain background")

        print("[Card] Step 2 done ✓")

        # ── Step 3: PIL — размещаем товар справа на нейтральном фоне ─
        print("[Card] Step 3 — placing product on neutral background")
        staged_b64, _ = await asyncio.get_event_loop().run_in_executor(
            None, _composite_product_right, product_no_bg, None, category
        )
        print("[Card] Step 3 done ✓")

        # ── Step 4: Kontext — генерирует фон вокруг товара ────────────
        # Товар уже на месте. Kontext только заполняет фон.
        print("[Card] Step 4 — kontext: generate background around placed product")
        is_clothing = category in ("clothing", "footwear")
        hanging_note = (
            "If the product is on a hanger, add a wall-mounted horizontal clothing rod at the very top of the image. "
            "The hanger hook must hang FROM the rod (hook goes OVER the rod from above), not pierce or pass through it. "
            "Rod is above, hanger hook hangs below it — physically correct. "
        ) if is_clothing else ""
        bg_prompt = (
            f"This image shows a product placed on a plain neutral background. "
            f"Replace ONLY the plain background with a beautiful photorealistic scene: {scene_prompt}. "
            f"CRITICAL RULES: "
            f"1. PRODUCT COLORS: Do NOT change product colors, patterns or textures in any way. Preserve exact original colors. "
            f"2. PRODUCT SIZE: The product MUST remain the same large size as in the input image. Do NOT scale it down. "
            f"3. PRODUCT POSITION: Product is a large foreground element, close to camera, fills the right side of frame. Keep it exactly where it is. "
            f"4. Do NOT move, resize or duplicate the product. "
            f"5. The LEFT 40% of the image must be CLEAN, EMPTY and slightly dark — absolutely NO furniture, NO objects, NO patterns in that zone. Only smooth dark gradient. This zone is reserved for text. "
            f"6. All scene elements (furniture, decor, plants) go ONLY in the right half and bottom of the image. "
            f"7. {hanging_note}"
            f"8. SHADOWS: add realistic cast shadow from the product onto the wall behind it — soft, slightly offset to the right and downward. Also add shadow on the floor beneath the product. "
            f"9. LIGHTING: bright and even illumination, average scene brightness 140-180/255. Light-colored walls (white, beige, light grey). Natural daylight or warm indoor lamp. NO dark rooms, NO night scenes. "
            f"10. NO duplicate products. NO text. NO watermarks."
        )

        result_b64 = None
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=300)) as session:
                staged_url = await upload_image_to_replicate(session, staged_b64)
                kontext_url = await call_kontext_single(session, staged_url, bg_prompt)
                if kontext_url:
                    dl = await download_image_as_base64(kontext_url)
                    if dl:
                        result_b64 = dl.split(",", 1)[1] if dl.startswith("data:") else dl
                        print("[Card] Step 4 kontext done ✓")
        except Exception as e:
            print(f"[Card] Step 4 kontext error: {e}")

        # Fallback: используем PIL composite с готовым фоном
        if not result_b64:
            print("[Card] Step 4 fallback — PIL composite with bg")
            result_b64, _ = await asyncio.get_event_loop().run_in_executor(
                None, _composite_product_right, product_no_bg, bg_b64, category
            )

        # ── Step 4.5: Адаптивная яркость (3 уровня) ──────────────────
        # Цель: итоговая яркость 130–160 (51–63%)
        # avg < 80  → очень тёмно → +35%
        # avg 80–120 → немного тёмно → +20%
        # avg > 120  → светло → без изменений
        def _adaptive_brighten(b64: str) -> str:
            import io as _io
            from PIL import Image as _Img, ImageEnhance as _IE
            import numpy as _np
            img = _Img.open(_io.BytesIO(base64.b64decode(b64))).convert("RGB")
            avg_brightness = _np.array(img).mean()
            if avg_brightness < 80:
                factor = 1.35
                level = f"very dark → +35%"
            elif avg_brightness < 120:
                factor = 1.20
                level = f"slightly dark → +20%"
            else:
                factor = 1.0
                level = f"bright → no change"
            print(f"[Brightness] avg={avg_brightness:.1f} ({avg_brightness/255*100:.0f}%) — {level}")
            if factor != 1.0:
                img = _IE.Brightness(img).enhance(factor)
            out = _io.BytesIO()
            img.save(out, format="JPEG", quality=93)
            return base64.b64encode(out.getvalue()).decode()

        result_b64 = await asyncio.get_event_loop().run_in_executor(None, _adaptive_brighten, result_b64)

        # ── Step 5: Apply text overlay ────────────────────────────────
        final = await _apply_card_overlay(result_b64, card_data)
        return web.json_response({"url": final}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


def _png_to_jpg_neutral(png_b64: str, bg_color=(240, 240, 238)) -> str:
    """Convert transparent PNG to JPEG on neutral background for kontext input."""
    import io as _io
    from PIL import Image
    raw = base64.b64decode(png_b64)
    prod = Image.open(_io.BytesIO(raw)).convert("RGBA")
    # Обрезаем прозрачные отступы
    bbox = prod.getbbox()
    if bbox:
        prod = prod.crop(bbox)
    bg = Image.new("RGBA", prod.size, bg_color + (255,))
    bg.paste(prod, (0, 0), prod)
    out = _io.BytesIO()
    bg.convert("RGB").save(out, format="JPEG", quality=95)
    return base64.b64encode(out.getvalue()).decode()


def _remove_bg(photo_b64: str) -> str | None:
    """Remove background using rembg, return base64 PNG with transparency."""
    try:
        from rembg import remove
        import io as _io
        from PIL import Image

        raw = base64.b64decode(photo_b64)
        result = remove(raw)
        img = Image.open(_io.BytesIO(result)).convert("RGBA")
        out = _io.BytesIO()
        img.save(out, format="PNG")
        return base64.b64encode(out.getvalue()).decode()
    except Exception as e:
        print(f"[rembg] error: {e}")
        import traceback; traceback.print_exc()
        return None


# Размеры товара по категории: (target_h_ratio, max_w_ratio, y_offset_ratio)
# target_h_ratio  — желаемая высота товара как доля от высоты карточки
# max_w_ratio     — максимальная ширина товара как доля от ширины карточки
# y_offset_ratio  — смещение от верха (0 = прижать вверх, 0.5 = по центру)
CATEGORY_SIZING = {
    # (target_h_ratio, max_w_ratio, y_offset_ratio)
    "clothing":    (0.95, 0.65, 0.01),   # крупнее — ближе к зрителю
    "footwear":    (0.55, 0.48, 0.35),   # обувь ниже центра
    "accessories": (0.62, 0.46, 0.20),
    "food":        (0.65, 0.44, 0.18),
    "beauty":      (0.68, 0.40, 0.16),
    "gadgets":     (0.62, 0.46, 0.20),
    "home":        (0.72, 0.50, 0.16),
    "other":       (0.68, 0.48, 0.18),
}


def _composite_product_right(
    product_no_bg_b64: str,
    bg_b64: str | None,
    category: str,
    out_w: int = 800,
    out_h: int = 1100,
) -> str:
    """
    Place product (transparent PNG) on the RIGHT side of the background.
    Left side is guaranteed to be clear of product.
    """
    import io as _io
    import numpy as np
    from PIL import Image, ImageFilter

    # ── Background ────────────────────────────────────────────────
    if bg_b64:
        bg = Image.open(_io.BytesIO(base64.b64decode(bg_b64))).convert("RGBA")
        bg = bg.resize((out_w, out_h), Image.LANCZOS)
    else:
        # Нейтральный серый фон
        bg = Image.new("RGBA", (out_w, out_h), (230, 228, 224, 255))

    # Небольшое размытие фона для эффекта глубины резкости
    bg_blurred = bg.filter(ImageFilter.GaussianBlur(radius=1.8))

    # ── Product ───────────────────────────────────────────────────
    prod = Image.open(_io.BytesIO(base64.b64decode(product_no_bg_b64))).convert("RGBA")

    # Обрезаем прозрачные отступы rembg — берём реальный размер товара
    bbox = prod.getbbox()
    if bbox:
        prod = prod.crop(bbox)
    import sys as _sys
    prod_w, prod_h = prod.size

    target_h_r, max_w_r, y_off_r = CATEGORY_SIZING.get(category, CATEGORY_SIZING["other"])
    target_h = int(out_h * target_h_r)
    target_w = int(out_w * max_w_r)

    if category == "clothing":
        # Non-proportional: фиксируем ширину и высоту независимо
        # Лёгкая вертикальная растяжка (~20%) — для одежды выглядит естественно
        new_w = target_w
        new_h = target_h
    else:
        # Остальные категории — пропорциональное масштабирование
        scale_by_h = target_h / prod_h
        scale_by_w = target_w / prod_w
        scale = min(scale_by_h, scale_by_w)
        new_h = int(prod_h * scale)
        new_w = int(prod_w * scale)

    prod_resized = prod.resize((new_w, new_h), Image.LANCZOS)

    # ── Позиция: правый край = правый край холста ─────────────────
    x = out_w - new_w
    y = int(out_h * y_off_r)
    y = min(y, out_h - new_h - 5)

    _sys.stdout.write(
        f"[PIL] canvas={out_w}x{out_h} "
        f"product_raw={prod_w}x{prod_h} "
        f"category={category} "
        f"target={target_h}px({target_h_r*100:.0f}%) "
        f"result={new_w}x{new_h}px "
        f"h={new_h/out_h*100:.1f}% w={new_w/out_w*100:.1f}% "
        f"x={x}({x/out_w*100:.1f}%) y={y}({y/out_h*100:.1f}%) "
        f"y_range={y/out_h*100:.1f}%..{(y+new_h)/out_h*100:.1f}%\n"
    )
    _sys.stdout.flush()

    # Мягкая тень под товаром (для одежды — тень под вешалкой)
    shadow = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", (new_w, 50), (0, 0, 0, 0))
    for i in range(50):
        alpha = int(70 * (1 - i / 50))
        for px in range(new_w):
            shadow_layer.putpixel((px, i), (0, 0, 0, alpha))
    shadow.paste(shadow_layer, (x, y + new_h - 25))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=14))

    # Собираем: фон → тень → товар
    canvas = bg_blurred.copy()
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.paste(prod_resized, (x, y), prod_resized)

    # ── Конвертируем в JPEG base64 ─────────────────────────────
    out = _io.BytesIO()
    canvas.convert("RGB").save(out, format="JPEG", quality=93)
    # Возвращаем также позицию и размер товара для повторной вставки после kontext
    paste_info = {"x": x, "y": y, "w": new_w, "h": new_h}
    return base64.b64encode(out.getvalue()).decode(), paste_info


def _repaste_product(
    nat_b64: str,
    product_no_bg_b64: str,
    paste_info: dict,
    out_w: int = 800,
    out_h: int = 1100,
) -> str:
    """После kontext натурализации снова вставляем товар поверх — фон не перекрывает товар."""
    import io as _io
    from PIL import Image

    bg = Image.open(_io.BytesIO(base64.b64decode(nat_b64))).convert("RGBA")
    bg = bg.resize((out_w, out_h), Image.LANCZOS)

    prod = Image.open(_io.BytesIO(base64.b64decode(product_no_bg_b64))).convert("RGBA")
    bbox = prod.getbbox()
    if bbox:
        prod = prod.crop(bbox)

    x, y, new_w, new_h = paste_info["x"], paste_info["y"], paste_info["w"], paste_info["h"]
    prod_resized = prod.resize((new_w, new_h), Image.LANCZOS)
    bg.paste(prod_resized, (x, y), prod_resized)

    out = _io.BytesIO()
    bg.convert("RGB").save(out, format="JPEG", quality=93)
    return base64.b64encode(out.getvalue()).decode()


async def call_text2img(session: aiohttp.ClientSession, prompt: str) -> str | None:
    """Step 1: Generate background scene without product"""
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "input": {
            "prompt": f"{prompt}. Empty scene, no products present, photorealistic commercial photography background, ultra detailed",
            "aspect_ratio": "3:4",
            "output_format": "jpg",
        }
    }
    try:
        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_TEXT2IMG}/predictions",
            api_headers, payload, label="Text2Img"
        )
        status = result.get("status")
        pred_id = result.get("id")
        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        print(f"[Text2Img] failed: {result.get('error')}")
        return None
    except Exception as e:
        print(f"[Text2Img] error: {e}")
        return None


async def call_kontext_two_images(session, product_url: str, bg_url: str | None, prompt: str) -> str | None:
    """Step 2: Place product into scene using flux-kontext-pro"""
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    input_images = [product_url]
    if bg_url:
        input_images.append(bg_url)

    payload = {
        "input": {
            "prompt": prompt,
            "input_image": product_url,
            **({"input_images": input_images} if bg_url else {}),
            "aspect_ratio": "3:4",
            "output_format": "jpg",
            "safety_tolerance": 2,
        }
    }
    try:
        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            api_headers, payload, label="Kontext2"
        )
        status = result.get("status")
        pred_id = result.get("id")
        print(f"[Kontext2] status={status} id={pred_id}")
        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        if status == "failed":
            print(f"[Kontext2] FAILED: {result.get('error')}")
        return None
    except Exception as e:
        print(f"[Kontext2] error: {e}")
        return None


async def call_kontext_single(session, image_url: str, prompt: str) -> str | None:
    """Kontext with a single image — for naturalizing composites."""
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "input": {
            "prompt": prompt,
            "input_image": image_url,
            "aspect_ratio": "3:4",
            "output_format": "jpg",
            "safety_tolerance": 2,
            "guidance": 3.5,
        }
    }
    try:
        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            api_headers, payload, label="KontextNat"
        )
        status = result.get("status")
        pred_id = result.get("id")
        print(f"[KontextNat] status={status} id={pred_id}")
        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        if status == "failed":
            print(f"[KontextNat] FAILED: {result.get('error')}")
        return None
    except Exception as e:
        print(f"[KontextNat] error: {e}")
        return None


async def download_as_b64(session: aiohttp.ClientSession, url: str) -> str | None:
    try:
        async with session.get(url) as resp:
            if resp.status == 200:
                return base64.b64encode(await resp.read()).decode()
    except Exception as e:
        print(f"[download_as_b64] error: {e}")
    return None


async def faceswap_handler(request):
    if request.method == "OPTIONS":
        return web.Response(status=200, headers=CORS_HEADERS)

    try:
        data = await request.json()
        template_b64 = data.get("template", "")
        user_photo_b64 = data.get("user_photo", "")

        if not template_b64 or not user_photo_b64:
            return web.json_response(
                {"error": "template and user_photo are required"},
                status=400,
                headers=CORS_HEADERS,
            )

        if template_b64.startswith("data:"):
            template_b64 = template_b64.split(",", 1)[1]
        if user_photo_b64.startswith("data:"):
            user_photo_b64 = user_photo_b64.split(",", 1)[1]

        print(f"[FaceSwap] template size={len(template_b64)}, user_photo size={len(user_photo_b64)}")

        result_url = await call_faceswap(template_b64, user_photo_b64)

        if not result_url:
            return web.json_response(
                {"error": "Face swap failed"},
                status=500,
                headers=CORS_HEADERS,
            )

        image_b64 = await download_image_as_base64(result_url)
        if image_b64:
            return web.json_response({"url": image_b64}, headers=CORS_HEADERS)

        return web.json_response({"url": result_url}, headers=CORS_HEADERS)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500, headers=CORS_HEADERS)


async def call_faceswap(template_b64: str, user_photo_b64: str) -> str | None:
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }

    timeout = aiohttp.ClientTimeout(total=180)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        template_url = await upload_image_to_replicate(session, template_b64)
        user_photo_url = await upload_image_to_replicate(session, user_photo_b64)

        if not template_url or not user_photo_url:
            print("[FaceSwap] Failed to upload images")
            return None

        payload = {
            "version": FACESWAP_VERSION,
            "input": {
                "input_image": template_url,
                "swap_image": user_photo_url,
            }
        }

        async with session.post(
            "https://api.replicate.com/v1/predictions",
            headers=api_headers,
            json=payload,
        ) as resp:
            raw = await resp.text()
            print(f"[FaceSwap] HTTP={resp.status} raw={raw[:300]}")
            try:
                result = await resp.json(content_type=None)
            except Exception:
                import json
                result = json.loads(raw)

            status = result.get("status")
            pred_id = result.get("id")
            print(f"[FaceSwap] status={status} id={pred_id}")

            if status == "succeeded":
                return _extract_output(result)
            if status in ("starting", "processing"):
                return await _poll(session, pred_id, api_headers)
            if status == "failed":
                print(f"[FaceSwap] FAILED: {result.get('error')}")
                return None
            return None


async def download_image_as_base64(url: str) -> str | None:
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    img_bytes = await resp.read()
                    b64 = base64.b64encode(img_bytes).decode()
                    return f"data:image/jpeg;base64,{b64}"
                print(f"[Replicate] download failed: {resp.status}")
                return None
    except Exception as e:
        print(f"[Replicate] download error: {e}")
        return None


async def _save_image_locally(photo_b64: str) -> str | None:
    """Save base64 image to local temp dir and return a public URL."""
    try:
        raw_b64 = photo_b64.split(",", 1)[1] if photo_b64.startswith("data:") else photo_b64
        img_bytes = base64.b64decode(raw_b64)
        filename = f"{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(TEMP_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        url = f"{PUBLIC_BASE_URL}/img/{filename}"
        print(f"[Upload] Saved locally → {url}")
        # Auto-delete after 10 minutes
        asyncio.create_task(_delete_after(filepath, 600))
        return url
    except Exception as e:
        print(f"[Upload] Local save failed: {e}")
        return None


async def _delete_after(filepath: str, delay: int):
    await asyncio.sleep(delay)
    try:
        os.unlink(filepath)
    except Exception:
        pass


async def serve_temp_image(request):
    filename = request.match_info["filename"]
    if "/" in filename or ".." in filename or not filename.endswith(".jpg"):
        return web.Response(status=404)
    filepath = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(filepath):
        return web.Response(status=404)
    return web.FileResponse(filepath, headers={"Content-Type": "image/jpeg",
                                                "Access-Control-Allow-Origin": "*"})


async def upload_image_to_replicate(session: aiohttp.ClientSession, photo_b64: str) -> str | None:
    """Upload image: try Replicate Files API, then fall back to local temp server."""
    if photo_b64.startswith("data:"):
        photo_b64 = photo_b64.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(photo_b64)
        headers = {
            "Authorization": f"Token {REPLICATE_TOKEN}",
            "Content-Type": "image/jpeg",
        }
        async with session.post(
            "https://api.replicate.com/v1/files",
            headers=headers,
            data=img_bytes,
        ) as resp:
            raw = await resp.text()
            print(f"[Replicate] file upload HTTP={resp.status} response={raw[:300]}")
            import json as _json
            try:
                result = _json.loads(raw)
            except Exception:
                result = {}
            url = result.get("urls", {}).get("get") or result.get("url")
            if url:
                print(f"[Replicate] uploaded to Replicate: {url}")
                return url
    except Exception as e:
        print(f"[Replicate] file upload exception: {e}")

    # Fallback: serve from our own server
    print("[Upload] Replicate upload failed → using local temp server")
    return await _save_image_locally(photo_b64)


async def _post_with_retry(session: aiohttp.ClientSession, url: str, headers: dict, payload: dict,
                           label: str = "Replicate", max_retries: int = 4) -> dict:
    """POST to Replicate API with automatic retry on 429 rate-limit responses."""
    import json as _json
    for attempt in range(max_retries):
        async with session.post(url, headers=headers, json=payload) as resp:
            raw = await resp.text()
            try:
                result = _json.loads(raw)
            except Exception:
                result = {}
            http_status = resp.status
            api_status = result.get("status")
            # Rate-limited — wait and retry
            if http_status == 429 or api_status == 429:
                retry_after = int(result.get("retry_after", 10)) + 2
                print(f"[{label}] 429 rate-limited (attempt {attempt+1}/{max_retries}), waiting {retry_after}s...")
                await asyncio.sleep(retry_after)
                continue
            return result
    print(f"[{label}] All {max_retries} attempts rate-limited, giving up")
    return {}


async def call_replicate(photo_b64: str, prompt: str) -> str | None:
    api_headers = {
        "Authorization": f"Token {REPLICATE_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }

    timeout = aiohttp.ClientTimeout(total=300)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        image_url = await upload_image_to_replicate(session, photo_b64)

        payload = {
            "input": {
                "prompt": prompt,
                "input_image": image_url,
                "aspect_ratio": "3:4",
                "output_format": "jpg",
                "safety_tolerance": 2,
            }
        }

        result = await _post_with_retry(
            session,
            f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
            api_headers, payload, label="Replicate"
        )

        status = result.get("status")
        pred_id = result.get("id")
        print(f"[Replicate] status={status} id={pred_id}")

        if status == "succeeded":
            return _extract_output(result)
        if status in ("starting", "processing"):
            return await _poll(session, pred_id, api_headers)
        if status == "failed":
            print(f"[Replicate] FAILED: error={result.get('error')} logs={result.get('logs','')[:200]}")
            return None
        if result:
            print(f"[Replicate] unexpected: {result}")
        return None


async def _poll(session, prediction_id: str, headers: dict) -> str | None:
    for i in range(40):
        await asyncio.sleep(3)
        async with session.get(
            f"https://api.replicate.com/v1/predictions/{prediction_id}",
            headers=headers,
        ) as resp:
            result = await resp.json(content_type=None)
            status = result.get("status")
            print(f"[Replicate] poll #{i+1} status={status}")

            if status == "succeeded":
                return _extract_output(result)
            if status == "failed":
                print(f"[Replicate] poll FAILED: {result.get('error')} logs={result.get('logs','')[:200]}")
                return None
    print("[Replicate] poll timeout")
    return None


def _extract_output(result: dict) -> str | None:
    output = result.get("output")
    if isinstance(output, list) and output:
        return output[0]
    if isinstance(output, str):
        return output
    return None


async def _apply_card_overlay(image_b64: str | None, card_data: dict) -> str:
    """Render text overlay via Cairo."""
    if not image_b64:
        return image_b64
    raw_b64 = image_b64.split(",", 1)[1] if image_b64.startswith("data:") else image_b64
    if card_data:
        rendered = await render_card_cairo(raw_b64, card_data)
        if rendered:
            return rendered
    return image_b64


ACCENT_COLORS = {
    "warm": "#d4a017", "dark": "#c9a84c", "tech": "#00c8ff",
    "workshop": "#ffc200", "nature": "#4caf50"
}



def _svg_esc(text: str) -> str:
    import html
    return html.escape(str(text))


def _svg_wrap(text: str, max_chars: int = 12) -> list:
    """Split text into lines of at most max_chars characters."""
    words = str(text).split()
    if not words:
        return [""]
    lines, current = [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


async def render_card_cairo(image_b64: str, card: dict) -> str | None:
    """Marketplace-style card: dynamic color from product, dividers, macro circle."""
    try:
        import cairosvg
    except ImportError:
        return None

    import io as _io
    import numpy as np
    from PIL import Image, ImageDraw as _ImageDraw
    from sklearn.cluster import KMeans

    raw_bytes = base64.b64decode(image_b64)
    pil_img   = Image.open(_io.BytesIO(raw_bytes)).convert("RGB")
    img_arr   = np.array(pil_img)
    H, W      = img_arr.shape[:2]

    # ── 1. KMeans: найти доминирующий цвет товара ────────────────
    small  = np.array(pil_img.resize((150, 200))).reshape(-1, 3).astype(float)
    km     = KMeans(n_clusters=6, n_init=8, random_state=42)
    km.fit(small)
    centers = km.cluster_centers_
    sizes   = np.bincount(km.labels_)

    best, best_score = None, -1
    for i, c in enumerate(centers):
        brightness = float(np.mean(c))
        mx = float(np.max(c))
        sat = (mx - float(np.min(c))) / (mx + 1e-6)
        if 45 < brightness < 215 and sat > 0.12:
            score = sat * (sizes[i] / len(km.labels_))
            if score > best_score:
                best_score, best = score, c

    dr, dg, db = (int(best[0]), int(best[1]), int(best[2])) if best is not None else (120, 90, 60)
    accent_hex = f"#{dr:02x}{dg:02x}{db:02x}"
    dark_hex   = f"#{int(dr*.50):02x}{int(dg*.50):02x}{int(db*.50):02x}"  # текст заголовка
    feat_hex   = f"#{int(dr*.42):02x}{int(dg*.42):02x}{int(db*.42):02x}"  # текст фич

    # ── 2. Яркость левой зоны → светлый или тёмный фон ──────────
    lw = W // 2
    left_bright = float(np.mean(img_arr[200:900, :lw, :]))
    light_bg    = left_bright > 148

    # Всегда белый текст — читаемость обеспечивает градиент слева
    t_col  = "#ffffff"; s_col = "#ffffff"; f_col = "#ffffff"
    sk_col = "#000000"; sk_w_t = "3.5";   sk_w_f = "1.2"; sk_op = "0.70"
    shd_op = "0.75"

    print(f"[Cairo] dominant=({dr},{dg},{db}) bright={left_bright:.0f} light={light_bg} →always-white")

    # ── 3. Умная зона для фич ────────────────────────────────────
    ZONES = {
        "mid":    img_arr[400:640, :lw, :],
        "lower":  img_arr[640:860, :lw, :],
        "bottom": img_arr[860:1060, :lw, :],
    }
    zone_std     = {n: float(np.std(z)) for n, z in ZONES.items()}
    best_zone    = min(zone_std, key=zone_std.get)
    ZONE_Y        = {"mid": 420, "lower": 640, "bottom": 860}
    row_gap_calc  = 95   # 2 строки по 1 слову
    feat_zone_top = min(ZONE_Y[best_zone], 1080 - 4 * row_gap_calc - 20)

    # ── 4. Данные карточки ───────────────────────────────────────
    badge        = _svg_esc(card.get("badge", ""))
    name         = _svg_esc(card.get("name", "")).upper()
    tagline_raw  = _svg_esc(card.get("tagline", ""))
    subtitle_raw = _svg_esc(card.get("subtitle", ""))

    feats = []
    for i in range(1, 6):
        feat = card.get(f"feat{i}", "")
        icon = card.get(f"icon{i}", "✦")
        if feat:
            # Первая буква заглавная, остальное строчные — как в эталоне
            txt = feat.strip()
            txt = txt[0].upper() + txt[1:].lower() if txt else txt
            feats.append({"icon": icon, "text": _svg_esc(txt)})

    FONT_TITLE    = "'Playfair Display', serif"           # заголовок — serif bold
    FONT_SEMI     = "'Montserrat SemiBold', 'Montserrat', sans-serif"  # фичи
    FONT_MEDIUM   = "'Montserrat Medium', 'Montserrat', sans-serif"    # бейдж
    FONT_LIGHT    = "'Montserrat Light', 'Montserrat', sans-serif"     # tagline
    FONT          = FONT_SEMI   # fallback для совместимости
    FONT_EMOJI    = "Noto Color Emoji, Segoe UI Emoji, Apple Color Emoji, sans-serif"

    els = []

    # Shadow filter + left gradient
    els.append(
        f'<defs>'
        f'<filter id="ts" x="-10%" y="-10%" width="130%" height="130%">'
        f'<feDropShadow dx="0" dy="1" stdDeviation="2" '
        f'flood-color="#000" flood-opacity="{shd_op}"/>'
        f'</filter>'
        f'<linearGradient id="textbg" x1="0" y1="0" x2="1" y2="0">'
        f'<stop offset="0%" stop-color="#000000" stop-opacity="0.65"/>'
        f'<stop offset="38%" stop-color="#000000" stop-opacity="0.40"/>'
        f'<stop offset="55%" stop-color="#000000" stop-opacity="0.10"/>'
        f'<stop offset="68%" stop-color="#000000" stop-opacity="0"/>'
        f'</linearGradient>'
        f'</defs>'
    )
    # Gradient rect over entire left half
    els.append('<rect x="0" y="0" width="800" height="1100" fill="url(#textbg)"/>')

    # ── Бейдж: сверху-слева (только если не совпадает с названием) ─
    badge_shown = badge and badge.upper() != name.upper()
    if badge_shown:
        bw = min(len(badge) * 11 + 34, 280)
        els.append(f'<rect x="28" y="22" width="{bw}" height="30" rx="15" fill="{accent_hex}"/>')
        els.append(
            f'<text x="{28 + bw//2}" y="43" text-anchor="middle" '
            f'font-family="{FONT_MEDIUM}" font-size="13" font-weight="500" '
            f'letter-spacing="1.5" fill="#ffffff">{badge}</text>'
        )

    # ── Заголовок: Playfair Display Bold ─────────────────────────
    ty = 155 if badge_shown else 100
    for line in _svg_wrap(name, max_chars=14):
        els.append(
            f'<text x="28" y="{ty}" '
            f'font-family="{FONT_TITLE}" font-size="90" font-weight="700" '
            f'fill="{t_col}" stroke="{sk_col}" stroke-width="{sk_w_t}" '
            f'stroke-opacity="{sk_op}" paint-order="stroke fill" '
            f'filter="url(#ts)">{line}</text>'
        )
        ty += 100

    # ── Tagline: italic, макс 3 слова на строку, 2 строки ────────
    if tagline_raw:
        ty += 10
        for line in _svg_wrap(tagline_raw, max_chars=18)[:2]:
            els.append(
                f'<text x="28" y="{ty}" font-family="{FONT_LIGHT}" font-size="18" '
                f'font-weight="300" fill="{s_col}" '
                f'stroke="{sk_col}" stroke-width="0.6" stroke-opacity="0.15" '
                f'paint-order="stroke fill">{line}</text>'
            )
            ty += 24

    # ── Слоган ───────────────────────────────────────────────────
    if subtitle_raw:
        ty += 8
        els.append(
            f'<text x="28" y="{ty}" font-family="{FONT_SEMI}" font-size="22" '
            f'font-weight="600" fill="{s_col}" '
            f'stroke="{sk_col}" stroke-width="0.8" stroke-opacity="0.15" '
            f'paint-order="stroke fill">{_svg_wrap(subtitle_raw, max_chars=18)[0]}</text>'
        )
        ty += 32

    # ── Фичи: начинаются строго НИЖЕ текстового блока ────────────
    feat_row_gap  = 95
    # feat_zone_top не может быть выше конца текстового блока + отступ 30px
    feat_zone_top = max(feat_zone_top, ty + 30)
    # И не выходить за нижний край при 4 фичах
    feat_zone_top = min(feat_zone_top, 1100 - 4 * feat_row_gap - 20)

    if feats:
        feats = feats[:4]
        feat_r    = 26
        feat_fs   = 22
        feat_lh   = 26
        feat_icon = 20
        cx_f      = 54
        tx_f      = 92
        row_gap   = feat_row_gap

        for idx, feat in enumerate(feats):
            cy = feat_zone_top + idx * row_gap

            # Разделитель
            if idx > 0:
                els.append(
                    f'<line x1="{cx_f - feat_r}" y1="{cy - 18}" x2="340" y2="{cy - 18}" '
                    f'stroke="{accent_hex}" stroke-width="0.8" stroke-opacity="0.35"/>'
                )
            # Круг + иконка
            els.append(f'<circle cx="{cx_f}" cy="{cy}" r="{feat_r}" fill="{accent_hex}"/>')
            els.append(
                f'<text x="{cx_f}" y="{cy + 7}" text-anchor="middle" '
                f'font-family="{FONT_EMOJI}" font-size="{feat_icon}" '
                f'filter="url(#ts)">{feat["icon"]}</text>'
            )
            # Текст: каждое слово на отдельной строке, ЗАГЛАВНЫМИ
            # Фильтруем предлоги, союзы и частицы русского языка
            _RU_STOPWORDS = {
                "В","НА","К","С","У","О","А","И","НО","ИЛИ","НЕ","НИ","БЫ","ЖЕ",
                "ДЛЯ","ПО","ОТ","ДО","ЗА","ПОД","НАД","ПРИ","ИЗ","БЕЗ","ДО","ОБ",
                "ПРО","ЧТО","КАК","ТАК","ВОТ","УЖЕ","ЕЩЁ","ЕЩЕ","ВСЕ","ВСЁ","ТО",
            }
            _all_words = feat["text"].upper().split()
            words = [w for w in _all_words if w not in _RU_STOPWORDS][:2]
            if not words:
                words = _all_words[:2] if _all_words else [feat["text"].upper()]
            start_y = cy - (len(words) - 1) * feat_lh // 2
            for li, word in enumerate(words):
                els.append(
                    f'<text x="{tx_f}" y="{start_y + li * feat_lh}" '
                    f'font-family="{FONT_SEMI}" font-size="{feat_fs}" font-weight="600" '
                    f'letter-spacing="1.0" '
                    f'fill="{f_col}" stroke="{sk_col}" stroke-width="{sk_w_f}" '
                    f'stroke-opacity="{sk_op}" paint-order="stroke fill" '
                    f'filter="url(#ts)">{word}</text>'
                )

    # Макро-кружок удалён навсегда — не восстанавливать

    # ── Сборка SVG ───────────────────────────────────────────────
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'xmlns:xlink="http://www.w3.org/1999/xlink" '
        'width="800" height="1100">\n'
        + "\n".join(els) + "\n</svg>"
    )

    print(f"[Cairo] SVG {len(svg)//1024}KB feats={len(feats)} zone={best_zone}")

    try:
        overlay_png = cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            output_width=800, output_height=1100,
        )
    except Exception as e:
        print(f"[Cairo] svg2png error: {e}")
        import traceback; traceback.print_exc()
        return None

    bg = Image.open(_io.BytesIO(raw_bytes)).convert("RGBA")
    bg = bg.resize((800, 1100), Image.LANCZOS)
    overlay = Image.open(_io.BytesIO(overlay_png)).convert("RGBA")
    bg.paste(overlay, (0, 0), overlay)
    out = _io.BytesIO()
    bg.convert("RGB").save(out, format="JPEG", quality=93)
    b64 = base64.b64encode(out.getvalue()).decode()
    print(f"[Cairo] OK ({len(out.getvalue())//1024}KB)")
    return f"data:image/jpeg;base64,{b64}"




async def health_handler(request):
    return web.Response(text="OK", headers=CORS_HEADERS)


def create_app() -> web.Application:
    app = web.Application(client_max_size=10 * 1024 * 1024)
    app.router.add_get("/health", health_handler)
    app.router.add_get("/img/{filename}", serve_temp_image)
    app.router.add_post("/generate", generate_handler)
    app.router.add_route("OPTIONS", "/generate", generate_handler)
    app.router.add_post("/generate-card", generate_card_handler)
    app.router.add_route("OPTIONS", "/generate-card", generate_card_handler)
    app.router.add_post("/faceswap", faceswap_handler)
    app.router.add_route("OPTIONS", "/faceswap", faceswap_handler)
    return app


async def start_api_server():
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()
    print("[API] Server started on http://0.0.0.0:8080")
