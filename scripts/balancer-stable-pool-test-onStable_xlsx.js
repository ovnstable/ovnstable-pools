const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {expect} = require("chai");
const {evmCheckpoint, evmRestore} = require("../utils/sharedBeforeEach")
const {writeFileSync} = require("fs");
const ExcelJS = require('exceljs');
const {ValueType} = require("exceljs");


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

const denominators = {};

let ONE_LP = "1000000000000000000";

async function main() {

    let wallet = await initWallet();

    let stablePool = await ethers.getContractAt(StablePhantomPool, stablePoolAddress, wallet);
    let linearPool = await ethers.getContractAt(LinearPool, linearPoolAddress, wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);
    let usdt = await ethers.getContractAt(ERC20, usdtAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, daiAddress, wallet);
    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);


    let names = {};
    names[usdc.address] = "usdc";
    names[usdt.address] = "usdt";
    names[dai.address] = "dai";
    names[usdPlus.address] = "usdPlus";
    names[staticUsdPlus.address] = "staticUsdPlus";
    names[linearPool.address] = "linearPT";
    names[stablePool.address] = "stablePT";


    // 1) Swaps

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


    let tokensToLog = {
        userTokens: [
            usdc,
            usdt,
            dai,
            usdPlus,
            staticUsdPlus,
            linearPool,
            stablePool,
        ],
        linearTokens: [
            usdc,
            staticUsdPlus,
            linearPool,
        ],
        stableTokens: [
            usdt,
            dai,
            linearPool,
            stablePool,
        ]
    }

    await evmCheckpoint("defaultLI");

    let testsParamsForTestExchangeOnStable = makeTestExchangeParams();
    for (const testParams of testsParamsForTestExchangeOnStable) {
        await testExchangeOnStable(testParams, tokensToLog);
    }

    await evmRestore("defaultLI");


    // --- functions

    function makeTestExchangeParams() {
        // let tokensFrom = [dai];
        // let tokensTo = [linearPool];
        let tokensFrom = [dai, usdt, linearPool];
        let tokensTo = [dai, usdt, linearPool];
        let steps = [
            {
                step: 1,
                start: 1,
                end: 100,
            },
            {
                step: 10,
                start: 10,
                end: 1000,
            },
            {
                step: 100,
                start: 100,
                end: 10000,
            },
            {
                step: 100,
                start: 100,
                end: 35000,
            },
        ]

        let testsParamsForTestExchangeOnStable = [];
        for (const tokenFrom of tokensFrom) {
            for (const tokenTo of tokensTo) {
                if (tokenFrom.address === tokenTo.address) {
                    continue;
                }
                for (const step of steps) {
                    testsParamsForTestExchangeOnStable.push({
                        tokenFrom: tokenFrom,
                        tokenTo: tokenTo,
                        step: step.step,
                        start: step.start,
                        end: step.end,
                    })
                }
            }
        }
        return testsParamsForTestExchangeOnStable;
    }

    async function testExchangeOnStable(testParams, tokensToLog) {
        await evmCheckpoint("testExchangeOnStable");

        let {tokenFrom, tokenTo, step, start, end} = testParams;
        let tokenFromName = names[tokenFrom.address];
        let tokenToName = names[tokenTo.address];

        let paramsStr = `${tokenFromName}-${tokenToName}_${start}-${end}-${step}`;
        console.log(`----------------------------------------------------`)
        console.log(`testExchangeOnStable start with params: ${paramsStr}`)

        let logs = [];
        let balances = await logBalances(tokensToLog, names, wallet, linearPool, stablePool, vault);

        console.log(balances.userBalances[tokenToName]);
        console.log("-----")

        let initBsl = new BN(balances.userBalances[tokenToName]);
        let prevBsl = initBsl;
        logs.push(balances);

        for (let i = start; i < end; i += step) {
            await swapXtoXOnSt(tokenFrom, tokenTo, i);
            balances = await logBalances(tokensToLog, names, wallet, linearPool, stablePool, vault);
            logs.push(balances);
            let diff = new BN(balances.userBalances[tokenToName]).sub(initBsl)
            // console.log("d: " + diff.toString());
            console.log(diff.divn(i).toString());
            await evmCheckpoint("testExchangeOnStable");

            prevBsl = new BN(balances.userBalances[tokenToName])
        }
        let dir = 'test_results'
        makeDirIfNeed(dir);
        let resultFileName = `${dir}/testExchangeOnStable_${paramsStr}.json`;
        fs.writeFileSync(resultFileName, JSON.stringify(logs, null, 2));
        console.log(`testExchangeOnStable end with results in file ${resultFileName}`);


        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${tokenFromName}-${tokenToName}`);
        await prepareSheet(worksheet, testParams, tokensToLog);

        let columnTo;
        let col = 2;
        for (const token of tokensToLog.userTokens) {
            if (token.address === tokenTo.address) {
                columnTo = col;
            }
            col++;
        }

        logsToExcelFormat(logs, worksheet, columnTo);

        await workbook.xlsx.writeFile(`${dir}/testExchangeOnStable_${paramsStr}.xlsx`);

        await evmRestore("testExchangeOnStable");
    }

    async function prepareSheet(worksheet, testParams, tokensToLog) {
        worksheet.addRow(["tokenFrom", names[testParams.tokenFrom.address]]);
        worksheet.addRow(["tokenTo", names[testParams.tokenTo.address]]);
        worksheet.addRow(["start", testParams.start]);
        worksheet.addRow(["end", testParams.end]);
        worksheet.addRow(["step", testParams.step]);

        let mergeUserCellEnd = 1 + tokensToLog.userTokens.length;
        let mergeLinearCellEnd = mergeUserCellEnd + tokensToLog.linearTokens.length;
        let mergeStableCellEnd = mergeLinearCellEnd + tokensToLog.stableTokens.length;

        let mergedRow = worksheet.addRow();
        worksheet.mergeCells(mergedRow.number, 2, mergedRow.number, mergeUserCellEnd)
        worksheet.mergeCells(mergedRow.number, mergeUserCellEnd + 1, mergedRow.number, mergeLinearCellEnd)
        worksheet.mergeCells(mergedRow.number, mergeLinearCellEnd + 1, mergedRow.number, mergeStableCellEnd)
        mergedRow.getCell(2).value = "user";
        mergedRow.getCell(mergeUserCellEnd + 1).value = "linear";
        mergedRow.getCell(mergeLinearCellEnd + 1).value = "stable";


        // const dobCol = worksheet.getColumn(3);
        // row.getCell(1)
        //
        // worksheet.getCell('A3').value = { formula: 'SUM(A1,A2)', result: 7 };
        // worksheet.fillFormula('A2:A10', 'A1+1', [2,3,4,5,6,7,8,9,10]);
        // worksheet.mergeCells('B');
        // worksheet.addRow(["", "user", "linear", "stable"]);

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
                tokensToSheet.push(names[token.address]);
                digits.push(Number.parseInt(str(await token.decimals()), 10));
                denominators.push({formula: `POWER(10,${colName}8)`});
                to18s.push({formula: `POWER(10,18-${colName}8)`});
                col++;
            }
        }
        worksheet.addRow(tokensToSheet);
        let rr = worksheet.addRow(digits);
        // rr.eachCell(cell => {
        //     cell.numFmt = '0';
        // })
        worksheet.addRow(denominators);
        worksheet.addRow(to18s);
        worksheet.addRow(tokensToSheet);

        return worksheet;
    }

    function logsToExcelFormat(logs, worksheet, columnTo) {
        let letter = worksheet.getColumn(columnTo).letter;
        let num = 0;
        for (const log of logs) {
            let row = worksheet.addRow();
            row.getCell(1).value = {formula: `${num}*$B$5`};
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

            let delta = row.getCell(col);
            delta.value = {formula: `(${letter}${row.number + 1}-${letter}${row.number})/$${letter}$9/$B$5`};
            col++;
            row.getCell(col).value = {formula: `1-${delta.col}${delta.row}`};

            num++;
        }
    }

    function makeDirIfNeed(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }

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

    async function swapXtoSTLP(token, amount) {
        await swapXtoXOnSt(token, stablePool, amount);
    }

    async function swapXtoXOnSt(assetIn, assetOut, amount) {
        let amountScaledStr;
        if (amount === undefined) {
            amountScaledStr = (await assetIn.balanceOf(wallet.address)).toString();
        } else {
            amountScaledStr = await upByDecimals(assetIn, amount);
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

async function initWallet() {

    let provider = ethers.provider;
    console.log('Provider: ' + provider.connection.url);
    let wallet = await new ethers.Wallet(process.env.PK_POLYGON, provider);
    console.log('Wallet: ' + wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance: ' + balance / 1e18);

    return wallet;
}

async function logBalances(tokensToLog, names, wallet, linearPool, stablePool, vault) {
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
    logBalancesRecord.userBalances = await balances(tokensToLog.userTokens, names, wallet);
    logBalancesRecord.linearBalances = await poolBalances(tokensToLog.linearTokens, names, linearPool, vault);
    logBalancesRecord.stableBalances = await poolBalances(tokensToLog.stableTokens, names, stablePool, vault);
    return logBalancesRecord;
}

async function balances(tokens, names, wallet) {
    // balances: {
    //     usdc: 0,
    //     usdt: 0,
    //     dai: 0,
    // },

    let balances = {};
    for (const token of tokens) {
        balances[names[token.address]] = str(await token.balanceOf(wallet.address));
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
        resBalances[names[token.address]] = map[token.address.toString().toLowerCase()];
    }
    return resBalances;
}


function str(value) {
    return value.toString();
}
