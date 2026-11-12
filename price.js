// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Advanced Price Engine (For Tokens & NFTs)
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

// ✅ محاسبه قیمت دقیق در یک زمان مشخص (Timestamp)
function getPriceAtTime(contractAddress, basePrice, targetTimestamp, config) {
    const startDay = getStartDayNumber(config);
    const targetDay = Math.floor(targetTimestamp / 86400);
    
    if (targetDay < startDay) return basePrice;
    
    let price = basePrice;
    for (let d = startDay; d <= targetDay; d++) {
        price = price * (1 + getDayChangePercent(contractAddress, d, config) / 100);
    }
    
    // نوسان دقیقه‌ای برای زمان‌های داخل روز
    const minuteNumber = Math.floor(targetTimestamp / 60);
    const vol = config.volatility || 0.20;
    const mHash = stableHash(contractAddress.toLowerCase() + "_min_" + minuteNumber);
    const mChange = ((mHash % 10000) / 10000 - 0.5) * 2 * vol;
    
    return price * (1 + mChange / 100);
}

// ✅ قیمت لحظه‌ای الان
window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", normalMin: -3, normalMax: 4, reverseMin: -4, reverseMax: 3, volatility: volatility };
    const now = Math.floor(Date.now() / 1000);
    
    const currentPrice = getPriceAtTime(contractAddress, basePrice, now, config);
    const yesterdayPrice = getPriceAtTime(contractAddress, basePrice, now - 86400, config); // ۲۴ ساعت قبل
    
    return {
        price: parseFloat(currentPrice.toFixed(6)),
        change24h: yesterdayPrice > 0 ? parseFloat((((currentPrice / yesterdayPrice) - 1) * 100).toFixed(2)) : 0
    };
};

window.getCurrentNFTPrice = function(contractAddress, basePrice) {
    const nft = window.NFT_PRICES.collections[contractAddress.toLowerCase()];
    const config = nft ? { startDate: nft.startDate || null, normalMin: nft.normalMin, normalMax: nft.normalMax, reverseMin: nft.reverseMin, reverseMax: nft.reverseMax, volatility: 0.05 } : { startDate: "2026-11-11", normalMin: -1, normalMax: 2, reverseMin: -2, reverseMax: 1, volatility: 0.05 };
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

// ✅ ساخت کندل‌ها (بر اساس قیمت دقیق شروع و محاسبه تک‌تک کندل‌ها)
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11", normalMin: -2, normalMax: 2, reverseMin: -2, reverseMax: 2, volatility: 0.20 };
    if (!config.volatility) config.volatility = 0.20;
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const isNFT = !!window.NFT_PRICES.collections[contractAddress.toLowerCase()];
    
    // قیمت لحظه‌ای الان
    let currentPrice = isToken 
        ? window.getCurrentTokenPrice(contractAddress, basePrice, config.volatility, config).price
        : window.getCurrentNFTPrice(contractAddress, basePrice).price;
    
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
    
    // اگر تعداد کندل‌ها خیلی زیاد شد (مثلاً برای ALL)، فاصله زمانی را بزرگ‌تر می‌کنیم
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
        
        // قیمت در ابتدای بازه (Open)
        const openTime = time;
        // قیمت در انتهای بازه (Close)
        const closeTime = time + sec - 1;
        
        let open = getPriceAtTime(contractAddress, basePrice, openTime, config);
        let close = getPriceAtTime(contractAddress, basePrice, closeTime, config);
        
        // محاسبه سقف و کف با کمی نوسان درونی
        const hash = stableHash(contractAddress.toLowerCase() + "_candle_" + time);
        const highNoise = (seededRandom(hash + 1) * 0.015); // ۱.۵٪ نوسان
        const lowNoise = (seededRandom(hash + 2) * 0.015);
        
        let high = Math.max(open, close) + (open * highNoise);
        let low = Math.min(open, close) - (open * lowNoise);
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(Math.max(low, 0.0001).toFixed(6)),
            close: parseFloat(close.toFixed(6))
        });
    }
    
    // ✅ هماهنگ‌سازی کندل آخر با قیمت لحظه‌ای (تا کاملاً دقیق باشه)
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        last.close = currentPrice;
        last.high = Math.max(last.open, last.high, currentPrice) * 1.001;
        last.low = Math.min(last.open, last.low, currentPrice) * 0.999;
    }
    
    return candles;
};

// ✅ تابع کمکی برای نویز تصادفی
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

console.log("✅ price.js loaded (Pro Engine)");
