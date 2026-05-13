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

// ── БАЗА ФОНОВ И ПРЕИМУЩЕСТВ ──
const BACKGROUNDS_DB = [
    { id:"workshop", name:"Мастерская", emoji:"🔨", scheme:"workshop",
      image:"img/bg/01_workshop.jpg",
      prompt:"professional carpenter workshop, wooden workbench with sawdust, tools on pegboard wall blurred in background, warm overhead industrial spotlight, dark concrete floor",
      products:[
        {k:["шуруповёрт","шуруп"],       a:["мощность","автономность","удобный хват"]},
        {k:["дрель"],                    a:["высокая скорость","универсальность","надёжность"]},
        {k:["болгарк"],                  a:["мощный мотор","точный рез","прочность"]},
        {k:["перфоратор"],               a:["сила удара","производительность","износостойкость"]},
        {k:["струбцин"],                 a:["надёжная фиксация","прочность","удобство"]},
        {k:["ящик","toolbox"],           a:["вместительность","организация","мобильность"]},
        {k:["перчатк","gloves"],         a:["защита рук","комфорт","износостойкость"]},
        {k:["уровень","лазерн"],         a:["точность","скорость работы","удобство"]},
        {k:["рулетк"],                   a:["точность измерений","компактность","прочность"]},
        {k:["крепёж","крепеж","болт","гайк"], a:["надёжность","прочность","долговечность"]},
        {k:["фурнитур"],                 a:["качество","эстетика","износостойкость"]},
        {k:["инструмент"],               a:["универсальность","долговечность","удобство хранения"]},
      ], def:["надёжность","прочность","долговечность"] },

    { id:"darktech", name:"Dark Tech", emoji:"💻", scheme:"tech",
      image:"img/bg/02_darktech.jpg",
      prompt:"dark modern tech workspace, black desk with subtle LED accent glow, premium monitor with interface glow, professional dark home office setup",
      products:[
        {k:["смартфон","телефон","iphone","samsung","xiaomi"], a:["производительность","камера","дизайн"]},
        {k:["ноутбук","laptop","macbook"],                     a:["мощность","мобильность","автономность"]},
        {k:["powerbank","павербанк","power bank"],             a:["быстрая зарядка","компактность","ёмкость"]},
        {k:["ssd","жёсткий","накопитель"],                    a:["скорость","надёжность","бесшумность"]},
        {k:["клавиатур","keyboard"],                          a:["отклик","комфорт","долговечность"]},
        {k:["мышк","mouse"],                                  a:["точность","эргономика","скорость"]},
        {k:["наушник","headphone","airpod"],                  a:["звук","шумоподавление","комфорт"]},
        {k:["микрофон","microphone"],                         a:["чистый звук","чувствительность","качество записи"]},
        {k:["часы","smartwatch","умные часы","apple watch"],  a:["функциональность","автономность","стиль"]},
        {k:["камер","camera","веб-камер"],                    a:["качество съёмки","детализация","стабилизация"]},
        {k:["роутер","router","wifi"],                        a:["скорость интернета","стабильность","покрытие"]},
      ], def:["производительность","надёжность","стиль"] },

    { id:"gaming", name:"Gaming Room", emoji:"🎮", scheme:"tech",
      image:"img/bg/03_gaming.jpg",
      prompt:"RGB gaming room with neon LED strip lighting, gaming setup with colorful atmospheric glow, dark gaming desk with monitor",
      products:[
        {k:["мышк","mouse","игровая мышь"],           a:["быстрый отклик","точность","RGB"]},
        {k:["клавиатур","keyboard","механическая"],   a:["механика","подсветка","скорость"]},
        {k:["геймпад","gamepad","джойстик"],          a:["удобство","виброотклик","совместимость"]},
        {k:["кресл","chair","игровое кресло"],        a:["комфорт","поддержка спины","регулировка"]},
        {k:["микрофон","microphone","стримерск"],     a:["качество записи","шумоподавление","стиль"]},
        {k:["rgb","лента","подсветк"],                a:["атмосфера","яркость","настройка цветов"]},
        {k:["headset","гарнитур","наушник"],          a:["объёмный звук","микрофон","комфорт"]},
        {k:["монитор","monitor","экран"],             a:["высокая герцовка","цветопередача","отклик"]},
        {k:["пк","pc","системный блок","компьютер"],  a:["производительность","охлаждение","дизайн"]},
      ], def:["быстрый отклик","производительность","стиль"] },

    { id:"marble", name:"Мрамор + вода", emoji:"💎", scheme:"dark",
      image:"img/bg/04_marble.jpg",
      prompt:"luxury white Carrara marble surface with elegant water droplets, premium beauty product photography background",
      products:[
        {k:["сыворотк","serum"],         a:["увлажнение","сияние кожи","лёгкая текстура"]},
        {k:["крем","cream"],             a:["питание","защита","восстановление"]},
        {k:["косметик","makeup"],        a:["стойкость","качество","эстетика"]},
        {k:["духи","парфюм","perfume"],  a:["аромат","стойкость","premium-дизайн"]},
        {k:["патч"],                     a:["увлажнение","снятие отёков","комфорт"]},
        {k:["масло","oil"],              a:["питание","блеск","восстановление"]},
        {k:["шампун","shampoo"],         a:["уход","мягкость","блеск"]},
        {k:["бьюти","beauty","гаджет"], a:["эффективность","удобство","инновации"]},
        {k:["skincare","уход"],          a:["уход","натуральность","эффективность"]},
      ], def:["уход","натуральность","эффективность"] },

    { id:"spa", name:"SPA интерьер", emoji:"🧖", scheme:"nature",
      image:"img/bg/05_spa.jpg",
      prompt:"luxury spa bathroom interior with white marble, scented candles, eucalyptus branches, soft warm ambient lighting",
      products:[
        {k:["крем","cream"],             a:["мягкость кожи","питание","комфорт"]},
        {k:["свеч","candle"],            a:["атмосфера","аромат","уют"]},
        {k:["аромамасл","эфирн"],        a:["расслабление","натуральность","стойкость"]},
        {k:["массажёр","массаж"],        a:["расслабление мышц","удобство","эффективность"]},
        {k:["косметик"],                 a:["уход","эстетика","качество"]},
        {k:["халат","robe"],             a:["мягкость","комфорт","premium-ткань"]},
        {k:["полотенц","towel"],         a:["впитываемость","мягкость","качество"]},
        {k:["bath","bomb","бомбочк"],    a:["аромат","расслабление","визуальный эффект"]},
        {k:["набор","set","комплект"],   a:["комплексный уход","стиль","подарок"]},
      ], def:["натуральность","комфорт","качество"] },

    { id:"scandinavian", name:"Scandinavian", emoji:"🏠", scheme:"warm",
      image:"img/bg/06_scandinavian.jpg",
      prompt:"bright minimalist Scandinavian interior, white walls, light oak wood furniture, soft natural daylight from large window, clean Nordic design",
      products:[
        {k:["мебел","furniture"],        a:["минимализм","удобство","качество"]},
        {k:["органайзер","organizer"],   a:["порядок","компактность","функциональность"]},
        {k:["декор","decor"],            a:["эстетика","уют","современный стиль"]},
        {k:["текстил","textile"],        a:["мягкость","комфорт","натуральность"]},
        {k:["ваз","vase"],               a:["минимализм","стиль","универсальность"]},
        {k:["полк","shelf"],             a:["вместительность","простота","дизайн"]},
        {k:["лампа","lamp","светильник"],a:["мягкий свет","стиль","уют"]},
        {k:["часы","clock","watch"],     a:["дизайн","минимализм","практичность"]},
        {k:["корзин","basket"],          a:["организация","вместительность","эстетика"]},
      ], def:["минимализм","функциональность","качество"] },

    { id:"cozy", name:"Уютная гостиная", emoji:"🕯", scheme:"warm",
      image:"img/bg/07_cozy.jpg",
      prompt:"cozy living room with warm amber lamp light, linen sofa with cushions, oak coffee table, inviting warm home atmosphere",
      products:[
        {k:["плед","blanket"],           a:["мягкость","тепло","уют"]},
        {k:["подушк","pillow","cushion"],a:["комфорт","дизайн","мягкость"]},
        {k:["свеч","candle"],            a:["атмосфера","аромат","эстетика"]},
        {k:["лампа","lamp","светильник"],a:["тёплый свет","уют","стиль"]},
        {k:["книг","book"],              a:["эстетика","развитие","атмосфера"]},
        {k:["декор","decor"],            a:["уют","стиль","гармония"]},
        {k:["ковёр","ковр","carpet","rug"],a:["комфорт","тепло","интерьер"]},
        {k:["столик","table"],           a:["функциональность","дизайн","компактность"]},
        {k:["увлажнитель","humidifier"], a:["свежесть воздуха","комфорт","здоровье"]},
      ], def:["комфорт","тепло","уют"] },

    { id:"kids", name:"Детская комната", emoji:"🧸", scheme:"warm",
      image:"img/bg/08_kids.jpg",
      prompt:"bright cheerful children's bedroom with pastel colors, natural daylight, wooden toys, safe playful home atmosphere",
      products:[
        {k:["игрушк","toy"],             a:["безопасность","яркость","развитие"]},
        {k:["детск","kids","child"],      a:["мягкость","комфорт","безопасность"]},
        {k:["развивающ","обучающ"],      a:["обучение","моторика","интерес"]},
        {k:["конструктор","lego"],       a:["развитие мышления","творчество","качество"]},
        {k:["книж","book"],              a:["развитие","обучение","иллюстрации"]},
        {k:["ночник","nightlight"],       a:["мягкий свет","безопасность","уют"]},
        {k:["мебел","furniture"],        a:["безопасность","удобство","качество"]},
        {k:["коврик","mat"],             a:["мягкость","тепло","безопасность"]},
        {k:["montessori","монтессор"],   a:["развитие навыков","натуральность","обучение"]},
      ], def:["безопасность","развитие","качество"] },

    { id:"gym", name:"Gym Industrial", emoji:"🏋️", scheme:"workshop",
      image:"img/bg/09_gym.jpg",
      prompt:"professional industrial gym, dark rubber floor with texture, overhead spotlights, gym equipment blurred in background",
      products:[
        {k:["гантел","dumbbell"],        a:["прочность","удобный хват","долговечность"]},
        {k:["бутылк","bottle","шейкер"], a:["герметичность","удобство","объём"]},
        {k:["коврик","mat","yoga"],       a:["антискольжение","комфорт","износостойкость"]},
        {k:["резинк","band","эспандер"], a:["эластичность","универсальность","компактность"]},
        {k:["протеин","питание","supplement"],a:["эффективность","вкус","состав"]},
        {k:["перчатк","gloves"],         a:["защита","комфорт","сцепление"]},
        {k:["спортивн","спорт"],         a:["комфорт","вентиляция","эластичность"]},
      ], def:["прочность","долговечность","эффективность"] },

    { id:"parking", name:"Парковка ночью", emoji:"🚗", scheme:"tech",
      image:"img/bg/10_parking.jpg",
      prompt:"night city parking with wet asphalt reflections, dramatic neon and streetlight atmospheric glow, dark premium automotive atmosphere",
      products:[
        {k:["авто","автоакс","car"],      a:["удобство","стиль","функциональность"]},
        {k:["led","подсветк","лента"],   a:["яркость","атмосфера","энергоэффективность"]},
        {k:["электроник","electronics"], a:["функциональность","надёжность","технологии"]},
        {k:["сабвуфер","subwoofer"],     a:["мощный бас","чистый звук","качество"]},
        {k:["держател","holder","крепл"],a:["фиксация","удобство","универсальность"]},
        {k:["видеорег","dashcam","регистратор"],a:["качество записи","безопасность","угол обзора"]},
        {k:["автохими","химия","полирол"],a:["защита","блеск","долговечность"]},
      ], def:["надёжность","функциональность","долговечность"] },

    { id:"garage", name:"Garage Workshop", emoji:"🔧", scheme:"workshop",
      image:"img/bg/11_garage.jpg",
      prompt:"professional garage workshop, grey concrete floor, car lift in background, organized tool wall, dramatic overhead workshop lighting",
      products:[
        {k:["домкрат","jack"],           a:["грузоподъёмность","устойчивость","безопасность"]},
        {k:["компрессор","compressor"],  a:["мощность","производительность","долговечность"]},
        {k:["автохими","химия"],         a:["защита","очистка","блеск"]},
        {k:["ключ","wrench","ratchet"],  a:["прочность","точность","износостойкость"]},
        {k:["масл","oil","синтетик"],    a:["защита двигателя","долговечность","эффективность"]},
        {k:["шин","tire","резин"],       a:["сцепление","безопасность","износостойкость"]},
        {k:["аккумулятор","battery"],    a:["мощность","надёжность","срок службы"]},
        {k:["инструмент"],               a:["прочность","надёжность","удобство"]},
      ], def:["прочность","надёжность","долговечность"] },

    { id:"kitchen", name:"Rustic Kitchen", emoji:"🍳", scheme:"nature",
      image:"img/bg/12_kitchen.jpg",
      prompt:"rustic kitchen interior, warm natural oak wooden countertop, herbs in terracotta pots, morning window sunlight, organic cozy kitchen atmosphere",
      products:[
        {k:["кофе","coffee"],            a:["аромат","насыщенность","бодрость"]},
        {k:["чай","tea"],                a:["вкус","натуральность","расслабление"]},
        {k:["специ","spice"],            a:["аромат","вкус","натуральность"]},
        {k:["сладост","десерт","sweet"], a:["вкус","текстура","эстетика"]},
        {k:["кухонн","утвар","посуда"],  a:["удобство","качество","долговечность"]},
        {k:["доск","board"],             a:["натуральное дерево","прочность","стиль"]},
        {k:["нож","knife"],              a:["острота","баланс","качество стали"]},
        {k:["мёд","honey"],              a:["натуральность","вкус","польза"]},
        {k:["выпечк","хлеб","bread"],    a:["свежесть","аромат","мягкость"]},
      ], def:["натуральность","качество","вкус"] },

    { id:"cafe", name:"Кофейня", emoji:"☕", scheme:"warm",
      image:"img/bg/13_cafe.jpg",
      prompt:"cozy coffee shop interior, warm ambient ceiling lighting, wooden tables, steaming coffee cup, relaxed cafe atmosphere",
      products:[
        {k:["кофе","coffee"],            a:["аромат","энергия","вкус"]},
        {k:["кружк","чашк","mug","cup"], a:["дизайн","удобство","объём"]},
        {k:["термос","thermos","tumbler"],a:["сохранение температуры","герметичность","мобильность"]},
        {k:["десерт","пирожн","cake"],   a:["вкус","эстетика","свежесть"]},
        {k:["сироп","syrup"],            a:["насыщенный вкус","аромат","разнообразие"]},
        {k:["ноутбук","laptop"],         a:["мобильность","производительность","стиль"]},
        {k:["блокнот","notebook"],       a:["удобство","минимализм","качество бумаги"]},
        {k:["книг","book"],              a:["атмосфера","развитие","эстетика"]},
      ], def:["уют","стиль","качество"] },

    { id:"pets", name:"Pet Home", emoji:"🐾", scheme:"warm",
      image:"img/bg/14_pets.jpg",
      prompt:"cozy home interior with warm natural lighting, comfortable soft home setting, pet-friendly warm atmosphere",
      products:[
        {k:["лежанк","lounger","кровать для"],a:["мягкость","комфорт","тепло"]},
        {k:["игрушк","toy"],             a:["прочность","интерес","безопасность"]},
        {k:["миск","bowl","кормушк"],    a:["удобство","устойчивость","качество"]},
        {k:["когтеточк","scratching"],   a:["прочность","защита мебели","долговечность"]},
        {k:["корм","food","питание"],    a:["натуральный состав","вкус","польза"]},
        {k:["поводок","leash"],          a:["прочность","комфорт","безопасность"]},
        {k:["одежд","одежда для"],       a:["тепло","стиль","комфорт"]},
        {k:["переноск","carrier"],       a:["безопасность","удобство","вентиляция"]},
      ], def:["безопасность","комфорт","качество"] },

    { id:"collector", name:"Collector Shelf", emoji:"🏆", scheme:"dark",
      image:"img/bg/15_collector.jpg",
      prompt:"premium dark display shelf with dramatic spotlights on collectible items, dark luxurious background with subtle ambient accent glow",
      products:[
        {k:["фигурк","figure","статуэтк"],a:["детализация","коллекционная ценность","качество"]},
        {k:["коллекц","collectible"],    a:["редкость","дизайн","ценность"]},
        {k:["lego","лего"],              a:["сборка","качество","творчество"]},
        {k:["funko","pop"],              a:["узнаваемость","коллекционность","стиль"]},
        {k:["merch","мерч"],             a:["fandom","дизайн","уникальность"]},
        {k:["anime","аниме"],            a:["эстетика","коллекционность","детализация"]},
        {k:["виниловые","vinyl"],        a:["качество покраски","стиль","коллекционная ценность"]},
        {k:["комикс","comic"],           a:["иллюстрации","сюжет","коллекционность"]},
      ], def:["детализация","качество","стиль"] },
];

