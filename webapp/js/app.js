const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ── API сервер (Replicate через наш сервер) ──
const API_SERVER = "https://mirageai.duckdns.org";

// ── КАТЕГОРИИ ТОВАРОВ (WB/Ozon) ──
const CATEGORIES = [
    {
        id: "clothing", name: "Одежда", emoji: "👗", scheme: "warm",
        photoPrompt: "Professional fashion product photography, clothing item worn by an attractive slim model, clean white studio background, soft diffused lighting, full body or 3/4 shot, sharp fabric texture and fit clearly visible, photorealistic, commercial e-commerce quality, 3:4 ratio, no text no logos no watermarks",
        bgDesc: {
            dark: "cozy living room interior, warm wooden floor, soft sofa and cushions visible in background, warm amber lamp light glowing, realistic home atmosphere",
            light: "bright Scandinavian apartment interior, white walls, light wood floor, large window with natural daylight, minimalist home decor"
        }
    },
    {
        id: "shoes", name: "Обувь", emoji: "👟", scheme: "warm",
        photoPrompt: "Professional footwear product photography, shoe shown at elegant side angle on white surface, clean white studio background, soft box lighting, sharp texture stitching and sole details, product fills 80% of frame, slight natural shadow underneath, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "elegant dark interior, luxurious wood floor, warm accent lighting, premium home atmosphere",
            light: "bright minimalist room, light wood floor, large window with natural daylight, clean walls"
        }
    },
    {
        id: "beauty", name: "Красота", emoji: "💄", scheme: "nature",
        photoPrompt: "Professional beauty and cosmetics product photography, product centered on clean white marble surface, elegant water droplets or ingredient splash scattered around it, fresh luxurious feel, soft diffused studio lighting, sharp label and packaging details visible, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "luxury bathroom counter, soft ambient candlelight, white marble surfaces, fresh green plants and white towels in background",
            light: "bright white marble bathroom, natural window daylight, fresh flowers in background, clean minimal styling"
        }
    },
    {
        id: "home", name: "Дом", emoji: "🏠", scheme: "warm",
        photoPrompt: "Professional interior lifestyle product photography, home decor item placed naturally in a modern cozy Scandinavian living space, natural daylight, editorial home magazine quality, product is the focal point, styled with minimal neutral props, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "cozy living room interior, warm evening light, stylish furniture and tasteful decor visible in background",
            light: "bright Scandinavian interior, white walls, light furniture, natural plants, large window with daylight"
        }
    },
    {
        id: "electronics", name: "Электроника", emoji: "📱", scheme: "tech",
        photoPrompt: "Professional tech product photography, electronic device shown at 45-degree isometric angle, clean dark background with subtle blue accent lighting, dramatic studio lighting highlighting product design and screen, sharp details of buttons ports and surface finish, sleek modern commercial look, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "modern dark home office setup, desk with subtle RGB lighting glow, monitor screens in background, dark tech workspace atmosphere",
            light: "clean modern workspace, white desk, large window with natural light, MacBook and minimal tech accessories visible in background"
        }
    },
    {
        id: "kids", name: "Детские", emoji: "🧸", scheme: "warm",
        photoPrompt: "Professional children's product photography, item shown with a happy smiling child aged 4-7 in a bright colorful home environment, warm soft lighting, pastel color palette, safe and trustworthy feel, child naturally playing or using the product, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "cozy children's room, soft warm lighting, colorful toys and gentle pastel decor visible in background",
            light: "bright cheerful children's room, white walls with colorful accents, natural daylight, toys scattered naturally"
        }
    },
    {
        id: "food", name: "Продукты", emoji: "🍎", scheme: "nature",
        photoPrompt: "Professional food product photography, item on rustic wooden table or white marble surface, fresh natural ingredients flying and scattered elegantly around the packaging, warm appetizing lighting, condensation water droplets for freshness effect, rich vibrant colors, styled with natural props, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "cozy kitchen counter, fresh herbs and vegetables visible in background, warm evening light, natural wood surfaces",
            light: "bright kitchen with white marble countertop, fresh plants and colorful fruits in background, natural sunlight streaming in"
        }
    },
    {
        id: "auto", name: "Автотовары", emoji: "🚗", scheme: "workshop",
        photoPrompt: "Professional automotive product photography, item shown installed or in use in a modern car interior or garage environment, dramatic directional lighting, product clearly visible in functional context, masculine premium feel, clean professional commercial look, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "industrial garage workshop interior, concrete floor, car partially visible in background, focused dramatic overhead spotlight",
            light: "bright modern garage, light concrete floor, clean car interior visible in background, professional workshop lighting"
        }
    },
    {
        id: "sport", name: "Спорт", emoji: "🏋️", scheme: "tech",
        photoPrompt: "Professional sports product photography, item shown in use by an athletic person in gym or outdoor setting, dynamic energetic composition, bright natural or professional studio lighting, active lifestyle feel, sharp product details clearly visible, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "modern gym interior, dramatic lighting, professional fitness equipment visible in background, dark energetic atmosphere",
            light: "bright outdoor sports setting, natural daylight, active lifestyle atmosphere, green nature background"
        }
    },
    {
        id: "accessories", name: "Аксессуары", emoji: "💍", scheme: "dark",
        photoPrompt: "Professional jewelry and accessories product photography, item worn by an elegant model or placed on neutral stone or velvet surface, macro close-up showing fine details and craftsmanship, soft diffused studio lighting with subtle luxury reflections, premium feel, clean background, photorealistic, 3:4 ratio",
        bgDesc: {
            dark: "luxury dark boutique interior, black velvet or dark marble surface, dramatic professional spotlight, elegant dark decor",
            light: "high-end bright showroom interior, light grey polished surface, clean white walls, professional retail lighting"
        }
    }
];

