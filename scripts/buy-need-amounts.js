const {fromE18, toUSDC, toOvn, toE18} = require("../utils/decimals");
const hre = require("hardhat");
const fs = require("fs");
const BN = require("bn.js");
const ethers = hre.ethers;

let IUniswapV2Router02 = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));
let IAavePool = JSON.parse(fs.readFileSync('./abi/IAavePool.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let Exchange = JSON.parse(fs.readFileSync('./abi/Exchange.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let amUsdtAddress = "0x60d55f02a771d515e077c9c2403a1ef324885cec";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let amDaiAddress = "0x27F8D03b3a2196956ED754baDc28D73be8830A6e";
let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";

async function main() {

    let mainWallet = await initWallet();
    let hardhatWallet = await initHardhatWallet();

    let usdc = await ethers.getContractAt(ERC20, usdcAddress, mainWallet);
    let usdt = await ethers.getContractAt(ERC20, usdtAddress, mainWallet);
    let amUsdt = await ethers.getContractAt(ERC20, amUsdtAddress, mainWallet);
    let dai = await ethers.getContractAt(ERC20, daiAddress, mainWallet);
    let amDai = await ethers.getContractAt(ERC20, amDaiAddress, mainWallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, mainWallet);
    let exchange = await ethers.getContractAt(Exchange.abi, Exchange.address, mainWallet);
    let aavePool = await ethers.getContractAt(IAavePool, "0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf", mainWallet);

    console.log('[Balance before]')
    console.log('USDC:   ' + await usdc.balanceOf(mainWallet.address) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(mainWallet.address) / 1e6);
    console.log('amUSDT:   ' + await amUsdt.balanceOf(mainWallet.address) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(mainWallet.address) / 1e18);
    console.log('amDAI:    ' + await amDai.balanceOf(mainWallet.address) / 1e18);
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


    await usdt.approve(aavePool.address, toUSDC(50000));
    await aavePool.deposit(usdt.address, toUSDC(50000), mainWallet.address, 0);


    let amDaiValue = new BN(10).pow(new BN(18)).muln(50000);
    await dai.approve(aavePool.address, amDaiValue.toString());
    await aavePool.deposit(dai.address, amDaiValue.toString(), mainWallet.address, 0);

    // Usd+
    await usdc.approve(exchange.address, "501000000000"); // 501k
    await exchange.buy(usdc.address, "501000000000"); // 501k

    console.log('\n[Balance after]')
    console.log('USDC:   ' + await usdc.balanceOf(mainWallet.address) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(mainWallet.address) / 1e6);
    console.log('amUSDT:   ' + await amUsdt.balanceOf(mainWallet.address) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(mainWallet.address) / 1e18);
    console.log('amDAI:    ' + await amDai.balanceOf(mainWallet.address) / 1e18);
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

async function initWallet() {

    let provider = ethers.provider;
    console.log('Provider: ' + provider.connection.url);

    let wallet = await new ethers.Wallet(process.env.PK_POLYGON, provider);
    console.log('Wallet: ' + wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance wallet: ' + fromE18(balance));

    return wallet;
}
