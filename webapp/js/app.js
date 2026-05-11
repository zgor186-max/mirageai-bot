const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let selectedTemplate = null;
let selectedPhotoBase64 = null;
let userCoins = 0;
let currentResultUrl = null;
let currentLang = "ru";

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
    renderTemplates();
    setupUpload();
});

function loadUserData() {
    const saved = localStorage.getItem("coins");
    userCoins = saved ? parseInt(saved) : 100;
    updateCoinsDisplay();
}

function updateCoinsDisplay() {
    document.getElementById("coins-count").textContent = userCoins;
}

// ── ШАБЛОНЫ ──
function renderTemplates() {
    const grid = document.getElementById("templates-grid");
    grid.innerHTML = TEMPLATES.map(t => {
        let tagHtml = "";
        if (t.tag === "Тренд")     tagHtml = `<div class="template-tag tag-trend">Тренд</div>`;
        else if (t.tag === "Новинка") tagHtml = `<div class="template-tag tag-new">Новинка</div>`;
        else if (t.tag === "Топ")  tagHtml = `<div class="template-tag tag-top">Топ</div>`;
        else if (t.tag === "Популярно") tagHtml = `<div class="template-tag tag-hot">Популярно</div>`;

        return `
        <div class="template-card" onclick="selectTemplate(${t.id})" id="card-${t.id}">
            <div class="template-img-placeholder">
                <img src="${t.photo}" alt="${t.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" onerror="this.style.display='none'">
                ${tagHtml}
                <div class="template-price-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f5a623"/><circle cx="12" cy="12" r="8" fill="#fbbf24"/><text x="12" y="16.5" text-anchor="middle" font-size="10" font-weight="bold" fill="#92400e">$</text></svg>
                    ${t.price}
                </div>
                <div class="template-name-overlay">${t.name}</div>
            </div>
        </div>`;
    }).join("");
}

// ── ВЫБОР ШАБЛОНА ──
function selectTemplate(id) {
    selectedTemplate = TEMPLATES.find(t => t.id === id);
    if (!selectedTemplate) return;

    document.querySelectorAll(".template-card").forEach(c => c.classList.remove("selected"));
    document.getElementById(`card-${id}`).classList.add("selected");
    showUpload();
}

// ── НАВИГАЦИЯ ──
function showHome() {
    switchScreen("home");
    setActiveNav("nav-home");
}

function showUpload() {
    switchScreen("upload");
    setActiveNav("nav-home");
}

function showGallery() {
    setActiveNav("nav-gallery");
    const screen = createDynamicScreen("gallery");
    const items = JSON.parse(localStorage.getItem("gallery") || "[]");

    if (items.length === 0) {
        screen.innerHTML = `
            <div class="page-header">Галерея</div>
            <div class="empty-state">
                <div class="empty-state-icon">🖼</div>
                <p>Твои работы появятся здесь</p>
            </div>`;
    } else {
        screen.innerHTML = `
            <div class="page-header">Галерея</div>
            <div class="gallery-grid">
                ${items.map(item => `
                    <div class="gallery-item" onclick="viewGalleryItem('${item.url}')">
                        <img src="${item.url}" alt="${item.name}" loading="lazy">
                        <div class="gallery-item-label">${item.emoji} ${item.name}</div>
                    </div>
                `).join("")}
            </div>`;
    }
}

function viewGalleryItem(url) {
    currentResultUrl = url;
    document.getElementById("result-image").src = url;
    switchScreen("result");
}

function shareResult() {
    if (!currentResultUrl) return;
    const data = {
        action: "result",
        template_id: selectedTemplate ? selectedTemplate.id : 0,
        template_name: selectedTemplate ? selectedTemplate.name : "",
        result_url: currentResultUrl,
        already_paid: true
    };
    tg.sendData(JSON.stringify(data));
}

