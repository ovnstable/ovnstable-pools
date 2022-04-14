const {fromE18} = require("../utils/decimals");
const hre = require("hardhat");
const fs = require("fs");
const {initWallet} = require("../utils/network");
const ethers = hre.ethers;

let IUniswapV2Router02 = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let Exchange = JSON.parse(fs.readFileSync('./abi/Exchange.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";

async function main() {

    let mainWallet = await initWallet(ethers);
    let hardhatWallet = await initHardhatWallet();

    let usdc = await ethers.getContractAt(ERC20, usdcAddress, mainWallet);
    let usdt = await ethers.getContractAt(ERC20, usdtAddress, mainWallet);
    let dai = await ethers.getContractAt(ERC20, daiAddress, mainWallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, mainWallet);
    let exchange = await ethers.getContractAt(Exchange.abi, Exchange.address, mainWallet);

    console.log('[Balance before]')
    console.log('USDC:   ' + await usdc.balanceOf(mainWallet.address) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(mainWallet.address) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(mainWallet.address) / 1e18);
    console.log('USD+:   ' + await usdPlus.balanceOf(mainWallet.address) / 1e6);

    let router = await ethers.getContractAt(IUniswapV2Router02, "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff", hardhatWallet);

    let path = [];
    path[0] = await router.WETH();
    path[1] = usdcAddress;

    const timestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;

    let needValue = "5000000000000000000000000";

    let amountRet = await router.getAmountsOut(needValue, path );
    await router.swapExactETHForTokens(amountRet[1], path, mainWallet.address, timestamp+10600, {value: needValue});

    path[1] = daiAddress;
    amountRet = await router.getAmountsOut(needValue, path );
    await router.swapExactETHForTokens(amountRet[1], path, mainWallet.address, timestamp+10600, {value: needValue});

    path[1] = usdtAddress;
    amountRet = await router.getAmountsOut(needValue, path);
    await router.swapExactETHForTokens(amountRet[1], path, mainWallet.address, timestamp+10600, {value: needValue});

    // Usd+
    await usdc.approve(exchange.address, "501000000000"); // 501k
    await exchange.buy(usdc.address, "501000000000"); // 501k

    console.log('\n[Balance after]')
    console.log('USDC:   ' + await usdc.balanceOf(mainWallet.address) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(mainWallet.address) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(mainWallet.address) / 1e18);
    console.log('USD+:   ' + await usdPlus.balanceOf(mainWallet.address) / 1e6);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });


async function initHardhatWallet() {

    let provider = ethers.provider;
    console.log('Provider: ' + provider.connection.url);


    // Test PK - DON'T USE IN PRODUCTION
    // Address: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
    let pk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    let wallet = await new ethers.Wallet(pk, provider);
    console.log('Wallet: ' + wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance wallet: ' + fromE18(balance));

    return wallet;
}

