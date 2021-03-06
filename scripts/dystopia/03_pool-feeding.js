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

let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;
let IDystopiaRouterAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaRouter.json')).abi;
let iUniswapV3PoolAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV3Pool.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let dystRouterAddress = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"

let uniV3PoolWmaticUsdcAddress = "0xa374094527e1673a86de625aa59517c5de346d32"
let uniV3PoolUsdcWethAddress = "0x45dda9cb7c25131df268515131f647d726f50608"


// replace addresses from create script
let dystPoolWmaticUsdPlusAddress = "0x1A5FEBA5D5846B3b840312Bd04D76ddaa6220170";
let dystPoolUsdPlusWethAddress = "0xCF107443b87d9F9A6dB946D02CB5df5EF5299c95";
let dystPoolUsdcUsdPlusAddress = "0x421a018cC5839c4C0300AfB21C725776dc389B1a";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let dystRouter = await ethers.getContractAt(IDystopiaRouterAbi, dystRouterAddress, wallet);

    let dystPoolWmaticUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolWmaticUsdPlusAddress, wallet);
    let dystPoolUsdPlusWeth = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdPlusWethAddress, wallet);
    let dystPoolUsdcUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdcUsdPlusAddress, wallet);

    let uniV3PoolWmaticUsdc = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolWmaticUsdcAddress, wallet);
    let uniV3PoolUsdcWeth = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolUsdcWethAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);


    await printUserBalances("before");
    // await evmCheckpoint("default");
    try {
        let amountToFeed = 20000;

        await feedPool(uniV3PoolWmaticUsdc, dystPoolWmaticUsdPlus, amountToFeed);
        await feedPool(uniV3PoolUsdcWeth, dystPoolUsdPlusWeth, amountToFeed);
        // await feedPool5050(dystPoolUsdcUsdPlus, amountToFeed);
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

    // for volatile
    async function feedPool(uniV3Pool, qsPool, amountToFeed) {
        console.log(`--- Start pool feeding`)
        let {token0, token1, price} = await getPriceUniV3(uniV3Pool);
        console.log(`price: ${price}`)

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

        console.log(`preToken0Amount: ${preToken0Amount}`)
        console.log(`preToken1Amount: ${preToken1Amount}`)
        console.log(`priceInPool: ${priceInPool}`)


        let token0Amount = BigInt(Math.floor(toEX(preToken0Amount, await token0.decimals())));
        let token1Amount = BigInt(Math.floor(toEX(preToken1Amount, await token1.decimals())));
        console.log(`token0Amount: ${token0Amount}`)
        console.log(`token1Amount: ${token1Amount}`)

        await token0.approve(dystRouter.address, token0Amount.toString())
        console.log(`token0[${await token0.symbol()}] approved`)
        await token1.approve(dystRouter.address, token1Amount.toString())
        console.log(`token1[${await token1.symbol()}] approved`)
        let result = await (await dystRouter.addLiquidity(
            token0.address,
            token1.address,
            false,
            token0Amount.toString(),
            token1Amount.toString(),
            0,
            0,
            wallet.address,
            MAX_UINT256.toString(),
            gasOpts
        )).wait();

        await printBalancesQsPool(qsPool)
    }

    async function feedPool5050(qsPool, amountToFeed) {
        console.log(`--- Start pool feeding`)
        let price = 1;
        console.log(`price: ${price}`)

        let token0Address = await qsPool.token0();
        let token1Address = await qsPool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let preToken0Amount;
        let preToken1Amount;
        let priceInPool;
        if (token0.address.toLowerCase() === usdcAddress.toLowerCase()) {
            console.log(`token0 replaced by usdPlus`)
            preToken0Amount = amountToFeed / 2;
            preToken1Amount = (amountToFeed / 2) / price;
            priceInPool = preToken0Amount / preToken1Amount;
        }
        if (token1.address.toLowerCase() === usdcAddress.toLowerCase()) {
            console.log(`token1 replaced by usdPlus`)
            preToken1Amount = amountToFeed / 2;
            preToken0Amount = (amountToFeed / 2) * price;
            priceInPool = preToken1Amount / preToken0Amount;
        }

        console.log(`preToken0Amount: ${preToken0Amount}`)
        console.log(`preToken1Amount: ${preToken1Amount}`)
        console.log(`priceInPool: ${priceInPool}`)


        let token0Amount = BigInt(Math.floor(toEX(preToken0Amount, await token0.decimals())));
        let token1Amount = BigInt(Math.floor(toEX(preToken1Amount, await token1.decimals())));
        console.log(`token0Amount: ${token0Amount}`)
        console.log(`token1Amount: ${token1Amount}`)

        await token0.approve(dystRouter.address, token0Amount.toString())
        console.log(`token0[${await token0.symbol()}] approved`)
        await token1.approve(dystRouter.address, token1Amount.toString())
        console.log(`token1[${await token1.symbol()}] approved`)
        let result = await (await dystRouter.addLiquidity(
            token0.address,
            token1.address,
            true,
            token0Amount.toString(),
            token1Amount.toString(),
            0,
            0,
            wallet.address,
            MAX_UINT256.toString(),
            gasOpts
        )).wait();

        await printBalancesQsPool(qsPool)
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
