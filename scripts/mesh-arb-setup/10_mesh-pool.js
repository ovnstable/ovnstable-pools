const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const univ3prices = require('@thanpolas/univ3prices')


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let iUniswapV2FactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Factory.json')).abi;
let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;
let iUniswapV3PoolAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV3Pool.json')).abi;
let iUniswapV2Router02Abi = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));

let meshFactoryAddress = "0x9F3044f7F9FC8bC9eD615d54845b4577B833282d";
let meshRouterAddress = "0x10f4A785F458Bc144e3706575924889954946639"


async function main() {

    let wallet = await initWallet(ethers);

    let meshRouter = await ethers.getContractAt(iUniswapV2Router02Abi, meshRouterAddress, wallet);
    let meshFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, meshFactoryAddress, wallet);

    console.log(`meshFactoryAddress: ${await meshRouter.factory()}`)


    let tokenA = "0x957da9EbbCdC97DC4a8C274dD762EC2aB665E15F";
    let tokenB = "0x8Ece0a50A025A7E13398212a5BEd2ded11959949";

    let somePoolAddress = await meshFactory.getPair(tokenA, tokenB);
    console.log(`somePool address: ${somePoolAddress}`);


    tokenA = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
    tokenB = "0x236eeC6359fb44CCe8f97E99387aa7F8cd5cdE1f";

    let usdPlusPool = await meshFactory.getPair(tokenA, tokenB);
    console.log(`let meshPoolUsdcUsdPlusAddress = "${usdPlusPool}";`);


    let somePool = await ethers.getContractAt([
        {
            "constant": true,
            "inputs": [],
            "name": "name",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "payable": false,
            "stateMutability": "pure",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "symbol",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "payable": false,
            "stateMutability": "pure",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "fee",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "payable": false,
            "stateMutability": "pure",
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [],
            "name": "sync",
            "outputs": [],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        },
    ], somePoolAddress, wallet);

    console.log(`somePool name: ${await somePool.name()}`);
    console.log(`somePool symbol: ${await somePool.symbol()}`);
    console.log(`somePool fee: ${await somePool.fee()}`);


    await somePool.sync();




    // let meshFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, meshFactoryAddress, wallet);
    // let meshFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, meshFactoryAddress, wallet);


    // let qsPoolWmaticUsdc = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolWmaticUsdcAddress, wallet);
    // let qsPoolUsdcWeth = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolUsdcWethAddress, wallet);
    //
    // let qsPoolWmaticUsdPlus = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolWmaticUsdPlusAddress, wallet);
    // let qsPoolUsdPlusWeth = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolUsdPlusWethAddress, wallet);
    //
    //
    // await printBalancesQsPool(qsPoolWmaticUsdc);
    // await printBalancesQsPool(qsPoolUsdcWeth);
    //
    // await printBalancesQsPool(qsPoolWmaticUsdPlus);
    // await printBalancesQsPool(qsPoolUsdPlusWeth);


    async function printBalancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        let balances0 = await token0.balanceOf(pool.address);
        let balances1 = await token1.balanceOf(pool.address);


        console.log(`-- balances for QS pool of ${token0Symbol}/${token1Symbol}`)
        console.log(`token0[${token0Symbol}]: ${reserves[0]} | ${balances0}`)
        console.log(`token1[${token1Symbol}]: ${reserves[1]} | ${balances1}`)
        console.log(`-------------------------------------`)
    }

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
