// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Realistic Market Price Engine (Final)
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

// ✅ تولید نویز نرم (مثل حرکت موج دریا، نه پرش‌های تصادفی)
function smoothNoise(seed) {
    const h = stableHash(seed);
    const x = (h % 10000) / 10000; // بین 0 و 1
    // یک منحنی نرم برای نوسانات
    return Math.sin(x * Math.PI * 2) * 0.5 + Math.cos(x * Math.PI * 4) * 0.5; 
}

// ✅ محاسبه قیمت در هر لحظه با نویز نرم
function getPriceAtTime(basePrice, targetTime, startDayTs, contractAddress, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    
    // ۱. روند اصلی رشد (برای بلندمدت)
    const trendPrice = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // ۲. نویز نرم برای هر بازه زمانی (مثلاً هر ۱۰ دقیقه یک موج نرم)
    // این کار باعث میشه قیمت پله‌ای نشه و خط‌های بارکدی حذف بشن
    const timeBlock = Math.floor(targetTime / 600); // هر ۱۰ دقیقه
    const noiseVal = smoothNoise(contractAddress + "_noise_" + timeBlock);
    
    // نویز ملایم بین -۰.۵٪ تا +۰.۵٪
    const noiseImpact = noiseVal * 0.005; 
    
    return trendPrice * (1 + noiseImpact);
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    
    const currentPrice = getPriceAtTime(basePrice, now, startDayTs, contractAddress, isToken);
    const yesterdayPrice = getPriceAtTime(basePrice, now - 86400, startDayTs, contractAddress, isToken);
    
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

window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11", volatility: 0.10 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    const secMap = {
        '1m': 60, '1h': 3600, '6h': 21600, '1d': 86400,
        '7d': 604800, '30d': 2592000, '6m': 15552000,
        '1y': 31536000, 'all': 31536000
    };
    
    let sec = secMap[timeframe] || 86400;
    let totalCandles = Math.floor((now - startDayTs) / sec);
    if (totalCandles < 2) totalCandles = 2;
    
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
        
        // ✅ قیمت شروع و پایان کندل از روی نویز نرم
        const open = getPriceAtTime(basePrice, time, startDayTs, contractAddress, isToken);
        const close = getPriceAtTime(basePrice, time + sec - 1, startDayTs, contractAddress, isToken);
        
        // ✅ سایه‌های خیلی کوتاه (فقط ۰.۰۲٪) که باعث میشه بدنه کندل‌ها توپر و زیبا بشن
        const high = Math.max(open, close) * 1.0002;
        const low = Math.min(open, close) * 0.9998;
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    
    // هماهنگی کندل آخر با قیمت لحظه‌ای
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        const currentPrice = getPriceAtTime(basePrice, now, startDayTs, contractAddress, isToken);
        last.close = parseFloat(currentPrice.toFixed(6));
        last.high = Math.max(last.open, last.high, currentPrice) * 1.0002;
        last.low = Math.min(last.open, last.low, currentPrice) * 0.9998;
    }
    
    return candles;
};

console.log("✅ price.js loaded (Realistic & Clean)");