function findAdvantages(productName) {
    const bg = BACKGROUNDS_DB.find(b => b.id === mpSelectedBg) || BACKGROUNDS_DB[0];
    const pn = (productName || "").toLowerCase();
    for (const p of bg.products) {
        if (p.k.some(k => pn.includes(k.toLowerCase()) || k.toLowerCase().split(/\s+/).some(w => pn.includes(w) && w.length > 3))) {
            return p.a;
        }
    }
    return bg.def;
}

function autoFillAdvantages(productName) {
    const advs = findAdvantages(productName);
    if (advs[0]) document.getElementById("mp-card-feat1").value = advs[0];
    if (advs[1]) document.getElementById("mp-card-feat2").value = advs[1];
    if (advs[2]) document.getElementById("mp-card-feat3").value = advs[2];
}

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
    setTimeout(renderBgSelector, 50);
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
let mpCardBgStyle = "dark";
let mpSelectedBg = "workshop";
let mpCardBgPrompt = "";
let mpCardCategory = "clothing";
let mpCardIcon1 = "✦";
let mpCardIcon2 = "✦";
let mpCardIcon3 = "✦";
let mpCardWithText = true;  // режим: с текстом или без
let mpCardSlogan = "";      // слоган (заголовок карточки)
let mpCardTagline = "";     // подзаголовок
let mpCardFeatures = [];    // [{icon, text}, ...]

