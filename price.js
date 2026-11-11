// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Price Configuration (NFTs + Tokens)
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4b1e65f73d8433043bbe0ab8cb3f118fac662f9a": { 
            name: "Guardian Collection", 
            basePrice: 25.00, 
            maxSupply: 100,
            image: 'image/guardian.png' 
        },
        "0xcfd6c099bc8b3c91d47d62156aec6ba128eb6b92": { 
            name: "FoxEggs Autumn Edition", 
            basePrice: 15.00, 
            maxSupply: 100,
            image: 'image/autumn.png' 
        },
        "0xaa890ebf2a6356c9da9e5b13c01db4ac88a70c8a": { 
            name: "Fox Eggs: Frozen Realm", 
            basePrice: 20.00, 
            maxSupply: 100,
            image: 'image/frozen.png' 
        }
    },
    overridePrices: {}
};

window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": {
        basePrice: 4.00,
        startDate: null,
        volatility: 0.20,
        normalMin: -3,
        normalMax: +4,
        reverseMin: -4,
        reverseMax: +3,
        reversalsPerMonth: 5
    }
};

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function stableHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function getStartDayNumber(config) {
    if (config.startDate) {
        const startObj = new Date(config.startDate + "T00:00:00Z");
        return Math.floor(startObj.getTime() / (1000 * 86400));
    }
    return Math.floor(Date.now() / (1000 * 86400));
}

function getReversalDays(contractAddress, monthKey) {
    const monthSeed = contractAddress.toLowerCase() + "_month_" + monthKey;
    const monthHash = stableHash(monthSeed);
    const reversalDays = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
        const r = ((monthHash + i * 7) % 28) + 1;
        if (!reversalDays.includes(r)) reversalDays.push(r);
    }
    return reversalDays;
}

function getDayTrend(contractAddress, dayNumber) {
    const date = new Date(dayNumber * 86400000);
    const dayOfMonth = date.getUTCDate();
    const monthKey = date.getUTCFullYear() + "_" + date.getUTCMonth();
    const reversals = getReversalDays(contractAddress, monthKey);
    return reversals.includes(dayOfMonth) ? 'reverse' : 'normal';
}

function getDayChangePercent(contractAddress, dayNumber, config) {
    const seedBase = contractAddress.toLowerCase() + "_day_" + dayNumber;
    const hash = stableHash(seedBase);
    const normalized = (hash % 10000) / 10000;
    const trend = getDayTrend(contractAddress, dayNumber);
    
    let min = config.normalMin || -3;
    let max = config.normalMax || +4;
    if (trend === 'reverse') {
        min = config.reverseMin || -4;
        max = config.reverseMax || +3;
    }
    return min + normalized * (max - min);
}

// ✅ قیمت لحظه‌ای برای توکن‌ها
window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    const now = Date.now();
    const todayDayNumber = Math.floor(now / (1000 * 86400));
    const startDay = getStartDayNumber(config);
    
    let todayPrice = basePrice;
    if (todayDayNumber >= startDay) {
        for (let d = startDay; d <= todayDayNumber; d++) {
            const changePercent = getDayChangePercent(contractAddress, d, config);
            todayPrice = todayPrice * (1 + changePercent / 100);
        }
    }
    
    const minuteNumber = Math.floor(now / (1000 * 60));
    const vol = volatility !== undefined ? volatility : 0.20;
    const minuteSeed = contractAddress.toLowerCase() + "_min_" + minuteNumber;
    const minuteHash = stableHash(minuteSeed);
    const minuteChange = ((minuteHash % 10000) / 10000 - 0.5) * 2 * vol;
    
    const currentPrice = todayPrice * (1 + minuteChange / 100);
    const yesterdayPrice = todayPrice / (1 + getDayChangePercent(contractAddress, todayDayNumber, config) / 100);
    const change24h = ((todayPrice / yesterdayPrice) - 1) * 100;
    
    return {
        price: parseFloat(currentPrice.toFixed(6)),
        change24h: parseFloat(change24h.toFixed(2)),
        minuteChange: parseFloat(minuteChange.toFixed(4))
    };
};

// ✅ قیمت لحظه‌ای برای NFT ها
window.getCurrentNFTPrice = function(contractAddress, basePrice) {
    const config = window.TOKEN_PRICES[contractAddress.toLowerCase()] || {
        normalMin: -2, normalMax: +3, reverseMin: -3, reverseMax: +2
    };
    const current = window.getCurrentTokenPrice(contractAddress, basePrice, 0.1, config);
    return current;
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

// ✅ ساخت کندل برای NFT ها و توکن‌ها
window.generatePriceHistory = function(basePrice, days, contractAddress, config) {
    if (!config) config = { normalMin: -2, normalMax: +3, reverseMin: -3, reverseMax: +2 };
    
    const candles = [];
    const now = Math.floor(Date.now() / 1000);
    const dayInSeconds = 86400;
    const todayDayNumber = Math.floor(now / dayInSeconds);
    const startDay = getStartDayNumber(config);
    const actualDays = Math.min(days, todayDayNumber - startDay + 1);
    
    if (actualDays <= 0) {
        return [{ time: todayDayNumber * dayInSeconds, open: basePrice, high: basePrice*1.002, low: basePrice*0.998, close: basePrice }];
    }
    
    let currentPrice = basePrice;
    for (let i = 0; i < actualDays; i++) {
        const dayNumber = startDay + i;
        const time = dayNumber * dayInSeconds;
        const open = currentPrice;
        const changePercent = getDayChangePercent(contractAddress, dayNumber, config);
        const close = open * (1 + changePercent / 100);
        
        const hash = stableHash(contractAddress.toLowerCase() + "_candle_" + dayNumber);
        const high = Math.max(open, close) + (open * (seededRandom(hash + 1) * 0.015));
        const low = Math.min(open, close) - (open * (seededRandom(hash + 2) * 0.015));
        
        candles.push({
            time: time, open: parseFloat(open.toFixed(6)), high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.01).toFixed(6)), close: parseFloat(close.toFixed(6))
        });
        currentPrice = close;
    }
    
    if (candles.length > 0) {
        let current;
        if (window.TOKEN_PRICES[contractAddress.toLowerCase()]) {
            current = window.getCurrentTokenPrice(contractAddress, basePrice, 0.20, config);
        } else {
            current = window.getCurrentNFTPrice(contractAddress, basePrice);
        }
        const lastCandle = candles[candles.length - 1];
        lastCandle.close = current.price;
        lastCandle.high = Math.max(lastCandle.open, lastCandle.high, current.price) * 1.002;
        lastCandle.low = Math.min(lastCandle.open, lastCandle.low, current.price) * 0.998;
    }
    return candles;
};
