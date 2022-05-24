const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {ZERO_ADDRESS} = require("@openzeppelin/test-helpers/src/constants");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let IDystopiaFactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaFactory.json')).abi;
let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let dystRouterAddress = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"
let dystFactoryAddress = "0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9"

let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);
    let qsFactory = await ethers.getContractAt(IDystopiaFactoryAbi, dystFactoryAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);

    let dystPoolWmaticUsdPlusAddress = await createPair(qsFactory, wmatic, usdPlus, false);
    let dystPoolUsdPlusWethAddress = await createPair(qsFactory, usdPlus, weth, false);
    let dystPoolUsdcUsdPlusAddress = await createPair(qsFactory, usdPlus, usdc, true);

    console.log(`------------------------------------------------------------------`)
    console.log(`let dystPoolWmaticUsdPlusAddress = "${dystPoolWmaticUsdPlusAddress}";`);
    console.log(`let dystPoolUsdPlusWethAddress = "${dystPoolUsdPlusWethAddress}";`);
    console.log(`let dystPoolUsdcUsdPlusAddress = "${dystPoolUsdcUsdPlusAddress}";`);
    console.log(`------------------------------------------------------------------`)


    async function createPair(factory, tokenA, tokenB, stable) {
        let tokenASymbol = await tokenA.symbol();
        let tokenBSymbol = await tokenB.symbol();

        console.log(`Start creation ${tokenASymbol} / ${tokenBSymbol} [${stable ? "stable" : "unstable"}]`)

        let pairAddress = await factory.getPair(tokenA.address, tokenB.address, stable);
        if (pairAddress !== ZERO_ADDRESS) {
            console.log(`- Already created pool address: ${pairAddress}`);
            return pairAddress;
        }

        let tx = await (await factory.createPair(tokenA.address, tokenB.address, stable, gasOpts)).wait();
        console.log(JSON.stringify(tx.events, null, 2));
        pairAddress = tx.events.find((e) => e.event === 'PairCreated').args[3];

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