function showHistory() {
    setActiveNav("nav-history");
    const screen = createDynamicScreen("history");
    const history = JSON.parse(localStorage.getItem("history") || "[]");
    if (history.length === 0) {
        screen.innerHTML = `
            <div class="page-header">История</div>
            <div class="empty-state">
                <div class="empty-state-icon">🕐</div>
                <p>История пуста.<br>Создай свой первый образ!</p>
            </div>`;
    } else {
        screen.innerHTML = `
            <div class="page-header">История</div>
            <div class="history-list">
                ${history.map(h => `
                    <div class="history-item">
                        <div class="history-emoji">${h.emoji}</div>
                        <div class="history-info">
                            <h4>${h.name}</h4>
                            <p>${h.date}</p>
                        </div>
                    </div>`).join("")}
            </div>`;
    }
}

function showBuy() {
    setActiveNav("nav-buy");
    const screen = createDynamicScreen("buy");
    screen.innerHTML = `
        <div class="page-header">Купить монеты</div>
        <div style="padding:0 16px 16px;color:#8888aa;font-size:13px">Баланс:
            <svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:middle"><circle cx="12" cy="12" r="11" fill="#f5a623"/><circle cx="12" cy="12" r="8" fill="#fbbf24"/><text x="12" y="16.5" text-anchor="middle" font-size="10" font-weight="bold" fill="#92400e">$</text></svg>
            <strong style="color:#f5a623">${userCoins}</strong>
        </div>
        <div class="buy-card" onclick="buyCoins(50,99)">
            <div class="buy-card-left"><h3>50 монет</h3><p>~3 генерации</p></div>
            <div class="buy-card-price">99 ₽</div>
        </div>
        <div class="buy-card" onclick="buyCoins(120,199)">
            <div class="buy-card-left"><h3>120 монет</h3><p>~8 генераций · Выгодно!</p></div>
            <div class="buy-card-price">199 ₽</div>
        </div>
        <div class="buy-card" onclick="buyCoins(300,399)">
            <div class="buy-card-left"><h3>300 монет</h3><p>~20 генераций · Максимум!</p></div>
            <div class="buy-card-price">399 ₽</div>
        </div>`;
}