function mpSetTextMode(withText) {
    mpCardWithText = withText;
    document.getElementById("mp-tt-with").classList.toggle("active", withText);
    document.getElementById("mp-tt-without").classList.toggle("active", !withText);
    const descCell = document.getElementById("mp-card-analysis-cell");
    if (descCell) descCell.style.display = withText ? "block" : "none";
}

function mpSelectBg(style, el) {
    mpCardBgStyle = style;
    document.querySelectorAll(".mp-bg-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
}

function mpSelectBackground(bgId, el) {
    mpSelectedBg = bgId;
    document.querySelectorAll(".mp-bg-scene-item").forEach(i => i.classList.remove("active"));
    if (el) el.classList.add("active");
    else {
        const row = document.getElementById("mp-bg-scene-row");
        if (row) {
            const idx = BACKGROUNDS_DB.findIndex(b => b.id === bgId);
            if (row.children[idx]) row.children[idx].classList.add("active");
        }
    }
    // Sync dots
    document.querySelectorAll(".mp-bg-dot").forEach(d => {
        d.classList.toggle("active", d.dataset.bgid === bgId);
    });
    const bg = BACKGROUNDS_DB.find(b => b.id === bgId);
    if (bg) {
        mpCardColorScheme = bg.scheme;
        const name = document.getElementById("mp-card-name").value.trim();
        if (name) autoFillAdvantages(name);
    }
}

function renderBgSelector() {
    const row = document.getElementById("mp-bg-scene-row");
    if (!row) return;
    const bgColors = { warm:"#1a1100", dark:"#0a0a10", tech:"#060c1e", workshop:"#120e00", nature:"#061006" };
    row.innerHTML = BACKGROUNDS_DB.map(bg => {
        const isActive = bg.id === mpSelectedBg ? " active" : "";
        const fallback = bgColors[bg.scheme] || "#111";
        return `<div class="mp-bg-scene-item${isActive}" onclick="mpSelectBackground('${bg.id}',this)">
            <div class="mp-bg-scene-thumb" style="background-color:${fallback};background-image:url('${bg.image}')"><span class="mp-bg-scene-emoji">${bg.emoji}</span></div>
            <div class="mp-bg-scene-name">${bg.name}</div>
        </div>`;
    }).join("");

    // Dots
    const dotsEl = document.getElementById("mp-bg-dots");
    if (dotsEl) {
        dotsEl.innerHTML = BACKGROUNDS_DB.map((bg, i) =>
            `<div class="mp-bg-dot${bg.id === mpSelectedBg ? " active" : ""}" data-bgid="${bg.id}" onclick="mpDotClick('${bg.id}')"></div>`
        ).join("");
    }

    // Fades + scroll listener
    const scroll = document.getElementById("mp-bg-scene-scroll");
    if (scroll) {
        const updateFades = () => {
            const fadeR = document.getElementById("mp-bg-fade-right");
            const fadeL = document.getElementById("mp-bg-fade-left");
            if (fadeR) fadeR.style.opacity = scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 4 ? "1" : "0";
            if (fadeL) fadeL.style.opacity = scroll.scrollLeft > 4 ? "1" : "0";
        };
        scroll.removeEventListener("scroll", scroll._fadeHandler);
        scroll._fadeHandler = updateFades;
        scroll.addEventListener("scroll", updateFades, { passive: true });
        updateFades();
    }
}

function mpDotClick(bgId) {
    mpSelectBackground(bgId, null);
    // Scroll the item into view
    const scroll = document.getElementById("mp-bg-scene-scroll");
    const row = document.getElementById("mp-bg-scene-row");
    if (!scroll || !row) return;
    const idx = BACKGROUNDS_DB.findIndex(b => b.id === bgId);
    const item = row.children[idx];
    if (item) {
        const itemLeft = item.offsetLeft;
        const itemW = item.offsetWidth;
        const scrollW = scroll.clientWidth;
        scroll.scrollTo({ left: itemLeft - scrollW / 2 + itemW / 2, behavior: "smooth" });
    }
    // Update dots active state
    document.querySelectorAll(".mp-bg-dot").forEach(d => {
        d.classList.toggle("active", d.dataset.bgid === bgId);
    });
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
        // Показываем переключатель режима
        document.getElementById("mp-text-toggle-wrap").style.display = "block";
        // Показываем ячейку анализа и запускаем анализ (если режим "с текстом")
        // Всегда показываем базовые поля (название + категория)
        const baseFields = document.getElementById("mp-card-base-fields");
        const loading = document.getElementById("mp-analysis-loading");
        const result = document.getElementById("mp-analysis-result");
        if (baseFields) baseFields.style.display = "block";
        if (loading) loading.style.display = "flex";
        if (result) result.style.display = "none";
        // Показываем описание только для режима "С текстом"
        const descCell = document.getElementById("mp-card-analysis-cell");
        if (descCell) descCell.style.display = mpCardWithText ? "block" : "none";
        mpCardAnalyze(mpCardPhotoBase64);
    };
    reader.readAsDataURL(file);
}

