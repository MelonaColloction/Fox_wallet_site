// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Simple Line Chart Price Engine (No Candles)
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

// هش پایدار برای تولید نویز یکسان
function stableHash(str) { 
    let hash = 0; 
    for (let i = 0; i < str.length; i++) { 
        hash = ((hash << 5) - hash) + str.charCodeAt(i); 
        hash = hash & hash; 
    } 
    return Math.abs(hash); 
}

// تولید نویز طبیعی (موج)
function marketNoise(seed) {
    const h = stableHash(seed);
    const x = (h % 10000) / 10000; 
    return (Math.sin(x * Math.PI * 2) * 0.4) + 
           (Math.sin(x * Math.PI * 6) * 0.3) + 
           (Math.cos(x * Math.PI * 12) * 0.3);
}

// ✅ محاسبه قیمت در هر ثانیه (بدون پیچیدگی کندل)
function calculatePriceAtTime(basePrice, targetTime, startDayTs, contractAddress, isToken) {
    if (targetTime <= startDayTs) return basePrice;
    
    const daysPassed = (targetTime - startDayTs) / 86400;
    
    // روند رشد آرام
    const dailyGrowthRate = isToken ? 0.0034 : 0.00185;
    const trendPrice = basePrice * Math.pow((1 + dailyGrowthRate), daysPassed);
    
    // نویزهای بازار (روزانه، ساعتی، دقیقه‌ای) برای طبیعی تر شدن خط
    const dayBlock = Math.floor(targetTime / 86400);
    const hourBlock = Math.floor(targetTime / 3600);
    const minBlock = Math.floor(targetTime / 60);
    
    const dailyNoise = marketNoise(contractAddress + "_d_" + dayBlock) * 0.02; 
    const hourlyNoise = marketNoise(contractAddress + "_h_" + hourBlock) * 0.01; 
    const minutelyNoise = marketNoise(contractAddress + "_m_" + minBlock) * 0.005; 
    
    let finalPrice = trendPrice * (1 + dailyNoise + hourlyNoise + minutelyNoise);
    return finalPrice < 0.0001 ? 0.0001 : finalPrice;
}

// قیمت فعلی برای نمایش در بالای صفحه
window.getCurrentTokenPrice = function(contractAddress, basePrice, volatility, config) {
    if(!config) config = { startDate: "2026-11-11" };
    
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    if (now < startDayTs) return { price: basePrice, change24h: 0 };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    
    const currentPrice = calculatePriceAtTime(basePrice, now, startDayTs, contractAddress, isToken);
    const yesterdayPrice = calculatePriceAtTime(basePrice, now - 86400, startDayTs, contractAddress, isToken);
    
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

// ═══════════════════════════════════════════════════════════════
// ✅ تولید دیتا برای نمودار خطی (فقط زمان و قیمت)
// ═══════════════════════════════════════════════════════════════
window.generatePriceHistory = function(basePrice, timeframe, contractAddress, config) {
    if (!config) config = { startDate: "2026-11-11" };
    
    const isToken = !!window.TOKEN_PRICES[contractAddress.toLowerCase()];
    const now = Math.floor(Date.now() / 1000);
    const startDayTs = new Date(config.startDate + "T00:00:00Z").getTime() / 1000;
    
    // اگر زمان شروع نرسیده باشه
    if (now < startDayTs) {
        return [{ time: now, value: basePrice }];
    }

    const secMap = {
        '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
        '7d': 604800, '30d': 2592000, '1y': 31536000
    };
    
    let sec = secMap[timeframe] || 3600;
    
    // حداکثر ۳۰۰ نقطه برای نمودار خطی کافیه (نمودار رو سبک نگه میداره)
    let totalPoints = Math.floor((now - startDayTs) / sec);
    if (totalPoints < 2) totalPoints = 2;
    
    if (totalPoints > 300) {
        sec = Math.ceil((now - startDayTs) / 300);
        totalPoints = 300;
    }
    
    const chartData = [];
    const currentBucket = Math.floor(now / sec);
    const startBucket = currentBucket - (totalPoints - 1);
    
    // ✅ فقط یک نقطه از هر بازه زمانی (فقط قیمت)
    for (let i = 0; i < totalPoints; i++) {
        const bucket = startBucket + i;
        const time = bucket * sec;
        
        // اگر زمان از الان گذشته باشه، تایم رو روی الان بذار
        const evalTime = (time > now) ? now : time;
        
        const price = calculatePriceAtTime(basePrice, evalTime, startDayTs, contractAddress, isToken);
        
        chartData.push({
            time: time,
            value: parseFloat(price.toFixed(6))
        });
    }
    
    // ✅ اطمینان از اینکه آخرین نقطه دقیقاً قیمت لحظه‌ای (زنده) هست
    if (chartData.length > 0) {
        const currentPrice = calculatePriceAtTime(basePrice, now, startDayTs, contractAddress, isToken);
        chartData[chartData.length - 1].value = parseFloat(currentPrice.toFixed(6));
    }
    
    return chartData;
};

console.log("✅ price.js loaded - Line Chart Mode");
