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


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);


    let qsRouter = await ethers.getContractAt(iUniswapV2Router02Abi, qsRouterAddress, wallet);
    let u3Router = await ethers.getContractAt(iUniswapV3Router02Abi, uniV3RouterAddress, wallet);

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


    // await printUserBalances("before");
    await evmCheckpoint("default");
    try {

        // await fixUsdcWeth();
        // await fixUsdcWeth();

        await fixMaticUsdc();
        await fixMaticUsdc();


    } catch (e) {
        console.log(e);
    }
    // await printUserBalances("after");
    await evmRestore("default");

    async function fixUsdcWeth() {

        // balances with prices fields
        let balancesCurrent = await balancesQsPool(qsPoolUsdPlusWeth);
        let balancesTarget = await getSampleTargetsUniV3(uniV3PoolUsdcWeth);

        let currentPrice0Per1 = balancesCurrent.price0Per1
        let targetPrice0Per1 = balancesTarget.price
        console.log(`currentPrice0Per1: ${currentPrice0Per1}`)
        console.log(`targetPrice0Per1 : ${targetPrice0Per1}`)

        // changePrice = (rA_0/rA_1)/(rB_0/rB_1);
        let changePrice = targetPrice0Per1 / currentPrice0Per1
        console.log(`changePrice: ${changePrice}`)

        let lowerBound = lowerChangePriceUsdPlusWeth;
        let upperBound = upperChangePriceUsdPlusWeth;
        if (lowerBound < changePrice && changePrice < upperBound) {
            console.log(`changePrice in bound ${lowerBound}-${upperBound}, skip actions`)
            return;
        }

        await printUserBalances("1");

        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
        console.log(`balancesTarget.reserve0:  ${balancesTarget.reserve0}`)
        console.log(`balancesTarget.reserve1:  ${balancesTarget.reserve1}`)


        let rCur0 = new BN(balancesCurrent.reserve0.toString());
        let rCur1 = new BN(balancesCurrent.reserve1.toString());
        let rTar0 = new BN(balancesTarget.reserve0.toString());
        let rTar1 = new BN(balancesTarget.reserve1.toString());


        // check price change
        if (changePrice < 1) {
            // for UsdcWeth pool it means swap 1 -> 0 => weth->usdc
            console.log(`changePrice < 1 => 1->0`)

            let [rIn0, rOut0, rIn1, rOut1] = [rCur1, rCur0, rTar1, rTar0]

            let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
            console.log(`aIn: ${aIn}`)

            let E15 = new BN(10).pow(new BN(15));
            if (aIn.lt(E15)) { // 0.001
                console.log(`aIn too low, skip actions`)
                return;
            }

            let poolPrices = await prices(uniV3PoolUsdcWeth, qsPoolUsdcWeth);

            let _1000 = new BN(1000);
            let uniV3PriceScaled = new BN(Math.floor(poolPrices.uniV3Price * 1000).toString())
            let maximumUsdcForSpend = aIn.mul(uniV3PriceScaled).div(_1000)

            let wethForSpending = aIn;

            let usdcSpent = await swapU3Out(usdc, weth, wethForSpending, maximumUsdcForSpend);
            let usdPlusReceived = await swapQS(weth, usdPlus, wethForSpending);
            let usdcReceived = await unwrap(usdPlusReceived)

        } else {
            console.log(`changePrice > 1 => 0->1`)

            let [rIn0, rOut0, rIn1, rOut1] = [rCur0, rCur1, rTar0, rTar1]

            let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
            console.log(`aIn: ${aIn}`)

            let E3 = new BN(10).pow(new BN(3));
            if (aIn.lt(E3)) { // 0.001
                console.log(`aIn too low, skip actions`)
                return;
            }

            let usdcForWrapping = calcAInForWrap(aIn);

            let usdPlusReceived = await wrap(usdcForWrapping);
            let wethReceived = await swapQS(usdPlus, weth, usdPlusReceived);
            let usdcReceived = await swapU3(weth, usdc, wethReceived);
        }

        balancesCurrent = await balancesQsPool(qsPoolUsdPlusWeth);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

        await printUserBalances("2");

    }

    async function fixMaticUsdc() {

        // balances with prices fields
        let balancesCurrent = await balancesQsPool(qsPoolWmaticUsdPlus);
        let balancesTarget = await getSampleTargetsUniV3(uniV3PoolWmaticUsdc);

        let currentPrice0Per1 = balancesCurrent.price0Per1
        let targetPrice0Per1 = balancesTarget.price
        console.log(`currentPrice0Per1: ${currentPrice0Per1}`)
        console.log(`targetPrice0Per1 : ${targetPrice0Per1}`)

        // changePrice = (rA_0/rA_1)/(rB_0/rB_1);
        let changePrice = targetPrice0Per1 / currentPrice0Per1
        console.log(`changePrice: ${changePrice}`)

        let lowerBound = lowerChangePriceWmaticUsdPlus;
        let upperBound = upperChangePriceWmaticUsdPlus;
        if (lowerBound < changePrice && changePrice < upperBound) {
            console.log(`changePrice in bound ${lowerBound}-${upperBound}, skip actions`)
            return;
        }

        await printUserBalances("1");

        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
        console.log(`balancesTarget.reserve0:  ${balancesTarget.reserve0}`)
        console.log(`balancesTarget.reserve1:  ${balancesTarget.reserve1}`)


        let rCur0 = new BN(balancesCurrent.reserve0.toString());
        let rCur1 = new BN(balancesCurrent.reserve1.toString());
        let rTar0 = new BN(balancesTarget.reserve0.toString());
        let rTar1 = new BN(balancesTarget.reserve1.toString());


        // check price change
        if (changePrice < 1) {
            // for UsdcWeth pool it means swap 1 -> 0 => weth->usdc
            console.log(`changePrice < 1 => 1->0`)

            let [rIn0, rOut0, rIn1, rOut1] = [rCur1, rCur0, rTar1, rTar0]

            let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
            console.log(`aIn: ${aIn}`)

            let E3 = new BN(10).pow(new BN(3));
            if (aIn.lt(E3)) { // 0.001
                console.log(`aIn too low, skip actions`)
                return;
            }

            let usdcForWrapping = calcAInForWrap(aIn);

            let usdPlusReceived = await wrap(usdcForWrapping);
            let wethReceived = await swapQS(usdPlus, wmatic, usdPlusReceived);
            let usdcReceived = await swapU3(wmatic, usdc, wethReceived);
        } else {
            console.log(`changePrice > 1 => 0->1`)

            let [rIn0, rOut0, rIn1, rOut1] = [rCur0, rCur1, rTar0, rTar1]

            let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
            console.log(`aIn: ${aIn}`)

            let E15 = new BN(10).pow(new BN(15));
            if (aIn.lt(E15)) { // 0.001
                console.log(`aIn too low, skip actions`)
                return;
            }

            let poolPrices = await prices(uniV3PoolWmaticUsdc, qsPoolWmaticUsdc);

            let _1000 = new BN(1000);
            let uniV3PriceScaled = new BN(Math.floor(poolPrices.uniV3Price * 1000).toString())
            let maximumUsdcForSpend = aIn.mul(uniV3PriceScaled).div(_1000)

            let wethForSpending = aIn;

            let usdcSpent = await swapU3Out(usdc, wmatic, wethForSpending, maximumUsdcForSpend);
            let usdPlusReceived = await swapQS(wmatic, usdPlus, wethForSpending);
            let usdcReceived = await unwrap(usdPlusReceived)
        }

        balancesCurrent = await balancesQsPool(qsPoolWmaticUsdPlus);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

        await printUserBalances("2");

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
        let nominator1 = _997.sub(t4).sub(tSqrt)
        let result0 = nominator0.div(_1994)
        let result1 = nominator1.div(_1994)

        // console.log(`result0: ${result0}`)
        // console.log(`result1: ${result1}`)
        if (result0.ltn(0)) {
            throw new Error("Result is below zero")
        }

        return result0;
    }

    function calcAInForWrap(aOut) {
        let _9996 = new BN(9996);
        let _10000 = new BN(10000);
        return aOut.mul(_10000).div(_9996);
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

        // let sqrtPriceLimitX96 = zeroForOne
        //     ? BigNumber.from('4295128740')
        //     : BigNumber.from('1461446703485210103287273052203988822378723970341');

        let swapParams = {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            fee: 500,
            recipient: wallet.address,
            deadline: MAX_UINT256.toString(),
            amountIn: amountIn.toString(),
            // amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
            // sqrtPriceLimitX96: sqrtPriceLimitX96.toString(),
        }

        // console.log(swapParams)
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

        console.log(swapParams)
        let retValue = await u3Router.callStatic.exactOutputSingle(swapParams);
        await u3Router.exactOutputSingle(swapParams);
        return retValue;
    }


    async function printUserBalances(stage) {
        console.log(`--- [Balance ${stage}]`)
        console.log('WETH:      ' + await weth.balanceOf(wallet.address) / 1e18);
        console.log('WMATIC:    ' + await wmatic.balanceOf(wallet.address) / 1e18);
        console.log('USDC:      ' + await usdc.balanceOf(wallet.address) / 1e6);
        console.log('USD+:      ' + await usdPlus.balanceOf(wallet.address) / 1e6);
        console.log('PoolToken: ' + await qsPoolUsdPlusWeth.balanceOf(wallet.address) / 1e18);
        console.log(`-------------------------------------`)
    }


    async function prices(uniV3Pool, qsPool) {
        let {price} = await getPriceUniV3(uniV3Pool);
        console.log(`UniV3 price: ${price}`)

        let qsPrice = await getPriceQsPool(qsPool)
        console.log(`QS price:    ${qsPrice}`)

        return {
            uniV3Price: price,
            qsPrice: qsPrice,
        }
    }


    async function printBalancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        let reserve0Normalized = reserves[0] / 10 ** (await token0.decimals());
        let reserve1Normalized = reserves[1] / 10 ** (await token1.decimals());

        let price0Per1 = reserve0Normalized / reserve1Normalized;
        let price1Per0 = reserve1Normalized / reserve0Normalized;

        console.log(`-- balances for QS pool of ${token0Symbol}/${token1Symbol}`)
        console.log(`token0[${token0Symbol}]: ${reserve0Normalized}`)
        console.log(`token1[${token1Symbol}]: ${reserve1Normalized}`)
        console.log(`price0Per1: ${price0Per1}`);
        console.log(`price1Per0: ${price1Per0}`);
        console.log(`-------------------------------------`)
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
        let price1Per0 = reserve1Normalized / reserve0Normalized;

        return {
            reserve0: reserves[0],
            reserve1: reserves[1],
            price0Per1: price0Per1,
            price1Per0: price1Per0,
        }
    }

    async function getPriceQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let reserve0Normalized = reserves[0] / 10 ** (await token0.decimals());
        let reserve1Normalized = reserves[1] / 10 ** (await token1.decimals());

        return reserve0Normalized / reserve1Normalized;
    }


    async function getPriceUniV3(pool) {
        let slot = await pool.slot0();
        let sqrtPriceX96 = slot[0];

        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        const tokenDecimals = [
            await token0.decimals(),
            await token1.decimals(),
        ];

        let price = parseFloat(univ3prices.sqrtPrice(tokenDecimals, sqrtPriceX96).toFixed({
            reverse: false,
            decimalPlaces: 18,
        }));

        return {
            token0,
            token1,
            price
        };
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
