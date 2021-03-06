const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {ZERO_ADDRESS, MAX_UINT256} = require("@openzeppelin/test-helpers/src/constants");
const {toEX} = require("../../utils/decimals");
const {evmCheckpoint, evmRestore} = require("../../utils/sharedBeforeEach")
const univ3prices = require("@thanpolas/univ3prices");


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


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let qsRouter = await ethers.getContractAt(iUniswapV2Router02Abi, qsRouterAddress, wallet);

    let uniV3PoolWmaticUsdc = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolWmaticUsdcAddress, wallet);
    let uniV3PoolUsdcWeth = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolUsdcWethAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);


    await printUserBalances("before");
    // await evmCheckpoint("default");
    try {
        let amountToFeed = 150000;

        await calcAmountInPool(uniV3PoolWmaticUsdc, amountToFeed);
        await calcAmountInPool(uniV3PoolUsdcWeth, amountToFeed);
    } catch (e) {
        console.log(e);
    }
    await printUserBalances("after");

    // await evmRestore("default");


    async function printUserBalances(stage) {
        console.log(`--- [Balance ${stage}]`)
        console.log('WETH:      ' + await weth.balanceOf(wallet.address) / 1e18);
        console.log('WMATIC:    ' + await wmatic.balanceOf(wallet.address) / 1e18);
        console.log('USD+:      ' + await usdPlus.balanceOf(wallet.address) / 1e6);
        console.log(`-------------------------------------`)
    }


    async function calcAmountInPool(uniV3Pool, amountToFeed) {
        console.log(`--- Start pool feeding`)
        let {token0, token1, price} = await getPriceUniV3(uniV3Pool);
        console.log(`price: ${price}`)

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        let preToken0Amount;
        let preToken1Amount;
        let priceInPool;
        if (token0.address.toLowerCase() === usdcAddress.toLowerCase()) {
            token0 = usdPlus;
            token0Symbol = "USD+";
            console.log(`token0 replaced by usdPlus`)
            preToken0Amount = amountToFeed / 2;
            preToken1Amount = (amountToFeed / 2) / price;
            priceInPool = preToken0Amount / preToken1Amount;
        }
        if (token1.address.toLowerCase() === usdcAddress.toLowerCase()) {
            token1 = usdPlus;
            token1Symbol = "USD+";
            console.log(`token1 replaced by usdPlus`)
            preToken1Amount = amountToFeed / 2;
            preToken0Amount = (amountToFeed / 2) * price;
            priceInPool = preToken1Amount / preToken0Amount;
        }



        console.log(`preToken0Amount[${token0Symbol}]: ${preToken0Amount}`)
        console.log(`preToken1Amount[${token1Symbol}]: ${preToken1Amount}`)
        console.log(`priceInPool: ${priceInPool}`)


        let token0Amount = BigInt(Math.floor(toEX(preToken0Amount, await token0.decimals())));
        let token1Amount = BigInt(Math.floor(toEX(preToken1Amount, await token1.decimals())));
        console.log(`token0Amount[${token0Symbol}]: ${token0Amount}`)
        console.log(`token1Amount[${token1Symbol}]: ${token1Amount}`)

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