let selectedTemplate = null;
let selectedPhotoBase64 = null;
let userCoins = 0;
let currentResultUrl = null;
let currentLang = "ru";

document.addEventListener("DOMContentLoaded", () => {
    clearStorageIfFull();
    loadUserData();
    renderTemplates();
    setupUpload();
});

function saveGallery(gallery) {
    // Храним только последние 8 карточек
    let items = gallery.slice(0, 8);
    while (items.length > 0) {
        try {
            localStorage.setItem("gallery", JSON.stringify(items));
            return;
        } catch (e) {
            items = items.slice(0, items.length - 1);
        }
    }
    try { localStorage.removeItem("gallery"); } catch(e) {}
}

function clearStorageIfFull() {
    try {
        const test = "x".repeat(1024);
        localStorage.setItem("_test", test);
        localStorage.removeItem("_test");
    } catch(e) {
        // Места нет — очищаем галерею
        try { localStorage.removeItem("gallery"); } catch(e2) {}
    }
}

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

async function sendToChat() {
    if (!currentResultUrl) return;

    const chatId = tg.initDataUnsafe?.user?.id;
    if (!chatId) { tg.showAlert("Не удалось определить пользователя"); return; }

    const btn = document.querySelector(".result-btn-share");
    const origText = btn.innerHTML;
    btn.innerHTML = "⏳ Отправляю...";
    btn.disabled = true;

    try {
        const blob = await fetch(currentResultUrl).then(r => r.blob());
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("photo", blob, "MirageAI.jpg");
        formData.append("caption", "✅ Карточка товара готова! — *MirageAI*");
        formData.append("parse_mode", "Markdown");

        const BOT_TOKEN = "8783691026:AAEzeRqVkCcXlwgqc0bhjZ4N-fOGcmoQ_nI";
        const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            body: formData
        });
        const result = await resp.json();

        if (result.ok) {
            tg.showAlert("✅ Фото отправлено в чат!");
        } else {
            tg.showAlert("❌ Ошибка: " + (result.description || "Попробуй ещё раз"));
        }
    } catch (e) {
        tg.showAlert("❌ Ошибка отправки. Попробуй ещё раз.");
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
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
let mpSelectedCategory = "clothing";

function mpSelectCategory(id, el) {
    mpSelectedCategory = id;
    document.querySelectorAll(".mp-cat-chip").forEach(c => c.classList.remove("active"));
    el.classList.add("active");
    // Автоматически меняем цветовую схему карточки под категорию
    const cat = CATEGORIES.find(c => c.id === id);
    if (cat) mpCardColorScheme = cat.scheme;
}

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
                        { type: "text", text: `Посмотри на изображение товара. Ответь ТОЛЬКО валидным JSON без markdown и без пояснений:
{
  "name": "Название товара по-русски, МАКСИМУМ 2 слова, ЗАГЛАВНЫМИ буквами. Формат: КАТЕГОРИЯ БРЕНД. ЗАПРЕЩЕНО писать модель или серию. Примеры правильно: КРОССОВКИ ASICS, КУРТКА NIKE, ШУРУПОВЁРТ MAKITA, СМАРТФОН SAMSUNG. Примеры неправильно: КРОССОВКИ ASICS GEL-KAYANO, IPHONE 15 PRO, КУРТКА COLUMBIA OMNI-HEAT",
  "badge": "САМАЯ главная характеристика товара (2-4 слова, ЗАГЛАВНЫМИ). Примеры: НАТУРАЛЬНАЯ ЗАМША, 100% ХЛОПОК, 18В, WIFI 6. Это будет использовано ТОЛЬКО здесь.",
  "subtitle": "3 характеристики через буллет, строчными. ЗАПРЕЩЕНО повторять badge. Формат: свойство1 • свойство2 • свойство3. Примеры: боковая молния • мягкая стелька • демисезонные",
  "feat1": "УНИКАЛЬНОЕ преимущество 1, максимум 2 слова. ЗАПРЕЩЕНО повторять badge и subtitle. ЗАПРЕЩЕНО: стильный дизайн, высокое качество, удобный. Только конкретика: лёгкий вес, нескользящая подошва, усиленный носок",
  "feat2": "УНИКАЛЬНОЕ преимущество 2, максимум 2 слова. ЗАПРЕЩЕНО повторять badge, subtitle и feat1. Только конкретные свойства которые ещё не упомянуты",
  "feat3": "УНИКАЛЬНОЕ преимущество 3, максимум 2 слова. ЗАПРЕЩЕНО повторять badge, subtitle, feat1 и feat2. Только конкретные свойства которые ещё не упомянуты",
  "style": "один из: warm (одежда/обувь/дом), dark (премиум/часы/сумки), tech (электроника/гаджеты), workshop (инструменты/стройка), nature (еда/косметика/природа)"
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

let mpAiToggleActive = false;

function mpToggleAiIdea() {
    if (!mpCardPhotoBase64) {
        tg.showAlert("Сначала загрузи фото товара!");
        return;
    }
    mpAiToggleActive = !mpAiToggleActive;
    const toggle = document.getElementById("mp-ai-toggle");
    const label = document.getElementById("mp-ai-label");
    toggle.classList.toggle("active", mpAiToggleActive);
    label.classList.toggle("active", mpAiToggleActive);
    if (mpAiToggleActive) {
        mpCardAnalyze(mpCardPhotoBase64);
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
        warm:     { dark: "cozy living room interior, warm wooden floor, soft sofa and cushions visible in background, warm amber lamp light glowing, realistic home atmosphere", light: "bright Scandinavian apartment interior, white walls, light wood floor, large window with natural daylight, minimalist home decor" },
        dark:     { dark: "luxury dark boutique interior, black marble surface, soft dramatic spotlights, elegant dark shelving in background, premium store atmosphere", light: "high-end bright showroom interior, light grey polished floor, clean white walls, professional retail lighting" },
        tech:     { dark: "modern dark home office setup, desk with RGB lighting glow, monitor screens in background, dark tech workspace atmosphere", light: "clean modern workspace, white desk, large window, MacBook and tech accessories visible in background, bright natural light" },
        workshop: { dark: "industrial garage workshop interior, concrete floor, tools hanging on wall in background, focused overhead spotlight on product", light: "bright professional workshop, light concrete floor, organized tool storage visible in background, daylight through windows" },
        nature:   { dark: "cozy kitchen counter, fresh herbs and vegetables in background, warm evening light, natural wood surfaces", light: "bright kitchen with white marble countertop, fresh plants and fruits in background, natural sunlight streaming in" },
    };
    const schemeStyles = bgStylesMap[mpCardColorScheme] || bgStylesMap.warm;
    const bgDesc = mpCardBgStyle === "light" ? schemeStyles.light : schemeStyles.dark;

    const prompt = `Professional product photography: place this exact product in a ${bgDesc}. The background must be a REAL realistic interior scene, NOT a plain solid color or gradient. The product is the main subject, placed naturally in the scene. Background should be visible and recognizable as a real place. NO text, NO letters, NO watermarks. Photorealistic, high quality marketplace photo.`;

    switchScreen("loading");
    animateSteps();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000);
        const resp = await fetch(`${API_SERVER}/generate`, {
            signal: controller.signal,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                photo: mpCardPhotoBase64,
                prompt
            })
        });
        clearTimeout(timeout);
        const result = await resp.json();
        const resultUrl = result?.url;
        if (!resultUrl) throw new Error(result?.error || "No image in response");

        // Рисуем текст поверх через Canvas
        let finalBase64;
        try {
            finalBase64 = await drawCardOverlay(resultUrl, { name, subtitle, badge, feat1, feat2, feat3 });
        } catch (overlayErr) {
            console.warn("drawCardOverlay failed, using raw image:", overlayErr);
            finalBase64 = resultUrl; // fallback: показываем картинку без текста
        }

        userCoins = Math.max(0, userCoins - 20);
        localStorage.setItem("coins", userCoins);
        updateCoinsDisplay();

        const gallery = JSON.parse(localStorage.getItem("gallery") || "[]");
        gallery.unshift({ id: Date.now(), emoji: "🏷", name: name || "Карточка товара", url: finalBase64, date: new Date().toLocaleDateString("ru") });
        saveGallery(gallery);

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
        // crossOrigin не нужен для data URI — убираем чтобы не блокировать iOS Safari
        if (!imageUrl.startsWith("data:")) img.crossOrigin = "anonymous";
        img.onload = async () => {
            try {
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
                const srcTop = Math.floor(img.height * 0.05);
                const srcBot = Math.floor(img.height * 0.97);
                ctx.drawImage(img, 0, srcTop, img.width, srcBot - srcTop, 0, topH, W, botY - topH);
            }
            function drawFade(y, h, fromColor, toColor) {
                const g = ctx.createLinearGradient(0, y, 0, y + h);
                g.addColorStop(0, fromColor); g.addColorStop(1, toColor);
                ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
            }
            function drawBadge(text, x, y, bg, textColor) {
                const maxBadgeW = W / 2 - PAD; // бейдж не шире половины карточки
                let sz = 18;
                ctx.font = `bold ${sz}px Arial`;
                while (sz > 11 && ctx.measureText(text).width + 28 > maxBadgeW) sz--;
                ctx.font = `bold ${sz}px Arial`;
                const bW = Math.min(Math.max(ctx.measureText(text).width + 28, 80), maxBadgeW);
                rr(x - bW, y, bW, 34, 17, bg);
                ctx.fillStyle = textColor || "#000";
                ctx.textAlign = "center";
                ctx.fillText(text, x - bW / 2, y + 22);
                ctx.textAlign = "left";
            }
            function drawTitle(words, startY, maxY, color, maxW) {
                let ty = startY;
                let lastSz = 22;
                for (const word of words) {
                    const sz = autoSize(word, maxW || W - PAD * 2, 96, 22);
                    const lineH = Math.round(sz * 1.1);
                    if (ty > maxY) break;
                    ctx.font = `700 ${sz}px 'Oswald', Arial`;
                    ctx.fillStyle = color;
                    ctx.fillText(word, PAD, ty);
                    lastSz = sz;
                    ty += lineH;
                }
                // Возвращаем нижний край последнего слова, а не позицию следующей строки
                return ty - Math.round(lastSz * 1.1) + Math.round(lastSz * 0.3);
            }
            function drawSubtitle(text, y, color, size) {
                const maxW = W - PAD * 2;
                let fsz = size || 28;
                ctx.font = `500 ${fsz}px 'Oswald', Arial`;
                while (fsz > 15 && ctx.measureText(text).width > maxW) fsz--;
                ctx.font = `500 ${fsz}px 'Oswald', Arial`;
                ctx.fillStyle = color;
                ctx.fillText(text.substring(0, 90), PAD, y);
                return y;
            }

            // ── OVERLAY: фото на весь холст, текст поверх тёмного градиента ──
            const GRAD_TOP = Math.floor(H * 0.55); // начало затемнения (~605px)
            const TITLE_Y  = Math.floor(H * 0.72); // заголовок (~792px)
            const PILL_H   = 73;
            const CHIPS_Y  = H - PAD - PILL_H;     // чипсы у самого низа (~997px)

            // Фото на весь холст
            function drawFullPhoto() {
                const srcTop = Math.floor(img.height * 0.05);
                const srcBot = Math.floor(img.height * 0.97);
                ctx.drawImage(img, 0, srcTop, img.width, srcBot - srcTop, 0, 0, W, H);
            }
            // Схемный градиент: прозрачный → tintColor (тёмный снизу)
            function drawOverlay(tintColor) {
                const g = ctx.createLinearGradient(0, GRAD_TOP, 0, H);
                g.addColorStop(0,    "rgba(0,0,0,0)");
                g.addColorStop(0.38, "rgba(0,0,0,0.62)");
                g.addColorStop(1,    tintColor);
                ctx.fillStyle = g;
                ctx.fillRect(0, GRAD_TOP, W, H - GRAD_TOP);
            }

            // ════════════════════════════════════════
            // 1. ОДЕЖДА / ОБУВЬ — тёплый минимализм
            // ════════════════════════════════════════
            if (scheme === "warm") {
                const accentClr = "#d4a017";
                const titleClr  = "#fff8e8";
                const subClr    = "#ddc880";

                drawFullPhoto();
                drawOverlay(isLight ? "rgba(50,35,5,0.94)" : "rgba(18,12,2,0.96)");
                if (badge) drawBadge(badge.toUpperCase(), W - PAD, 65, accentClr, "#1a1000");
                const tY1 = drawTitle((name||"").toUpperCase().split(/\s+/), TITLE_Y, CHIPS_Y - 50, titleClr);
                if (subtitle) drawSubtitle(subtitle, tY1 + 10, subClr);
                if (feats.length) {
                    const gap = 12, colW = (W - PAD*2 - gap*(feats.length-1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i*(colW+gap), fy = CHIPS_Y;
                        rr(fx, fy, colW, PILL_H, 36, "rgba(40,28,5,0.92)", accentClr, 2);
                        ctx.beginPath(); ctx.arc(fx+26, fy+PILL_H/2, 11, 0, Math.PI*2);
                        ctx.fillStyle = accentClr; ctx.fill();
                        ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
                        ctx.beginPath(); ctx.moveTo(fx+20, fy+PILL_H/2); ctx.lineTo(fx+25, fy+PILL_H/2+5); ctx.lineTo(fx+32, fy+PILL_H/2-5); ctx.stroke();
                        ctx.fillStyle = "#fff";
                        const fw = f.split(" ");
                        if (fw.length > 1) {
                            const sz = Math.min(autoSize(fw[0], colW-52, 22, 11), autoSize(fw.slice(1).join(" "), colW-52, 22, 11));
                            ctx.font = `600 ${sz}px Arial`;
                            ctx.fillText(fw[0], fx+46, fy+28); ctx.fillText(fw.slice(1).join(" "), fx+46, fy+52);
                        } else {
                            ctx.font = `600 ${autoSize(f, colW-52, 22, 11)}px Arial`;
                            ctx.fillText(f, fx+46, fy+PILL_H/2+8);
                        }
                    });
                }

            // ════════════════════════════════════════
            // 2. ПРЕМИУМ / АКСЕССУАРЫ — тёмный элегантный
            // ════════════════════════════════════════
            } else if (scheme === "dark") {
                const gold     = "#c9a84c";
                const titleClr = "#ffffff";

                drawFullPhoto();
                drawOverlay(isLight ? "rgba(25,22,14,0.94)" : "rgba(5,5,5,0.96)");
                if (badge) drawBadge(badge.toUpperCase(), W - PAD, 65, gold, "#000");
                ctx.fillStyle = gold; ctx.font = `22px Arial`;
                ctx.fillText("◆", PAD, TITLE_Y - 30);
                const tY2 = drawTitle((name||"").toUpperCase().split(/\s+/), TITLE_Y, CHIPS_Y - 50, titleClr, W - PAD*2 - 20);
                if (subtitle) drawSubtitle(subtitle, tY2 + 10, "#a08060");
                if (feats.length) {
                    const gap = 14, colW = (W - PAD*2 - gap*(feats.length-1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i*(colW+gap), fy = CHIPS_Y;
                        rr(fx, fy, colW, PILL_H, 6, "rgba(20,15,5,0.88)", gold, 1.5);
                        ctx.fillStyle = gold; ctx.font = `bold 22px Arial`;
                        ctx.fillText("◆", fx+14, fy+PILL_H/2+8);
                        ctx.fillStyle = titleClr;
                        const fw = f.split(" ");
                        if (fw.length > 1) {
                            const sz = Math.min(autoSize(fw[0], colW-52, 22, 11), autoSize(fw.slice(1).join(" "), colW-52, 22, 11));
                            ctx.font = `600 ${sz}px Arial`;
                            ctx.fillText(fw[0], fx+46, fy+28); ctx.fillText(fw.slice(1).join(" "), fx+46, fy+52);
                        } else {
                            ctx.font = `600 ${autoSize(f, colW-52, 22, 11)}px Arial`;
                            ctx.fillText(f, fx+46, fy+PILL_H/2+8);
                        }
                    });
                }

            // ════════════════════════════════════════
            // 3. ЭЛЕКТРОНИКА / ГАДЖЕТЫ — тёмный техно
            // ════════════════════════════════════════
            } else if (scheme === "tech") {
                const cyan     = "#00c8ff";
                const titleClr = "#ffffff";

                drawFullPhoto();
                drawOverlay(isLight ? "rgba(0,15,40,0.94)" : "rgba(3,10,20,0.96)");
                if (badge) drawBadge(badge.toUpperCase(), W - PAD, 65, cyan, "#000");
                const tY3 = drawTitle((name||"").toUpperCase().split(/\s+/), TITLE_Y, CHIPS_Y - 50, titleClr);
                if (subtitle) drawSubtitle(subtitle, tY3 + 10, "#4ab8d8");
                if (feats.length) {
                    const gap = 10, colW = (W - PAD*2 - gap*(feats.length-1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i*(colW+gap), fy = CHIPS_Y;
                        rr(fx, fy, colW, PILL_H, 8, "rgba(0,30,60,0.88)", cyan, 1.5);
                        ctx.fillStyle = cyan;
                        ctx.beginPath(); ctx.moveTo(fx+14, fy+PILL_H/2-9); ctx.lineTo(fx+14, fy+PILL_H/2+9); ctx.lineTo(fx+28, fy+PILL_H/2); ctx.fill();
                        ctx.fillStyle = titleClr;
                        const fw = f.split(" ");
                        if (fw.length > 1) {
                            const sz = Math.min(autoSize(fw[0], colW-46, 22, 11), autoSize(fw.slice(1).join(" "), colW-46, 22, 11));
                            ctx.font = `600 ${sz}px Arial`;
                            ctx.fillText(fw[0], fx+36, fy+28); ctx.fillText(fw.slice(1).join(" "), fx+36, fy+52);
                        } else {
                            ctx.font = `600 ${autoSize(f, colW-46, 22, 11)}px Arial`;
                            ctx.fillText(f, fx+36, fy+PILL_H/2+8);
                        }
                    });
                }

            // ════════════════════════════════════════
            // 4. ИНСТРУМЕНТЫ / СТРОЙКА — мощный промышленный
            // ════════════════════════════════════════
            } else if (scheme === "workshop") {
                const yellow = "#ffc200";

                drawFullPhoto();
                drawOverlay(isLight ? "rgba(15,12,0,0.95)" : "rgba(10,8,0,0.97)");
                if (badge) drawBadge(badge.toUpperCase(), W - PAD, 65, yellow, "#000");
                const tY4 = drawTitle((name||"").toUpperCase().split(/\s+/), TITLE_Y, CHIPS_Y - 50, "#ffffff");
                if (subtitle) drawSubtitle(subtitle, tY4 + 10, "#aaaaaa");
                if (feats.length) {
                    const gap = 10, colW = (W - PAD*2 - gap*(feats.length-1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i*(colW+gap), fy = CHIPS_Y;
                        rr(fx, fy, colW, PILL_H, 6, "rgba(30,24,0,0.88)", yellow, 2);
                        rr(fx, fy, 6, PILL_H, [6,0,0,6], yellow);
                        ctx.fillStyle = "#fff";
                        const fw = f.split(" ");
                        if (fw.length > 1) {
                            const sz = Math.min(autoSize(fw[0], colW-32, 22, 11), autoSize(fw.slice(1).join(" "), colW-32, 22, 11));
                            ctx.font = `600 ${sz}px Arial`;
                            ctx.fillText(fw[0], fx+22, fy+30); ctx.fillText(fw.slice(1).join(" "), fx+22, fy+54);
                        } else {
                            ctx.font = `600 ${autoSize(f, colW-32, 22, 11)}px Arial`;
                            ctx.fillText(f, fx+22, fy+PILL_H/2+8);
                        }
                    });
                }

            // ════════════════════════════════════════
            // 5. КОСМЕТИКА / ЕДА / ПРИРОДА — мягкий органик
            // ════════════════════════════════════════
            } else {
                const green    = "#4caf50";
                const titleClr = "#e8ffe8";

                drawFullPhoto();
                drawOverlay(isLight ? "rgba(5,20,5,0.94)" : "rgba(5,14,5,0.97)");
                if (badge) drawBadge(badge.toUpperCase(), W - PAD, 65, green, "#fff");
                ctx.font = "24px Arial"; ctx.fillText("🌿", PAD, TITLE_Y - 22);
                const tY5 = drawTitle((name||"").toUpperCase().split(/\s+/), TITLE_Y, CHIPS_Y - 50, titleClr, W - PAD*2 - 30);
                if (subtitle) drawSubtitle(subtitle, tY5 + 10, "#7fc87f");
                if (feats.length) {
                    const gap = 12, colW = (W - PAD*2 - gap*(feats.length-1)) / feats.length;
                    feats.forEach((f, i) => {
                        const fx = PAD + i*(colW+gap), fy = CHIPS_Y;
                        rr(fx, fy, colW, PILL_H, 36, "rgba(10,35,10,0.88)", green, 2);
                        ctx.beginPath(); ctx.arc(fx+26, fy+PILL_H/2, 13, 0, Math.PI*2);
                        ctx.fillStyle = green; ctx.fill();
                        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
                        ctx.beginPath(); ctx.moveTo(fx+20, fy+PILL_H/2); ctx.lineTo(fx+25, fy+PILL_H/2+5); ctx.lineTo(fx+32, fy+PILL_H/2-5); ctx.stroke();
                        ctx.fillStyle = titleClr;
                        const fw = f.split(" ");
                        if (fw.length > 1) {
                            const sz = Math.min(autoSize(fw[0], colW-56, 22, 11), autoSize(fw.slice(1).join(" "), colW-56, 22, 11));
                            ctx.font = `600 ${sz}px Arial`;
                            ctx.fillText(fw[0], fx+46, fy+28); ctx.fillText(fw.slice(1).join(" "), fx+46, fy+52);
                        } else {
                            ctx.font = `600 ${autoSize(f, colW-56, 22, 11)}px Arial`;
                            ctx.fillText(f, fx+46, fy+PILL_H/2+8);
                        }
                    });
                }
            }

            resolve(canvas.toDataURL("image/jpeg", 0.93));
            } catch(e) { reject(e); }
        };
        img.onerror = (e) => reject(new Error("Image load failed: " + (e?.message || "unknown")));
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000);
        const resp = await fetch(`${API_SERVER}/generate`, {
            signal: controller.signal,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                photo: mpPhotoBase64,
                prompt
            })
        });
        clearTimeout(timeout);
        const result = await resp.json();

        const resultUrl = result?.url;
        if (!resultUrl) throw new Error(result?.error || "No image in response");

        userCoins = Math.max(0, userCoins - 20);
        localStorage.setItem("coins", userCoins);
        updateCoinsDisplay();

        const gallery = JSON.parse(localStorage.getItem("gallery") || "[]");
        gallery.unshift({ id: Date.now(), emoji: "📦", name: "Карточка товара", url: resultUrl, date: new Date().toLocaleDateString("ru") });
        saveGallery(gallery);

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
        console.log("Step 2: calling faceswap API...");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000);
        const resp = await fetch(`${API_SERVER}/faceswap`, {
            signal: controller.signal,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template: templateBase64, user_photo: selectedPhotoBase64 })
        });
        clearTimeout(timeout);
        const data = await resp.json();
        const resultUrl = data?.url;
        if (!resultUrl) throw new Error(data?.error || "No image in response");
        console.log("Step 2 done");

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