const LOCATION_SEEDS = {
    clothing: [
        "уютная гостиная с тёплым светом торшера",
        "скандинавская спальня с белыми стенами и дневным светом",
        "кофейня с деревянными столиками и мягким светом",
        "летняя терраса с естественным солнечным светом",
        "минималистичная белая студия с мягкими тенями"
    ],
    accessories: [
        "мраморная поверхность с мягким студийным светом",
        "тёмная полка коллекционера с точечной подсветкой",
        "роскошный бутик с золотыми акцентами",
        "минималистичная витрина ювелирного магазина",
        "тёмный бархат с драматическим прожектором"
    ],
    food: [
        "деревенская кухня с дубовой столешницей и травами",
        "уютная кофейня с тёплым amber-светом",
        "фермерский рынок с натуральными продуктами",
        "современная кухня с белой мраморной поверхностью",
        "пикник на траве с мягким естественным светом"
    ],
    beauty: [
        "мраморная ванная с каплями воды и soft-светом",
        "спа-интерьер со свечами и веточками эвкалипта",
        "белая студия с розовым акцентным светом",
        "роскошный туалетный столик с круглым зеркалом",
        "тропическая ванная с живыми растениями"
    ],
    gadgets: [
        "RGB игровая комната с неоновыми LED-лентами",
        "тёмный минималистичный офис с синим светом монитора",
        "ночная крыша с панорамой огней города",
        "полка в магазине электроники с подсветкой",
        "тёмная студия с драматическим точечным прожектором"
    ],
    home: [
        "скандинавский интерьер с большим панорамным окном",
        "уютная гостиная с кирпичной стеной и свечами",
        "светлая студия в стиле лофт с высокими потолками",
        "терраса с видом на зелёный сад",
        "современная квартира с панорамными окнами ночью"
    ],
    other: [
        "профессиональная деревянная мастерская с инструментами",
        "гаражный бокс с бетонным полом и неоновым светом",
        "промышленный спортзал с резиновым покрытием",
        "уличная площадка с граффити на стенах",
        "минималистичный склад с драматическим освещением"
    ]
};

function pickLocationSeed(category) {
    const list = LOCATION_SEEDS[category] || LOCATION_SEEDS.other;
    return list[Math.floor(Math.random() * list.length)];
}

