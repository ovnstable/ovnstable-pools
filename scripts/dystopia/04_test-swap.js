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

let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;
let IDystopiaRouterAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaRouter.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let dystRouterAddress = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"

// replace addresses from create script
let dystPoolUsdcUsdPlusAddress = "0x421a018cC5839c4C0300AfB21C725776dc389B1a";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let dystRouter = await ethers.getContractAt(IDystopiaRouterAbi, dystRouterAddress, wallet);

    let dystPoolUsdcUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdcUsdPlusAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);


    await printUserBalances("before");
    // await evmCheckpoint("default");
    try {

        // let amountInUsdPlusToUsdc = toE6(10);
        // await swap5050(meshPoolUsdcUsdPlus, usdPlus, usdc, amountInUsdPlusToUsdc);

        let amountInUsdcToUsdPlus = toE6(10);
        await swap5050(dystPoolUsdcUsdPlus, usdc, usdPlus, amountInUsdcToUsdPlus);

    } catch (e) {
        console.log(e);
    }
    await printUserBalances("after");
    // await evmRestore("default");


    async function swap5050(qsPool, tokenIn, tokenOut, amountIn) {
        await printBalancesQsPool(qsPool)
        let priceBefore = await getPriceQsPool(qsPool);

        await tokenIn.approve(dystRouter.address, amountIn.toString());
        await dystRouter.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            tokenIn.address,
            tokenOut.address,
            true,
            wallet.address,
            MAX_UINT256.toString()
        );

        await printBalancesQsPool(qsPool)

        let priceAfter = await getPriceQsPool(qsPool);
        console.log(`--- [Price change]`)
        console.log(`diff: ${priceAfter - priceBefore}`)
        console.log(`ratio: ${priceAfter / priceBefore}`)
        console.log(`-------------------------------------`)
    }


    async function printUserBalances(stage) {
        console.log(`--- [Balance ${stage}]`)
        console.log('WETH:      ' + await weth.balanceOf(wallet.address) / 1e18);
        console.log('WMATIC:    ' + await wmatic.balanceOf(wallet.address) / 1e18);
        console.log('USD+:      ' + await usdPlus.balanceOf(wallet.address) / 1e6);
        console.log('USDC:      ' + await usdc.balanceOf(wallet.address) / 1e6);
        console.log(`-------------------------------------`)
    }





    async function printBalancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        let token0Decimals = await token0.decimals();
        let token1Decimals = await token1.decimals();

        let reserve0Normalized = reserves[0] / 10 ** token0Decimals;
        let reserve1Normalized = reserves[1] / 10 ** token1Decimals;

        let price0Per1 = reserve0Normalized / reserve1Normalized;
        let price1Per0 = reserve1Normalized / reserve0Normalized;

        let balances0 = await token0.balanceOf(pool.address);
        let balances1 = await token1.balanceOf(pool.address);

        let balances0Normalized = balances0 / 10 ** token0Decimals;
        let balances1Normalized = balances1 / 10 ** token1Decimals;

        console.log(`-- balances for QS pool of ${token0Symbol}/${token1Symbol}`)
        console.log(`token0[${token0Symbol}]: ${reserve0Normalized}`)
        console.log(`token0[${token0Symbol}]: ${balances0Normalized}`)
        console.log(`token1[${token1Symbol}]: ${reserve1Normalized}`)
        console.log(`token1[${token1Symbol}]: ${balances1Normalized}`)
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

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
