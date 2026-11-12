// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Realistic Market Price Engine
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

// ✅ ساخت موج طبیعی برای بازار (Random Walk)
// این تابع یه عدد تصادفی نرم بین ۰ تا ۱ برمی‌گردونه که باعث میشه قیمت به طور طبیعی نوسان کنه
function randomWalkNoise(seed) {
    const h = stableHash(seed);
    // تبدیل هش به عدد اعشاری بین ۰ و ۱
    return (h % 10000) / 10000;
}

// ✅ تابع اصلی که قیمت رو در هر لحظه با نویز طبیعی حساب می‌کنه
function getRealisticPrice(basePrice, targetTime, startDayTs, contractAddress, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    
    // ۱. روند اصلی (رشد بلندمدت)
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    const trendPrice = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // ۲. نویز بازار (شبیه به نوسانات واقعی)
    // ما هر ۴ ساعت یه نقطه جدید برای نویز در نظر می‌گیریم که قیمت به سمتش حرکت کنه
    const fourHourBlock = Math.floor(targetTime / 14400);
    const nextBlock = fourHourBlock + 1;
    
    // نقطه شروع و پایان این بازه ۴ ساعته
    const startNoise = (randomWalkNoise(contractAddress + "_b_" + fourHourBlock) - 0.5) * 2; // بین -1 تا +1
    const endNoise = (randomWalkNoise(contractAddress + "_b_" + nextBlock) - 0.5) * 2;
    
    // درون‌یابی خطی (Linear Interpolation) برای اینکه قیمت تو این ۴ ساعت آروم آروم از یه نقطه به نقطه بعدی بره
    const progressInBlock = (targetTime % 14400) / 14400;
    // فرمول Smoothstep برای حرکت نرم‌تر
    const smoothProgress = progressInBlock * progressInBlock * (3 - 2 * progressInBlock);
    
    const currentNoise = startNoise + (endNoise - startNoise) * smoothProgress;
    
    // شدت نوسانات (مثلاً برای توکن ۵٪، برای NFT ۳٪)
    const noiseIntensity = isToken ? 0.05 : 0.03;
    
    // قیمت نهایی = روند اصلی + نویز
    return trendPrice * (1 + currentNoise * noiseIntensity);
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    
    const currentPrice = getRealisticPrice(basePrice, now, startDayTs, contractAddress, isToken);
    const yesterdayPrice = getRealisticPrice(basePrice, now - 86400, startDayTs, contractAddress, isToken);
    
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
        
        // ✅ قیمت شروع و پایان کندل از تابع نویز طبیعی گرفته میشه
        const open = getRealisticPrice(basePrice, time, startDayTs, contractAddress, isToken);
        const close = getRealisticPrice(basePrice, time + sec - 1, startDayTs, contractAddress, isToken);
        
        // ✅ سایه‌های طبیعی (مثل AVAX)
        const high = Math.max(open, close) * (1 + (randomWalkNoise(contractAddress + "_high_" + time) * 0.002)); // حداکثر ۰.۲٪ سایه
        const low = Math.min(open, close) * (1 - (randomWalkNoise(contractAddress + "_low_" + time) * 0.002));  // حداکثر ۰.۲٪ سایه
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        const currentPrice = getRealisticPrice(basePrice, now, startDayTs, contractAddress, isToken);
        last.close = parseFloat(currentPrice.toFixed(6));
        last.high = Math.max(last.open, last.high, currentPrice) * 1.001;
        last.low = Math.min(last.open, last.low, currentPrice) * 0.999;
    }
    
    return candles;
};

console.log("✅ price.js loaded (Realistic Market)");
