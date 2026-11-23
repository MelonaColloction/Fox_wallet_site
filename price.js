
// ═══════════════════════════════════════════════════════════════
// Fox Wallet - Final Live Market Engine
// Updated: Fox Kingdom Legendary NFT
// ═══════════════════════════════════════════════════════════════

window.NFT_PRICES = {
    collections: {
        "0x4b1e65f73d8433043bbe0ab8cb3f118fac662f9a": {
            name: "Fox Eggs Classic NFT",
            basePrice: 9.00,
            startDate: "2026-11-11",
            maxSupply: 100,
            image: "image/guardian.png",
            volatility: 0.05
        },

        "0xcfd6c099bc8b3c91d47d62156aec6ba128eb6b92": {
            name: "Fox Eggs Seasonal NFT",
            basePrice: 10.00,
            startDate: "2026-11-11",
            maxSupply: 100,
            image: "image/autumn.png",
            volatility: 0.05
        },

        // NEW NFT - Fox Kingdom Legendary
        "0x6558756D5F7E8D165A29aD6fB15c92412b09DA00": {
            name: "The Celestial Fox King",
            basePrice: 50.00,
            startDate: "2026-11-23",
            maxSupply: 25,
            image: "image/celestial-fox-king.png",
            volatility: 0.05
        }
    }
};

window.TOKEN_PRICES = {
    "0xafeabf57f4540e6ae19b3ea34c0d207e06bf20ca": {
        basePrice: 4.00,
        startDate: "2026-11-11",
        volatility: 0.10
    }
};

// ═══════════════════════════════════════════════════════════════
// Stable Hash
// ═══════════════════════════════════════════════════════════════

function stableHash(str) {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }

    return Math.abs(hash);
}

// ═══════════════════════════════════════════════════════════════
// Bearish Day
// ═══════════════════════════════════════════════════════════════

function isBearishDay(contractAddress, targetTime) {
    const date = new Date(targetTime * 1000);

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    const monthKey =
        contractAddress + "_bearish_" + year + "_" + month;

    let bearishDays = [];
    let attempts = 0;

    while (bearishDays.length < 8 && attempts < 200) {
        const hash = stableHash(
            monthKey + "_attempt_" + attempts
        );

        const randomDay = (hash % 28) + 1;

        if (!bearishDays.includes(randomDay)) {
            bearishDays.push(randomDay);
        }

        attempts++;
    }

    return bearishDays.includes(day);
}

// ═══════════════════════════════════════════════════════════════
// Price Engine
// ═══════════════════════════════════════════════════════════════

window.getTickPrice = function(
    basePrice,
    targetTime,
    startDayTs,
    contractAddress,
    isToken
) {
    if (targetTime <= startDayTs) {
        return basePrice;
    }

    const daysPassed =
        (targetTime - startDayTs) / 86400;

    const targetPrice = isToken ? 1000000 : 20000;
    const targetDays = 3650;

    const exactDailyGrowthRate =
        Math.pow(targetPrice / basePrice, 1 / targetDays) - 1;

    const trendPrice =
        basePrice * Math.pow(
            (1 + exactDailyGrowthRate),
            daysPassed
        );

    const msTime = Math.floor(targetTime * 1000);

    const tickHash = stableHash(
        contractAddress + "_tick_" + msTime
    );

    const tickNoise =
        ((tickHash % 10000) / 10000 - 0.5) * 2 * 0.005;

    const isBearish =
        isBearishDay(contractAddress, targetTime);

    const trendBias = isBearish ? -0.002 : 0.002;

    const totalChange = trendBias + tickNoise;

    const finalPrice =
        trendPrice * (1 + totalChange);

    return finalPrice < 0.0001
        ? 0.0001
        : finalPrice;
};

// ═══════════════════════════════════════════════════════════════
// Live Price
// ═══════════════════════════════════════════════════════════════

window.getLivePrice = function(
    contractAddress,
    basePrice,
    isToken,
    startDate
) {
    const now = Math.floor(Date.now() / 1000);

    const date = startDate || "2026-11-11";

    const startDayTs = Math.floor(
        new Date(date + "T00:00:00Z").getTime() / 1000
    );

    return window.getTickPrice(
        basePrice,
        now,
        startDayTs,
        contractAddress,
        isToken
    );
};

// ═══════════════════════════════════════════════════════════════
// Current Token Price
// ═══════════════════════════════════════════════════════════════

window.getCurrentTokenPrice = function(
    contractAddress,
    basePrice,
    volatility,
    config
) {
    if (!config) {
        config = { startDate: "2026-11-11" };
    }

    const addr = contractAddress.toLowerCase();

    const isToken = !!window.TOKEN_PRICES[addr];

    const now = Math.floor(Date.now() / 1000);

    const startDayTs = Math.floor(
        new Date(config.startDate + "T00:00:00Z").getTime() / 1000
    );

    if (now < startDayTs) {
        return {
            price: basePrice,
            change24h: 0
        };
    }

    const currentPrice = window.getLivePrice(
        addr,
        basePrice,
        isToken,
        config.startDate
    );

    const yesterdayPrice = window.getTickPrice(
        basePrice,
        now - 86400,
        startDayTs,
        addr,
        isToken
    );

    return {
        price: parseFloat(currentPrice.toFixed(6)),

        change24h: yesterdayPrice > 0
            ? parseFloat(
                (((currentPrice / yesterdayPrice) - 1) * 100).toFixed(2)
            )
            : 0
    };
};

