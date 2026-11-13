// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Final Market Price Engine (Accurate & Fixed)
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4b1e65f73d8433043bbe0ab8cb3f118fac662f9a": { name: "Guardian Collection", basePrice: 25.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/guardian.png', volatility: 0.05 },
        "0xcfd6c099bc8b3c91d47d62156aec6ba128eb6b92": { name: "FoxEggs Autumn Edition", basePrice: 15.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/autumn.png', volatility: 0.05 },
        "0xaa890ebf2a6356c9da9e5b13c01db4ac88a70c8a": { name: "Fox Eggs: Frozen Realm", basePrice: 20.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/frozen.png', volatility: 0.05 }
    }
};

window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": { basePrice: 4.00, startDate: "2026-11-11", volatility: 0.10 }
};

function stableHash(str) { 
    let hash = 0; 
    for (let i = 0; i < str.length; i++) { 
        hash = ((hash << 5) - hash) + str.charCodeAt(i); 
        hash = hash & hash; 
    } 
    return Math.abs(hash); 
}

// ✅ تشخیص روزهای نزولی (۸ روز در ماه)
function isBearishDay(contractAddress, targetTime) {
    const date = new Date(targetTime * 1000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const monthKey = contractAddress + "_bearish_" + year + "_" + month;
    let bearishDays = [];
    let attempts = 0;
    while (bearishDays.length < 8 && attempts < 200) {
        const hash = stableHash(monthKey + "_attempt_" + attempts);
        const randomDay = (hash % 28) + 1; 
        if (!bearishDays.includes(randomDay)) bearishDays.push(randomDay);
        attempts++;
    }
    return bearishDays.includes(day);
}

// ✅ موتور اصلی: محاسبه قیمت در هر ثانیه (Tick)
function getTickPrice(basePrice, targetTime, startDayTs, contractAddress, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    
    // ۱. روند اصلی (رشد بلندمدت)
    const trendPrice = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // ۲. نویز لحظه‌ای (برای هر ثانیه)
    const tickHash = stableHash(contractAddress + "_tick_" + targetTime);
    const tickNoise = ((tickHash % 10000) / 10000 - 0.5) * 2; 
    
    // ۳. روند نزولی روزهای خاص
    const isBearish = isBearishDay(contractAddress, targetTime);
    const trendBias = isBearish ? -0.008 : 0.008; 
    
    const totalChange = trendBias + (tickNoise * 0.001); // نویز ثانیه‌ای خیلی ریز
    let finalPrice = trendPrice * (1 + totalChange);
    
    return finalPrice < 0.0001 ? 0.0001 : finalPrice;
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11" };
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = Math.floor(new Date(config.startDate + "T00:00:00Z").getTime() / 1000);
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const currentPrice = getTickPrice(basePrice, now, startDayTs, contractAddress, isToken);
    const yesterdayPrice = getTickPrice(basePrice, now - 86400, startDayTs, contractAddress, isToken);
    
    return {
        price: parseFloat(currentPrice.toFixed(6)),
        change24h: yesterdayPrice > 0 ? parseFloat((((currentPrice / yesterdayPrice) - 1) * 100).toFixed(2)) : 0
    };
};

window.getCurrentNFTPrice = function(contractAddress, basePrice) {
    const nft = window.NFT_PRICES.collections[contractAddress.toLowerCase()];
    const config = nft ? { startDate: nft.startDate } : { startDate: "2026-11-11" };
    return window.getCurrentTokenPrice(contractAddress, basePrice, 0, config);
};

window.getTokenInfo = function(contractAddress) {
    if (!contractAddress) return null;
    const addr = contractAddress.toLowerCase();
    for (const key in window.TOKEN_PRICES) {
        if (key.toLowerCase() === addr) {
            const info = window.TOKEN_PRICES[key];
            const current = window.getCurrentTokenPrice(addr, info.basePrice, 0, info);
            return { contract: key, basePrice: info.basePrice, currentPrice: current.price, change24h: current.change24h };
        }
    }
    return null;
};

// ✅ ساخت کندل‌ها با بازه‌های زمانی دقیق
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11" };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = Math.floor(new Date(config.startDate + "T00:00:00Z").getTime() / 1000);
    
    // ✅ تعریف دقیق ثانیه‌ها برای هر بازه زمانی
    const secMap = {
        '6h': 21600,            // ۶ ساعت
        '1d': 86400,            // ۱ روز
        '7d': 604800,           // ۷ روز
        '30d': 2592000,         // ۳۰ روز (۱ ماه)
        '6m': 15552000,         // ۶ ماه
        '1y': 31536000,         // ۱ سال
        'all': 31536000         // کل (هر کندل ۱ سال)
    };
    
    const sec = secMap[timeframe] || 86400;
    
    // ✅ محاسبه تعداد بازه‌های کامل گذشته + ۱ برای کندل در حال جریان (امروز)
    const totalElapsedSeconds = now - startDayTs;
    let totalCandles = Math.floor(totalElapsedSeconds / sec) + 1;
    
    if (totalCandles < 1) totalCandles = 1;
    
    // محدودیت برای جلوگیری از شلوغی بیش از حد (مثلاً برای ۶ ساعت در ۱۰ سال)
    if (totalCandles > 400) {
        // اگه تعداد کندل‌ها بیشتر از ۴۰۰ شد، بازه رو بزرگتر می‌کنیم
        const newSec = Math.ceil(totalElapsedSeconds / 400);
        totalCandles = Math.floor(totalElapsedSeconds / newSec) + 1;
        return buildCandles(basePrice, contractAddress, isToken, startDayTs, now, newSec, totalCandles);
    }
    
    return buildCandles(basePrice, contractAddress, isToken, startDayTs, now, sec, totalCandles);
};

// ✅ تابع کمکی برای ساخت کندل‌ها (برای جلوگیری از تکرار کد)
function buildCandles(basePrice, contractAddress, isToken, startDayTs, now, sec, totalCandles) {
    const candles = [];
    const startBucket = Math.floor(startDayTs / sec);
    
    for (let i = 0; i < totalCandles; i++) {
        const time = (startBucket + i) * sec;
        if (time > now + sec) break;
        
        const candleEndTime = Math.min(time + sec - 1, now);
        
        const open = getTickPrice(basePrice, time, startDayTs, contractAddress, isToken);
        const close = getTickPrice(basePrice, candleEndTime, startDayTs, contractAddress, isToken);
        
        // ✅ سایه‌های طبیعی
        const highHash = stableHash(contractAddress + "_high_" + time);
        const lowHash = stableHash(contractAddress + "_low_" + time);
        const high = Math.max(open, close) * (1 + ((highHash % 50) / 10000)); 
        const low = Math.min(open, close) * (1 - ((lowHash % 50) / 10000));
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    return candles;
}

console.log("✅ price.js loaded (Accurate Timeframes & Today's Candle)");