async function mpCardAnalyze(base64) {
    const loadingEl = document.getElementById("mp-analysis-loading");
    const resultEl  = document.getElementById("mp-analysis-result");

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
                        { type: "text", text: `Посмотри на изображение товара.${(()=>{const s=document.getElementById("mp-card-specs")?.value?.trim();return s?`\nРЕАЛЬНЫЕ ХАРАКТЕРИСТИКИ ТОВАРА (ОБЯЗАТЕЛЬНО использовать в name, badge, subtitle, feat1-3): ${s}`:"";})()}\nОтветь ТОЛЬКО валидным JSON без markdown и без пояснений.

Доступные локации (по одной на каждую категорию, ИСПОЛЬЗУЙ именно эти варианты):
clothing: ${LOCATION_SEEDS.clothing[Math.floor(Math.random()*LOCATION_SEEDS.clothing.length)]}
accessories: ${LOCATION_SEEDS.accessories[Math.floor(Math.random()*LOCATION_SEEDS.accessories.length)]}
food: ${LOCATION_SEEDS.food[Math.floor(Math.random()*LOCATION_SEEDS.food.length)]}
beauty: ${LOCATION_SEEDS.beauty[Math.floor(Math.random()*LOCATION_SEEDS.beauty.length)]}
gadgets: ${LOCATION_SEEDS.gadgets[Math.floor(Math.random()*LOCATION_SEEDS.gadgets.length)]}
home: ${LOCATION_SEEDS.home[Math.floor(Math.random()*LOCATION_SEEDS.home.length)]}
other: ${LOCATION_SEEDS.other[Math.floor(Math.random()*LOCATION_SEEDS.other.length)]}

{
  "name": "Короткий продающий заголовок карточки, МАКСИМУМ 3 слова, ЗАГЛАВНЫМИ. Это НЕ название бренда — это крючок для покупателя. Используй материал, главное свойство или выгоду. Примеры: ТЁПЛАЯ ФЛАНЕЛЬ, 100% ХЛОПОК, МЯГЧЕ С КАЖДОЙ СТИРКОЙ, КРУТЯЩИЙ МОМЕНТ 50НМ, ЗАРЯД НА 8 ЧАСОВ. ЗАПРЕЩЕНО: ВАШ ИДЕАЛЬНЫЙ, ЛУЧШИЙ ВЫБОР, КОМФОРТ ДОМА",
  "category": "один из: clothing, accessories, food, beauty, gadgets, home, other",
  "location": "скопируй ТОЧНО выбранную локацию из списка выше — ту что лучше всего подходит для этого товара",
  "props": "перечисли 3-4 предмета которые логично окружают этот товар в реальной жизни. Только предметы через запятую на английском. Примеры: для пижамы — folded linen blanket, wooden tray with pine cones, steaming mug of tea, soft candles. Для шуруповёрта — wooden planks, screws, work gloves, sawdust. Для крема — rolled towel, eucalyptus branches, smooth stones, candles.",
  "background_prompt": "переведи выбранную локацию на английский, добавь реквизит из поля props и технические параметры съёмки. Только окружение без самого товара. Максимум 40 слов.",
  "badge": "Конкретная характеристика товара (2-4 слова, ЗАГЛАВНЫМИ). Материал, мощность, ёмкость, размер. Примеры: 100% ХЛОПОК, 18В БЕСЩЁТОЧНЫЙ, ОБЪЁМ 5Л, РАЗМЕРЫ 42-52. НЕ писать общие слова типа ПРЕМИУМ, ЛУЧШИЙ, ИДЕАЛЬНЫЙ",
  "subtitle": "2-3 конкретных факта о товаре через буллет, строчными. Только реальные свойства: материал, размер, мощность, функции. Формат: факт1 • факт2 • факт3. Примеры для пижамы: хлопок 100% • размеры 42-54 • машинная стирка. Для шуруповёрта: крутящий момент 50Нм • 2 скорости • кейс в комплекте",
  "feat1": "Конкретное свойство товара, МАКСИМУМ 2 слова. Материал/размер/мощность/функция. Примеры: 100% ХЛОПОК, 18В, 5 ЛИТРОВ, ВОДОСТОЙКИЙ. ЗАПРЕЩЕНО: КОМФОРТ, КАЧЕСТВО, СТИЛЬ, УДОБСТВО",
  "feat2": "Другое конкретное свойство, МАКСИМУМ 2 слова. Не повторять feat1. Примеры: РАЗМЕР 42-54, АНТИПРИГАР, БЫСТРАЯ ЗАРЯДКА",
  "feat3": "Третье конкретное свойство, МАКСИМУМ 2 слова. Не повторять feat1 и feat2. Примеры: МАШИННАЯ СТИРКА, ГАРАНТИЯ 1ГОД, КОМПЛЕКТ 2ШТ",
  "icon1": "одна emoji иконка подходящая к feat1. Примеры: ☁️🌙✂️🔥💧⚡🎯🛡️🌿",
  "icon2": "одна emoji иконка подходящая к feat2",
  "icon3": "одна emoji иконка подходящая к feat3"
}` }
                    ]
                }]
            })
        });

        const result = await resp.json();
        console.log("Analyze API response:", JSON.stringify(result).substring(0, 500));

        let text = result?.choices?.[0]?.message?.content
            || result?.data?.[0]?.text
            || result?.output
            || result?.text
            || "";

        if (!text) throw new Error("Empty response: " + JSON.stringify(result).substring(0, 200));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in: " + text.substring(0, 200));
        const data = JSON.parse(jsonMatch[0]);

        // Заполняем видимые поля
        const nameEl = document.getElementById("mp-card-name");
        if (nameEl) nameEl.value = data.name || "";

        const catEl = document.getElementById("mp-card-category");
        if (catEl && data.category) catEl.value = data.category;

        // Сохраняем AI-промт фона (локация + реквизит)
        const props = data.props ? `, ${data.props}` : "";
        mpCardBgPrompt = data.background_prompt
            ? data.background_prompt + (data.props && !data.background_prompt.includes(data.props.split(",")[0]) ? `, ${data.props}` : "")
            : "";

        // Сохраняем категорию и иконки для generate-card запроса
        mpCardCategory = data.category || "clothing";
        mpCardIcon1 = data.icon1 || "✦";
        mpCardIcon2 = data.icon2 || "✦";
        mpCardIcon3 = data.icon3 || "✦";

        // Цветовая схема по категории
        const schemeMap = {
            clothing: "warm", accessories: "dark", food: "nature",
            beauty: "nature", gadgets: "tech", home: "warm", other: "workshop"
        };
        mpCardColorScheme = schemeMap[data.category] || "warm";

        // Синхронизируем select категории
        if (data.category) mpCategoryChange(data.category);

        // Заполняем скрытые поля для генерации
        const dbAdvs = findAdvantages(data.name || "");
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setVal("mp-card-subtitle", data.subtitle || "");
        setVal("mp-card-badge",    data.badge    || "");
        setVal("mp-card-feat1",    data.feat1 || dbAdvs[0] || "");
        setVal("mp-card-feat2",    data.feat2 || dbAdvs[1] || "");
        setVal("mp-card-feat3",    data.feat3 || dbAdvs[2] || "");


    } catch (e) {
        console.warn("Auto-analyze failed:", e.message);
    } finally {
        if (loadingEl) loadingEl.style.display = "none";
        if (resultEl)  resultEl.style.display  = "flex";
    }
}

// Маппинг пользовательских категорий на фоны BACKGROUNDS_DB (3-4 варианта)
const CATEGORY_TO_BG = {
    clothing:    ["cozy", "scandinavian", "cafe", "kids"],
    accessories: ["marble", "collector", "spa", "scandinavian"],
    food:        ["kitchen", "cafe", "cozy", "scandinavian"],
    beauty:      ["spa", "marble", "scandinavian", "cozy"],
    gadgets:     ["darktech", "gaming", "workshop", "garage"],
    home:        ["scandinavian", "cozy", "kitchen", "kids"],
    other:       ["workshop", "garage", "gym", "pets"]
};