function showProfile() {
    setActiveNav("");
    const screen = createDynamicScreen("profile");
    const user = tg.initDataUnsafe?.user;
    const name = user ? `${user.first_name} ${user.last_name || ""}`.trim() : "Пользователь";
    const username = user?.username ? `@${user.username}` : "";
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    screen.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">👤</div>
            <div class="profile-name">${name}</div>
            ${username ? `<div class="profile-username">${username}</div>` : ""}
            <div class="profile-balance">
                <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f5a623"/><circle cx="12" cy="12" r="8" fill="#fbbf24"/><text x="12" y="16.5" text-anchor="middle" font-size="10" font-weight="bold" fill="#92400e">$</text></svg>
                ${userCoins} монет
            </div>
        </div>
        <div class="profile-stats">
            <div class="stat-card">
                <div class="stat-value">${history.length}</div>
                <div class="stat-label">Генераций</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${userCoins}</div>
                <div class="stat-label">Монет осталось</div>
            </div>
        </div>
        <div style="padding:0 16px">
            <button onclick="showBuy()" style="width:100%;padding:14px;background:linear-gradient(135deg,#5c35d9,#7c5af7);border:none;border-radius:14px;color:white;font-size:16px;font-weight:700;cursor:pointer">
                Пополнить баланс
            </button>
        </div>`;
}

// ── ЯЗЫК ──
function showLanguage() {
    document.getElementById("lang-modal").style.display = "flex";
}

function closeLangModal(e) {
    if (!e || e.target === document.getElementById("lang-modal")) {
        document.getElementById("lang-modal").style.display = "none";
    }
}

function setLang(lang) {
    currentLang = lang;
    document.querySelectorAll(".lang-option").forEach(b => b.classList.remove("active"));
    event.target.classList.add("active");
    closeLangModal();
}

// ── ИНСТРУМЕНТЫ ──
function selectTool(tool) {
    if (tool === "image") {
        showHome();
    } else if (tool === "marketplace") {
        showMarketplace();
    } else {
        tg.showAlert("Этот раздел появится скоро! 🚀");
    }
}

// ── КАРТОЧКИ МАРКЕТПЛЕЙС ──
let mpSelectedStyle = "model";
let mpPhotoBase64 = null;

function showMarketplace() {
    switchScreen("marketplace");
    setActiveNav("");
}

function mpSwitchTab(tab) {
    document.getElementById("mp-tab-photo").style.display = tab === "photo" ? "block" : "none";
    document.getElementById("mp-tab-card").style.display = tab === "card" ? "block" : "none";
    document.getElementById("tab-photo").classList.toggle("active", tab === "photo");
    document.getElementById("tab-card").classList.toggle("active", tab === "card");
}

function mpHandlePhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        mpPhotoBase64 = await resizeImageToBase64(file, 800);
        document.getElementById("mp-photo-preview").src = ev.target.result;
        document.getElementById("mp-upload-area").style.display = "none";
        document.getElementById("mp-preview-container").style.display = "block";
        document.getElementById("mp-generate-btn").disabled = false;
    };
    reader.readAsDataURL(file);
}

function mpSelectStyle(style, el) {
    mpSelectedStyle = style;
    document.querySelectorAll(".mp-style-card").forEach(c => c.classList.remove("selected"));
    el.classList.add("selected");
}

let mpCardPhotoBase64 = null;
let mpCardColorScheme = "warm";
let mpCardBgStyle = "dark"; // dark | light | gradient

function mpSelectBg(style, el) {
    mpCardBgStyle = style;
    document.querySelectorAll(".mp-bg-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
}

function mpCardHandlePhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        mpCardPhotoBase64 = await resizeImageToBase64(file, 800);
        document.getElementById("mp-card-photo-preview").src = ev.target.result;
        document.getElementById("mp-card-upload-area").style.display = "none";
        document.getElementById("mp-card-preview-container").style.display = "block";
        document.getElementById("mp-card-generate-btn").disabled = false;

        // Авто-анализ товара
        mpCardAnalyze(mpCardPhotoBase64);
    };
    reader.readAsDataURL(file);
}

async function mpCardAnalyze(base64) {
    // Показываем индикатор анализа
    const fields = ["mp-card-name","mp-card-subtitle","mp-card-badge","mp-card-feat1","mp-card-feat2","mp-card-feat3"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        el.placeholder = "⏳ Анализирую товар...";
        el.disabled = true;
    });

    try {
        const POLZA_KEY = "pza_Y_e6drIevLO8ptUDrT2T5srYMGIrIEgP";
        const resp = await fetch("https://polza.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${POLZA_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-3.1-flash-lite",
                messages: [{
                    role: "user",
                    content: [
                        { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } },
                        { type: "text", text: `Внимательно посмотри на это изображение товара и точно определи что на нём изображено. Ответь ТОЛЬКО валидным JSON без markdown и без пояснений:
{
  "name": "точное название товара по-русски (1-3 слова, ЗАГЛАВНЫМИ буквами, например: ПИЖАМА В КЛЕТКУ, ШУРУПОВЁРТ, ЗИМНЯЯ КУРТКА)",
  "subtitle": "привлекательный слоган для маркетплейса по-русски (4-7 слов)",
  "badge": "главная характеристика товара (например: 100% ХЛОПОК, 900 ВТ, WIFI, 1 МЕТР)",
  "feat1": "преимущество 1 (2-3 слова)",
  "feat2": "преимущество 2 (2-3 слова)",
  "feat3": "преимущество 3 (2-3 слова)",
  "style": "тип фона — один из: warm (одежда/дом), dark (премиум/мода), tech (электроника/гаджеты), workshop (инструменты), nature (еда/природа)"
}` }
                    ]
                }]
            })
        });

        const result = await resp.json();
        console.log("Analyze API response:", JSON.stringify(result).substring(0, 500));

        // Пробуем разные форматы ответа
        let text = result?.choices?.[0]?.message?.content
            || result?.data?.[0]?.text
            || result?.output
            || result?.text
            || "";

        if (!text) throw new Error("Empty response: " + JSON.stringify(result).substring(0, 200));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in: " + text.substring(0, 200));
        const data = JSON.parse(jsonMatch[0]);

        document.getElementById("mp-card-name").value = data.name || "";
        document.getElementById("mp-card-subtitle").value = data.subtitle || "";
        document.getElementById("mp-card-badge").value = data.badge || "";
        document.getElementById("mp-card-feat1").value = data.feat1 || "";
        document.getElementById("mp-card-feat2").value = data.feat2 || "";
        document.getElementById("mp-card-feat3").value = data.feat3 || "";
        mpCardColorScheme = data.style || "warm";

    } catch (e) {
        console.warn("Auto-analyze failed:", e.message);
    } finally {
        const placeholders = ["Название товара", "Подзаголовок", "Значок (напр: 100% ХЛОПОК)", "Преимущество 1", "Преимущество 2", "Преимущество 3"];
        fields.forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el.placeholder.includes("⏳")) return;
            el.placeholder = placeholders[i];
            el.disabled = false;
        });
        fields.forEach(id => { document.getElementById(id).disabled = false; });
    }
}

function mpCardAiIdea() {
    if (!mpCardPhotoBase64) {
        tg.showAlert("Сначала загрузи фото товара!");
        return;
    }
    mpCardAnalyze(mpCardPhotoBase64);
}

async function mpCardGenerate() {
    if (!mpCardPhotoBase64) return;

    const name = document.getElementById("mp-card-name").value.trim();
    const subtitle = document.getElementById("mp-card-subtitle").value.trim();
    const badge = document.getElementById("mp-card-badge").value.trim();
    const feat1 = document.getElementById("mp-card-feat1").value.trim();
    const feat2 = document.getElementById("mp-card-feat2").value.trim();
    const feat3 = document.getElementById("mp-card-feat3").value.trim();

    const bgStylesMap = {
        warm:     { dark: "elegant warm bedroom with soft golden lighting and cozy shadows", light: "bright cozy living room with warm natural sunlight and cream tones" },
        dark:     { dark: "dramatic dark studio with moody cinematic lighting and subtle fog", light: "bright minimalist white studio with soft diffused light" },
        tech:     { dark: "modern tech environment with blue neon lighting and dark background", light: "clean bright white tech desk setup with natural daylight" },
        workshop: { dark: "professional workshop with dramatic industrial dark lighting", light: "bright professional workshop with white walls and daylight" },
        nature:   { dark: "lush dark forest with dramatic evening green light", light: "bright fresh outdoor nature setting with soft morning sunlight" },
    };
    const gradientDescMap = {
        warm: "elegant room with golden hour sunset light transitioning from warm shadow to bright",
        dark: "dramatic studio with cinematic gradient from deep shadow to soft highlight",
        tech: "modern tech space with gradient from deep blue dark to bright neon lit area",
        workshop: "workshop space with gradient from dark dramatic shadow to bright working light",
        nature: "nature setting with gradient from shaded green forest to bright sunny meadow",
    };
    const schemeStyles = bgStylesMap[mpCardColorScheme] || bgStylesMap.warm;
    let bgDesc;
    if (mpCardBgStyle === "light") bgDesc = schemeStyles.light;
    else if (mpCardBgStyle === "gradient") bgDesc = gradientDescMap[mpCardColorScheme] || gradientDescMap.warm;
    else bgDesc = schemeStyles.dark;

    const prompt = `Change only the background of this product photo to: ${bgDesc}. The product itself must remain exactly as shown - same shape, colors, materials. STRICT RULES: NO text, NO letters, NO words, NO brand names, NO logos, NO watermarks anywhere in the image. Clean professional product photo for marketplace.`;

    switchScreen("loading");
    animateSteps();

    try {
        const POLZA_KEY = "pza_Y_e6drIevLO8ptUDrT2T5srYMGIrIEgP";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000);
        const resp = await fetch("https://polza.ai/api/v1/media", {
            signal: controller.signal,
            method: "POST",
            headers: { "Authorization": `Bearer ${POLZA_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "google/gemini-3.1-flash-image-preview",
                input: { prompt, images: [{ type: "base64", data: "data:image/jpeg;base64," + mpCardPhotoBase64 }] }
            })
        });
        clearTimeout(timeout);
        const result = await resp.json();
        const resultUrl = result?.data?.[0]?.url || result?.url || result?.data?.url;
        if (!resultUrl) throw new Error("No image in response");

        // Рисуем текст поверх через Canvas
        const finalBase64 = await drawCardOverlay(resultUrl, { name, subtitle, badge, feat1, feat2, feat3 });

        userCoins = Math.max(0, userCoins - 20);
        localStorage.setItem("coins", userCoins);
        updateCoinsDisplay();

        const gallery = JSON.parse(localStorage.getItem("gallery") || "[]");
        gallery.unshift({ id: Date.now(), emoji: "🏷", name: name || "Карточка товара", url: finalBase64, date: new Date().toLocaleDateString("ru") });
        localStorage.setItem("gallery", JSON.stringify(gallery.slice(0, 50)));

        finishProgress();
        await new Promise(r => setTimeout(r, 500));
        currentResultUrl = finalBase64;
        document.getElementById("result-image").src = finalBase64;
        switchScreen("result");
    } catch (err) {
        tg.showAlert("❌ Ошибка: " + (err.message || String(err)));
        showMarketplace();
    }
}

