const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../utils/network");

let Pool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let USDPlus = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let poolAddress = "0x6933ec1CA55C06a894107860c92aCdFd2Dd8512f";

async function main() {


    let wallet = await initWallet(ethers);
    let usdPlus = await ethers.getContractAt(USDPlus.abi, USDPlus.address, wallet);
    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);
    let usdc = await ethers.getContractAt(ERC20, "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    console.log('1: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('1: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('1: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);


    let amountToUsdPlus = 400000;
    let amountToUsdPlusScaled = new BN(10).pow(new BN(6)).muln(amountToUsdPlus).toString();
    let convertedAmount = staticUsdPlus.staticToDynamicAmount(amountToUsdPlusScaled);
    await (await usdPlus.approve(staticUsdPlus.address, convertedAmount, {
        maxFeePerGas: "250000000000",
        maxPriorityFeePerGas: "250000000000"
    })).wait();
    await (await staticUsdPlus.deposit(convertedAmount, wallet.address, {
        maxFeePerGas: "250000000000",
        maxPriorityFeePerGas: "250000000000"
    })).wait();

    console.log('2: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('2: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('2: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);

    let amountUsdcToLp = 30000;
    let amountUsdcToLpScaled = new BN(10).pow(new BN(6)).muln(amountUsdcToLp).toString();
    let amountStUsdPlusToLp = 400000;
    let amountStUsdPlusToLpScaled = new BN(10).pow(new BN(6)).muln(amountStUsdPlusToLp).toString();

    let pool = await ethers.getContractAt(Pool, poolAddress, wallet);

    let targets = await pool.getTargets();
    let balances = await vault.getPoolTokens(await pool.getPoolId());

    console.log(`2: Targets: lower: ${targets[0].toString()} upper: ${targets[1].toString()}`);
    console.log(`2: Balances: ${balances[0].toString()} : ${balances[1].toString()}`);
    await (await usdc.approve(vault.address, amountUsdcToLpScaled, {
        maxFeePerGas: "250000000000",
        maxPriorityFeePerGas: "250000000000"
    })).wait();

    await (await vault.swap(
        {
            poolId: await pool.getPoolId(),
            kind: 0,
            assetIn: usdc.address,
            assetOut: poolAddress,
            amount: amountUsdcToLpScaled,
            userData: "0x",
        },
        {
            sender: wallet.address,
            fromInternalBalance: false,
            recipient: wallet.address,
            toInternalBalance: false,
        },
        0,
        1000000000000,
        {maxFeePerGas: "250000000000", maxPriorityFeePerGas: "250000000000"}
    )).wait();

    console.log('3: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('3: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('3: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
    console.log('3: Balance Pool LP: ' + await pool.balanceOf(wallet.address) / 1e18);

    targets = await pool.getTargets();
    balances = await vault.getPoolTokens(await pool.getPoolId());

    console.log(`3: Targets: lower: ${targets[0].toString()} upper: ${targets[1].toString()}`);
    console.log(`3: Balances: ${balances[0].toString()} : ${balances[1].toString()}`);


    await (await staticUsdPlus.approve(vault.address, amountStUsdPlusToLpScaled, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })
    ).wait();
    await (await vault.swap(
        {
            poolId: await pool.getPoolId(),
            kind: 0,
            assetIn: staticUsdPlus.address,
            assetOut: poolAddress,
            amount: amountStUsdPlusToLpScaled,
            userData: "0x",
        },
        {
            sender: wallet.address,
            fromInternalBalance: false,
            recipient: wallet.address,
            toInternalBalance: false,
        },
        0,
        1000000000000,
        {maxFeePerGas: "250000000000", maxPriorityFeePerGas: "250000000000"}
    )).wait();


    console.log('4: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('4: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('4: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
    console.log('4: Balance Pool LP: ' + await pool.balanceOf(wallet.address) / 1e18);

    targets = await pool.getTargets();
    balances = await vault.getPoolTokens(await pool.getPoolId());

    console.log(`4: Targets: lower: ${targets[0].toString()} upper: ${targets[1].toString()}`);
    console.log(`4: Balances: ${balances[0].toString()} : ${balances[1].toString()}`);


}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

