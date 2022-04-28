const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {ZERO_ADDRESS, MAX_UINT256} = require("@openzeppelin/test-helpers/src/constants");
const {toEX, toE6} = require("../../utils/decimals");
const {evmCheckpoint, evmRestore} = require("../../utils/sharedBeforeEach")
const univ3prices = require("@thanpolas/univ3prices");
const {toE18} = require("../balancer-stable-pool-test-commons");
const {BigNumber} = require("ethers");
const {bold} = require("@defi-wonderland/smock/dist/src/chai-plugin/color");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let Exchange = JSON.parse(fs.readFileSync('./abi/Exchange.json'));

let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;
let iUniswapV2Router02Abi = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));
let iUniswapV3PoolAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV3Pool.json')).abi;
let iUniswapV3Router02Abi = JSON.parse(fs.readFileSync('./abi/build/ISwapRouterV3.json')).abi;

let ArbitrageQSAbi = JSON.parse(fs.readFileSync('./abi/build/ArbitrageQS.json')).abi;


let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let qsRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
// let uniV3RouterAddress = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
let uniV3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

let uniV3PoolWmaticUsdcAddress = "0xa374094527e1673a86de625aa59517c5de346d32"
let uniV3PoolUsdcWethAddress = "0x45dda9cb7c25131df268515131f647d726f50608"

let qsPoolWmaticUsdcAddress = "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827"
let qsPoolUsdcWethAddress = "0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d"


// replace addresses from create script
let qsPoolWmaticUsdPlusAddress = "0x91F670270B86C80Ec92bB6B5914E6532cA967bFB";
let qsPoolUsdPlusWethAddress = "0x901Debb34469e89FeCA591f5E5336984151fEc39";


