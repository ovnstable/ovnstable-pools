const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";


// replace addresses from create script
let dystPoolWmaticUsdPlusAddress = "0x1A5FEBA5D5846B3b840312Bd04D76ddaa6220170";
let dystPoolUsdPlusWethAddress = "0xCF107443b87d9F9A6dB946D02CB5df5EF5299c95";
let dystPoolUsdcUsdPlusAddress = "0x421a018cC5839c4C0300AfB21C725776dc389B1a";


async function main() {

    let wallet = await initWallet(ethers);

    let dystPoolWmaticUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolWmaticUsdPlusAddress, wallet);
    let dystPoolUsdPlusWeth = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdPlusWethAddress, wallet);
    let dystPoolUsdcUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdcUsdPlusAddress, wallet);


    await printBalancesQsPool(dystPoolWmaticUsdPlus);
    await printBalancesQsPool(dystPoolUsdPlusWeth);
    await printBalancesQsPool(dystPoolUsdcUsdPlus);


    async function printBalancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);
        console.log(`token0: ${token0Address}`);
        console.log(`token1: ${token1Address}`);

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

        let stable = await pool.stable();

        console.log(`-- balances for QS pool of ${token0Symbol}/${token1Symbol} [${stable ? "stable" : "unstable"}]`)
        console.log(`token0[${token0Symbol}]: ${reserve0Normalized}`)
        console.log(`token0[${token0Symbol}]: ${balances0Normalized}`)
        console.log(`token1[${token1Symbol}]: ${reserve1Normalized}`)
        console.log(`token1[${token1Symbol}]: ${balances1Normalized}`)
        console.log(`price0Per1: ${price0Per1}`);
        console.log(`price1Per0: ${price1Per0}`);
        // console.log(`fee: ${await pool.fee()}`);
        console.log(`-------------------------------------`)
    }

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