const COLOR_SCHEMES = {
    warm:     { title: "#fff8e8", badge: "#f5c842", featStroke: "rgba(245,200,70,0.85)",  featText: "#fff3cc" },
    dark:     { title: "#ffffff", badge: "#e8c84a", featStroke: "rgba(220,185,60,0.85)",  featText: "#ffe680" },
    tech:     { title: "#e8f8ff", badge: "#00d4ff", featStroke: "rgba(0,210,255,0.85)",   featText: "#a0eeff" },
    workshop: { title: "#fff5e0", badge: "#ffb700", featStroke: "rgba(255,185,0,0.85)",   featText: "#ffd966" },
    nature:   { title: "#f0fff2", badge: "#5eff6a", featStroke: "rgba(80,230,90,0.85)",   featText: "#b8ffbe" },
};

async function drawCardOverlay(imageUrl, { name, subtitle, badge, feat1, feat2, feat3 }) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const W = 800, H = 1060;
            const canvas = document.createElement("canvas");
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext("2d");
            const C = COLOR_SCHEMES[mpCardColorScheme] || COLOR_SCHEMES.warm;
            const PAD = 28;

            function rr(x, y, w, h, r, fill, stroke, strokeW) {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, r);
                if (fill) { ctx.fillStyle = fill; ctx.fill(); }
                if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW || 2; ctx.stroke(); }
            }

            function shadow(blur, color) {
                ctx.shadowBlur = blur || 0;
                ctx.shadowColor = color || "transparent";
                ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            }

            function autoSize(text, maxW, max, min) {
                let sz = max;
                ctx.font = `900 ${sz}px 'Arial Black', Arial`;
                while (sz > min && ctx.measureText(text).width > maxW) sz -= 1;
                return sz;
            }

            // ── Фото на весь холст ──
            // Crop-fit: scale proportionally so photo fills width, center vertically
            const scale = Math.max(W / img.width, H / img.height);
            const sw = img.width * scale, sh = img.height * scale;
            const sx = (W - sw) / 2, sy = (H - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh);

            // ── Gradient top (зависит от выбранного стиля фона) ──
            const bgMode = mpCardBgStyle || "dark";
            const topColor = bgMode === "light" ? "255,255,255" : "0,0,0";
            // Сплошная полоса сверху чтобы скрыть текст ИИ
            ctx.fillStyle = `rgba(${topColor},1)`;
            ctx.fillRect(0, 0, W, H * 0.28);
            // Плавный переход из сплошного в прозрачный
            const gTop = ctx.createLinearGradient(0, H * 0.28, 0, H * 0.60);
            gTop.addColorStop(0,   `rgba(${topColor},1)`);
            gTop.addColorStop(0.3, `rgba(${topColor},0.75)`);
            gTop.addColorStop(0.7, `rgba(${topColor},0.25)`);
            gTop.addColorStop(1,   `rgba(${topColor},0)`);
            ctx.fillStyle = gTop;
            ctx.fillRect(0, H * 0.28, W, H * 0.32);

            // ── Gradient bottom (features zone) ──
            const gBot = ctx.createLinearGradient(0, H * 0.58, 0, H);
            gBot.addColorStop(0, "rgba(0,0,0,0)");
            gBot.addColorStop(0.4, "rgba(0,0,0,0.70)");
            gBot.addColorStop(1, "rgba(0,0,0,0.96)");
            ctx.fillStyle = gBot;
            ctx.fillRect(0, H * 0.58, W, H * 0.42);

            // ── BADGE top-right pill ──
            if (badge) {
                const badgeText = badge.toUpperCase();
                ctx.font = `bold 20px Arial`;
                const bW = Math.max(ctx.measureText(badgeText).width + 32, 80);
                const bH = 38;
                const bX = W - bW - PAD, bY = PAD;
                rr(bX, bY, bW, bH, bH / 2, C.badge);
                shadow(8, "rgba(0,0,0,0.5)");
                ctx.fillStyle = mpCardColorScheme === "warm" ? "#1a1000" : "#000000";
                ctx.font = `bold 19px Arial`;
                ctx.textAlign = "center";
                ctx.fillText(badgeText, bX + bW / 2, bY + 25);
                ctx.textAlign = "left";
                shadow(0);
            }

            // ── TITLE — each word fills full width ──
            const titleColor = bgMode === "light" ? "#111111" : C.title;
            const titleShadowColor = bgMode === "light" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.95)";
            const titleWords = (name || "").toUpperCase().split(/\s+/).filter(Boolean);
            let ty = 72;
            for (const word of titleWords) {
                const sz = autoSize(word, W - PAD * 2, 108, 26);
                shadow(16, titleShadowColor);
                ctx.font = `900 ${sz}px 'Arial Black', Arial`;
                ctx.fillStyle = titleColor;
                ctx.fillText(word, PAD, ty);
                shadow(0);
                ty += Math.round(sz * 1.08);
                if (ty > H * 0.46) break;
            }

            // ── SUBTITLE below title ──
            if (subtitle && ty < H * 0.50) {
                ctx.font = `500 22px Arial`;
                ctx.fillStyle = "rgba(255,255,255,0.78)";
                shadow(8, "rgba(0,0,0,0.9)");
                let line = "", sy2 = ty + 6;
                for (const w of subtitle.split(" ")) {
                    const t = line + w + " ";
                    if (ctx.measureText(t).width > W - PAD * 2 && line) {
                        ctx.fillText(line.trim(), PAD, sy2); sy2 += 28; line = w + " ";
                    } else line = t;
                    if (sy2 > H * 0.52) break;
                }
                if (line && sy2 <= H * 0.52) ctx.fillText(line.trim(), PAD, sy2);
                shadow(0);
            }

            // ── FEATURES — bottom pills with checkmark ──
            const feats = [feat1, feat2, feat3].filter(Boolean);
            if (feats.length) {
                const pillH = 52;
                const gap = 12;
                const totalH = feats.length * pillH + (feats.length - 1) * gap;
                let fy = H - PAD - totalH;

                feats.forEach((f) => {
                    const text = f;
                    ctx.font = `600 20px Arial`;
                    const textW = ctx.measureText(text).width;
                    const checkSize = 28;
                    const pillW = Math.min(checkSize + 12 + textW + PAD * 1.5, W - PAD * 2);
                    const pillX = PAD;

                    // pill background
                    rr(pillX, fy, pillW, pillH, pillH / 2, "rgba(255,255,255,0.13)", C.featStroke, 1.5);

                    // checkmark circle
                    const cx2 = pillX + pillH / 2;
                    const cy2 = fy + pillH / 2;
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, 11, 0, Math.PI * 2);
                    ctx.fillStyle = C.badge;
                    ctx.fill();

                    // checkmark ✓
                    ctx.strokeStyle = mpCardColorScheme === "warm" ? "#1a1000" : "#000";
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                    ctx.beginPath();
                    ctx.moveTo(cx2 - 5, cy2);
                    ctx.lineTo(cx2 - 1, cy2 + 5);
                    ctx.lineTo(cx2 + 6, cy2 - 5);
                    ctx.stroke();

                    // text
                    shadow(6, "rgba(0,0,0,0.8)");
                    ctx.fillStyle = C.featText;
                    ctx.font = `600 20px Arial`;
                    ctx.textAlign = "left";
                    ctx.fillText(text, pillX + pillH / 2 + 16, fy + pillH / 2 + 7);
                    shadow(0);

                    fy += pillH + gap;
                });
            }

            resolve(canvas.toDataURL("image/jpeg", 0.93));
        };
        img.onerror = reject;
        img.src = imageUrl;
    });
}

