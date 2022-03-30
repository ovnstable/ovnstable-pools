const BN = require("bn.js");

const denominators = {};

async function upByDecimals(token, amount) {
    return (await denominator(token)).muln(amount).toString();
}

async function denominator(token) {
    let denominator = denominators[token.address.toString()];
    if (denominator !== undefined) {
        return denominator;
    }
    denominator = new BN(10).pow(new BN(await token.decimals()));
    denominators[token.address.toString()] = denominator;
    return denominator;
}


async function balances(tokensToLog, names, wallet, linearPool, stablePool, vault) {
    // let logBalancesRecord = {
    //     userBalances: {
    //         usdc: 0,
    //         usdt: 0,
    //         dai: 0,
    //         usdPlus: 0,
    //         staticUsdPlus: 0,
    //         linearPT: 0,
    //         stablePT: 0
    //     },
    //     linearBalances: {
    //         usdc: 0,
    //         staticUsdPlus: 0,
    //         linearPT: 0,
    //     },
    //     stableBalances: {
    //         usdt: 0,
    //         dai: 0,
    //         linearPT: 0,
    //         stablePT: 0
    //     }
    // }

    let logBalancesRecord = {};
    logBalancesRecord.userBalances = await walletBalances(tokensToLog.userTokens, names, wallet);
    logBalancesRecord.linearBalances = await poolBalances(tokensToLog.linearTokens, names, linearPool, vault);
    logBalancesRecord.stableBalances = await poolBalances(tokensToLog.stableTokens, names, stablePool, vault);
    return logBalancesRecord;
}

async function walletBalances(tokens, names, wallet) {
    // balances: {
    //     usdc: 0,
    //     usdt: 0,
    //     dai: 0,
    // },

    let balances = {};
    for (const token of tokens) {
        balances[names[token.address.toString().toLowerCase()]] = str(await token.balanceOf(wallet.address));
    }
    return balances;
}


async function poolBalances(tokensIn, names, pool, vault) {
    // linearBalances: {
    //     usdc: 0,
    //     staticUsdPlus: 0,
    //     linearPT: 0,
    // },

    const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());
    let map = {};
    for (let i = 0; i < balances.length; i++) {
        let token = tokens[i];
        map[token.toLowerCase()] = str(balances[i]);
    }
    map[pool.address.toLowerCase()] = str(await pool.getVirtualSupply());

    let resBalances = {};
    for (const token of tokensIn) {
        resBalances[names[token.address.toString().toLowerCase()]] = map[token.address.toString().toLowerCase()];
    }
    return resBalances;
}


function str(value) {
    return value.toString();
}


function unscaleFrom18(value, decimals) {
    return value.div(new BN(10).pow(new BN(18).sub(decimals)));
}

function scaleTo18(value, decimals) {
    return value.mul(new BN(10).pow(new BN(18).sub(decimals)));
}


function addr(token) {
    return token.address.toString().toLowerCase();
}


module.exports = {
    str,
    balances,
    walletBalances,
    poolBalances,
    upByDecimals,
    unscaleFrom18,
    scaleTo18,
    addr
}
