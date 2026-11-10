// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Price Configuration
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4B1e65f73D8433043Bbe0AB8Cb3f118FAC662F9a": { name: "Guardian Collection", pricePerNFT: 25.00 },
        "0xcfd6c099bc8B3c91D47D62156AEc6BA128eB6B92": { name: "FoxEggs Autumn Edition", pricePerNFT: 15.00 },
        "0xaA890ebf2a6356c9Da9E5B13C01db4aC88A70c8a": { name: "Fox Eggs: Frozen Realm", pricePerNFT: 20.00 }
    },
    overridePrices: {}
};

// فقط قیمت و نوسان اینجاست
window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": {
        basePrice: 4.00,
        dailyMin: -3,
        dailyMax: +4
    }
};

window.generatePriceHistory = function(basePrice, dailyMin, dailyMax, days) {
    const candles = [];
    const now = Math.floor(Date.now() / 1000);
    const dayInSeconds = 86400;
    const startTime = now - (days * dayInSeconds);
    let currentPrice = basePrice * (1 + (Math.random() * 0.06 - 0.03));
    for (let i = 0; i < days; i++) {
        const time = startTime + (i * dayInSeconds);
        const open = currentPrice;
        const changePercent = dailyMin + Math.random() * (dailyMax - dailyMin);
        const close = open * (1 + changePercent / 100);
        const highExtra = open * (Math.random() * 0.015);
        const lowExtra = open * (Math.random() * 0.015);
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
    return candles;
};

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

console.log("✅ price.js loaded (Prices only)");