async function mpGenerate() {
    if (!mpPhotoBase64) return;

    const stylePrompts = {
        model: "Place this product on a professional fashion model. Show the product being worn naturally. Keep the product exactly as shown. Professional e-commerce photo style.",
        store: "Place this product on a clean store hanger or display stand. Professional retail photography, neutral background.",
        flat: "Create a flat lay photo of this product. Shot from directly above, clean minimal background, professional product photography.",
        studio: "Create a professional studio catalog photo of this product. Clean neutral background, perfect lighting, e-commerce style."
    };

    const wishes = document.getElementById("mp-wishes").value.trim();
    const prompt = stylePrompts[mpSelectedStyle] + (wishes ? " Additional details: " + wishes : "");

    switchScreen("loading");
    animateSteps();

    try {
        const POLZA_KEY = "pza_Y_e6drIevLO8ptUDrT2T5srYMGIrIEgP";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000);
        const resp = await fetch("https://polza.ai/api/v1/media", {
            signal: controller.signal,
            method: "POST",
            headers: {
                "Authorization": `Bearer ${POLZA_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-3.1-flash-image-preview",
                input: {
                    prompt,
                    images: [{ type: "base64", data: "data:image/jpeg;base64," + mpPhotoBase64 }]
                }
            })
        });
        clearTimeout(timeout);
        const result = await resp.json();

        const resultUrl = result?.data?.[0]?.url || result?.url || result?.data?.url;
        if (!resultUrl) throw new Error("No image in response");

        userCoins = Math.max(0, userCoins - 20);
        localStorage.setItem("coins", userCoins);
        updateCoinsDisplay();

        const gallery = JSON.parse(localStorage.getItem("gallery") || "[]");
        gallery.unshift({ id: Date.now(), emoji: "📦", name: "Карточка товара", url: resultUrl, date: new Date().toLocaleDateString("ru") });
        localStorage.setItem("gallery", JSON.stringify(gallery.slice(0, 50)));

        finishProgress();
        await new Promise(r => setTimeout(r, 500));
        currentResultUrl = resultUrl;
        document.getElementById("result-image").src = resultUrl;
        switchScreen("result");

    } catch (err) {
        tg.showAlert("❌ Ошибка: " + (err.message || String(err)));
        showMarketplace();
    }
}

// ── ЭКРАНЫ ──
function switchScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const screen = document.getElementById(`screen-${name}`);
    if (screen) screen.classList.add("active");
    else createDynamicScreen(name).classList.add("active");
}

function createDynamicScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    let s = document.getElementById(`screen-${name}`);
    if (!s) {
        s = document.createElement("div");
        s.id = `screen-${name}`;
        s.className = "screen";
        document.body.insertBefore(s, document.querySelector(".bottom-nav"));
    }
    s.classList.add("active");
    return s;
}

function setActiveNav(id) {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    if (id) {
        const btn = document.getElementById(id);
        if (btn) btn.classList.add("active");
    }
}

// ── ЗАГРУЗКА ФОТО ──
function setupUpload() {
    const area = document.getElementById("upload-area");
    const input = document.getElementById("photo-input");
    area.addEventListener("click", () => input.click());
    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const blob = file;
            selectedPhotoBase64 = await resizeImageToBase64(blob, 800);
            document.getElementById("photo-preview").src = ev.target.result;
            document.getElementById("upload-area").style.display = "none";
            document.getElementById("preview-container").style.display = "block";
            document.getElementById("generate-btn").disabled = false;
        };
        reader.readAsDataURL(file);
    });
}

function changePhoto() {
    document.getElementById("photo-input").click();
}

// ── ГЕНЕРАЦИЯ ──
async function resizeImageToBase64(blob, maxSize = 800) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                else { w = Math.round(w * maxSize / h); h = maxSize; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function fetchImageAsBase64(url) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return resizeImageToBase64(blob, 800);
}

async function callPolzaAPI(templateBase64, userBase64) {
    const POLZA_KEY = "pza_Y_e6drIevLO8ptUDrT2T5srYMGIrIEgP";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    const resp = await fetch("https://polza.ai/api/v1/media", {
        signal: controller.signal,
        method: "POST",
        headers: {
            "Authorization": `Bearer ${POLZA_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            input: {
                prompt: "Face swap: replace the face of the person in the first image with the face from the second image. Keep everything else in the first image exactly the same — pose, background, clothes, lighting.",
                images: [
                    { type: "base64", data: "data:image/jpeg;base64," + templateBase64 },
                    { type: "base64", data: "data:image/jpeg;base64," + userBase64 }
                ]
            }
        })
    });
    clearTimeout(timeout);
    const result = await resp.json();
    console.log("Polza response:", JSON.stringify(result).substring(0, 400));

    if (result?.data?.[0]?.url) return result.data[0].url;
    if (result?.url) return result.url;
    if (result?.data?.url) return result.data.url;

    throw new Error("No image in response: " + JSON.stringify(result).substring(0, 300));
}

