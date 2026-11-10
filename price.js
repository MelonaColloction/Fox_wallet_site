// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Price Configuration (نسخه اصلاح‌شده)
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4B1e65f73D8433043Bbe0AB8Cb3f118FAC662F9a": { name: "Guardian Collection", pricePerNFT: 25.00 },
        "0xcfd6c099bc8B3c91D47D62156AEc6BA128eB6B92": { name: "FoxEggs Autumn Edition", pricePerNFT: 15.00 },
        "0xaA890ebf2a6356c9Da9E5B13C01db4aC88A70c8a": { name: "Fox Eggs: Frozen Realm", pricePerNFT: 20.00 }
    },
    overridePrices: {}
};

window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": {
        basePrice: 4.00,
        dailyMin: -3,
        dailyMax: +4
    }
};

// ✅ تابع seed-based random — پایدار
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ✅ کندل‌های پایدار — هر روز فقط یه کندل جدید اضافه می‌شه
window.generatePriceHistory = function(basePrice, dailyMin, dailyMax, days, contractAddress = 'default') {
    const candles = [];
    const now = Math.floor(Date.now() / 1000);
    const dayInSeconds = 86400;
    const todayDayNumber = Math.floor(now / dayInSeconds);
    const startDay = todayDayNumber - days + 1;
    
    let currentPrice = basePrice;
    
    for (let i = 0; i < days; i++) {
        const dayNumber = startDay + i;
        const time = dayNumber * dayInSeconds;
        
        // ← seed یکتا بر اساس آدرس + شماره روز
        const seedBase = contractAddress.toLowerCase() + "_candle_" + dayNumber;
        let hash = 0;
        for (let j = 0; j < seedBase.length; j++) {
            hash = ((hash << 5) - hash) + seedBase.charCodeAt(j);
            hash = hash & hash;
        }
        
        const open = currentPrice;
        // ← نوسان پایدار بر اساس روز
        const changePercent = dailyMin + (Math.abs(hash % 10000) / 10000) * (dailyMax - dailyMin);
        const close = open * (1 + changePercent / 100);
        
        // high/low پایدار
        const highExtra = open * (seededRandom(hash + 1) * 0.015);
        const lowExtra = open * (seededRandom(hash + 2) * 0.015);
        const high = Math.max(open, close) + highExtra;
        const low = Math.min(open, close) - lowExtra;
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.01).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
        currentPrice = close;
    }
    
    // ✅ کندل آخر = قیمت لحظه‌ای امروز
    if (candles.length > 0) {
        const current = window.getCurrentTokenPrice(contractAddress, basePrice, dailyMin, dailyMax);
        const lastCandle = candles[candles.length - 1];
        lastCandle.close = current.price;
        lastCandle.high = Math.max(lastCandle.open, lastCandle.high, current.price) * 1.002;
        lastCandle.low = Math.min(lastCandle.open, lastCandle.low, current.price) * 0.998;
    }
    
    return candles;
};

// ✅ قیمت لحظه‌ای — پایدار در طول روز
window.getCurrentTokenPrice = function(contractAddress, basePrice, dailyMin, dailyMax) {
    const dayNumber = Math.floor(Date.now() / (1000 * 86400));
    const seedString = contractAddress.toLowerCase() + "_" + dayNumber;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
        hash = hash & hash;
    }
    const range = dailyMax - dailyMin;
    const normalizedHash = Math.abs(hash % 10000) / 10000;
    const changePercent = dailyMin + (normalizedHash * range);
    const currentPrice = basePrice * (1 + changePercent / 100);
    return {
        price: parseFloat(currentPrice.toFixed(6)),
        change24h: parseFloat(changePercent.toFixed(2))
    };
};

window.getTokenInfo = function(contractAddress) {
    if (!contractAddress) return null;
    const addr = contractAddress.toLowerCase();
    for (const key in window.TOKEN_PRICES) {
        if (key.toLowerCase() === addr) {
            const info = window.TOKEN_PRICES[key];
            const current = window.getCurrentTokenPrice(addr, info.basePrice, info.dailyMin, info.dailyMax);
            return {
                contract: key,
                basePrice: info.basePrice,
                dailyMin: info.dailyMin,
                dailyMax: info.dailyMax,
                currentPrice: current.price,
                change24h: current.change24h
            };
        }
    }
    return null;
};

console.log("✅ price.js loaded (Stable candles)");
