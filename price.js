// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Advanced Price Engine (10 Years Target)
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
        basePrice: 4.00, startDate: "2026-11-11", volatility: 0.15 
    }
};

function stableHash(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; } return Math.abs(hash); }

function buildPricePath(contractAddress, basePrice, startTime, endTime, volatility, stepSeconds, isToken) {
    const path = [];
    let currentPrice = basePrice;
    let currentTime = startTime;
    
    path.push({ time: currentTime, price: currentPrice });
    
    while (currentTime < endTime) {
        const phaseSeed = contractAddress + "_phase_" + Math.floor(currentTime / 3600); 
        const hash = stableHash(phaseSeed);
        
        const isUpTrend = (hash % 2) === 0; 
        const trendDurationMin = (hash % 43) + 3; 
        const trendDurationSec = trendDurationMin * 60;
        const trendIntensity = ((hash % 90) + 10) / 1000; 
        
        const actualIntensity = isUpTrend ? trendIntensity : (trendIntensity * 0.5); 
        
        // ✅ رشد پایه جدید:
        // توکن: 0.0034 (برای رسیدن به ۱ میلیون)
        // NFT: 0.00185 (برای رسیدن به ۲۰ هزار دلار از ۲۵ دلار)
        let baseGrowth = isToken ? 0.0034 : 0.00185; 
        
        const phaseEndTime = Math.min(currentTime + trendDurationSec, endTime);
        
        while (currentTime < phaseEndTime) {
            currentTime += stepSeconds;
            
            const microNoise = (stableHash(contractAddress + "_m_" + currentTime) % 1000) / 1000000;
            
            let change = actualIntensity * (stepSeconds / 60);
            if (!isUpTrend) change = -change;
            
            currentPrice = currentPrice * (1 + change + microNoise + baseGrowth);
            path.push({ time: currentTime, price: currentPrice });
        }
    }
    
    return path;
}

function getPriceFromPath(path, targetTime) {
    if (targetTime <= path[0].time) return path[0].price;
    if (targetTime >= path[path.length - 1].time) return path[path.length - 1].price;
    
    let left = 0, right = path.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (path[mid].time === targetTime) return path[mid].price;
        if (path[mid].time < targetTime) left = mid + 1;
        else right = mid - 1;
    }
    
    const p1 = path[right];
    const p2 = path[left];
    const ratio = (targetTime - p1.time) / (p2.time - p1.time);
    return p1.price + (p2.price - p1.price) * ratio;
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const path = buildPricePath(contractAddress, basePrice, startDayTs, now, config.volatility, 60, isToken);
    const currentPrice = getPriceFromPath(path, now);
    const yesterdayPrice = getPriceFromPath(path, now - 86400);
    
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
    const startDayTs = new Date(config.startDate + "T00:00:00").getTime() / 1000;
    
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
    
    const path = buildPricePath(contractAddress, basePrice, startDayTs, now, config.volatility, 60, isToken);
    
    const candles = [];
    const currentBucket = Math.floor(now / sec);
    const startBucket = currentBucket - (totalCandles - 1);
    
    for (let i = 0; i < totalCandles; i++) {
        const bucket = startBucket + i;
        const time = bucket * sec;
        
        const open = getPriceFromPath(path, time);
        const close = getPriceFromPath(path, time + sec - 1);
        
        const high = Math.max(open, close) * 1.00001;
        const low = Math.min(open, close) * 0.99999;
        
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
        const currentPrice = getPriceFromPath(path, now);
        last.close = currentPrice;
        last.high = Math.max(last.open, last.high, currentPrice) * 1.00001;
        last.low = Math.min(last.open, last.low, currentPrice) * 0.99999;
    }
    
    return candles;
};

console.log("✅ price.js loaded (10 Years Target)");