async function generate() {
    if (!selectedTemplate || !selectedPhotoBase64) return;

    switchScreen("loading");
    animateSteps();

    try {
        console.log("Step 1: fetching template image...");
        const templateBase64 = await fetchImageAsBase64(selectedTemplate.photo);
        console.log("Step 1 done, size:", templateBase64.length);
        console.log("Step 2: calling Polza API...");
        const resultUrl = await callPolzaAPI(templateBase64, selectedPhotoBase64);
        console.log("Step 2 done, url:", resultUrl);

        // Сохраняем в галерею
        const history = JSON.parse(localStorage.getItem("gallery") || "[]");
        history.unshift({
            id: Date.now(),
            emoji: selectedTemplate.emoji,
            name: selectedTemplate.name,
            url: resultUrl,
            date: new Date().toLocaleDateString("ru")
        });
        localStorage.setItem("gallery", JSON.stringify(history.slice(0, 50)));

        // Списываем монеты
        userCoins = Math.max(0, userCoins - selectedTemplate.price);
        localStorage.setItem("coins", userCoins);
        updateCoinsDisplay();

        // Показываем результат в мини-апп
        finishProgress();
        await new Promise(r => setTimeout(r, 500));
        currentResultUrl = resultUrl;
        document.getElementById("result-image").src = resultUrl;
        switchScreen("result");

    } catch (err) {
        console.error("Generate error:", err);
        tg.showAlert("❌ Ошибка: " + (err.message || String(err)));
        showHome();
        return;
    }

}

