// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Advanced Price Engine (Final & Stable Version)
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

// ✅ تابع محاسبه قیمت پایه (بدون نویزهای عجیب که کندل‌ها رو خراب کنه)
function getBasePriceAtTime(basePrice, startDayTs, targetTime, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    // نرخ رشد روزانه: توکن 0.34% و NFT 0.185%
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    
    // فرمول رشد مرکب
    return basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000; // ✅ UTC
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    
    // قیمت پایه امروز
    let currentPrice = getBasePriceAtTime(basePrice, startDayTs, now, isToken);
    
    // ✅ اعمال نویز قیمت لحظه‌ای (فقط برای عددی که بالای صفحه نشون داده میشه)
    const minuteNum = Math.floor(now / 60);
    const minuteNoiseHash = stableHash(contractAddress + "_m_" + minuteNum);
    const minuteNoise = ((minuteNoiseHash % 100) - 50) / 10000; // بین -۰.۵٪ تا +۰.۵٪
    currentPrice = currentPrice * (1 + minuteNoise);

    // قیمت دیروز
    let yesterdayPrice = getBasePriceAtTime(basePrice, startDayTs, now - 86400, isToken);
    
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

// ✅ تابع ساخت کندل‌ها (با رنگ‌بندی و بدنه کاملاً درست)
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11", volatility: 0.10 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000; // ✅ UTC
    
    const secMap = {
        '1m': 60, '1h': 3600, '6h': 21600, '1d': 86400,
        '7d': 604800, '30d': 2592000, '6m': 15552000,
        '1y': 31536000, 'all': 31536000
    };
    
    let sec = secMap[timeframe] || 86400;
    let totalCandles = Math.floor((now - startDayTs) / sec);
    if (totalCandles < 2) totalCandles = 2;
    
    // برای اینکه چارت سنگین نشه، نهایتاً ۴۰۰ کندل می‌سازیم
    if (totalCandles > 400) {
        sec = Math.ceil((now - startDayTs) / 400);
        totalCandles = 400;
    }
    
    const candles = [];
    const currentBucket = Math.floor(now / sec);
    const startBucket = currentBucket - (totalCandles - 1);
    
    for (let i = 0; i < totalCandles; i++) {
        const bucket = startBucket + i;
        const time = bucket * sec;
        
        // ✅ قیمت شروع (بدون نویز)
        const open = getBasePriceAtTime(basePrice, startDayTs, time, isToken);
        
        // ✅ قیمت پایان (با نویز منحصر به فرد برای هر کندل، بین -۰.۳٪ تا +۰.۳٪)
        const candleNoiseHash = stableHash(contractAddress + "_c_" + bucket);
        const candleNoise = ((candleNoiseHash % 60) - 30) / 10000; 
        const close = open * (1 + candleNoise);
        
        // ✅ سایه‌ها دقیقاً تنظیم میشن که باعث اشتباه در رنگ‌بندی نشن
        const high = Math.max(open, close) * 1.0002;
        const low = Math.min(open, close) * 0.9998;
        
        candles.push({
            time: time, // زمان به UTC (تاریخ میلادی درست)
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    
    // هماهنگی ۱۰۰٪ کندل آخر با قیمتی که بالای صفحه نشون داده میشه
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        
        let finalPrice = getBasePriceAtTime(basePrice, startDayTs, now, isToken);
        const minuteNum = Math.floor(now / 60);
        const minuteNoiseHash = stableHash(contractAddress + "_m_" + minuteNum);
        const minuteNoise = ((minuteNoiseHash % 100) - 50) / 10000;
        finalPrice = finalPrice * (1 + minuteNoise);
        
        last.close = parseFloat(finalPrice.toFixed(6));
        last.high = Math.max(last.open, last.high, finalPrice) * 1.0002;
        last.low = Math.min(last.open, last.low, finalPrice) * 0.9998;
    }
    
    return candles;
};

console.log("✅ price.js loaded (Final & Stable Version)");