let arbAddress = "0xD0798f8308EFE28516C36D5d0dC31f68fD8D0d05";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    1000366077732111122
    let qsRouter = await ethers.getContractAt(iUniswapV2Router02Abi, qsRouterAddress, wallet);
    let u3Router = await ethers.getContractAt(iUniswapV3Router02Abi, uniV3RouterAddress, wallet);
    let arb = await ethers.getContractAt(ArbitrageQSAbi, arbAddress, wallet);

    let qsPoolWmaticUsdc = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolWmaticUsdcAddress, wallet);
    let qsPoolUsdcWeth = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolUsdcWethAddress, wallet);

    let qsPoolWmaticUsdPlus = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolWmaticUsdPlusAddress, wallet);
    let qsPoolUsdPlusWeth = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolUsdPlusWethAddress, wallet);

    let uniV3PoolWmaticUsdc = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolWmaticUsdcAddress, wallet);
    let uniV3PoolUsdcWeth = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolUsdcWethAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);

    console.log(`usdPlus.exchange: ${await usdPlus.exchange()}`)
    let exchange = await ethers.getContractAt(Exchange.abi, await usdPlus.exchange(), wallet);


    let lowerChangePriceUsdPlusWeth = 0.9999; // 1 pp
    let upperChangePriceUsdPlusWeth = 1.0001; // 1 pp

    let lowerChangePriceWmaticUsdPlus = 0.9999; // 1 pp
    let upperChangePriceWmaticUsdPlus = 1.0001; // 1 pp


    await evmCheckpoint("default");
    try {


        // if (await doNeedFixUsdcWeth()) {
        //     console.log(`Need fixUsdcWeth 1`)
        //     await fixUsdcWeth();
        // } else {
        //     console.log(`Skip fixUsdcWeth 1`)
        // }
        // if (await doNeedFixUsdcWeth()) {
        //     console.log(`Need fixUsdcWeth 2`)
        //     await fixUsdcWeth();
        // } else {
        //     console.log(`Skip fixUsdcWeth 2`)
        // }

        await fixUsdcWeth();
        // await fixUsdcWeth();


        // -------------------------------------------------

        // if (await doNeedFixMaticUsdc()) {
        //     console.log(`Need fixMaticUsdc 1`)
        //     await fixMaticUsdc();
        // } else {
        //     console.log(`Skip fixMaticUsdc 1`)
        // }
        // if (await doNeedFixMaticUsdc()) {
        //     console.log(`Need fixMaticUsdc 2`)
        //     await fixMaticUsdc();
        // } else {
        //     console.log(`Skip fixMaticUsdc 2`)
        // }

        // await fixMaticUsdc();
        // await fixMaticUsdc();


    } catch (e) {
        console.log(e);
    }
    await evmRestore("default");

    async function chain_U3_QS_UN(
        token0,
        token1,
        token2,
        token0MaximumSpend,
        token1AmountOut
    ) {
        let token0Spent = await swapU3Out(token0, token1, token1AmountOut, token0MaximumSpend);
        let token2Received = await swapQS(token1, token2, token1AmountOut);
        let usdcReceived = await unwrap(token2Received);
    }


    async function chain_WR_QS_U3(
        token0,
        token1,
        token2,
        usdcForWrapping
    ) {
        let token0Received = await wrap(usdcForWrapping);
        let token1Received = await swapQS(token0, token1, token0Received);
        let usdcReceived = await swapU3(token1, token2, token1Received);
    }


    async function fixUsdcWeth() {

        let qsPool = qsPoolUsdPlusWeth;
        let u3Pool = uniV3PoolUsdcWeth;
        let isUsdcLeft = true;
        let xToken = weth;
        let lowerChangePriceBound = lowerChangePriceUsdPlusWeth;
        let upperChangePriceBound = upperChangePriceUsdPlusWeth;


        params = await getFixParams(
            qsPool,
            u3Pool,
            isUsdcLeft,
            xToken,
            lowerChangePriceBound,
            upperChangePriceBound
        );

        console.log(`-----   From js:`);
        console.log(`params.skip: ${params.skip}`);
        if(!params.skip) {
            console.log(`params.useXtoUsdc: ${params.useXtoUsdc}`);
            console.log(`params.tokens[0]: ${params.tokens[0].address}`);
            console.log(`params.tokens[1]: ${params.tokens[1].address}`);
            console.log(`params.tokens[2]: ${params.tokens[2].address}`);
            console.log(`params.reserves[0]: ${params.reserves[0]}`);
            console.log(`params.reserves[1]: ${params.reserves[1]}`);
            console.log(`params.reserves[2]: ${params.reserves[2]}`);
            console.log(`params.reserves[3]: ${params.reserves[3]}`);
        }

        let callParams = {
            qsPool: qsPool.address,
            u3Pool: u3Pool.address,
            isUsdcLeft: isUsdcLeft,
            usdc: usdc.address,
            xToken: xToken.address,
            usdPlus: usdPlus.address,
            lowerChangePriceBound: new BN(10).pow(new BN(18)).sub(new BN(10).pow(new BN(14))).toString(),
            upperChangePriceBound: new BN(10).pow(new BN(18)).add(new BN(10).pow(new BN(14))).toString(),
            qsRouter: qsRouter.address,
            u3Router: u3Router.address,
        };
        console.log(JSON.stringify(callParams, null, 2));

        let arbParams = await arb.getFixParams(callParams)

        // 1342239264980
        // 1342239264979505972135989118000000000000
        console.log(JSON.stringify(arbParams));
        console.log(`-----   From arb:`);
        console.log(`params.skip: ${arbParams.skip}`);
        console.log(`params.useXtoUsdc: ${arbParams.useXtoUsdc}`);
        console.log(`params.tokens[0]: ${arbParams.tokens.token0}`);
        console.log(`params.tokens[1]: ${arbParams.tokens.token1}`);
        console.log(`params.tokens[2]: ${arbParams.tokens.token2}`);
        console.log(`params.reserves[0]: ${arbParams.reserves.reserve0}`);
        console.log(`params.reserves[1]: ${arbParams.reserves.reserve1}`);
        console.log(`params.reserves[2]: ${arbParams.reserves.reserve2}`);
        console.log(`params.reserves[3]: ${arbParams.reserves.reserve3}`);
        console.log(`params.usdcIn: ${arbParams.usdcIn}`);
        console.log(`params.usdcOut: ${arbParams.usdcOut}`);


        // let params = await getFixParams(
        //     qsPool,
        //     u3Pool,
        //     isUsdcLeft,
        //     xToken,
        //     lowerChangePriceBound,
        //     upperChangePriceBound
        // )999900000000000000
        if (params.skip) {
            return;
        }
        // await fix(params);

        // let tx = await arb.fixByFlash({
        //     qsPool: qsPool.address,
        //     u3Pool: u3Pool.address,
        //     isUsdcLeft: isUsdcLeft,
        //     usdc: usdc.address,
        //     xToken: xToken.address,
        //     usdPlus: usdPlus.address,
        //     lowerChangePriceBound: new BN(10).pow(new BN(18)).sub(new BN(10).pow(new BN(14))).toString(),
        //     upperChangePriceBound: new BN(10).pow(new BN(18)).add(new BN(10).pow(new BN(14))).toString(),
        //     qsRouter: qsRouter.address,
        //     u3Router: u3Router.address
        // });
        //
        // let res = await tx.wait();



        balancesCurrent = await balancesQsPool(qsPool);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)


        // console.log(JSON.stringify(res, null, 2));

    }

    async function fixMaticUsdc() {

        let qsPool = qsPoolWmaticUsdPlus;
        let u3Pool = uniV3PoolWmaticUsdc;
        let isUsdcLeft = false;
        let xToken = wmatic;
        let lowerChangePriceBound = lowerChangePriceWmaticUsdPlus;
        let upperChangePriceBound = upperChangePriceWmaticUsdPlus;

        params = await getFixParams(
            qsPool,
            u3Pool,
            isUsdcLeft,
            xToken,
            lowerChangePriceBound,
            upperChangePriceBound
        );

        console.log(`-----   From js:`);
        console.log(`params.skip: ${params.skip}`);
        if(!params.skip) {
            console.log(`params.useXtoUsdc: ${params.useXtoUsdc}`);
            console.log(`params.tokens[0]: ${params.tokens[0].address}`);
            console.log(`params.tokens[1]: ${params.tokens[1].address}`);
            console.log(`params.tokens[2]: ${params.tokens[2].address}`);
            console.log(`params.reserves[0]: ${params.reserves[0]}`);
            console.log(`params.reserves[1]: ${params.reserves[1]}`);
            console.log(`params.reserves[2]: ${params.reserves[2]}`);
            console.log(`params.reserves[3]: ${params.reserves[3]}`);
        }

        let callParams = {
            qsPool: qsPool.address,
            u3Pool: u3Pool.address,
            isUsdcLeft: isUsdcLeft,
            usdc: usdc.address,
            xToken: xToken.address,
            usdPlus: usdPlus.address,
            lowerChangePriceBound: new BN(10).pow(new BN(18)).sub(new BN(10).pow(new BN(14))).toString(),
            upperChangePriceBound: new BN(10).pow(new BN(18)).add(new BN(10).pow(new BN(14))).toString(),
            qsRouter: qsRouter.address,
            u3Router: u3Router.address,
        };
        console.log(JSON.stringify(callParams, null, 2));

        let arbParams = await arb.getFixParams(callParams)
        // 1342239264980
        // 1342239264979505972135989118000000000000
        console.log(JSON.stringify(arbParams));
        console.log(`-----   From arb:`);
        console.log(`params.skip: ${arbParams.skip}`);
        console.log(`params.useXtoUsdc: ${arbParams.useXtoUsdc}`);
        console.log(`params.tokens[0]: ${arbParams.tokens.token0}`);
        console.log(`params.tokens[1]: ${arbParams.tokens.token1}`);
        console.log(`params.tokens[2]: ${arbParams.tokens.token2}`);
        console.log(`params.reserves[0]: ${arbParams.reserves.reserve0}`);
        console.log(`params.reserves[1]: ${arbParams.reserves.reserve1}`);
        console.log(`params.reserves[2]: ${arbParams.reserves.reserve2}`);
        console.log(`params.reserves[3]: ${arbParams.reserves.reserve3}`);
        console.log(`params.usdcIn: ${arbParams.usdcIn}`);
        console.log(`params.usdcOut: ${arbParams.usdcOut}`);


        if (params.skip) {
            return;
        }
        // await fix(params);

        await arb.fixByFlash({
            qsPool: qsPool.address,
            u3Pool: u3Pool.address,
            isUsdcLeft: isUsdcLeft,
            usdc: usdc.address,
            xToken: xToken.address,
            usdPlus: usdPlus.address,
            lowerChangePriceBound: new BN(10).pow(new BN(18)).sub(new BN(10).pow(new BN(14))).toString(),
            upperChangePriceBound: new BN(10).pow(new BN(18)).add(new BN(10).pow(new BN(14))).toString(),
            qsRouter: qsRouter.address,
            u3Router: u3Router.address,
        });

        balancesCurrent = await balancesQsPool(qsPool);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

    }


    async function doNeedFixUsdcWeth() {

        let qsPool = qsPoolUsdPlusWeth;
        let u3Pool = uniV3PoolUsdcWeth;
        let isUsdcLeft = true;
        let xToken = weth;
        let lowerChangePriceBound = lowerChangePriceUsdPlusWeth;
        let upperChangePriceBound = upperChangePriceUsdPlusWeth;

        let params = await getFixParams(
            qsPool,
            u3Pool,
            isUsdcLeft,
            xToken,
            lowerChangePriceBound,
            upperChangePriceBound
        )
        if (params.skip) {
            return false;
        }

        return doNeedFix(params);
    }


    async function doNeedFixMaticUsdc() {
        let qsPool = qsPoolWmaticUsdPlus;
        let u3Pool = uniV3PoolWmaticUsdc;
        let isUsdcLeft = false;
        let xToken = wmatic;
        let lowerChangePriceBound = lowerChangePriceWmaticUsdPlus;
        let upperChangePriceBound = upperChangePriceWmaticUsdPlus;

        let params = await getFixParams(
            qsPool,
            u3Pool,
            isUsdcLeft,
            xToken,
            lowerChangePriceBound,
            upperChangePriceBound
        );
        if (params.skip) {
            return false;
        }

        return doNeedFix(params);
    }

    async function getFixParams(
        qsPool,
        u3Pool,
        isUsdcLeft,
        xToken,
        lowerChangePriceBound,
        upperChangePriceBound
    ) {

        // balances with prices fields
        let balancesCurrent = await balancesQsPool(qsPool);
        let balancesTarget = await getSampleTargetsUniV3(u3Pool);

        let currentPrice0Per1 = balancesCurrent.price0Per1
        let targetPrice0Per1 = balancesTarget.price
        console.log(`currentPrice0Per1: ${currentPrice0Per1}`)
        console.log(`targetPrice0Per1 : ${targetPrice0Per1}`)

        // changePrice = (rA_0/rA_1)/(rB_0/rB_1);
        let changePrice = targetPrice0Per1 / currentPrice0Per1
        console.log(`changePrice: ${changePrice}`)

        if (lowerChangePriceBound < changePrice && changePrice < upperChangePriceBound) {
            console.log(`changePrice in bound ${lowerChangePriceBound}-${upperChangePriceBound}, skip actions`)
            return {
                skip: true
            };
        }

        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
        console.log(`balancesTarget.reserve0:  ${balancesTarget.reserve0}`)
        console.log(`balancesTarget.reserve1:  ${balancesTarget.reserve1}`)


        let rCur0 = new BN(balancesCurrent.reserve0.toString());
        let rCur1 = new BN(balancesCurrent.reserve1.toString());
        let rTar0 = new BN(balancesTarget.reserve0.toString());
        let rTar1 = new BN(balancesTarget.reserve1.toString());


        // let params = {
        //     useXtoUsdc: false,
        //     tokens: [token0, token1, token2],
        //     reserves: [rIn0, rOut0, rIn1, rOut1]
        // }

        let params;

        if (isUsdcLeft) {
            if (changePrice < 1) {
                console.log(`changePrice < 1 => 1->0`)

                params = {
                    useXtoUsdc: true,
                    tokens: [usdc, xToken, usdPlus],
                    reserves: [rCur1, rCur0, rTar1, rTar0]
                }
            } else {
                console.log(`changePrice > 1 => 0->1`)

                params = {
                    useXtoUsdc: false,
                    tokens: [usdPlus, xToken, usdc],
                    reserves: [rCur0, rCur1, rTar0, rTar1]
                }
            }
        } else {
            if (changePrice < 1) {
                console.log(`changePrice < 1 => 1->0`)

                params = {
                    useXtoUsdc: false,
                    tokens: [usdPlus, xToken, usdc],
                    reserves: [rCur1, rCur0, rTar1, rTar0]
                }

            } else {
                console.log(`changePrice > 1 => 0->1`)

                params = {
                    useXtoUsdc: true,
                    tokens: [usdc, xToken, usdPlus],
                    reserves: [rCur0, rCur1, rTar0, rTar1]
                }
            }
        }

        return params;
    }


    async function fix(params) {

        if (params.useXtoUsdc) {
            await xToUsdc(
                params.tokens[0],
                params.tokens[1],
                params.tokens[2],
                params.reserves[0],
                params.reserves[1],
                params.reserves[2],
                params.reserves[3]
            )
        } else {
            await usdcToX(
                params.tokens[0],
                params.tokens[1],
                params.tokens[2],
                params.reserves[0],
                params.reserves[1],
                params.reserves[2],
                params.reserves[3]
            )
        }

        balancesCurrent = await balancesQsPool(qsPoolUsdPlusWeth);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

    }

    async function doNeedFix(params) {
        if (params.useXtoUsdc) {
            return await xToUsdcCheck(
                params.tokens[0],
                params.tokens[1],
                params.tokens[2],
                params.reserves[0],
                params.reserves[1],
                params.reserves[2],
                params.reserves[3]
            )
        } else {
            return await usdcToXCheck(
                params.tokens[0],
                params.tokens[1],
                params.tokens[2],
                params.reserves[0],
                params.reserves[1],
                params.reserves[2],
                params.reserves[3]
            )
        }
    }


    async function usdcToX(
        token0, token1, token2,
        rIn0, rOut0, rIn1, rOut1
    ) {
        let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        let usdcIn = calcAInForWrap(aIn);
        let usdcOut = calcAOutForQS(usdcIn, rIn0, rOut0);
        // equivalent to use uniV3 swap price
        usdcOut = usdcOut.mul(rIn1).div(rOut1);
        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${usdcIn.sub(usdcOut)}`)


        let E3 = new BN(10).pow(new BN(3));
        if (aIn.lt(E3)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return;
        }

        let usdcForWrapping = calcAInForWrap(aIn);

        await chain_WR_QS_U3(token0, token1, token2, usdcForWrapping)
    }


    async function xToUsdc(
        token0, token1, token2,
        rIn0, rOut0, rIn1, rOut1
    ) {

        let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        // equivalent to use uniV3 swap price
        let maximumUsdcForSpend = aIn.mul(rOut1).div(rIn1);

        // give 1% more for spending
        maximumUsdcForSpend = maximumUsdcForSpend.muln(101).divn(100)

        let usdcIn = maximumUsdcForSpend;
        let usdcOut = calcAOutOnWrap(calcAOutForQS(aIn, rIn0, rOut0));
        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${usdcIn.sub(usdcOut)}`)

        // for 18 decimal in
        let E15 = new BN(10).pow(new BN(15));
        if (aIn.lt(E15)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return;
        }

        let wethForSpending = aIn;
        await chain_U3_QS_UN(token0, token1, token2, maximumUsdcForSpend, wethForSpending);

    }

    async function usdcToXCheck(
        token0, token1, token2,
        rIn0, rOut0, rIn1, rOut1
    ) {
        let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        let usdcIn = calcAInForWrap(aIn);
        let usdcOut = calcAOutForQS(usdcIn, rIn0, rOut0);
        // equivalent to use uniV3 swap price
        usdcOut = usdcOut.mul(rIn1).div(rOut1);

        let diff = usdcIn.sub(usdcOut);
        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${diff}`)

        let E3 = new BN(10).pow(new BN(3));
        if (aIn.lt(E3)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return false;
        }

        if (diff > 0) {
            console.log(`Have lost on fixing, skip actions`)
            return false;
        }

        return true;
    }

    async function xToUsdcCheck(
        token0, token1, token2,
        rIn0, rOut0, rIn1, rOut1
    ) {

        let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        // equivalent to use uniV3 swap price
        let maximumUsdcForSpend = aIn.mul(rOut1).div(rIn1);

        // give 1% more for spending
        maximumUsdcForSpend = maximumUsdcForSpend.muln(101).divn(100)

        let usdcIn = maximumUsdcForSpend;
        let usdcOut = calcAOutOnWrap(calcAOutForQS(aIn, rIn0, rOut0));

        let diff = usdcIn.sub(usdcOut);
        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${diff}`)

        let E15 = new BN(10).pow(new BN(15));
        if (aIn.lt(E15)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return false;
        }

        if (diff > 0) {
            console.log(`Have lost on fixing, skip actions`)
            return false;
        }

        return true;
    }

    function calcAInForQS(rIn0, rOut0, rIn1, rOut1) {
        // p1 = rIn1/rOut1

        let _9 = new BN(9);
        let _997 = new BN(997);
        let _1994 = new BN(1994);
        let _1997 = new BN(1997);
        let _5982 = new BN(5982);
        let _994009 = new BN(994009);
        let _3988000 = new BN(3988000);


        let t1 = _3988000.mul(rIn0).mul(rOut0).mul(rIn1).div(rOut1);
        let t2 = _9.mul(rIn0).mul(rIn0);
        let t3 = _5982.mul(rIn0);
        let underSqrt = t1.add(t2).sub(t3).add(_994009);
        let tSqrt = sqrt(underSqrt)
        let t4 = _1997.mul(rIn0)
        let nominator0 = _997.sub(t4).add(tSqrt)
        let result0 = nominator0.div(_1994)

        if (result0.ltn(0)) {
            throw new Error("Result is below zero")
        }

        return result0;
    }

    // same to getAmountOut()
    function calcAOutForQS(aIn, rIn0, rOut0) {
        let _997 = new BN(997);
        let _1000 = new BN(1000);

        let amountInWithFee = aIn.mul(_997);
        let numerator = amountInWithFee.mul(rOut0);
        let denominator = rIn0.mul(_1000).add(amountInWithFee);
        let amountOut = numerator.div(denominator);

        return amountOut;
    }

    function calcAInForWrap(aOut) {
        let _9996 = new BN(9996);
        let _10000 = new BN(10000);
        return aOut.mul(_10000).div(_9996);
    }

    function calcAOutOnWrap(aIn) {
        let _9996 = new BN(9996);
        let _10000 = new BN(10000);
        return aIn.mul(_9996).div(_10000);
    }

    function sqrt(num) {
        if (num.lt(new BN(0))) {
            throw new Error("Sqrt only works on non-negtiave inputs")
        }
        if (num.lt(new BN(2))) {
            return num
        }

        const smallCand = sqrt(num.shrn(2)).shln(1)
        const largeCand = smallCand.add(new BN(1))

        if (largeCand.mul(largeCand).gt(num)) {
            return smallCand
        } else {
            return largeCand
        }
    }

    // usdc -> usd+
    async function wrap(amountIn) {
        await usdc.approve(exchange.address, amountIn.toString());
        let result = await exchange.callStatic.buy(usdcAddress, amountIn.toString());
        await exchange.buy(usdcAddress, amountIn.toString());
        return result;
    }

    //  usd+ -> usdc
    async function unwrap(amountIn) {
        await usdPlus.approve(exchange.address, amountIn.toString());
        let result = await exchange.callStatic.redeem(usdcAddress, amountIn.toString());
        await exchange.redeem(usdcAddress, amountIn.toString());
        return result;
    }

    async function swapQS(tokenIn, tokenOut, amountIn) {
        await tokenIn.approve(qsRouter.address, amountIn.toString());
        let path = [tokenIn.address, tokenOut.address];
        let result = await qsRouter.callStatic.swapExactTokensForTokens(
            amountIn.toString(),
            0,
            path,
            wallet.address,
            MAX_UINT256.toString()
        );
        await qsRouter.swapExactTokensForTokens(
            amountIn.toString(),
            0,
            path,
            wallet.address,
            MAX_UINT256.toString()
        );
        return result[1];
    }

    async function swapU3(tokenIn, tokenOut, amountIn) {
        await tokenIn.approve(u3Router.address, amountIn.toString());

        let swapParams = {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            fee: 500,
            recipient: wallet.address,
            deadline: MAX_UINT256.toString(),
            amountIn: amountIn.toString(),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        }

        let retValue = await u3Router.callStatic.exactInputSingle(swapParams);
        await u3Router.exactInputSingle(swapParams);
        return retValue;
    }

    async function swapU3Out(tokenIn, tokenOut, amountOut, amountInMaximum) {
        await tokenIn.approve(u3Router.address, amountInMaximum.toString());
        console.log("swapU3Out amountInMaximum: " + amountInMaximum);
        console.log("swapU3Out amountOut: " + amountOut);
        let swapParams = {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            fee: 500,
            recipient: wallet.address,
            deadline: MAX_UINT256.toString(),
            amountOut: amountOut.toString(),
            amountInMaximum: amountInMaximum.toString(),
            sqrtPriceLimitX96: 0
        }

        let retValue = await u3Router.callStatic.exactOutputSingle(swapParams);
        await u3Router.exactOutputSingle(swapParams);
        return retValue;
    }


    async function balancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let reserve0Normalized = reserves[0] / 10 ** (await token0.decimals());
        let reserve1Normalized = reserves[1] / 10 ** (await token1.decimals());

        let price0Per1 = reserve0Normalized / reserve1Normalized;

        return {
            reserve0: reserves[0],
            reserve1: reserves[1],
            price0Per1: price0Per1,
        }
    }


    async function getSampleTargetsUniV3(pool) {
        let slot = await pool.slot0();
        let sqrtPriceX96 = slot[0];

        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Decimals = new BN((await token0.decimals()).toString());
        let token1Decimals = new BN((await token1.decimals()).toString());
        const tokenDecimals = [
            token0Decimals,
            token1Decimals,
        ];

        _2_96 = new BN(2).pow(new BN(96));
        console.log(`_2_96: ${_2_96}`)
        // // 91806626997176688271480
        //
        //
        // //  (sqrt(p0/p1))^2 = p0/p1
        //
        //
        // // 64.96
        // // -> 128.192
        //
        //
        // 1063820804.765131544816214155
        sqrtPriceX96BN = new BN(sqrtPriceX96.toString());
        console.log(`sqrtRatioX96: ${sqrtPriceX96BN}`)

        baseTokenDecimals = token0Decimals;
        quoteTokenDecimals = token1Decimals;

        sqrt10X128 = new BN("1076067327063303206878105757264492625226");


        console.log(`baseTokenDecimals: ${baseTokenDecimals}`)
        console.log(`quoteTokenDecimals: ${quoteTokenDecimals}`)
        let adjustedSqrtRatioX96
        if (baseTokenDecimals.gt(quoteTokenDecimals)) {
            let difference = baseTokenDecimals.sub(quoteTokenDecimals);
            console.log("difference: " + difference);
            adjustedSqrtRatioX96 = sqrtPriceX96BN.mul(new BN(10).pow(difference.divn(2)));
            console.log("adjustedSqrtRatioX96: " + adjustedSqrtRatioX96);
            if (difference % 2 === 1) {
                adjustedSqrtRatioX96 = adjustedSqrtRatioX96
                    .mul(sqrt10X128)
                    .div(new BN(2).pow(new BN(128)));
                console.log("adjustedSqrtRatioX96: " + adjustedSqrtRatioX96);
            }

        } else {
            let difference = quoteTokenDecimals.sub(baseTokenDecimals)
            console.log("difference: " + difference);
            adjustedSqrtRatioX96 = sqrtPriceX96BN.div(new BN(10).pow(difference.divn(2)));
            console.log("adjustedSqrtRatioX96: " + adjustedSqrtRatioX96);
            if (difference % 2 === 1) {
                adjustedSqrtRatioX96 = adjustedSqrtRatioX96
                    .mul(new BN(2).pow(new BN(128)))
                    .div(sqrt10X128);
                console.log("adjustedSqrtRatioX96: " + adjustedSqrtRatioX96);
            }
        }

        console.log(`adjustedSqrtRatioX96: ${adjustedSqrtRatioX96}`)

        let value = adjustedSqrtRatioX96
            .mul(adjustedSqrtRatioX96)
            .div(new BN(2).pow(new BN(64)))
        console.log(`value: ${value}`)
        if (adjustedSqrtRatioX96.lt(_2_96)) {
            console.log("adjustedSqrtRatioX96 less then 2^96")
        }
        value1 = value
            // .mul(new BN(10).pow(new BN(57)))
            .mul(new BN(10).pow(new BN(44)))
            .div(new BN(2).pow(new BN(128)));
        console.log(`value1: ${value1}`)


        value2 = value
            .mul(new BN(10).pow(new BN(18)))
            .div(new BN(2).pow(new BN(128)));
        console.log(`value2: ${value2}`)


        let price = parseFloat(univ3prices.sqrtPrice(tokenDecimals, sqrtPriceX96).toFixed({
            reverse: false,
            decimalPlaces: 18,
        }));


        let token0Balance = new BN(10).pow(token0Decimals).muln(1000000);
        let token1Balance = new BN(10).pow(token1Decimals).muln(1000000);

        // save 12 precision digits after dot
        let E12Num = 1000000000000;
        let E12 = new BN(E12Num);
        let priceScaledE6 = new BN(Math.floor(price * E12Num).toString())

        token1Balance = token1Balance.mul(E12).div(priceScaledE6);

        // make same object like in QS pool reserves
        return {
            reserve0: token0Balance,
            reserve1: token1Balance,
            price
        };
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
