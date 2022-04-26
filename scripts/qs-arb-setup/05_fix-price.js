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


    // await printUserBalances("before");
    await evmCheckpoint("default");
    try {


        // let amountInUsdPlusToWeth = toE6(5000);
        // await swap(uniV3PoolUsdcWeth, qsPoolUsdPlusWeth, usdPlus, weth, amountInUsdPlusToWeth);
        //
        // let amountInUsdPlusToWmatic = toE6(5000);
        // await swap(uniV3PoolWmaticUsdc, qsPoolWmaticUsdPlus, usdPlus, wmatic, amountInUsdPlusToWmatic);
        //
        // let amountInWethToUsdPlus = toE18(1);
        // await swap(uniV3PoolUsdcWeth, qsPoolUsdPlusWeth, weth, usdPlus, amountInWethToUsdPlus);

        let balancesCurrent = await balancesQsPool(qsPoolUsdPlusWeth);
        let balancesTarget = await balancesQsPool(qsPoolUsdcWeth);

        let changePrice = balancesTarget.price0Per1 / balancesCurrent.price0Per1;
        let changePriceInv = balancesTarget.price1Per0 / balancesCurrent.price1Per0;
        console.log(`changePrice: ${changePrice}`)
        console.log(`changePriceInv: ${changePriceInv}`)

        //
        // changePrice = (rA_0/rA_1)/(rB_0/rB_1);
        //
        // changePrice * (rB_0/rB_1) = (rA_0/rA_1)


        // if(true){
        //     return;
        // }

        // let amountInWmaticToUsdPlus = toE18(3000);
        //
        //
        // let pricesAfter = await prices(uniV3PoolWmaticUsdc, qsPoolWmaticUsdPlus);
        //
        // let feeOnQsSwap = 0.003;
        //
        // let balancesAfter = await balancesQsPool(qsPoolWmaticUsdPlus);
        //
        // // исходные балансы
        // let b0_0;
        // let b0_1;
        //
        //
        // // результирующие балансы
        // let b1_0;
        // let b1_1;
        //
        // // b0_0*b0_1 ~= b1_0*b1_1


        let rIn0 = balancesCurrent.reserve1;
        let rOut0 = balancesCurrent.reserve0;
        let p1 = 0.8;
        // let p1 = 0.7447510160007935;


        // aIn=(rIn0*1000 *(rOut0 - (rIn0 + aIn) / p1))/((rOut0 - (rOut0 - (rIn0 + aIn) / p1))*997)+1


        // let a = 997 / p1
        // let b = 997 * (rOut0 + rIn0 / p1 + 1 / p1) + 1000 * rIn0 / p1
        // let c = 997 * rIn0 / p1 + 997 * rOut0 - 1000 * rIn0 * rOut0 + 1000 * rIn0 * rIn0 / p1
        //
        // console.log(`a: ${a}`)
        // console.log(`b: ${b}`)
        // console.log(`c: ${c}`)
        //
        // let d = b * b - 4 * a * c;
        // console.log(`d: ${d}`)
        // let sqrtD = Math.sqrt(d);
        // console.log(`sqrt(d): ${sqrtD}`)
        //
        // let x1 = (-b + sqrtD) / (2 * a)
        // let x2 = (-b - sqrtD) / (2 * a)
        //
        // console.log(`x1: ${x1}`)
        // console.log(`x2: ${x2}`)
        //
        //
        // let _997 = new BN(997);
        // let _1000 = new BN(1000);
        //

        // balancesCurrent = await balancesQsPoolN(qsPoolUsdPlusWeth);
        // balancesTarget = await balancesQsPoolN(qsPoolUsdcWeth);
        //
        // console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        // console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
        //
        // rIn0 = new BN(balancesCurrent.reserve0.toString());
        // rOut0 = new BN(balancesCurrent.reserve1.toString());
        //
        // console.log(`balancesTarget.reserve0: ${balancesTarget.reserve0}`)
        // console.log(`balancesTarget.reserve1: ${balancesTarget.reserve1}`)
        //
        //
        // // p1 = rIn1/rOut1
        // let rIn1 = new BN(balancesTarget.reserve0.toString());
        // let rOut1 = new BN(balancesTarget.reserve1.toString());
        //
        // //
        // a = _997.mul(rOut1).div(rIn1);
        // b = _997.mul(rOut0.add(rIn0.mul(rOut1).div(rIn1)).add(rOut1.div(rIn1))).add(
        //     _1000.mul(rIn0).mul(rOut1).div(rIn1))
        // c = _997.mul(rIn0).mul(rOut1).div(rIn1).add(
        //     _997.mul(rOut0)).sub(
        //     _1000.mul(rIn0).mul(rOut0)).add(
        //     _1000.mul(rIn0).mul(rIn0).mul(rOut1).div(rIn1))
        //
        // console.log(`a: ${a}`)
        // console.log(`b: ${b}`)
        // console.log(`c: ${c}`)
        //
        // d = b.mul(b).sub(a.mul(c).muln(4));
        // console.log(`d: ${d}`)
        // sqrtD = sqrt(d);
        // console.log(`sqrt(d): ${sqrtD}`)
        //
        // x1 = b.neg().add(sqrtD).div(a.muln(2));
        // x2 = b.neg().sub(sqrtD).div(a.muln(2));
        //
        // console.log(`x1: ${x1}`)
        // console.log(`x2: ${x2}`)

        //342 283 662 - before
        //341 564 133 - target
        //342 625 464 - t1
        //342 764 078 - t2


        // console.log(`${balancesCurrent.reserve0 * balancesCurrent.reserve1}`)
        // console.log(`${balancesAfter.reserve0 * balancesAfter.reserve1}`)


        // p0 = b0_0 / b0_1
        // p1 = b1_0 / b1_1

        // !!!!!!! TODO: в обратную сторону

        // let pre = 3053984;
        //
        // let prr = await prices(uniV3PoolUsdcWeth, qsPoolUsdcWeth);
        // let u1 = Math.floor(prr.uniV3Price * pre);
        // u1 = pre;
        // console.log(`u1: ${u1}`)


        let w1 = 10000000;
        let up1 = 10000000;


        // check price change

        if (changePrice < 1) {

            // for UsdcWeth pool it means swap 1 -> 0 => weth->usdc

            balancesCurrent = await balancesQsPoolN(qsPoolUsdPlusWeth);
            balancesTarget = await balancesQsPoolN(qsPoolUsdcWeth);

            console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
            console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

            console.log(`balancesTarget.reserve0: ${balancesTarget.reserve0}`)
            console.log(`balancesTarget.reserve1: ${balancesTarget.reserve1}`)

            rIn0 = new BN(balancesCurrent.reserve1.toString());
            rOut0 = new BN(balancesCurrent.reserve0.toString());

            // p1 = rIn1/rOut1
            let rIn1 = new BN(balancesTarget.reserve1.toString());
            let rOut1 = new BN(balancesTarget.reserve0.toString());

            let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
            console.log(`aIn: ${aIn}`)
            let aIn2 = calcAInForQS(rOut0, rIn0, rOut1, rIn1)
            console.log(`aIn2: ${aIn2}`)


            let prr = await prices(uniV3PoolUsdcWeth, qsPoolUsdcWeth);
            let u1 = Math.floor(prr.uniV3Price * aIn2);
            // u1 = pre;
            console.log(`u1: ${u1}`)


            await printUserBalances("1");
            await prices(uniV3PoolUsdcWeth, qsPoolUsdPlusWeth)
            // let wethForSpending = await swapU3(usdc, weth, u1);

            // let needWethForQs = aIn2;
            let needWethForQs = new BN("2107903900");

            let maximumUsdcForSpend = u1;
            let usdcSpent = await swapU3Out(usdc, weth, needWethForQs, maximumUsdcForSpend);
            console.log(`usdcSpent: ${usdcSpent}`)
            let wethForSpending = needWethForQs;

            // wethForSpending = new BN("3421124625897879");
            console.log(`wethForSpending: ${wethForSpending}`)
            console.log(`+++ --`)

            await prices(uniV3PoolUsdcWeth, qsPoolUsdPlusWeth)
            await printUserBalances("2");

            await printBalancesQsPool(qsPoolUsdPlusWeth)
            let upR = await swapQS(weth, usdPlus, wethForSpending);
            console.log(`upR: ${upR}`)
            await printBalancesQsPool(qsPoolUsdPlusWeth)

            await printUserBalances("3");

            let ucR = await unwrap(upR)
            console.log(`ucR: ${ucR}`)
            await printUserBalances("4");

            balancesCurrent = await balancesQsPoolN(qsPoolUsdPlusWeth);
            console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
            console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
        } else {

            console.log(`changePrice > 1 => 0->1`)
            await printUserBalances("1");
            // 0->1

            let balancesCurrent = await balancesQsPoolN(qsPoolUsdPlusWeth);
            let balancesTarget = await balancesQsPoolN(qsPoolUsdcWeth);

            console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
            console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
            console.log(`balancesTarget.reserve0: ${balancesTarget.reserve0}`)
            console.log(`balancesTarget.reserve1: ${balancesTarget.reserve1}`)

            let rIn0 = new BN(balancesCurrent.reserve0.toString());
            let rOut0 = new BN(balancesCurrent.reserve1.toString());

            // p1 = rIn1/rOut1
            let rIn1 = new BN(balancesTarget.reserve0.toString());
            let rOut1 = new BN(balancesTarget.reserve1.toString());

            let aIn = calcAInForQS(rIn0, rOut0, rIn1, rOut1)
            console.log(`aIn: ${aIn}`)


            // let usdcForWrapping = new BN("21079039");
            let usdcForWrapping = calcAInForWrap(aIn);
            console.log(`usdcForWrapping: ${usdcForWrapping}`)
            // usdc -> usd+
            let usdPlusReceived = await wrap(usdcForWrapping);
            console.log(`usdPlusReceived: ${usdPlusReceived}`)

            await printUserBalances("2");

            let usdPlusToSpent = usdPlusReceived;

            let wethToSpent = await swapQS(usdPlus, weth, usdPlusToSpent);
            console.log(`wethToSpent: ${wethToSpent}`)
            await printUserBalances("3");
            let resultUsdc = await swapU3(weth, usdc, wethToSpent);
            console.log(`resultUsdc: ${resultUsdc}`)
            await printUserBalances("4");

            balancesCurrent = await balancesQsPoolN(qsPoolUsdPlusWeth);
            console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
            console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

        }


    } catch (e) {
        console.log(e);
    }
    // await printUserBalances("after");
    await evmRestore("default");


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

        console.log(`result0: ${result0}`)
        console.log(`result1: ${result1}`)

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

    async function wrap(amountIn) {
        await usdc.approve(exchange.address, amountIn.toString());
        let result = await exchange.callStatic.buy(usdcAddress, amountIn.toString());
        await exchange.buy(usdcAddress, amountIn.toString());
        return result;
    }

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
            reserve0: reserve0Normalized,
            reserve1: reserve1Normalized,
            price0Per1: price0Per1,
            price1Per0: price1Per0,
        }
    }


    async function balancesQsPoolNN(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let reserve0Normalized = new BN(reserves[0].toString()).mul(
            new BN(10).pow(
                new BN(18).sub(new BN((await token0.decimals()).toString()))
            )
        );
        let reserve1Normalized = new BN(reserves[1].toString()).mul(
            new BN(10).pow(
                new BN(18).sub(new BN((await token1.decimals()).toString()))
            )
        );

        return {
            reserve0: reserve0Normalized,
            reserve1: reserve1Normalized
        }
    }

    async function balancesQsPoolN(pool) {
        let reserves = await pool.getReserves();
        return {
            reserve0: reserves[0],
            reserve1: reserves[1]
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
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
