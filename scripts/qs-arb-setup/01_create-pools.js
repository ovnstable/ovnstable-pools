const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {ZERO_ADDRESS} = require("@openzeppelin/test-helpers/src/constants");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let iUniswapV2FactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Factory.json')).abi;
let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let qsFactoryAddress = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
let qsRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);
    let qsFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, qsFactoryAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);

    let qsPoolWmaticUsdPlusAddress = await createPair(qsFactory, wmatic, usdPlus);
    let qsPoolUsdPlusWethAddress = await createPair(qsFactory, usdPlus, weth);
    let qsPoolUsdcUsdPlusAddress = await createPair(qsFactory, usdPlus, usdc);

    console.log(`------------------------------------------------------------------`)
    console.log(`let qsPoolWmaticUsdPlusAddress = "${qsPoolWmaticUsdPlusAddress}";`);
    console.log(`let qsPoolUsdPlusWethAddress = "${qsPoolUsdPlusWethAddress}";`);
    console.log(`let qsPoolUsdcUsdPlusAddress = "${qsPoolUsdcUsdPlusAddress}";`);
    console.log(`------------------------------------------------------------------`)


    async function createPair(factory, tokenA, tokenB) {
        let tokenASymbol = await tokenA.symbol();
        let tokenBSymbol = await tokenB.symbol();

        console.log(`Start creation ${tokenASymbol} / ${tokenBSymbol}`)

        let pairAddress = await factory.getPair(tokenA.address, tokenB.address);
        if (pairAddress !== ZERO_ADDRESS) {
            console.log(`- Already created pool address: ${pairAddress}`);
            return pairAddress;
        }

        let tx = await (await factory.createPair(tokenA.address, tokenB.address, gasOpts)).wait();
        pairAddress = tx.events.find((e) => e.event === 'PairCreated').args[2];

        console.log(`- Newly created pool address: ${pairAddress}`);
        return pairAddress;
    }

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
