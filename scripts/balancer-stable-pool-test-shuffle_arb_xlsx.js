const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {evmCheckpoint, evmRestore} = require("../utils/sharedBeforeEach")
const ExcelJS = require('exceljs');
const {balances, upByDecimals, str, scaleTo18, unscaleFrom18, addr} = require("./balancer-stable-pool-test-commons");
const {initWallet} = require("../utils/network");


let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let StablePhantomPool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));

let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";

let linearPoolAddress = "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425";
let stablePoolAddress = "0xE051605A83dEAe38d26a7346B100EF1AC2ef8a0b";


let ONE_LP = "1000000000000000000";

// Seeded random init
let seed = xmur3("shuffle");
let random = sfc32(seed(), seed(), seed(), seed());


async function main() {

    let wallet = await initWallet(ethers);

    let stablePool = await ethers.getContractAt(StablePhantomPool, stablePoolAddress, wallet);
    let linearPool = await ethers.getContractAt(LinearPool, linearPoolAddress, wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);
    let usdt = await ethers.getContractAt(ERC20, usdtAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, daiAddress, wallet);
    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);


    let names = {};
    names[addr(usdc)] = "usdc";
    names[addr(usdt)] = "usdt";
    names[addr(dai)] = "dai";
    names[addr(usdPlus)] = "usdPlus";
    names[addr(staticUsdPlus)] = "staticUsdPlus";
    names[addr(linearPool)] = "linearPT";
    names[addr(stablePool)] = "stablePT";

    let tokensMap = {};
    tokensMap[addr(usdc)] = usdc;
    tokensMap[addr(usdt)] = usdt;
    tokensMap[addr(dai)] = dai;
    tokensMap[addr(usdPlus)] = usdPlus;
    tokensMap[addr(staticUsdPlus)] = staticUsdPlus;
    tokensMap[addr(linearPool)] = linearPool;
    tokensMap[addr(stablePool)] = stablePool;


    await evmCheckpoint("default");
    try {
        await runTest();
    } catch (e) {
        console.error(e)
    }
    await evmRestore("default");


    // --- functions


    async function runTest() {
        let tokensToLog = {
            userTokens: [
                // usdc,
                usdt,
                dai,
                // usdPlus,
                // staticUsdPlus,
                linearPool,
                stablePool,
            ],
            linearTokens: [
                // usdc,
                // staticUsdPlus,
                // linearPool,
            ],
            stableTokens: [
                usdt,
                dai,
                linearPool,
                stablePool,
            ]
        }

        let logs = [];
        let currentBalances = await balances(tokensToLog, names, wallet, linearPool, stablePool, vault);
        currentBalances.amount = 0;
        logs.push(currentBalances);

        let rounds = makeTestExchangeParams();
        for (const round of rounds) {
            await testRound(round, tokensToLog);
            currentBalances = await balances(tokensToLog, names, wallet, linearPool, stablePool, vault);
            currentBalances.amount = round.amount;
            logs.push(currentBalances);
        }

        let dir = 'test_results'
        makeDirIfNeed(dir);
        let resultFileName = `${dir}/testShuffleOnStable_arb.json`;
        fs.writeFileSync(resultFileName, JSON.stringify(logs, null, 2));
        console.log(`testShuffleOnStable end with results in file ${resultFileName}`);


        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`tst`);
        await prepareSheet(worksheet, tokensToLog);

        logsToExcelFormat(logs, worksheet);

        await workbook.xlsx.writeFile(`${dir}/testShuffleOnStable_arb.xlsx`);

    }


    function makeTestExchangeParams() {
        // let tokensIn = [dai];
        // let tokensOut = [linearPool];
        let tokensIn = [dai, usdt, linearPool];
        let tokensOut = [dai, usdt, linearPool];
        let steps = [
            {
                min: 10,
                max: 100,
                arbitrageEach: 50,
                rounds: 500,
            }
        ]

        let rounds = [];
        for (const step of steps) {
            let sum = 0;
            for (let i = 0; i < step.rounds; i++) {
                let round = shuffleRound(tokensIn, tokensOut, step.min, step.max);
                round.number = i;
                sum += round.amount;
                rounds.push(round);
                if ((i + 1) % step.arbitrageEach === 0) {
                    rounds.push({arbitrage: true})
                }
            }
            console.log("avg: " + sum / step.rounds)
        }

        return rounds;
    }


    function shuffleRound(tokensIn, tokensOut, amountMin, amountMax) {
        let amount = getRandomInt(amountMin, amountMax);
        let tokenIn = tokensIn[getRandomInt(0, tokensIn.length)];
        let tokenOut;
        do {
            tokenOut = tokensOut[getRandomInt(0, tokensOut.length)];
        } while (tokenIn.address === tokenOut.address);
        return {
            tokenIn,
            tokenOut,
            amount
        }
    }


    async function testRound(round) {
        if (round.arbitrage) {
            await testArbitrageOnStable();
        } else {
            await testShuffleOnStable(round);
        }
    }

    async function testArbitrageOnStable() {


        const {tokens, balances} = await vault.getPoolTokens(await stablePool.getPoolId());
        let map = {};
        for (let i = 0; i < balances.length; i++) {
            let tokenAddress = tokens[i];
            // console.log("tokenAddress: " + tokenAddress.toLowerCase())
            let token = tokensMap[tokenAddress.toLowerCase()];
            let decimals = new BN(str(await token.decimals()));
            let balance18 = scaleTo18(new BN(str(balances[i])), decimals);
            map[tokenAddress.toLowerCase()] = balance18;
            // console.log(`${name(token)} balance18: ${balance18}`)
        }

        let usdtBalance = map[addr(usdt)];
        let daiBalance = map[addr(dai)];
        let linearPTBalance = map[addr(linearPool)];

        let sum = new BN(0);
        sum = sum.add(usdtBalance);
        sum = sum.add(daiBalance);
        sum = sum.add(linearPTBalance);
        // console.log(`sum: ${sum}`)

        let avg = sum.divn(3);
        // console.log(`avg: ${avg}`)

        let deltaUsdt = usdtBalance.sub(avg);
        let deltaDai = daiBalance.sub(avg);
        let deltaLinearPT = linearPTBalance.sub(avg);

        let zero = new BN(0);
        let tokensFrom = [];
        let tokensTo = [];
        if (deltaUsdt.lt(zero)) {
            tokensTo.push({token: usdt, delta: deltaUsdt});
        } else {
            tokensFrom.push({token: usdt, delta: deltaUsdt});
        }

        if (deltaDai.lt(zero)) {
            tokensTo.push({token: dai, delta: deltaDai});
        } else {
            tokensFrom.push({token: dai, delta: deltaDai});
        }

        if (deltaLinearPT.lt(zero)) {
            tokensTo.push({token: linearPool, delta: deltaLinearPT});
        } else {
            tokensFrom.push({token: linearPool, delta: deltaLinearPT});
        }

        for (const tokenFrom of tokensFrom) {
            for (const tokenTo of tokensTo) {
                // console.log(`${tokenFrom.token.address} -> ${tokenTo.token.address}`);
                // console.log(`${name(tokenFrom.token)} -> ${name(tokenTo.token)} : ${tokenFrom.delta} - ${tokenTo.delta}`);

                let tokenIn = tokenTo.token;
                let tokenOut = tokenFrom.token;

                let from = tokenFrom.delta.abs();
                let to = tokenTo.delta.abs();

                let decimals = new BN(str(await tokenIn.decimals()));
                let amount;
                if (from.lt(to)) {
                    amount = unscaleFrom18(from, decimals);
                } else {
                    amount = unscaleFrom18(to, decimals);
                }
                console.log(`arb: ${name(tokenFrom.token)} -> ${name(tokenTo.token)} : ${amount}`);

                await swapXtoXOnSt(
                    tokenIn,
                    tokenOut,
                    str(amount),
                    true
                )
            }
        }
    }

    function name(token) {
        return names[addr(token)];
    }

    async function testShuffleOnStable(testParams) {
        let {tokenIn, tokenOut, amount} = testParams;
        let tokenInName = name(tokenIn);
        let tokenOutName = name(tokenOut);

        let paramsStr = `${tokenInName}-${tokenOutName}_${amount}`;
        // console.log(`----------------------------------------------------`)
        console.log(`${testParams.number}: testShuffleOnStable swap params: ${paramsStr}`)
        // console.log(`${amount}`)
        await swapXtoXOnSt(tokenIn, tokenOut, amount);
    }

    async function prepareSheet(worksheet, tokensToLog) {

        let mergeUserCellEnd = 1 + tokensToLog.userTokens.length;
        let mergeLinearCellEnd = mergeUserCellEnd + tokensToLog.linearTokens.length;
        let mergeStableCellEnd = mergeLinearCellEnd + tokensToLog.stableTokens.length;

        let mergedRow = worksheet.addRow();
        worksheet.mergeCells(mergedRow.number, 2, mergedRow.number, mergeUserCellEnd)
        if (mergeUserCellEnd + 1 < mergeLinearCellEnd) {
            worksheet.mergeCells(mergedRow.number, mergeUserCellEnd + 1, mergedRow.number, mergeLinearCellEnd)
        }
        worksheet.mergeCells(mergedRow.number, mergeLinearCellEnd + 1, mergedRow.number, mergeStableCellEnd)
        mergedRow.getCell(2).value = "user";
        if (mergeUserCellEnd + 1 < mergeLinearCellEnd) {
            mergedRow.getCell(mergeUserCellEnd + 1).value = "linear";
        }
        mergedRow.getCell(mergeLinearCellEnd + 1).value = "stable";

        let tokensToSheet = ["tokens"];
        let digits = ["decimals"];
        let denominators = ["denominator"];
        let to18s = ["to18"];
        let col = 2;

        for (const tokens of [
            tokensToLog.userTokens,
            tokensToLog.linearTokens,
            tokensToLog.stableTokens
        ]) {
            for (const token of tokens) {
                let colName = worksheet.getColumn(col).letter
                tokensToSheet.push(name(token));
                digits.push(Number.parseInt(str(await token.decimals()), 10));
                denominators.push({formula: `POWER(10,${colName}${mergedRow.number + 2})`});// +2 to get digits row
                to18s.push({formula: `POWER(10,18-${colName}${mergedRow.number + 2})`});
                col++;
            }
        }
        worksheet.addRow(tokensToSheet);
        worksheet.addRow(digits);
        worksheet.addRow(denominators);
        worksheet.addRow(to18s);
        worksheet.addRow(tokensToSheet);

        return worksheet;
    }

    function logsToExcelFormat(logs, worksheet) {

        let prevSumUser = undefined;
        let prevSumStable = undefined;

        let widthStart = 0;
        let widthEnd = 100;
        for (const log of logs) {
            let row = worksheet.addRow();
            row.getCell(1).value = log.amount;
            let col = 2;
            for (let attributeName in log.userBalances) {
                row.getCell(col).value = log.userBalances[attributeName];
                col++;
            }
            for (let attributeName in log.linearBalances) {
                row.getCell(col).value = log.linearBalances[attributeName];
                col++;
            }
            for (let attributeName in log.stableBalances) {
                row.getCell(col).value = log.stableBalances[attributeName];
                col++;
            }
            col += 5;

            let refCol = 2;

            widthStart = col;

            let sumUser = new BN(0);
            let sumStable = new BN(0);

            for (let attributeName in log.userBalances) {
                let res = new BN(row.getCell(refCol).value)
                    .mul(new BN(10).pow(new BN(18 - worksheet.getCell(3, refCol).value)));
                sumUser = sumUser.add(res);

                row.getCell(col).value = res.toString();
                row.getCell(col).numFmt = "0";
                col++;
                refCol++;
            }
            for (let attributeName in log.stableBalances) {
                let res = new BN(row.getCell(refCol).value)
                    .mul(new BN(10).pow(new BN(18 - worksheet.getCell(3, refCol).value)));
                sumStable = sumStable.add(res);

                row.getCell(col).value = res.toString();
                row.getCell(col).numFmt = "0";
                col++;
                refCol++;
            }

            row.getCell(col).value = sumUser.toString();
            row.getCell(col).numFmt = "0";
            col++;

            row.getCell(col).value = sumStable.toString();
            row.getCell(col).numFmt = "0";
            col++;

            row.getCell(col).value = sumUser.sub(sumStable).toString();
            row.getCell(col).numFmt = "0";
            col++;


            if (prevSumUser !== undefined) {
                row.getCell(col).value = sumUser.sub(prevSumUser).toString();
                row.getCell(col).numFmt = "0";
                col++;
            }
            prevSumUser = sumUser;
            if (prevSumStable !== undefined) {
                row.getCell(col).value = sumStable.sub(prevSumStable).toString();
                row.getCell(col).numFmt = "0";
                col++;
            }
            prevSumStable = sumStable;


            widthEnd = col;
        }

        for (let i = widthStart; i < widthEnd; i++) {
            worksheet.getColumn(i).width = 27;
        }
    }


    function makeDirIfNeed(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }

    async function swapXtoXOnSt(assetIn, assetOut, amount, alreadyScaled) {
        let amountScaledStr;
        if (amount === undefined) {
            amountScaledStr = (await assetIn.balanceOf(wallet.address)).toString();
        } else {
            if (alreadyScaled) {
                amountScaledStr = amount;
            } else {
                amountScaledStr = await upByDecimals(assetIn, amount);
            }
        }
        // console.log(`amountScaledStr: ${amountScaledStr}`)
        await assetIn.approve(vault.address, amountScaledStr);
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: assetIn.address,
                assetOut: assetOut.address,
                amount: amountScaledStr,
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );
    }


}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });


function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}

function sfc32(a, b, c, d) {
    return function () {
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        d >>>= 0;
        let t = (a + b) | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        d = d + 1 | 0;
        t = t + d | 0;
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}


function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(random() * (max - min)) + min; //Максимум не включается, минимум включается
}


