// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Price Engine (Synced & Accurate)
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4b1e65f73d8433043bbe0ab8cb3f118fac662f9a": { name: "Guardian Collection", basePrice: 25.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/guardian.png', normalMin: -1, normalMax: +2, reverseMin: -2, reverseMax: +1 },
        "0xcfd6c099bc8b3c91d47d62156aec6ba128eb6b92": { name: "FoxEggs Autumn Edition", basePrice: 15.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/autumn.png', normalMin: -1, normalMax: +2, reverseMin: -2, reverseMax: +1 },
        "0xaa890ebf2a6356c9da9e5b13c01db4ac88a70c8a": { name: "Fox Eggs: Frozen Realm", basePrice: 20.00, startDate: "2026-11-11", maxSupply: 100, image: 'image/frozen.png', normalMin: -1, normalMax: +2, reverseMin: -2, reverseMax: +1 }
    }
};

window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": {
        basePrice: 4.00, startDate: "2026-11-11", volatility: 0.20,
        normalMin: -3, normalMax: +4, reverseMin: -4, reverseMax: +3, reversalsPerMonth: 5
    }
};

function stableHash(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; } return Math.abs(hash); }

function getStartDayNumber(config) {
    if (config.startDate) {
        const parts = config.startDate.split('-');
        const startObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
        return Math.floor(startObj.getTime() / 86400000);
    }
    const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);
    return Math.floor(todayLocal.getTime() / 86400000);
}

function getReversalDays(contractAddress, monthKey) {
    const monthHash = stableHash(contractAddress.toLowerCase() + "_month_" + monthKey);
    const reversalDays = [];
    for (let i = 0; i < 5; i++) {
        const r = ((monthHash + i * 7) % 28) + 1;
        if (!reversalDays.includes(r)) reversalDays.push(r);
    }
    return reversalDays;
}

function getDayTrend(contractAddress, dayNumber) {
    const date = new Date(dayNumber * 86400000);
    const reversals = getReversalDays(contractAddress, date.getFullYear() + "_" + date.getMonth());
    return reversals.includes(date.getDate()) ? 'reverse' : 'normal';
}

function getDayChangePercent(contractAddress, dayNumber, config) {
    const hash = stableHash(contractAddress.toLowerCase() + "_day_" + dayNumber);
    const normalized = (hash % 10000) / 10000;
    const trend = getDayTrend(contractAddress, dayNumber);
    let min = trend === 'reverse' ? config.reverseMin : config.normalMin;
    let max = trend === 'reverse' ? config.reverseMax : config.normalMax;
    return min + normalized * (max - min);
}

function getDayBasePrice(contractAddress, basePrice, daysAgo, config) {
    const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);
    const targetDay = Math.floor(todayLocal.getTime() / 86400000) - daysAgo;
    const startDay = getStartDayNumber(config);
    if (targetDay < startDay) return basePrice;
    let price = basePrice;
    for (let d = startDay; d <= targetDay; d++) {
        price = price * (1 + getDayChangePercent(contractAddress, d, config) / 100);
    }
    return price;
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    const todayPrice = getDayBasePrice(contractAddress, basePrice, 0, config);
    const yesterdayPrice = getDayBasePrice(contractAddress, basePrice, 1, config);
    const minuteNumber = Math.floor(Date.now() / 60000);
    const vol = volatility !== undefined ? volatility : 0.20;
    
    const mHash = stableHash(contractAddress.toLowerCase() + "_min_" + minuteNumber);
    const mChange = ((mHash % 10000) / 10000 - 0.5) * 2 * vol;
    const currentPrice = todayPrice * (1 + mChange / 100);
    
    const yHash = stableHash(contractAddress.toLowerCase() + "_min_" + (minuteNumber - 1440));
    const yChange = ((yHash % 10000) / 10000 - 0.5) * 2 * vol;
    const yPrice = yesterdayPrice * (1 + yChange / 100);
    
    return {
        price: parseFloat(currentPrice.toFixed(6)),
        change24h: yPrice > 0 ? parseFloat((((currentPrice / yPrice) - 1) * 100).toFixed(2)) : 0
    };
};

window.getCurrentNFTPrice = function(contractAddress, basePrice) {
    const nft = window.NFT_PRICES.collections[contractAddress.toLowerCase()];
    const config = nft ? { startDate: nft.startDate || null, normalMin: nft.normalMin, normalMax: nft.normalMax, reverseMin: nft.reverseMin, reverseMax: nft.reverseMax } : { startDate: null, normalMin: -1, normalMax: 2, reverseMin: -2, reverseMax: 1 };
    return window.getCurrentTokenPrice(contractAddress, basePrice, 0.05, config);
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

// ✅ موتور اصلی تولید کندل (با ضریب تصحیح و شروع از دیروز)
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11", normalMin: -2, normalMax: 2, reverseMin: -2, reverseMax: 2 };
    if (!config.volatility) config.volatility = 0.20;
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const isNFT = !!window.NFT_PRICES.collections[contractAddress.toLowerCase()];
    
    // گرفتن قیمت لحظه‌ای
    let currentPrice = basePrice;
    if (isToken) {
        currentPrice = window.getCurrentTokenPrice(contractAddress, basePrice, config.volatility, config).price;
    } else if (isNFT) {
        currentPrice = window.getCurrentNFTPrice(contractAddress, basePrice).price;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = getStartDayNumber(config) * 86400;
    
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
    
    const currentBucket = Math.floor(now / sec);
    const startBucket = currentBucket - (totalCandles - 1);
    
    let tempCandles = [];
    let tempPrice = currentPrice * 0.85; 

    // ساخت کندل‌ها از قدیم به جدید
    for (let i = 0; i < totalCandles; i++) {
        const bucket = startBucket + i;
        const time = bucket * sec;
        
        let open = tempPrice;
        let close = open, high = open, low = open;
        
        for (let j = 0; j < 4; j++) {
            const subSeed = stableHash(contractAddress.toLowerCase() + "_s_" + time + "_" + j);
            const change = ((subSeed % 10000) / 10000 - 0.5) * 2 * config.volatility;
            close = close * (1 + change / 100);
            if (close > high) high = close;
            if (close < low) low = close;
        }
        
        tempCandles.push({ time, open, high, low, close });
        tempPrice = close;
    }
    
    // ✅ ضریب تصحیح برای هماهنگی کندل آخر با قیمت فعلی
    const candles = [];
    if (tempCandles.length > 0) {
        const lastClose = tempCandles[tempCandles.length - 1].close;
        const ratio = currentPrice / lastClose;
        
        for (let c of tempCandles) {
            candles.push({
                time: c.time,
                open: parseFloat((c.open * ratio).toFixed(6)),
                high: parseFloat((c.high * ratio).toFixed(6)),
                low: parseFloat((c.low * ratio).toFixed(6)),
                close: parseFloat((c.close * ratio).toFixed(6))
            });
        }
    }
    
    return candles;
};

console.log("✅ price.js loaded (Synced & Accurate)");
