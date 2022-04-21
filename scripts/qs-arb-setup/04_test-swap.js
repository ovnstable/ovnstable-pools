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


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;
let iUniswapV2Router02Abi = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));
let iUniswapV3PoolAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV3Pool.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let qsRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

let uniV3PoolWmaticUsdcAddress = "0xa374094527e1673a86de625aa59517c5de346d32"
let uniV3PoolUsdcWethAddress = "0x45dda9cb7c25131df268515131f647d726f50608"


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

    let qsPoolWmaticUsdPlus = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolWmaticUsdPlusAddress, wallet);
    let qsPoolUsdPlusWeth = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolUsdPlusWethAddress, wallet);

    let uniV3PoolWmaticUsdc = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolWmaticUsdcAddress, wallet);
    let uniV3PoolUsdcWeth = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolUsdcWethAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);


    await printUserBalances("before");
    // await evmCheckpoint("default");
    try {

        // let amountInUsdPlusToWeth = toE6(5000);
        // await swap(uniV3PoolUsdcWeth, qsPoolUsdPlusWeth, usdPlus, weth, amountInUsdPlusToWeth);
        //
        // let amountInUsdPlusToWmatic = toE6(5000);
        // await swap(uniV3PoolWmaticUsdc, qsPoolWmaticUsdPlus, usdPlus, wmatic, amountInUsdPlusToWmatic);
        //
        // let amountInWethToUsdPlus = toE18(1);
        // await swap(uniV3PoolUsdcWeth, qsPoolUsdPlusWeth, weth, usdPlus, amountInWethToUsdPlus);

        let amountInWmaticToUsdPlus = toE18(3000);
        await swap(uniV3PoolWmaticUsdc, qsPoolWmaticUsdPlus, wmatic, usdPlus, amountInWmaticToUsdPlus);

    } catch (e) {
        console.log(e);
    }
    await printUserBalances("after");
    // await evmRestore("default");

    async function swap(uniV3Pool, qsPool, tokenIn, tokenOut, amountIn) {
        await printBalancesQsPool(qsPool)
        let pricesBefore = await prices(uniV3Pool, qsPool);

        let path = [tokenIn.address, tokenOut.address];
        await tokenIn.approve(qsRouter.address, amountIn.toString());
        await qsRouter.swapExactTokensForTokens(
            amountIn.toString(),
            0,
            path,
            wallet.address,
            MAX_UINT256.toString()
        );

        await printBalancesQsPool(qsPool)

        let pricesAfter = await prices(uniV3Pool, qsPool);
        console.log(`--- [Price change]`)
        console.log(`diff: ${pricesAfter.qsPrice - pricesBefore.qsPrice}`)
        console.log(`ratio: ${pricesAfter.qsPrice / pricesBefore.qsPrice}`)
        console.log(`-------------------------------------`)
    }


    async function printUserBalances(stage) {
        console.log(`--- [Balance ${stage}]`)
        console.log('WETH:      ' + await weth.balanceOf(wallet.address) / 1e18);
        console.log('WMATIC:    ' + await wmatic.balanceOf(wallet.address) / 1e18);
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