let progressInterval = null;

function animateSteps() {
    let progress = 0;
    const percent = document.getElementById("loading-percent");
    const bar = document.getElementById("loading-bar-fill");
    const steps = [
        document.getElementById("step-1"),
        document.getElementById("step-2"),
        document.getElementById("step-3")
    ];

    steps.forEach(s => s && s.classList.remove("active"));
    if (steps[0]) steps[0].classList.add("active");

    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(() => {
        const step = progress < 40 ? 2 : progress < 70 ? 1 : 0.4;
        progress = Math.min(progress + step, 90);

        if (percent) percent.textContent = Math.round(progress) + "%";
        if (bar) bar.style.width = progress + "%";

        if (progress >= 33 && steps[1]) {
            steps[0] && steps[0].classList.remove("active");
            steps[1].classList.add("active");
        }
        if (progress >= 66 && steps[2]) {
            steps[1] && steps[1].classList.remove("active");
            steps[2].classList.add("active");
        }
    }, 500);
}

function finishProgress() {
    if (progressInterval) clearInterval(progressInterval);
    const percent = document.getElementById("loading-percent");
    const bar = document.getElementById("loading-bar-fill");
    const steps = [
        document.getElementById("step-1"),
        document.getElementById("step-2"),
        document.getElementById("step-3")
    ];
    if (percent) percent.textContent = "100%";
    if (bar) bar.style.width = "100%";
    steps.forEach(s => s && s.classList.remove("active"));
    if (steps[2]) steps[2].classList.add("active");
}

function buyCoins(amount, price) {
    tg.showAlert(`Оплата через Telegram Stars появится скоро!\nА пока напиши администратору.`);
}
