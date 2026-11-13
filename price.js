// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Realistic Price Engine (Target-Based) - FIXED v2
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

// ✅ نویز ارتقا یافته (ترکیب ۳ موج برای طبیعی تر شدن)
function marketNoise(seed) {
    const h = stableHash(seed);
    const x = (h % 10000) / 10000; 
    // ترکیب ۳ موج سینوسی با فرکانس‌های مختلف
    return (Math.sin(x * Math.PI * 2) * 0.4) + 
           (Math.sin(x * Math.PI * 6) * 0.3) + 
           (Math.cos(x * Math.PI * 12) * 0.3);
}

// ✅ تابع اصلی محاسبه قیمت (اضافه شدن نویز دقیقه‌ای و ثانیه‌ای)
function calculateFinalPrice(basePrice, targetTime, startDayTs, contractAddress, isToken, volatility) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    
    // ۱. روند اصلی (Trend)
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    const trendPrice = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // ۲. نویزهای چند لایه (برای اینکه توی تایم‌فریم ۱ دقیقه هم نوسان داشته باشیم)
    const dayBlock = Math.floor(targetTime / 86400);
    const hourBlock = Math.floor(targetTime / 3600);
    const minBlock = Math.floor(targetTime / 60);
    
    const vol = volatility || 0.05;
    
    // نویز روزانه (تا ۲ درصد)
    const dailyNoise = marketNoise(contractAddress + "_d_" + dayBlock) * 0.02; 
    // نویز ساعتی (تا ۱ درصد)
    const hourlyNoise = marketNoise(contractAddress + "_h_" + hourBlock) * 0.01; 
    // ✅ نویز دقیقه‌ای (تا ۰.۵ درصد) - این باعث میشه نمودار ۱ دقیقه‌ای هم بالا و پایین بره
    const minutelyNoise = marketNoise(contractAddress + "_m_" + minBlock) * 0.005; 
    
    // ۳. قیمت نهایی
    let finalPrice = trendPrice * (1 + dailyNoise + hourlyNoise + minutelyNoise);
    
    if (finalPrice < 0.0001) finalPrice = 0.0001;
    return finalPrice;
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const vol = config.volatility || 0.05;
    
    const currentPrice = calculateFinalPrice(basePrice, now, startDayTs, contractAddress, isToken, vol);
    const yesterdayPrice = calculateFinalPrice(basePrice, now - 86400, startDayTs, contractAddress, isToken, vol);
    
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

// ✅ تولید تاریخچه کندل‌ها
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11", volatility: 0.10 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    const vol = config.volatility || 0.05;
    
    if (now < startDayTs) {
        return [{ time: now, open: basePrice, high: basePrice, low: basePrice, close: basePrice }];
    }

    const secMap = {
        '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
        '7d': 604800, '30d': 2592000, '1y': 31536000
    };
    
    let sec = secMap[timeframe] || 3600; // پیش‌فرض ۱ ساعت
    
    let totalCandles = Math.floor((now - startDayTs) / sec);
    if (totalCandles < 2) totalCandles = 2;
    
    // محدودیت ۴۰۰ کندل
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
        
        const open = calculateFinalPrice(basePrice, time, startDayTs, contractAddress, isToken, vol);
        
        // برای کندل آخر (کندل زنده)، تایم رو روی الان تنظیم میکنیم
        let closeTime = time + sec - 1;
        if (closeTime > now) closeTime = now; 
        
        const close = calculateFinalPrice(basePrice, closeTime, startDayTs, contractAddress, isToken, vol);
        
        // ✅ محاسبه High و Low واقعی تر (بررسی میانه بازه برای پیدا کردن بیشترین/کمترین)
        const midTime = time + Math.floor(sec / 2);
        const midPrice = calculateFinalPrice(basePrice, midTime, startDayTs, contractAddress, isToken, vol);
        
        const high = Math.max(open, close, midPrice) * 1.0002; // سایه بالا
        const low = Math.min(open, close, midPrice) * 0.9998;   // سایه پایین
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    
    // آپدیت کندل آخر با قیمت لحظه‌ای
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        const currentPrice = calculateFinalPrice(basePrice, now, startDayTs, contractAddress, isToken, vol);
        last.close = parseFloat(currentPrice.toFixed(6));
        last.high = Math.max(last.open, last.high, currentPrice) * 1.0002;
        last.low = Math.min(last.open, last.low, currentPrice) * 0.9998;
    }
    
    return candles;
};

console.log("✅ price.js loaded (Target-Based) - FIXED v2");
