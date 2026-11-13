// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Realistic Price Engine (Target-Based) - FIXED
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4b1e65f73d8433043bbe0ab8cb3f118fac662f9a": { name: "Guardian Collection", basePrice: 25.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/guardian.png', volatility: 0.05 },
        "0xcfd6c099bc8b3c91d47d62156aec6ba128eb6b92": { name: "FoxEggs Autumn Edition", basePrice: 15.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/autumn.png', volatility: 0.05 },
        "0xaa890ebf2a6356c9da9e5b13c01db4ac88a70c8a": { name: "Fox Eggs: Frozen Realm", basePrice: 20.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/frozen.png', volatility: 0.05 }
    }
};

window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": {
        basePrice: 4.00, startDate: "2026-11-11", volatility: 0.10 
    }
};

function stableHash(str) { 
    let hash = 0; 
    for (let i = 0; i < str.length; i++) { 
        hash = ((hash << 5) - hash) + str.charCodeAt(i); 
        hash = hash & hash; 
    } 
    return Math.abs(hash); 
}

// ✅ نویز طبیعی بازار (بین -1 و 1)
function marketNoise(seed) {
    const h = stableHash(seed);
    const x = (h % 10000) / 10000; 
    // ترکیب سینوس و کسینوس برای ایجاد موج طبیعی
    return Math.sin(x * Math.PI * 2) * 0.5 + Math.cos(x * Math.PI * 5) * 0.5;
}

// ✅ محاسبه قیمت در هر لحظه از زمان
function calculateFinalPrice(basePrice, targetTime, startDayTs, contractAddress, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    
    // نرخ رشد روزانه
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    const trendPrice = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // نویزها
    const hourBlock = Math.floor(targetTime / 3600);
    const dailyNoise = marketNoise(contractAddress + "_d_" + Math.floor(daysPassed)) * 0.03; 
    const hourlyNoise = marketNoise(contractAddress + "_h_" + hourBlock) * 0.01; 
    
    let finalPrice = trendPrice * (1 + dailyNoise + hourlyNoise);
    
    if (finalPrice < 0.0001) finalPrice = 0.0001;
    return finalPrice;
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    
    const currentPrice = calculateFinalPrice(basePrice, now, startDayTs, contractAddress, isToken);
    const yesterdayPrice = calculateFinalPrice(basePrice, now - 86400, startDayTs, contractAddress, isToken);
    
    return {
        price: parseFloat(currentPrice.toFixed(6)),
        change24h: yesterdayPrice > 0 ? parseFloat((((currentPrice / yesterdayPrice) - 1) * 100).toFixed(2)) : 0
    };
};

window.getCurrentNFTPrice = function(contractAddress, basePrice) {
    const nft = window.NFT_PRICES.collections[contractAddress.toLowerCase()];
    const config = nft ? { startDate: nft.startDate, volatility: nft.volatility } : { startDate: "2026-11-11", volatility: 0.05 };
    return window.getCurrentTokenPrice(contractAddress, basePrice, config.volatility, config);
};

window.getTokenInfo = function(contractAddress) {
    if (!contractAddress) return null;
    const addr = contractAddress.toLowerCase();
    for (const key in window.TOKEN_PRICES) {
        if (key.toLowerCase() === addr) {
            const info = window.TOKEN_PRICES[key];
            const current = window.getCurrentTokenPrice(addr, info.basePrice, info.volatility, info);
            return { contract: key, basePrice: info.basePrice, currentPrice: current.price, change24h: current.change24h };
        }
    }
    return null;
};

// ✅ تولید تاریخچه کندل‌ها (اصلاح‌شده برای حل مشکلات)
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11", volatility: 0.10 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const now = Math.floor(Date.now() / 1000); // زمان فعلی سیستم (میلادی)
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    // اگر زمان فعلی قبل از تاریخ شروع است
    if (now < startDayTs) {
        return [{
            time: now,
            open: basePrice, high: basePrice, low: basePrice, close: basePrice
        }];
    }

    const secMap = {
        '1m': 60, '1h': 3600, '6h': 21600, '1d': 86400,
        '7d': 604800, '30d': 2592000, '6m': 15552000,
        '1y': 31536000, 'all': 31536000
    };
    
    let sec = secMap[timeframe] || 86400;
    
    // محاسبه تعداد کندل‌ها بر اساس زمان سپری شده
    let totalCandles = Math.floor((now - startDayTs) / sec);
    
    // ✅ حل مشکل روز سوم: همیشه حداقل ۲ کندل داشته باشیم و کندل آخر حتماً باز باشه
    if (totalCandles < 2) {
        totalCandles = 2;
    }
    
    // ✅ محدودیت ۴۰۰ کندل برای جلوگیری از سنگین شدن نمودار
    if (totalCandles > 400) {
        sec = Math.ceil((now - startDayTs) / 400);
        totalCandles = 400;
    }
    
    const candles = [];
    // شروع از کندلی که دقیقاً از startDayTs شروع میشه
    const currentBucket = Math.floor(now / sec);
    // شروع محاسبه از کندل فعلی به عقب
    const startBucket = currentBucket - (totalCandles - 1);
    
    for (let i = 0; i < totalCandles; i++) {
        const bucket = startBucket + i;
        const time = bucket * sec;
        
        // ✅ قیمت Open: در ابتدای بازه زمانی
        const open = calculateFinalPrice(basePrice, time, startDayTs, contractAddress, isToken);
        
        // ✅ قیمت Close: در انتهای بازه زمانی (یا زمان فعلی اگر کندل آخر باشد)
        let closeTime = time + sec - 1;
        if (closeTime > now) closeTime = now; // کندل جاری (زنده) تا لحظه حالا
        
        const close = calculateFinalPrice(basePrice, closeTime, startDayTs, contractAddress, isToken);
        
        // ✅ سایه‌ها (High و Low)
        // برای جلوگیری از سایه‌های مصنوعی، High و Low رو از بین open، close و نویزهای داخلی بازه محاسبه می‌کنیم
        const high = Math.max(open, close) * 1.0005;
        const low = Math.min(open, close) * 0.9995;
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    
    // ✅ کندل آخر رو حتماً با قیمت لحظه‌ای آپدیت کن
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        const currentPrice = calculateFinalPrice(basePrice, now, startDayTs, contractAddress, isToken);
        last.close = parseFloat(currentPrice.toFixed(6));
        // چون close تغییر کرد، High و Low رو مجدد تنظیم کن
        last.high = Math.max(last.open, last.close) * 1.0005;
        last.low = Math.min(last.open, last.close) * 0.9995;
    }
    
    return candles;
};

console.log("✅ price.js loaded (Target-Based) - FIXED");