// Выбор лучшего фона из массива по названию товара
function pickBestBg(categoryId, productName) {
    const bgs = CATEGORY_TO_BG[categoryId];
    if (!bgs) return "workshop";
    if (!productName) return bgs[0];
    const pn = productName.toLowerCase();
    // Ищем фон у которого есть совпадение по ключевым словам продуктов
    for (const bgId of bgs) {
        const bg = BACKGROUNDS_DB.find(b => b.id === bgId);
        if (!bg) continue;
        for (const p of bg.products) {
            if (p.k.some(k => pn.includes(k.toLowerCase()))) return bgId;
        }
    }
    return bgs[0]; // по умолчанию первый из массива
}

function mpCategoryChange(categoryId) {
    const productName = document.getElementById("mp-card-name")?.value || "";
    const bgId = pickBestBg(categoryId, productName);
    mpSelectedBg = bgId;
    const bg = BACKGROUNDS_DB.find(b => b.id === bgId);
    if (bg) mpCardColorScheme = bg.scheme;
    // Синхронизируем select если вызвано программно
    const catEl = document.getElementById("mp-card-category");
    if (catEl && catEl.value !== categoryId) catEl.value = categoryId;
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

async function mpCardAiIdea() {
    if (!mpCardPhotoBase64) {
        tg.showAlert("Сначала загрузи фото товара!");
        return;
    }
    const btn = document.getElementById("mp-ai-idea-btn");
    const descEl = document.getElementById("mp-card-description");
    if (btn) { btn.textContent = "⏳ Думаю..."; btn.disabled = true; }
    try {
        const name = document.getElementById("mp-card-name")?.value || "товар";
        const POLZA_KEY = "pza_Y_e6drIevLO8ptUDrT2T5srYMGIrIEgP";
        const resp = await fetch("https://polza.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${POLZA_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "google/gemini-3.1-flash-lite",
                messages: [{
                    role: "user",
                    content: [
                        { type: "image_url", image_url: { url: "data:image/jpeg;base64," + mpCardPhotoBase64 } },
                        { type: "text", text: `Ты копирайтер для маркетплейса WB/Ozon. Товар: "${name}". Посмотри на фото и ответь ТОЛЬКО валидным JSON без markdown.\n\n{\n  "slogan": "2-3 СЛОВА ЗАГЛАВНЫМИ — конкретное главное свойство товара. Материал, особенность, факт. Примеры для пижамы: ТЁПЛЫЙ ХЛОПОК, ФЛАНЕЛЬ 100%, УЮТНАЯ КЛЕТКА. Для шуруповёрта: КРУТЯЩИЙ МОМЕНТ 50НМ, ЗАРЯД 8 ЧАСОВ. СТРОГО ЗАПРЕЩЕНО: ВАШ ИДЕАЛЬНЫЙ, ЛУЧШИЙ ВЫБОР, ДОМАШНИЙ УЮТ, КОМФОРТ ДОМА, МЯГКИЙ СОН, ВАШ УЮТ",\n  "tagline": "1-2 предложения с конкретными характеристиками: материал, размеры, функции. Без маркетинговой воды.",\n  "features": [\n    {"icon": "эмодзи", "text": "КОНКРЕТНЫЙ ФАКТ: материал/размер/мощность/функция. НЕ прилагательные — только измеримые свойства. Пример: 100% ХЛОПОК, РАЗМЕР 42-54, 18В БАТАРЕЯ"},\n    {"icon": "эмодзи", "text": "второй конкретный факт, не повторять первый"},\n    {"icon": "эмодзи", "text": "третий конкретный факт"},\n    {"icon": "эмодзи", "text": "четвёртый конкретный факт"},\n    {"icon": "эмодзи", "text": "пятый конкретный факт"}\n  ]\n}\nSTRICTLY 5 features. На русском.` }
                    ]
                }]
            })
        });
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON");
        const parsed = JSON.parse(jsonMatch[0]);

        mpCardSlogan = parsed.slogan || "";
        mpCardTagline = parsed.tagline || "";
        mpCardFeatures = parsed.features || [];

        // Показываем в поле описания
        if (descEl) {
            const lines = mpCardFeatures.map(f => `${f.icon} ${f.text}`).join("\n");
            descEl.value = `${mpCardSlogan}\n${mpCardTagline}\n\n${lines}`;
        }
    } catch(e) {
        console.error("AI idea error:", e);
        tg.showAlert("Не удалось получить идею, попробуй ещё раз");
    } finally {
        if (btn) { btn.textContent = "✦ AI идея"; btn.disabled = false; }
    }
}

async function mpCardGenerate() {
    if (!mpCardPhotoBase64) return;

    const name = document.getElementById("mp-card-name").value.trim();

    // Если AI идея была нажата — используем слоган и фичи
    // Иначе fallback на скрытые поля от автоанализа
    const useAiIdea = mpCardSlogan && mpCardFeatures.length > 0;
    const cardTitle   = useAiIdea ? mpCardSlogan : name;
    const cardSubtitle = useAiIdea ? mpCardTagline : document.getElementById("mp-card-subtitle").value.trim();
    const badge = useAiIdea ? name : (document.getElementById("mp-card-badge").value.trim() || name);
    const features = useAiIdea
        ? mpCardFeatures
        : [
            { icon: "✦", text: document.getElementById("mp-card-feat1").value.trim() },
            { icon: "✦", text: document.getElementById("mp-card-feat2").value.trim() },
            { icon: "✦", text: document.getElementById("mp-card-feat3").value.trim() },
          ].filter(f => f.text);

    console.log("[Card] useAiIdea:", useAiIdea, "features:", JSON.stringify(features));
    const sceneBg = mpCardBgPrompt || "clean professional studio, soft gradient background, neutral tones";
    const scenePrompt = `${sceneBg}. Photorealistic commercial photography scene, cinematic lighting, high detail, 3:4 aspect ratio. NO text, NO watermarks.`;

    switchScreen("loading");
    animateSteps();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);
        const resp = await fetch(`${API_SERVER}/generate-card`, {
            signal: controller.signal,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                photo: mpCardPhotoBase64,
                scene_prompt: scenePrompt,
                product_name: name || "product",
                category: mpCardCategory || "clothing",
                card: mpCardWithText ? (() => {
                    const price = document.getElementById("mp-card-price")?.value?.trim() || "";
                    const c = { name: cardTitle, subtitle: cardSubtitle, badge, scheme: mpCardColorScheme || "warm", price };
                    features.forEach((f, i) => {
                        c[`feat${i+1}`] = String(f.text || "");
                        c[`icon${i+1}`] = String(f.icon || "✦");
                    });
                    return c;
                })() : null
            })
        });
        clearTimeout(timeout);
        const result = await resp.json();
        const resultUrl = result?.url;
        if (!resultUrl) throw new Error(result?.error || "No image in response");

        // Сервер уже вернул готовую карточку с текстом
        const finalBase64 = resultUrl;

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

