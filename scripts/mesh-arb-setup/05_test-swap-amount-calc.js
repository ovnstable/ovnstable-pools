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

let meshRouterAddress = "0x10f4A785F458Bc144e3706575924889954946639"
let qsRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

// replace addresses from create script
let meshPoolUsdcUsdPlusAddress = "0x68b7cEd0dBA382a0eC705d6d97608B7bA3CD8C55";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let meshRouter = await ethers.getContractAt(iUniswapV2Router02Abi, meshRouterAddress, wallet);
    let qsRouter = await ethers.getContractAt(iUniswapV2Router02Abi, qsRouterAddress, wallet);

    let meshPoolUsdcUsdPlus = await ethers.getContractAt(iUniswapV2PairAbi, meshPoolUsdcUsdPlusAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);


    // await printUserBalances("before");
    // await evmCheckpoint("default");
    try {
        await printBalancesQsPool(meshPoolUsdcUsdPlus)

        // let amountInUsdPlusToUsdc = toE6(9.995);
        let amountInUsdPlusToUsdc = toE6(10);
        await swap5050(meshPoolUsdcUsdPlus, usdPlus, usdc, amountInUsdPlusToUsdc);

        // let amountInUsdcToUsdPlus = toE6(1000);
        // await swap5050(meshPoolUsdcUsdPlus, usdc, usdPlus, amountInUsdcToUsdPlus);

    } catch (e) {
        console.log(e);
    }
    // await printUserBalances("after");
    // await evmRestore("default");


    async function swap5050(qsPool, tokenIn, tokenOut, amountIn) {

        let reserves = await qsPool.getReserves();
        let amountOut = await meshRouter.getAmountOut(amountIn.toString(), reserves[0].toString(), reserves[1].toString());

        console.log(`reserves[0]:  ${reserves[0]}`)
        console.log(`reserves[1]:  ${reserves[1]}`)
        console.log(`amountIn:     ${amountIn}`)
        console.log(`amountOut:    ${amountOut}`)
        console.log(`amountOut:    ${reserves[1] - amountOut}`)

        let reserveIn = new BN(reserves[0].toString());
        let reserveOut = new BN(reserves[1].toString());
        amountIn = new BN(amountIn.toString());

        let fee = new BN(10);
        let fee100 = new BN(10000);

        let amountInWithFee = amountIn.mul(fee100.sub(fee));
        let nominator = reserveOut.mul(amountInWithFee);
        let denominator = reserveIn.mul(fee100).add(amountInWithFee);

        let res = nominator.div(denominator)
        console.log(`res: ${res}`)


        // estimatePos = (reserveOut * (amountIn * (fee100 - fee))) / (reserveIn * fee100 - (amountIn * (fee100 - fee)));



        let meshPoolGetEst = await ethers.getContractAt([{
            "inputs": [
                {
                    "internalType": "address",
                    "name": "token",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "amountIn",
                    "type": "uint256"
                }
            ],
            "name": "estimatePos",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "amountOut",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },], meshPoolUsdcUsdPlusAddress, wallet);


        let resFromEst = await meshPoolGetEst.estimatePos(usdcAddress, amountIn.toString());

        console.log(`res:        ${res}`)
        console.log(`resFromEst: ${resFromEst}`)


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
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
