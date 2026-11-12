// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Advanced Price Engine (Fixed & Realistic Growth)
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

function stableHash(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; } return Math.abs(hash); }

// ✅ تابع محاسبه قیمت در هر لحظه (با فرمول دقیق رشد روزانه)
function calculatePriceAtTime(basePrice, contractAddress, startDayTs, targetTime, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    // تعداد روزهایی که گذشته
    const daysPassed = (targetTime - startDayTs) / 86400;
    
    // نرخ رشد روزانه (برای توکن 0.34% و برای NFT 0.185%)
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    
    // فرمول رشد مرکب: قیمت پایه × (1 + نرخ رشد) ^ تعداد روزها
    let price = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // ✅ اضافه کردن نویزهای کوتاه‌مدت (بالا/پایین شدن‌های طبیعی) بدون اینکه روی روند کلی اثر بذاره
    const hourNum = Math.floor(targetTime / 3600);
    const minuteNum = Math.floor(targetTime / 60);
    
    // هش برای نویز ساعتی (بین -۱.۵٪ تا +۱.۵٪)
    const hourlyNoiseHash = stableHash(contractAddress + "_h_" + hourNum);
    const hourlyNoise = ((hourlyNoiseHash % 300) - 150) / 10000; 
    
    // هش برای نویز دقیقه‌ای (بین -۰.۲٪ تا +۰.۲٪)
    const minuteNoiseHash = stableHash(contractAddress + "_m_" + minuteNum);
    const minuteNoise = ((minuteNoiseHash % 40) - 20) / 10000;
    
    // اعمال نویزها (فقط حول محور قیمت اصلی، بدون اثر تصاعدی)
    price = price * (1 + hourlyNoise + minuteNoise);
    
    return price;
}

window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11", volatility: volatility || 0.10 };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    
    const currentPrice = calculatePriceAtTime(basePrice, contractAddress, startDayTs, now, isToken);
    const yesterdayPrice = calculatePriceAtTime(basePrice, contractAddress, startDayTs, now - 86400, isToken);
    
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
    
    const candles = [];
    const currentBucket = Math.floor(now / sec);
    const startBucket = currentBucket - (totalCandles - 1);
    
    for (let i = 0; i < totalCandles; i++) {
        const bucket = startBucket + i;
        const time = bucket * sec;
        
        const open = calculatePriceAtTime(basePrice, contractAddress, startDayTs, time, isToken);
        const close = calculatePriceAtTime(basePrice, contractAddress, startDayTs, time + sec - 1, isToken);
        
        // سایه‌های تمیز (توپر)
        const high = Math.max(open, close) * 1.0005;
        const low = Math.min(open, close) * 0.9995;
        
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
        const currentPrice = calculatePriceAtTime(basePrice, contractAddress, startDayTs, now, isToken);
        last.close = currentPrice;
        last.high = Math.max(last.open, last.high, currentPrice) * 1.0005;
        last.low = Math.min(last.open, last.low, currentPrice) * 0.9995;
    }
    
    return candles;
};

console.log("✅ price.js loaded (Fixed & Realistic Growth)");