function getIconType(feat) {
    const f = feat.toLowerCase();
    if (/мощн|скоро|энерги|быстр|сила\s*удар|герцовк/.test(f)) return "bolt";
    if (/автоном|аккумул|ёмкост|зарядк/.test(f)) return "battery";
    if (/прочн|долговечн|надёжн|износ|защит|безопасн|стойк|фиксац/.test(f)) return "shield";
    if (/качест|дизайн|эстетик|стиль|коллекц|ценност|детализац|натур/.test(f)) return "diamond";
    if (/точн/.test(f)) return "target";
    if (/звук|шумо|аудио|микрофон/.test(f)) return "sound";
    if (/комфорт|хват|мягкост|тепло|уют|расслабл|удобств/.test(f)) return "comfort";
    if (/компактн|мобильн|вместит|органи|порядок/.test(f)) return "box";
    if (/аромат|натур|органик/.test(f)) return "leaf";
    if (/развит|обучен|творчест|инновац|функцион|универсальн|эффективн|производительн/.test(f)) return "arrows";
    return "check";
}

function drawAdvIcon(ctx, cx, cy, r, type, clr) {
    ctx.save();
    ctx.strokeStyle = clr; ctx.fillStyle = clr;
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const s = r * 0.52;
    if (type === "bolt") {
        ctx.beginPath();
        ctx.moveTo(cx+s*0.4,cy-s*1.1); ctx.lineTo(cx-s*0.6,cy+s*0.2); ctx.lineTo(cx+s*0.1,cy+s*0.1);
        ctx.lineTo(cx-s*0.4,cy+s*1.1); ctx.lineTo(cx+s*0.6,cy-s*0.2); ctx.lineTo(cx-s*0.1,cy-s*0.1);
        ctx.closePath(); ctx.fill();
    } else if (type === "battery") {
        ctx.beginPath(); ctx.roundRect(cx-s*0.9,cy-s*0.5,s*1.6,s*1.0,s*0.15); ctx.stroke();
        ctx.fillRect(cx+s*0.7,cy-s*0.28,s*0.22,s*0.56);
        ctx.fillRect(cx-s*0.8,cy-s*0.38,s*1.05,s*0.76);
    } else if (type === "shield") {
        ctx.beginPath();
        ctx.moveTo(cx,cy-s*1.1); ctx.lineTo(cx+s*0.9,cy-s*0.4);
        ctx.lineTo(cx+s*0.9,cy+s*0.2);
        ctx.quadraticCurveTo(cx+s*0.8,cy+s*1.0,cx,cy+s*1.3);
        ctx.quadraticCurveTo(cx-s*0.8,cy+s*1.0,cx-s*0.9,cy+s*0.2);
        ctx.lineTo(cx-s*0.9,cy-s*0.4); ctx.closePath(); ctx.stroke();
        ctx.lineWidth=1.8; ctx.beginPath();
        ctx.moveTo(cx-s*0.38,cy+s*0.08); ctx.lineTo(cx-s*0.05,cy+s*0.42); ctx.lineTo(cx+s*0.42,cy-s*0.28); ctx.stroke();
    } else if (type === "diamond") {
        ctx.beginPath();
        ctx.moveTo(cx,cy-s*1.1); ctx.lineTo(cx+s*0.9,cy); ctx.lineTo(cx,cy+s*1.1); ctx.lineTo(cx-s*0.9,cy); ctx.closePath(); ctx.stroke();
        ctx.lineWidth=1; ctx.beginPath();
        ctx.moveTo(cx-s*0.9,cy); ctx.lineTo(cx-s*0.32,cy-s*1.1);
        ctx.moveTo(cx+s*0.9,cy); ctx.lineTo(cx+s*0.32,cy-s*1.1);
        ctx.moveTo(cx-s*0.32,cy-s*1.1); ctx.lineTo(cx,cy+s*0.42); ctx.lineTo(cx+s*0.32,cy-s*1.1); ctx.stroke();
    } else if (type === "target") {
        ctx.beginPath(); ctx.arc(cx,cy,s*0.95,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx,cy,s*0.35,0,Math.PI*2); ctx.fill();
        ctx.lineWidth=1.4; ctx.beginPath();
        ctx.moveTo(cx,cy-s*0.95); ctx.lineTo(cx,cy-s*0.5);
        ctx.moveTo(cx,cy+s*0.5);  ctx.lineTo(cx,cy+s*0.95);
        ctx.moveTo(cx-s*0.95,cy); ctx.lineTo(cx-s*0.5,cy);
        ctx.moveTo(cx+s*0.5,cy);  ctx.lineTo(cx+s*0.95,cy); ctx.stroke();
    } else if (type === "sound") {
        ctx.beginPath();
        ctx.moveTo(cx-s*0.6,cy-s*0.5); ctx.lineTo(cx-s*0.15,cy-s*0.5);
        ctx.lineTo(cx+s*0.5,cy-s*1.0); ctx.lineTo(cx+s*0.5,cy+s*1.0);
        ctx.lineTo(cx-s*0.15,cy+s*0.5); ctx.lineTo(cx-s*0.6,cy+s*0.5); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+s*0.5,cy,s*0.65,-Math.PI*0.4,Math.PI*0.4); ctx.stroke();
    } else if (type === "comfort") {
        ctx.beginPath(); ctx.arc(cx,cy,s*0.9,0,Math.PI*2); ctx.stroke();
        ctx.lineWidth=2.5; ctx.beginPath();
        ctx.moveTo(cx-s*0.48,cy+s*0.1); ctx.lineTo(cx-s*0.1,cy+s*0.5); ctx.lineTo(cx+s*0.55,cy-s*0.35); ctx.stroke();
    } else if (type === "box") {
        ctx.beginPath();
        ctx.moveTo(cx,cy-s*1.05); ctx.lineTo(cx+s*0.85,cy-s*0.5);
        ctx.lineTo(cx+s*0.85,cy+s*0.65); ctx.lineTo(cx,cy+s*1.05);
        ctx.lineTo(cx-s*0.85,cy+s*0.65); ctx.lineTo(cx-s*0.85,cy-s*0.5); ctx.closePath(); ctx.stroke();
        ctx.lineWidth=1.4; ctx.beginPath();
        ctx.moveTo(cx-s*0.85,cy-s*0.5); ctx.lineTo(cx,cy); ctx.lineTo(cx+s*0.85,cy-s*0.5);
        ctx.moveTo(cx,cy); ctx.lineTo(cx,cy+s*1.05); ctx.stroke();
    } else if (type === "leaf") {
        ctx.beginPath();
        ctx.moveTo(cx,cy+s*1.0);
        ctx.quadraticCurveTo(cx-s*1.0,cy-s*0.2,cx-s*0.2,cy-s*1.0);
        ctx.quadraticCurveTo(cx+s*1.0,cy-s*0.2,cx,cy+s*1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx-s*0.1,cy-s*0.8); ctx.lineTo(cx-s*0.2,cy+s*0.9); ctx.stroke();
    } else if (type === "arrows") {
        ctx.lineWidth=2.3; ctx.beginPath();
        ctx.moveTo(cx-s*0.9,cy+s*0.7); ctx.lineTo(cx-s*0.3,cy+s*0.1);
        ctx.lineTo(cx+s*0.2,cy+s*0.5); ctx.lineTo(cx+s*0.9,cy-s*0.7); ctx.stroke();
        ctx.lineWidth=2; ctx.beginPath();
        ctx.moveTo(cx+s*0.42,cy-s*0.7); ctx.lineTo(cx+s*0.9,cy-s*0.7); ctx.lineTo(cx+s*0.9,cy-s*0.2); ctx.stroke();
    } else { // check (default)
        ctx.beginPath(); ctx.arc(cx,cy,s*0.9,0,Math.PI*2); ctx.stroke();
        ctx.lineWidth=2.5; ctx.beginPath();
        ctx.moveTo(cx-s*0.48,cy+s*0.1); ctx.lineTo(cx-s*0.1,cy+s*0.5); ctx.lineTo(cx+s*0.55,cy-s*0.35); ctx.stroke();
    }
    ctx.restore();
}

