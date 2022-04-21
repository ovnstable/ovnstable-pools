const {fromE18} = require("../../utils/decimals");
const hre = require("hardhat");
const fs = require("fs");
const {initWallet} = require("../../utils/network");
const ethers = hre.ethers;

let IUniswapV2Router02 = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let Exchange = JSON.parse(fs.readFileSync('./abi/Exchange.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let iWETHAbi = JSON.parse(fs.readFileSync('./abi/build/IWETH.json')).abi;

let qsRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

async function main() {

    let wallet = await initWallet(ethers);

    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);
    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);
    let wmaticAsWeth = await ethers.getContractAt(iWETHAbi, wmaticAddress, wallet);

    let exchange = await ethers.getContractAt(Exchange.abi, Exchange.address, wallet);


    console.log('[Balance before]')
    console.log('WETH:   ' + await weth.balanceOf(wallet.address) / 1e18);
    console.log('WMATIC: ' + await wmatic.balanceOf(wallet.address) / 1e18);
    console.log('USDC:   ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('USD+:   ' + await usdPlus.balanceOf(wallet.address) / 1e6);

    let router = await ethers.getContractAt(IUniswapV2Router02, qsRouterAddress, wallet);

    const timestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;

    let path = [];
    path[0] = await router.WETH();
    console.log(`WETH address: ${path[0]}`);

    // usdc
    path[1] = usdcAddress;

    let needValue = "5000000000000000000000000"; // 500k

    let amountRet = await router.getAmountsOut(needValue, path);
    await router.swapExactETHForTokens(amountRet[1], path, wallet.address, timestamp + 10600, {value: needValue});

    // weth
    path[1] = weth.address;
    amountRet = await router.getAmountsOut(needValue, path);
    await router.swapExactETHForTokens(amountRet[1], path, wallet.address, timestamp + 10600, {value: needValue});

    // wmatic
    await wmaticAsWeth.deposit({value: needValue});

    // Usd+
    await usdc.approve(exchange.address, "201000000000"); // 201k
    await exchange.buy(usdc.address, "201000000000"); // 201k

    console.log('\n[Balance after]')
    console.log('WETH:   ' + await weth.balanceOf(wallet.address) / 1e18);
    console.log('WMATIC: ' + await wmatic.balanceOf(wallet.address) / 1e18);
    console.log('USDC:   ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('USD+:   ' + await usdPlus.balanceOf(wallet.address) / 1e6);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
