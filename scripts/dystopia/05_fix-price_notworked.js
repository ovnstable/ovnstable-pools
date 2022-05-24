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

let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;
let IDystopiaRouterAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaRouter.json')).abi;
let iUniswapV3PoolAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV3Pool.json')).abi;
let iUniswapV3Router02Abi = JSON.parse(fs.readFileSync('./abi/build/ISwapRouterV3.json')).abi;


let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let dystRouterAddress = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"
// let uniV3RouterAddress = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
let uniV3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

let uniV3PoolWmaticUsdcAddress = "0xa374094527e1673a86de625aa59517c5de346d32"
let uniV3PoolUsdcWethAddress = "0x45dda9cb7c25131df268515131f647d726f50608"


// replace addresses from create script
let dystPoolWmaticUsdPlusAddress = "0x1A5FEBA5D5846B3b840312Bd04D76ddaa6220170";
let dystPoolUsdPlusWethAddress = "0xCF107443b87d9F9A6dB946D02CB5df5EF5299c95";
let dystPoolUsdcUsdPlusAddress = "0x421a018cC5839c4C0300AfB21C725776dc389B1a";


let E18 = new BN(10).pow(new BN(18));

let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);


    let dystRouter = await ethers.getContractAt(IDystopiaRouterAbi, dystRouterAddress, wallet);
    let u3Router = await ethers.getContractAt(iUniswapV3Router02Abi, uniV3RouterAddress, wallet);

    let dystPoolWmaticUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolWmaticUsdPlusAddress, wallet);
    let dystPoolUsdPlusWeth = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdPlusWethAddress, wallet);
    let dystPoolUsdcUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdcUsdPlusAddress, wallet);

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

        // await fixUsdcWeth();
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

        await fixMaticUsdc();
        await fixMaticUsdc();


    } catch (e) {
        console.log(e);
    }
    await evmRestore("default");

    async function chain_U3_DY_UN(
        token0,
        token1,
        token2,
        token0MaximumSpend,
        token1AmountOut
    ) {
        let token0Spent = await swapU3Out(token0, token1, token1AmountOut, token0MaximumSpend);
        let token2Received = await swapDY(token1, token2, token1AmountOut);
        let usdcReceived = await unwrap(token2Received)
    }


    async function chain_WR_DY_U3(
        token0,
        token1,
        token2,
        usdcForWrapping
    ) {
        let token0Received = await wrap(usdcForWrapping);
        let token1Received = await swapDY(token0, token1, token0Received);
        let usdcReceived = await swapU3(token1, token2, token1Received);
    }


    async function fixUsdcWeth() {

        let qsPool = dystPoolUsdPlusWeth;
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
            return;
        }
        await fix(params);
    }

    async function fixMaticUsdc() {

        let qsPool = dystPoolWmaticUsdPlus;
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
            return;
        }
        await fix(params);
    }


    async function doNeedFixUsdcWeth() {

        let qsPool = dystPoolUsdPlusWeth;
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
        let qsPool = dystPoolWmaticUsdPlus;
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

        balancesCurrent = await balancesQsPool(dystPoolUsdPlusWeth);
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
        let aIn = calcAInForDY(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        let usdcIn = calcAInForWrap(aIn);
        let usdcOut = calcAOutForDY(usdcIn, rIn0, rOut0);
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

        await chain_WR_DY_U3(token0, token1, token2, usdcForWrapping)
    }


    async function xToUsdc(
        token0, token1, token2,
        rIn0, rOut0, rIn1, rOut1
    ) {

        let aIn = calcAInForDY(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        // equivalent to use uniV3 swap price
        let maximumUsdcForSpend = aIn.mul(rOut1).div(rIn1);

        // give 1% more for spending
        maximumUsdcForSpend = maximumUsdcForSpend.muln(101).divn(100)

        let usdcIn = maximumUsdcForSpend;
        let usdcOut = calcAOutOnWrap(calcAOutForDY(aIn, rIn0, rOut0));
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
        await chain_U3_DY_UN(token0, token1, token2, maximumUsdcForSpend, wethForSpending);

    }

    async function usdcToXCheck(
        token0, token1, token2,
        rIn0, rOut0, rIn1, rOut1
    ) {
        let aIn = calcAInForDY(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        let usdcIn = calcAInForWrap(aIn);
        let usdcOut = calcAOutForDY(usdcIn, rIn0, rOut0);
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

        let aIn = calcAInForDY(rIn0, rOut0, rIn1, rOut1)
        console.log(`aIn: ${aIn}`)

        // equivalent to use uniV3 swap price
        let maximumUsdcForSpend = aIn.mul(rOut1).div(rIn1);

        // give 1% more for spending
        maximumUsdcForSpend = maximumUsdcForSpend.muln(101).divn(100)

        let usdcIn = maximumUsdcForSpend;
        let usdcOut = calcAOutOnWrap(calcAOutForDY(aIn, rIn0, rOut0));

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

    // for volatile only
    function calcAInForDY(rIn0, rOut0, rIn1, rOut1) {
        // p1 = rIn1/rOut1

        let fee100 = new BN(2000);
        let feeR = fee100.subn(1);


        let _2 = new BN(2);
        let _4 = new BN(4);

        let a = _4.mul(fee100).mul(feeR);
        let b = (fee100.sub(feeR)).mul(fee100.sub(feeR));
        let c = _2.mul(feeR).mul(fee100.sub(feeR));
        let d = feeR.mul(feeR);
        let e = feeR.add(fee100);


        let t1 = a.mul(rIn0).mul(rOut0).mul(rIn1).div(rOut1);
        let t2 = b.mul(rIn0).mul(rIn0);
        let t3 = c.mul(rIn0);
        let underSqrt = t1.add(t2).sub(t3).add(d);
        let tSqrt = sqrt(underSqrt)
        let t4 = e.mul(rIn0)
        let nominator0 = tSqrt.add(feeR).sub(t4)
        let result0 = nominator0.div(_2.mul(feeR))

        if (result0.ltn(0)) {
            throw new Error("Result is below zero")
        }

        return result0;
    }

    // same to getAmountOut()
    async function calcAOutForDY(pool, aIn, tIn) {
        return await pool.getAmountOut(aIn.toString(), tIn.address);
    }

    // how much usdc for needed usd+
    function calcAInForWrap(
        amountOut, swapFee,
        reserveIn, reserveOut,
        decimalsIn, decimalsOut
    ) {

        reserveIn = rescale(reserveIn, decimalsIn, 18);
        reserveOut = rescale(reserveOut, decimalsOut, 18);
        amountOut = rescale(amountOut, decimalsIn, 18);

        let xy = k(reserveIn, reserveOut);
        let y = getY(reserveOut.sub(amountOut), xy, reserveIn);
        y = y.sub(reserveIn);

        let amountIn = rescale(y, 18, decimalsIn);

        amountIn = amountIn.mul(swapFee).div(swapFee.sub(new BN(1)));

        return amountIn.add(new BN(1));
    }

    // usdc -> usd+
    async function calcAOutOnWrap(pool, aIn, tIn) {
        return await pool.getAmountOut(aIn.toString(), tIn.address);
    }


    function getY(x0, xy, y) {
        for (let i = 0; i < 255; i++) {
            let yPrev = y;
            let k = f(x0, y);
            if (k.lt(xy)) {
                let dy = xy.sub(k).mul(E18).div(d(x0, y));
                y = y.add(dy);
            } else {
                let dy = k.sub(xy).mul(E18).div(d(x0, y));
                y = y.sub(dy);
            }
            if (closeTo(y, yPrev, new BN(1))) {
                break;
            }
        }
        return y;
    }

    function closeTo(a, b, target) {
        if (a.gt(b)) {
            return a.sub(b).lte(target);
        } else {
            return b.sub(this).lte(target);
        }
    }

    function d(x0, y) {
        let a = new BN(3).mul(x0).mul(y).mul(y).div(E18).div(E18);
        let b = x0.mul(x0).div(E18).mul(x0).div(E18);
        return a.add(b);
    }

    function f(x0, y) {
        let a = x0.mul(y).mul(y).div(E18).mul(y).div(E18).div(E18);
        let b = x0.mul(x0).div(E18).mul(x0).div(E18).mul(y).div(E18);
        return a.add(b);
    }


    function k(x, y, decimals0, decimals1) {
        let _x = rescale(x, decimals0, 18);
        let _y = rescale(y, decimals1, 18);

        // 18+18-18=18
        let _a = _x.mul(_y).div(E18);
        // 18+18-18=18, 18+18-18=18
        let _b = _x.mul(_x).div(E18).add(_y.mul(_y).div(E18));
        // x3y+y3x >= k
        // 18+18-18=18
        return _a.mul(_b).div(E18);
    }


    function rescale(value, fromDecimals, toDecimals) {
        let from = new BN(10).pow(new BN(fromDecimals));
        let to = new BN(10).pow(new BN(toDecimals));
        return value.mul(to).div(from);
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
        await usdc.approve(dystRouter.address, amountIn.toString());
        let result = await dystRouter.callStatic.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            usdc.address,
            usdPlus.address,
            true,
            wallet.address,
            MAX_UINT256.toString()
        );
        await dystRouter.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            usdc.address,
            usdPlus.address,
            true,
            wallet.address,
            MAX_UINT256.toString()
        );
        return result[1];
    }

    //  usd+ -> usdc
    async function unwrap(amountIn) {
        await usdPlus.approve(dystRouter.address, amountIn.toString());
        let result = await dystRouter.callStatic.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            usdPlus.address,
            usdc.address,
            true,
            wallet.address,
            MAX_UINT256.toString()
        );
        await dystRouter.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            usdPlus.address,
            usdc.address,
            true,
            wallet.address,
            MAX_UINT256.toString()
        );
        return result[1];
    }

    async function swapDY(tokenIn, tokenOut, amountIn) {
        await tokenIn.approve(dystRouter.address, amountIn.toString());
        let result = await dystRouter.callStatic.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            tokenIn.address,
            tokenOut.address,
            false,
            wallet.address,
            MAX_UINT256.toString()
        );
        await dystRouter.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            tokenIn.address,
            tokenOut.address,
            false,
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

        // _2_96 = new BN(2).pow(new BN(96));
        // console.log(`_2_96: ${_2_96}`)
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
        // // 1063820804.765131544816214155
        // sqrtPriceX96BN = new BN(sqrtPriceX96.toString());
        //
        // baseTokenDecimals = token1Decimals;
        // quoteTokenDecimals = token0Decimals;
        //
        // sqrt10X128 = new BN("1076067327063303206878105757264492625226");

        //
        // console.log(`baseTokenDecimals: ${baseTokenDecimals}`)
        // console.log(`quoteTokenDecimals: ${quoteTokenDecimals}`)
        // let adjustedSqrtRatioX96
        // if (baseTokenDecimals > quoteTokenDecimals) {
        //     let difference = baseTokenDecimals.sub(quoteTokenDecimals);
        //     adjustedSqrtRatioX96 = sqrtPriceX96BN.mul(new BN(10).pow(difference.divn(2)));
        //     if (difference % 2 === 1) {
        //         adjustedSqrtRatioX96 = adjustedSqrtRatioX96
        //             .mul(sqrt10X128)
        //             .div(new BN(2).pow(new BN(128)));
        //     }
        //
        // } else {
        //     let difference = quoteTokenDecimals.sub(baseTokenDecimals)
        //     adjustedSqrtRatioX96 = sqrtPriceX96BN.div(new BN(10).pow(difference.divn(2)));
        //     if (difference % 2 === 1) {
        //         adjustedSqrtRatioX96 = adjustedSqrtRatioX96
        //             .mul(new BN(2).pow(new BN(128)))
        //             .div(sqrt10X128);
        //     }
        // }
        //
        // console.log(`adjustedSqrtRatioX96: ${adjustedSqrtRatioX96}`)
        //
        // let value = adjustedSqrtRatioX96
        //     .mul(adjustedSqrtRatioX96)
        //     .div(new BN(2).pow(new BN(64)))
        // console.log(`value: ${value}`)
        // value1 = value
        //     .mul(new BN(10).pow(new BN(57)))
        //     .div(new BN(2).pow(new BN(128)));
        // console.log(`value1: ${value1}`)
        // value2 = value
        //     .mul(new BN(10).pow(new BN(18)))
        //     .div(new BN(2).pow(new BN(128)));
        // console.log(`value2: ${value2}`)
        //
        // console.log(`sqrtPriceX96: ${sqrtPriceX96BN}`)
        // console.log(`sqrtPriceX96: ${sqrtPriceX96BN.pow(new BN(2))}`)
        // console.log(`sqrtPriceX96: ${sqrtPriceX96BN.pow(new BN(2)).mul(new BN("1"))}`)
        // console.log(`sqrtPriceX96: ${sqrtPriceX96BN.pow(new BN(2)).mul(new BN("1").mul(_2_96))}`)
        // console.log(`sqrtPriceX96: ${sqrtPriceX96BN.pow(new BN(2)).div(_2_96).mul(new BN("1").mul(_2_96)).div(_2_96)}`)
        // console.log(`sqrtPriceX96: ${sqrtPriceX96BN.pow(new BN(2)).div(_2_96).mul(new BN("1"))}`)


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
