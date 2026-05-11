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

function sendToChat() {
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

function downloadResult() {
    if (!currentResultUrl) return;
    if (currentResultUrl.startsWith("data:")) {
        // Base64 — создаём blob и скачиваем
        fetch(currentResultUrl)
            .then(r => r.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "MirageAI_" + Date.now() + ".jpg";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            });
    } else {
        // Обычный URL
        if (tg.downloadFile) {
            tg.downloadFile(currentResultUrl, "MirageAI.jpg");
        } else {
            window.open(currentResultUrl, "_blank");
        }
    }
}

function forwardResult() {
    if (!currentResultUrl) return;
    // Если это base64 — конвертируем в blob и шарим
    if (currentResultUrl.startsWith("data:")) {
        fetch(currentResultUrl)
            .then(r => r.blob())
            .then(blob => {
                const file = new File([blob], "MirageAI.jpg", { type: "image/jpeg" });
                if (navigator.share && navigator.canShare({ files: [file] })) {
                    navigator.share({ files: [file], title: "MirageAI" });
                } else {
                    // Fallback — скачиваем
                    downloadResult();
                }
            });
    } else {
        if (navigator.share) {
            navigator.share({ url: currentResultUrl, title: "MirageAI" });
        } else {
            downloadResult();
        }
    }
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
        warm:     { dark: "cozy dimly lit bedroom with warm amber lamp light, dark wooden furniture, soft shadows", light: "clean neutral beige studio backdrop with very soft side lighting, no harsh reflections" },
        dark:     { dark: "dramatic pure black studio background with subtle spotlight on product", light: "clean light grey studio background with soft professional lighting" },
        tech:     { dark: "dark carbon fiber surface with subtle blue LED accent lighting from sides", light: "clean white desk surface with soft natural light from a window" },
        workshop: { dark: "dark industrial concrete surface with focused spotlight from above", light: "light grey concrete surface with soft diffused daylight" },
        nature:   { dark: "dark green forest floor with soft dappled evening light", light: "clean white marble surface with fresh green leaves as accent" },
    };
    const schemeStyles = bgStylesMap[mpCardColorScheme] || bgStylesMap.warm;
    const bgDesc = mpCardBgStyle === "light" ? schemeStyles.light : schemeStyles.dark;

    const prompt = `Professional product photography: place this exact product on a ${bgDesc}. The product must be the clear focal point, sharp and well-defined. Background must NOT overpower or blend with the product. NO text, NO letters, NO logos, NO watermarks anywhere. Studio quality marketplace photo.`;

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
        img.onload = async () => {
            await document.fonts.load("700 60px 'Oswald'");
            const W = 800, H = 1100;
            const canvas = document.createElement("canvas");
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext("2d");
            const scheme = mpCardColorScheme || "warm";
            const isLight = (mpCardBgStyle || "dark") === "light";
            const PAD = 30;
            const feats = [feat1, feat2, feat3].filter(Boolean);

            function rr(x, y, w, h, r, fill, stroke, sw) {
                ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
                if (fill) { ctx.fillStyle = fill; ctx.fill(); }
                if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 2; ctx.stroke(); }
            }
            function autoSize(text, maxW, max, min, font) {
                let sz = max;
                ctx.font = `${font || '700'} ${sz}px 'Oswald', Arial`;
                while (sz > min && ctx.measureText(text).width > maxW) sz -= 1;
                return sz;
            }
            function drawPhoto(topH, botY) {
                const srcTop = Math.floor(img.height * 0.28);
                const srcBot = Math.floor(img.height * 0.92);
                ctx.drawImage(img, 0, srcTop, img.width, srcBot - srcTop, 0, topH, W, botY - topH);
            }
            function drawFade(y, h, fromColor, toColor) {
                const g = ctx.createLinearGradient(0, y, 0, y + h);
                g.addColorStop(0, fromColor); g.addColorStop(1, toColor);
                ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
            }
            function drawBadge(text, x, y, bg, textColor) {
                ctx.font = `bold 18px Arial`;
                const bW = Math.max(ctx.measureText(text).width + 28, 80);
                rr(x - bW, y, bW, 34, 17, bg);
                ctx.fillStyle = textColor || "#000";
                ctx.textAlign = "center";
                ctx.fillText(text, x - bW / 2, y + 22);
                ctx.textAlign = "left";
            }
            function drawTitle(words, startY, maxY, color, maxW) {
                let ty = startY;
                for (const word of words) {
                    const sz = autoSize(word, maxW || W - PAD * 2, 118, 26);
                    ctx.font = `700 ${sz}px 'Oswald', Arial`;
                    ctx.fillStyle = color;
                    ctx.fillText(word, PAD, ty);
                    ty += Math.round(sz * 1.05);
                    if (ty > maxY) break;
                }
                return ty;
            }
            function drawSubtitle(text, y, color, size) {
                ctx.font = `400 ${size || 21}px Arial`;
                ctx.fillStyle = color;
                ctx.fillText(text.substring(0, 52), PAD, y);
            }

            // ════════════════════════════════════════
            // 1. ОДЕЖДА / ОБУВЬ — светлый минимализм
            // ════════════════════════════════════════
            if (scheme === "warm") {
                const topBg = isLight ? "#fafafa" : "#1a1208";
                const botBg = isLight ? "#ffffff" : "#120e06";
                const accentClr = "#d4a017";
                const titleClr = isLight ? "#1a1a1a" : "#fff8e8";
                const subClr = isLight ? "#666" : "#c8a96e";
                const topH = Math.floor(H * 0.32), botY = Math.floor(H * 0.77);

                ctx.fillStyle = topBg; ctx.fillRect(0, 0, W, topH);
                ctx.fillStyle = accentClr; ctx.fillRect(0, topH - 3, W, 3);
                drawPhoto(topH, botY);
                drawFade(topH, 50, topBg, "rgba(0,0,0,0)");
                ctx.fillStyle = botBg; ctx.fillRect(0, botY, W, H - botY);
                ctx.fillStyle = accentClr; ctx.fillRect(0, botY, W, 3);
                drawFade(botY - 50, 50, "rgba(0,0,0,0)", botBg);

                if (badge) drawBadge(badge.toUpperCase(), W - PAD, PAD, accentClr, "#1a1000");
                drawTitle((name || "").toUpperCase().split(/\s+/), 68, topH - 20, titleClr);
                if (subtitle) drawSubtitle(subtitle, botY + 34, subClr);

                if (feats.length) {
                    const pillH = 52, gap = 12;
                    const colW = (W - PAD * 2 - gap * (feats.length - 1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i * (colW + gap), fy = botY + 56;
                        rr(fx, fy, colW, pillH, 26, isLight ? "#1a1a1a" : "#2a2010", accentClr, 1.5);
                        ctx.beginPath(); ctx.arc(fx + 20, fy + pillH/2, 8, 0, Math.PI*2);
                        ctx.fillStyle = accentClr; ctx.fill();
                        ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round";
                        ctx.beginPath(); ctx.moveTo(fx+15, fy+pillH/2); ctx.lineTo(fx+19, fy+pillH/2+4); ctx.lineTo(fx+25, fy+pillH/2-4); ctx.stroke();
                        ctx.fillStyle = "#fff"; ctx.font = `600 16px Arial`;
                        const fw = f.split(" ");
                        if (fw.length > 1 && ctx.measureText(f).width > colW - 38) {
                            ctx.fillText(fw[0], fx+36, fy+20); ctx.fillText(fw.slice(1).join(" "), fx+36, fy+38);
                        } else ctx.fillText(f, fx+36, fy+pillH/2+6);
                    });
                }

            // ════════════════════════════════════════
            // 2. ПРЕМИУМ / АКСЕССУАРЫ — тёмный элегантный
            // ════════════════════════════════════════
            } else if (scheme === "dark") {
                const topBg = isLight ? "#f0ede8" : "#0a0a0a";
                const botBg = isLight ? "#e8e4de" : "#050505";
                const gold = "#c9a84c";
                const titleClr = isLight ? "#111" : "#fff";
                const topH = Math.floor(H * 0.30), botY = Math.floor(H * 0.75);

                ctx.fillStyle = topBg; ctx.fillRect(0, 0, W, topH);
                ctx.fillStyle = gold; ctx.fillRect(PAD, topH - 2, W - PAD*2, 1);
                drawPhoto(topH, botY);
                drawFade(topH, 60, topBg, "rgba(0,0,0,0)");
                ctx.fillStyle = botBg; ctx.fillRect(0, botY, W, H - botY);
                ctx.fillStyle = gold; ctx.fillRect(PAD, botY, W - PAD*2, 1);
                drawFade(botY - 60, 60, "rgba(0,0,0,0)", botBg);

                if (badge) drawBadge(badge.toUpperCase(), W - PAD, PAD, gold, "#000");
                ctx.fillStyle = gold; ctx.font = `24px Arial`;
                ctx.fillText("◆", PAD, 54);
                drawTitle((name || "").toUpperCase().split(/\s+/), 68, topH - 20, titleClr, W - PAD*2 - 20);
                if (subtitle) drawSubtitle(subtitle, botY + 30, isLight ? "#555" : "#a08060");

                if (feats.length) {
                    const pillH = 50, gap = 14;
                    const colW = (W - PAD * 2 - gap * (feats.length - 1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i * (colW + gap), fy = botY + 50;
                        rr(fx, fy, colW, pillH, 4, "transparent", gold, 1);
                        ctx.fillStyle = gold; ctx.font = `bold 16px Arial`;
                        ctx.fillText("◆", fx + 12, fy + pillH/2 + 6);
                        ctx.fillStyle = titleClr; ctx.font = `600 16px Arial`;
                        ctx.fillText(f, fx + 34, fy + pillH/2 + 6);
                    });
                }

            // ════════════════════════════════════════
            // 3. ЭЛЕКТРОНИКА / ГАДЖЕТЫ — тёмный техно
            // ════════════════════════════════════════
            } else if (scheme === "tech") {
                const topBg = isLight ? "#e8f4ff" : "#050d1a";
                const botBg = isLight ? "#ddeeff" : "#030a14";
                const cyan = "#00c8ff";
                const titleClr = isLight ? "#001830" : "#ffffff";
                const topH = Math.floor(H * 0.28), botY = Math.floor(H * 0.74);

                ctx.fillStyle = topBg; ctx.fillRect(0, 0, W, topH);
                const techGrad = ctx.createLinearGradient(0, 0, W, 0);
                techGrad.addColorStop(0, cyan); techGrad.addColorStop(1, "transparent");
                ctx.fillStyle = techGrad; ctx.fillRect(0, topH - 3, W, 3);

                drawPhoto(topH, botY);
                drawFade(topH, 55, topBg, "rgba(0,0,0,0)");
                ctx.fillStyle = botBg; ctx.fillRect(0, botY, W, H - botY);
                ctx.fillStyle = techGrad; ctx.fillRect(0, botY, W, 3);
                drawFade(botY - 55, 55, "rgba(0,0,0,0)", botBg);

                if (badge) drawBadge(badge.toUpperCase(), W - PAD, PAD, cyan, "#000");
                ctx.strokeStyle = cyan; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(PAD, 18); ctx.lineTo(PAD, 8); ctx.lineTo(PAD+12, 8); ctx.stroke();
                drawTitle((name || "").toUpperCase().split(/\s+/), 65, topH - 15, titleClr);
                if (subtitle) drawSubtitle(subtitle, botY + 30, isLight ? "#004060" : "#4ab8d8");

                if (feats.length) {
                    const pillH = 52, gap = 10;
                    const colW = (W - PAD * 2 - gap * (feats.length - 1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i * (colW + gap), fy = botY + 48;
                        rr(fx, fy, colW, pillH, 6, isLight ? "rgba(0,80,120,0.12)" : "rgba(0,200,255,0.08)", cyan, 1);
                        ctx.fillStyle = cyan;
                        ctx.beginPath(); ctx.moveTo(fx+14, fy+pillH/2-6); ctx.lineTo(fx+14, fy+pillH/2+6); ctx.lineTo(fx+24, fy+pillH/2); ctx.fill();
                        ctx.fillStyle = titleClr; ctx.font = `600 16px Arial`;
                        const fw = f.split(" ");
                        if (fw.length > 1 && ctx.measureText(f).width > colW - 38) {
                            ctx.fillText(fw[0], fx+32, fy+20); ctx.fillText(fw.slice(1).join(" "), fx+32, fy+38);
                        } else ctx.fillText(f, fx+32, fy+pillH/2+6);
                    });
                }

            // ════════════════════════════════════════
            // 4. ИНСТРУМЕНТЫ / СТРОЙКА — мощный промышленный
            // ════════════════════════════════════════
            } else if (scheme === "workshop") {
                const topBg = isLight ? "#1c1c1c" : "#111111";
                const botBg = isLight ? "#1c1c1c" : "#0d0d0d";
                const yellow = "#ffc200";
                const topH = Math.floor(H * 0.30), botY = Math.floor(H * 0.76);

                ctx.fillStyle = topBg; ctx.fillRect(0, 0, W, topH);
                ctx.save();
                for (let xi = -20; xi < W + 20; xi += 22) {
                    ctx.fillStyle = xi % 44 < 22 ? "rgba(255,194,0,0.07)" : "transparent";
                    ctx.fillRect(xi, 0, 11, topH);
                }
                ctx.restore();
                ctx.fillStyle = yellow; ctx.fillRect(0, topH - 4, W, 4);

                drawPhoto(topH, botY);
                drawFade(topH, 50, topBg, "rgba(0,0,0,0)");
                ctx.fillStyle = botBg; ctx.fillRect(0, botY, W, H - botY);
                ctx.fillStyle = yellow; ctx.fillRect(0, botY, W, 4);
                drawFade(botY - 50, 50, "rgba(0,0,0,0)", botBg);

                if (badge) drawBadge(badge.toUpperCase(), W - PAD, PAD, yellow, "#000");
                drawTitle((name || "").toUpperCase().split(/\s+/), 68, topH - 20, "#ffffff");
                if (subtitle) drawSubtitle(subtitle, botY + 32, "#aaa");

                if (feats.length) {
                    const pillH = 54, gap = 10;
                    const colW = (W - PAD * 2 - gap * (feats.length - 1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i * (colW + gap), fy = botY + 50;
                        rr(fx, fy, colW, pillH, 4, "rgba(255,194,0,0.12)", yellow, 1.5);
                        rr(fx, fy, 4, pillH, [4,0,0,4], yellow);
                        ctx.fillStyle = "#fff"; ctx.font = `600 16px Arial`;
                        const fw = f.split(" ");
                        if (fw.length > 1 && ctx.measureText(f).width > colW - 30) {
                            ctx.fillText(fw[0], fx+18, fy+20); ctx.fillText(fw.slice(1).join(" "), fx+18, fy+38);
                        } else ctx.fillText(f, fx+18, fy+pillH/2+6);
                    });
                }

            // ════════════════════════════════════════
            // 5. КОСМЕТИКА / ЕДА / ПРИРОДА — мягкий органик
            // ════════════════════════════════════════
            } else {
                const topBg = isLight ? "#f0f7f0" : "#0d1a0d";
                const botBg = isLight ? "#e8f4e8" : "#081008";
                const green = "#4caf50";
                const titleClr = isLight ? "#1a2e1a" : "#e8ffe8";
                const topH = Math.floor(H * 0.30), botY = Math.floor(H * 0.76);

                ctx.fillStyle = topBg; ctx.fillRect(0, 0, W, topH);
                ctx.strokeStyle = green; ctx.lineWidth = 2.5;
                ctx.beginPath();
                for (let xi = 0; xi < W; xi += 20) {
                    xi === 0 ? ctx.moveTo(xi, topH - 8) : ctx.quadraticCurveTo(xi - 10, topH - 14, xi, topH - 8);
                }
                ctx.stroke();

                drawPhoto(topH, botY);
                drawFade(topH, 50, topBg, "rgba(0,0,0,0)");
                ctx.fillStyle = botBg; ctx.fillRect(0, botY, W, H - botY);
                drawFade(botY - 50, 50, "rgba(0,0,0,0)", botBg);

                if (badge) drawBadge(badge.toUpperCase(), W - PAD, PAD, green, "#fff");
                ctx.font = "28px Arial"; ctx.fillText("🌿", PAD, 50);
                drawTitle((name || "").toUpperCase().split(/\s+/), 68, topH - 20, titleClr, W - PAD*2 - 30);
                if (subtitle) drawSubtitle(subtitle, botY + 30, isLight ? "#3a5e3a" : "#7fc87f");

                if (feats.length) {
                    const pillH = 52, gap = 12;
                    const colW = (W - PAD * 2 - gap * (feats.length - 1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i * (colW + gap), fy = botY + 50;
                        rr(fx, fy, colW, pillH, 26, isLight ? "rgba(76,175,80,0.15)" : "rgba(76,175,80,0.2)", green, 1.5);
                        ctx.beginPath(); ctx.arc(fx+20, fy+pillH/2, 9, 0, Math.PI*2);
                        ctx.fillStyle = green; ctx.fill();
                        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round";
                        ctx.beginPath(); ctx.moveTo(fx+15, fy+pillH/2); ctx.lineTo(fx+19, fy+pillH/2+4); ctx.lineTo(fx+25, fy+pillH/2-4); ctx.stroke();
                        ctx.fillStyle = titleClr; ctx.font = `600 16px Arial`;
                        const fw = f.split(" ");
                        if (fw.length > 1 && ctx.measureText(f).width > colW - 40) {
                            ctx.fillText(fw[0], fx+36, fy+20); ctx.fillText(fw.slice(1).join(" "), fx+36, fy+38);
                        } else ctx.fillText(f, fx+36, fy+pillH/2+6);
                    });
                }
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