async function drawCardOverlay(imageUrl, { name, subtitle, badge, feat1, feat2, feat3 }) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (!imageUrl.startsWith("data:")) img.crossOrigin = "anonymous";
        img.onload = async () => {
            try {
            await document.fonts.load("700 60px 'Oswald'");
            const W = 800, H = 1100;
            const canvas = document.createElement("canvas");
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext("2d");
            const scheme = mpCardColorScheme || "warm";
            const PAD = 28;
            const feats = [feat1, feat2, feat3].filter(Boolean);

            const ACCENTS = { warm:"#d4a017", dark:"#c9a84c", tech:"#00c8ff", workshop:"#ffc200", nature:"#4caf50" };
            const accent = ACCENTS[scheme] || "#d4a017";
            const TINTS  = { warm:[16,11,3], dark:[6,5,8], tech:[3,9,22], workshop:[12,9,0], nature:[4,14,5] };
            const [tr,tg,tb] = TINTS[scheme] || [16,11,3];

            const TITLE_H = 130;
            const PAD_TOP = 22;

            function autoSz(text, maxW, max, min) {
                let sz = max;
                ctx.font = `700 ${sz}px 'Oswald', Arial`;
                while (sz > min && ctx.measureText(text).width > maxW) sz--;
                return sz;
            }

            // 1. Product image — full canvas height
            ctx.filter = "brightness(1.1)";
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);
            ctx.filter = "none";

            // 2. No gradient — text shadow ensures readability on any background

            // 3. Badge pill (top-right)
            if (badge) {
                const bt = badge.toUpperCase();
                ctx.font = "bold 12px Arial";
                const bpx = 13, bpy = 7;
                const btw = ctx.measureText(bt).width;
                const bw = btw + bpx*2, bh = 12 + bpy*2;
                const bx = W - PAD - bw, by = 18;
                ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh/2);
                ctx.fillStyle = accent; ctx.fill();
                ctx.fillStyle = "#111"; ctx.textAlign = "left";
                ctx.fillText(bt, bx + bpx, by + bpy + 11);
            }

            // 4. Title text
            ctx.textAlign = "left";
            const fullTitle = (name || "").toUpperCase();
            const tMaxW = W - PAD*2 - (badge ? 175 : 10);
            const tsz = autoSz(fullTitle, tMaxW, 70, 26);
            ctx.font = `700 ${tsz}px 'Oswald', Arial`;
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(0,0,0,0.85)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const titleY = PAD_TOP + tsz;
            ctx.fillText(fullTitle, PAD, titleY);

            // 5. Subtitle below title
            if (subtitle) {
                let ssz = 17;
                ctx.font = `400 ${ssz}px Arial`;
                while (ssz > 11 && ctx.measureText(subtitle).width > W - PAD*2) ssz--;
                ctx.font = `400 ${ssz}px Arial`;
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.shadowBlur = 8;
                ctx.fillText(subtitle.substring(0, 90), PAD, titleY + ssz + 6);
            }
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // 6. Left gradient for advantages readability (full height)
            if (feats.length > 0) {
                const lGrad = ctx.createLinearGradient(0, 0, 275, 0);
                lGrad.addColorStop(0,   `rgba(${tr},${tg},${tb},0.82)`);
                lGrad.addColorStop(0.6, `rgba(${tr},${tg},${tb},0.42)`);
                lGrad.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
                ctx.fillStyle = lGrad;
                ctx.fillRect(0, TITLE_H, 275, H - TITLE_H);

                // 7. Three advantages on left, evenly distributed over full image height
                const availH = H - TITLE_H - 50;
                const spacing = availH / (feats.length + 1);
                const ICR = 22, ICX = 50, TXT_X = ICX + ICR + 12, TXT_W = 186;

                feats.forEach((feat, i) => {
                    const cy = TITLE_H + spacing * (i + 1);

                    // Circle background
                    ctx.beginPath(); ctx.arc(ICX, cy, ICR, 0, Math.PI*2);
                    ctx.fillStyle = accent + "26"; ctx.fill();
                    ctx.strokeStyle = accent; ctx.lineWidth = 1.8; ctx.stroke();

                    // Vector icon
                    drawAdvIcon(ctx, ICX, cy, ICR, getIconType(feat), accent);

                    // Advantage text
                    ctx.textAlign = "left";
                    ctx.fillStyle = "#ffffff";
                    const words = feat.split(" ");
                    let fsz = 20;
                    ctx.font = `600 ${fsz}px Arial`;
                    while (fsz > 12 && ctx.measureText(feat).width > TXT_W) fsz--;
                    if (ctx.measureText(feat).width <= TXT_W) {
                        ctx.font = `600 ${fsz}px Arial`;
                        ctx.fillText(feat, TXT_X, cy + fsz * 0.36);
                    } else {
                        const mid = Math.ceil(words.length / 2);
                        const l1 = words.slice(0, mid).join(" ");
                        const l2 = words.slice(mid).join(" ");
                        let sz2 = 18;
                        ctx.font = `600 ${sz2}px Arial`;
                        while (sz2 > 11 && (ctx.measureText(l1).width > TXT_W || ctx.measureText(l2).width > TXT_W)) sz2--;
                        ctx.font = `600 ${sz2}px Arial`;
                        ctx.fillText(l1, TXT_X, cy - 4);
                        ctx.fillText(l2, TXT_X, cy + sz2 + 4);
                    }
                });
            }

            resolve(canvas.toDataURL("image/jpeg", 0.93));
            } catch(e) { reject(e); }
        };
        img.onerror = (e) => reject(new Error("Image load failed"));
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
