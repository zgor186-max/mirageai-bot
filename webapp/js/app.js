const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ── API сервер (Replicate через наш сервер) ──
const API_SERVER = "https://mirageai.duckdns.org";

// ── КАТЕГОРИИ ТОВАРОВ (WB/Ozon) ──
const CATEGORIES = [
    {
        id: "clothing", name: "Одежда", emoji: "👗", scheme: "warm",
        photoPrompt: "Professional e-commerce fashion photography. The clothing item is worn naturally by an attractive slim model, neutral expression, full body or 3/4 shot. Soft three-point studio lighting: key light upper-left at 45 degrees, fill light reducing shadows to 2:1 ratio, subtle rim light separating model from background. Clean seamless white background. 85mm lens equivalent, f/8 aperture. Sharp fabric texture and fit clearly visible. Model pose highlights drape and silhouette. Photorealistic, marketplace hero shot, 3:4 ratio, NO text NO logos NO watermarks.",
        bgDesc: {
            dark: "cozy Scandinavian living room, warm oak wooden floor with visible grain, linen sofa with cushions softly blurred at f/2.8 bokeh in background, warm amber table lamp glow, realistic photorealistic interior",
            light: "bright Nordic apartment, white painted walls, light ash wood floor, floor-to-ceiling window with soft natural daylight streaming in, minimal Scandinavian furniture blurred at f/2.8, airy clean atmosphere"
        }
    },
    {
        id: "shoes", name: "Обувь", emoji: "👟", scheme: "warm",
        photoPrompt: "Professional footwear e-commerce photography. Shoe positioned at elegant 3/4 side angle slightly turned left, showing full silhouette profile, sole edge and heel detail. Placed on clean white acrylic surface. Soft diffused studio lighting with natural grounding shadow underneath. Key light from upper-left. Clean white seamless background. 85mm macro lens equivalent, f/11 aperture for full product sharpness. Shoe occupies 75% of frame. Sharp stitching and texture details. Photorealistic, marketplace-ready, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "elegant dark premium interior, warm walnut wood floor with subtle grain, low warm accent lighting from floor lamp, luxurious blurred background at f/2.8 bokeh, premium home atmosphere",
            light: "bright minimalist room, light birch wood floor, large window with diffused natural daylight, white walls, minimal Scandinavian decor blurred in background"
        }
    },
    {
        id: "beauty", name: "Красота", emoji: "💄", scheme: "nature",
        photoPrompt: "Professional cosmetics product photography. Product centered on white Carrara marble surface with subtle natural veining. Fresh water droplets scattered elegantly around it suggesting purity and freshness. Botanical ingredient elements softly arranged nearby. Soft diffused studio lighting from upper-left, subtle specular highlights on packaging showing premium quality. 85mm macro lens, f/5.6 aperture. Product sharp with fully readable label. Photorealistic, high-end beauty editorial quality, 3:4 ratio, NO text NO logos NO watermarks.",
        bgDesc: {
            dark: "luxury spa bathroom counter, soft ambient candlelight creating warm glow, white marble surfaces, fresh eucalyptus branches and white towels softly blurred at f/2.8 in background, premium spa atmosphere",
            light: "bright white marble bathroom, large window with soft natural daylight, fresh white flowers and green plants blurred in background at f/2.8, clean minimal luxury atmosphere"
        }
    },
    {
        id: "home", name: "Дом", emoji: "🏠", scheme: "warm",
        photoPrompt: "Professional interior lifestyle product photography. Home decor item placed naturally as the clear focal point in a modern Scandinavian living space. Minimal neutral styled props supporting product without competing. Soft natural window light from left supplemented with studio fill. 85mm lens f/8. Sharp product with softly blurred interior context at f/2.8 bokeh. Warm neutral color temperature 5500K. Editorial home magazine quality. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "cozy Scandinavian living room, warm evening amber light from table lamp, stylish linen sofa and oak coffee table blurred at f/2.8 in background, tasteful minimal decor, warm photorealistic atmosphere",
            light: "bright Nordic interior, white walls, light oak furniture, large window with daylight, natural green plants blurred at f/2.8 in background, clean airy Scandinavian atmosphere"
        }
    },
    {
        id: "electronics", name: "Электроника", emoji: "📱", scheme: "tech",
        photoPrompt: "Professional consumer electronics product photography. Device shown at 45-degree isometric hero angle revealing front, top and side simultaneously. Deep charcoal background with subtle blue-purple gradient. Dramatic key light from upper-right creating sharp specular highlight along product edge, fill light preventing shadow loss. Screen showing subtle active UI glow. 85mm lens f/8. Razor-sharp focus on buttons, ports and surface finish. Sleek premium tech commercial quality. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "modern dark home office, matte black desk surface, subtle RGB underglow creating atmospheric cyan and purple glow, dual monitors with UI interface blurred at f/2.8 in background, professional dark tech workspace",
            light: "clean modern workspace, white birch wood desk, large window with soft natural daylight, minimal MacBook and tech accessories blurred at f/2.8 in background, bright professional atmosphere"
        }
    },
    {
        id: "kids", name: "Детские", emoji: "🧸", scheme: "warm",
        photoPrompt: "Professional children's product photography. Item shown naturally with a happy smiling child aged 5-7 in a bright cheerful home environment. Warm diffused window light from left. Pastel color palette: soft yellows, light blues, gentle pinks. Product clearly visible and child interaction looks natural and joyful. 85mm lens f/5.6. Both child and product sharp. Safe, trustworthy and playful atmosphere. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "cozy children's bedroom, soft warm nightlight glow, colorful plush toys and pastel decor blurred at f/2.8 in background, gentle warm atmosphere, safe and cozy feeling",
            light: "bright cheerful children's room, white walls with colorful pastel accents, natural daylight from large window, wooden toys and books blurred in background at f/2.8, playful and safe atmosphere"
        }
    },
    {
        id: "food", name: "Продукты", emoji: "🍎", scheme: "nature",
        photoPrompt: "Professional food product photography. Item on white Carrara marble surface or warm rustic oak wooden board. Fresh natural product-relevant ingredients (herbs, fruits, spices) arranged elegantly around packaging using controlled scatter technique. Warm appetizing key light from upper-left with soft fill. Condensation water droplets on cold products for freshness. Rich vibrant colors with accurate color reproduction. 85mm macro lens f/8. Product label sharp and fully readable. Food styling editorial quality. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "cozy kitchen counter, natural oak wooden surface, fresh herbs in terracotta pots and colorful vegetables blurred at f/2.8 in background, warm under-cabinet evening light, organic natural atmosphere",
            light: "bright kitchen with white Carrara marble countertop, fresh botanical plants and colorful seasonal fruits blurred at f/2.8 in background, natural sunlight streaming in from window, clean fresh atmosphere"
        }
    },
    {
        id: "auto", name: "Автотовары", emoji: "🚗", scheme: "workshop",
        photoPrompt: "Professional automotive accessories product photography. Item shown installed or in functional context of a premium car interior or clean professional garage. Dramatic directional key light from upper-right creating depth and dimension. Sharp detail on surface finish, engineering and functional elements. Masculine premium commercial feel. Size reference element visible for scale. 85mm lens f/8. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "industrial professional garage workshop, grey concrete floor with subtle texture, high-quality power tools hanging on organized pegboard wall blurred at f/2.8 in background, focused overhead spotlight on product, masculine atmosphere",
            light: "bright professional workshop, light concrete floor, organized tool storage and clean car visible in background at f/2.8, industrial windows with daylight, clean professional atmosphere"
        }
    },
    {
        id: "sport", name: "Спорт", emoji: "🏋️", scheme: "tech",
        photoPrompt: "Professional sports equipment product photography. Item shown in dynamic active context with an athletic person in motion in gym or outdoor setting. Natural bright energetic lighting suggesting performance and energy. Sharp product details visible with motion-freeze quality. Vibrant saturated colors with accurate reproduction. 85mm lens f/5.6. Active lifestyle background softly blurred at f/2.8 bokeh. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "modern professional gym interior, dramatic overhead spotlighting, black rubber floor, premium fitness equipment blurred at f/2.8 in background, dark energetic motivational atmosphere",
            light: "bright outdoor sports setting, natural morning sunlight, green nature and sports track blurred at f/2.8 in background, active healthy lifestyle atmosphere"
        }
    },
    {
        id: "accessories", name: "Аксессуары", emoji: "💍", scheme: "dark",
        photoPrompt: "Professional jewelry and accessories product photography. Item worn by an elegant model or placed on premium dark velvet or polished grey stone surface. Macro close-up revealing fine craftsmanship and material quality. Three-point studio lighting with subtle specular highlights showing metal shine and gemstone refraction. 85mm macro lens f/8. Razor-sharp product detail. Luxurious atmosphere with clean controlled background. Photorealistic, 3:4 ratio, NO text NO logos.",
        bgDesc: {
            dark: "luxury high-end boutique interior, polished black marble surface with subtle reflection, soft dramatic spotlights creating pools of light from above, dark mahogany shelving blurred at f/2.8 in background, premium store atmosphere",
            light: "premium bright showroom interior, light grey polished concrete floor with subtle reflection, clean white walls, professional retail lighting from above, minimal luxury props blurred at f/2.8 in background"
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
        warm:     {
            dark:  "cozy Scandinavian living room, warm oak wooden floor with visible grain, linen sofa with cushions softly blurred at f/2.8 bokeh in background, warm amber table lamp glow creating cozy atmosphere",
            light: "bright Nordic apartment, white painted walls, light ash wood floor, floor-to-ceiling window with soft natural daylight, minimal Scandinavian furniture blurred at f/2.8 bokeh"
        },
        dark:     {
            dark:  "luxury high-end boutique interior, polished black marble floor with subtle reflection, soft dramatic spotlights creating pools of light from above, dark mahogany shelving blurred at f/2.8 in background",
            light: "premium bright showroom interior, light grey polished concrete floor with reflection, clean white walls, professional retail spotlighting from above, minimal luxury props blurred at f/2.8"
        },
        tech:     {
            dark:  "modern dark home office, matte black desk surface, subtle RGB underglow with cyan and purple atmospheric glow, dual monitors with UI interface blurred at f/2.8 in background, professional dark tech workspace",
            light: "clean modern workspace, white birch wood desk, large window with soft natural daylight, minimal MacBook and tech accessories blurred at f/2.8 in background"
        },
        workshop: {
            dark:  "industrial professional garage workshop, grey concrete floor with texture, high-quality power tools on organized pegboard wall blurred at f/2.8 in background, focused overhead spotlight on product",
            light: "bright professional workshop, light concrete floor, organized tool storage and clean equipment visible blurred at f/2.8 in background, industrial windows with daylight"
        },
        nature:   {
            dark:  "cozy kitchen counter, natural oak wooden surface, fresh herbs in terracotta pots and colorful vegetables blurred at f/2.8 in background, warm under-cabinet evening light",
            light: "bright kitchen with white Carrara marble countertop, fresh botanical plants and colorful seasonal fruits blurred at f/2.8 in background, natural sunlight streaming in from window"
        },
    };
    const schemeStyles = bgStylesMap[mpCardColorScheme] || bgStylesMap.warm;
    const bgDesc = mpCardBgStyle === "light" ? schemeStyles.light : schemeStyles.dark;

    const prompt = `Professional marketplace product photography for Wildberries and Ozon. Place this exact product as the hero subject in a ${bgDesc}. Three-point studio lighting applied to the product: key light upper-left at 45 degrees, fill light reducing shadows to 2:1 ratio, subtle rim light separating product from background. Product occupies 65-75% of frame positioned at rule of thirds, perfectly sharp with accurate color reproduction. Background realistically blurred at f/2.8 bokeh creating natural depth separation. 85mm lens equivalent, warm neutral color temperature 5500K, sRGB color profile. The background MUST be a REAL recognizable interior scene with visible depth, NOT a plain solid color or flat gradient. Photorealistic, hero shot quality, 3:4 aspect ratio. NO text, NO letters, NO watermarks, NO logos.`;

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

            // ── PREMIUM OVERLAY ──
            const GRAD_TOP = Math.floor(H * 0.62);
            const TITLE_Y  = Math.floor(H * 0.775);
            const PILL_H   = 56;
            const CHIPS_Y  = H - PAD - PILL_H - 4;

            const SC = {
                warm:     { accent:"#d4a017", title:"#fff8e8", sub:"#ddc880", tint: isLight ? [42,30,5]  : [15,10,2]  },
                dark:     { accent:"#c9a84c", title:"#ffffff",  sub:"#b09070", tint: isLight ? [20,18,10] : [4,4,4]    },
                tech:     { accent:"#00c8ff", title:"#ffffff",  sub:"#4ab8d8", tint: isLight ? [0,12,35]  : [2,8,18]   },
                workshop: { accent:"#ffc200", title:"#ffffff",  sub:"#aaaaaa", tint: isLight ? [12,10,0]  : [8,6,0]    },
                nature:   { accent:"#4caf50", title:"#e8ffe8",  sub:"#7fc87f", tint: isLight ? [4,18,4]   : [4,12,4]   },
            }[scheme] || { accent:"#d4a017", title:"#fff8e8", sub:"#ddc880", tint:[15,10,2] };
            const [tr,tg,tb] = SC.tint;

            // 1. Фото
            const srcTop = Math.floor(img.height * 0.05);
            const srcBot = Math.floor(img.height * 0.97);
            ctx.drawImage(img, 0, srcTop, img.width, srcBot - srcTop, 0, 0, W, H);

            // 2. Мягкий градиент снизу (товар виден на 62%)
            const gOver = ctx.createLinearGradient(0, GRAD_TOP, 0, H);
            gOver.addColorStop(0,    "rgba(0,0,0,0)");
            gOver.addColorStop(0.25, `rgba(${tr},${tg},${tb},0.32)`);
            gOver.addColorStop(0.62, `rgba(${tr},${tg},${tb},0.80)`);
            gOver.addColorStop(1,    `rgba(${tr},${tg},${tb},0.97)`);
            ctx.fillStyle = gOver;
            ctx.fillRect(0, GRAD_TOP, W, H - GRAD_TOP);

            // 3. Бейдж (компактный, top-right)
            if (badge) {
                const bt = badge.toUpperCase();
                const bfs = 13;
                ctx.font = `bold ${bfs}px Arial`;
                const btw = ctx.measureText(bt).width;
                const bpx = 14, bpy = 8, bh = bfs + bpy * 2, bw = btw + bpx * 2;
                const bx = W - PAD - bw, by = 36;
                rr(bx, by, bw, bh, bh / 2, SC.accent);
                ctx.fillStyle = "#000";
                ctx.textAlign = "left";
                ctx.fillText(bt, bx + bpx, by + bpy + bfs - 1);
            }

            // 4. Тонкая акцентная линия над заголовком
            ctx.fillStyle = SC.accent;
            ctx.fillRect(PAD, TITLE_Y - 20, 40, 3);

            // 5. Заголовок (max 66px, не перекрывает товар)
            ctx.textAlign = "left";
            let ty = TITLE_Y;
            for (const word of (name || "").toUpperCase().split(/\s+/)) {
                const sz = autoSize(word, W - PAD * 2, 66, 20);
                if (ty > CHIPS_Y - 46) break;
                ctx.font = `700 ${sz}px 'Oswald', Arial`;
                ctx.fillStyle = SC.title;
                ctx.fillText(word, PAD, ty);
                ty += Math.round(sz * 1.08);
            }

            // 6. Подзаголовок
            if (subtitle && ty < CHIPS_Y - 28) {
                let fsz = 19;
                ctx.font = `400 ${fsz}px Arial`;
                while (fsz > 12 && ctx.measureText(subtitle).width > W - PAD * 2) fsz--;
                ctx.font = `400 ${fsz}px Arial`;
                ctx.fillStyle = SC.sub;
                ctx.fillText(subtitle.substring(0, 90), PAD, ty + 12);
            }

            // 7. Чипы преимуществ (компактные, современные)
            if (feats.length) {
                const gap = 10;
                const colW = (W - PAD * 2 - gap * (feats.length - 1)) / feats.length;
                feats.forEach((f, i) => {
                    const fx = PAD + i * (colW + gap), fy = CHIPS_Y;
                    rr(fx, fy, colW, PILL_H, 10, `rgba(${tr},${tg},${tb},0.84)`, SC.accent, 1.5);
                    // Маленький акцентный круг-иконка
                    ctx.beginPath(); ctx.arc(fx + 18, fy + PILL_H / 2, 5, 0, Math.PI * 2);
                    ctx.fillStyle = SC.accent; ctx.fill();
                    // Текст
                    ctx.fillStyle = "#fff";
                    ctx.textAlign = "left";
                    const fw = f.split(" ");
                    const maxTW = colW - 34;
                    if (fw.length > 1) {
                        const sz = Math.min(autoSize(fw[0], maxTW, 17, 10), autoSize(fw.slice(1).join(" "), maxTW, 17, 10));
                        ctx.font = `600 ${sz}px Arial`;
                        ctx.fillText(fw[0], fx + 30, fy + 20);
                        ctx.fillText(fw.slice(1).join(" "), fx + 30, fy + 20 + sz + 3);
                    } else {
                        const sz = autoSize(f, maxTW, 17, 10);
                        ctx.font = `600 ${sz}px Arial`;
                        ctx.fillText(f, fx + 30, fy + PILL_H / 2 + sz / 3);
                    }
                });
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
        model:  "Professional fashion e-commerce photography. This exact product worn naturally by an attractive slim model, neutral studio expression, full body or 3/4 shot, product is the clear focus. Soft three-point studio lighting: key light upper-left 45 degrees, fill light at 2:1 ratio, rim light separating model from background. Clean white seamless background. 85mm lens f/8. Sharp fabric texture and fit clearly visible. Model pose highlights product silhouette and drape. Photorealistic, Wildberries Ozon marketplace hero shot, 3:4 ratio, NO text NO logos NO watermarks.",
        store:  "Professional retail product photography. This exact item displayed naturally on a premium wooden or chrome hanger against clean white seamless studio background. Soft diffused studio lighting from upper-left with fill light. Product hangs naturally showing silhouette and drape. Subtle grounding shadow for realism. 85mm lens f/8. Sharp fabric texture detail across entire product. Catalog-ready quality. Photorealistic, 3:4 ratio, NO text NO logos.",
        flat:   "Professional flat lay product photography. This exact item arranged on clean white seamless surface, shot from directly overhead at 90 degrees bird's eye view. Soft even lighting with no harsh shadows using diffused softbox from directly above. Product occupies 70% of frame centered. Razor-sharp detail across entire product surface. 50mm lens equivalent f/11. Editorial flat lay styling quality. Photorealistic, 3:4 ratio, NO text NO logos.",
        studio: "Professional studio catalog product photography. This exact item centered on clean light grey acrylic sweep background. Three-point studio lighting: key light upper-left, fill light eliminating harsh shadows, subtle rim light. No shadows on background. Product occupies 75% of frame. Razor-sharp focus across entire product. Accurate color reproduction. 85mm lens f/11. Pure product catalog quality for Wildberries Ozon marketplace. Photorealistic, 3:4 ratio, NO text NO logos NO watermarks."
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