// ═══════════════════════════════════════════════════════════════
// Current NFT Price
// ═══════════════════════════════════════════════════════════════

window.getCurrentNFTPrice = function(
    contractAddress,
    basePrice
) {
    const addr = contractAddress.toLowerCase();

    const nft =
        window.NFT_PRICES.collections[addr];

    if (!nft) {
        return null;
    }

    return window.getCurrentTokenPrice(
        addr,
        basePrice !== undefined ? basePrice : nft.basePrice,
        nft.volatility,
        nft
    );
};

// ═══════════════════════════════════════════════════════════════
// Token Information
// ═══════════════════════════════════════════════════════════════

window.getTokenInfo = function(contractAddress) {
    if (!contractAddress) {
        return null;
    }

    const addr = contractAddress.toLowerCase();

    for (const key in window.TOKEN_PRICES) {
        if (key.toLowerCase() === addr) {
            const info = window.TOKEN_PRICES[key];

            const current = window.getCurrentTokenPrice(
                addr,
                info.basePrice,
                info.volatility,
                info
            );

            return {
                contract: key,
                basePrice: info.basePrice,
                currentPrice: current.price,
                change24h: current.change24h
            };
        }
    }

    return null;
};

// ═══════════════════════════════════════════════════════════════
// NFT Information
// ═══════════════════════════════════════════════════════════════

window.getNFTInfo = function(contractAddress) {
    if (!contractAddress) {
        return null;
    }

    const addr = contractAddress.toLowerCase();

    const nft = window.NFT_PRICES.collections[addr];

    if (!nft) {
        return null;
    }

    const current = window.getCurrentNFTPrice(addr);

    return {
        contract: addr,
        name: nft.name,
        collection: nft.collection || nft.name,
        basePrice: nft.basePrice,
        currentPrice: current.price,
        change24h: current.change24h,
        startDate: nft.startDate,
        maxSupply: nft.maxSupply,
        image: nft.image
    };
};

// ═══════════════════════════════════════════════════════════════
// Generate Price History
// ═══════════════════════════════════════════════════════════════

window.generatePriceHistory = function(
    basePrice,
    timeframe,
    contractAddress,
    config
) {
    const addr = contractAddress.toLowerCase();

    if (!config) {
        const nft = window.NFT_PRICES.collections[addr];
        const token = window.TOKEN_PRICES[addr];

        config = nft || token || {
            startDate: "2026-11-11"
        };
    }

    const isToken = !!window.TOKEN_PRICES[addr];

    const startDayTs = Math.floor(
        new Date(config.startDate + "T00:00:00Z").getTime() / 1000
    );

    const now = Math.floor(Date.now() / 1000);

    const secMap = {
        "6h": 21600,
        "1d": 86400,
        "7d": 604800,
        "30d": 2592000,
        "6m": 15552000,
        "1y": 31536000,
        "all": 31536000
    };

    const sec = secMap[timeframe] || 86400;

    const totalCandles =
        Math.floor((now - startDayTs) / sec) + 1;

    const candles = [];

    if (now < startDayTs) {
        return candles;
    }

    const livePrice = window.getTickPrice(
        basePrice,
        now,
        startDayTs,
        addr,
        isToken
    );

    for (let i = 0; i < totalCandles; i++) {
        const time = startDayTs + (i * sec);

        if (time > now) {
            break;
        }

        const isLastCandle =
            (i === totalCandles - 1) ||
            (time + sec > now);

        const candleEndTime = isLastCandle
            ? now
            : (time + sec - 1);

        const open = window.getTickPrice(
            basePrice,
            time,
            startDayTs,
            addr,
            isToken
        );

        const close = isLastCandle
            ? livePrice
            : window.getTickPrice(
                basePrice,
                candleEndTime,
                startDayTs,
                addr,
                isToken
            );

        const highHash = stableHash(
            addr + "_high_" + time
        );

        const lowHash = stableHash(
            addr + "_low_" + time
        );

        const high =
            Math.max(open, close) *
            (1 + ((highHash % 50) / 10000));

        const low =
            Math.min(open, close) *
            (1 - ((lowHash % 50) / 10000));

        candles.push({
            time: time,
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(
                Math.max(low, 0.0001).toFixed(6)
            ),
            close: parseFloat(close.toFixed(6))
        });
    }

    return candles;
};

// ═══════════════════════════════════════════════════════════════
// Load Confirmation
// ═══════════════════════════════════════════════════════════════

console.log(
    "Fox Wallet Price Engine Loaded Successfully"
);

console.log(
    "The Celestial Fox King - Fox Kingdom Legendary"
);
