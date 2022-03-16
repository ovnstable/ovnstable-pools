const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');

let Pool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let USDPlus = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let poolAddress = "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425";

async function main() {


    let wallet = await initWallet();
    let usdPlus = await ethers.getContractAt(USDPlus.abi, USDPlus.address, wallet);
    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);
    let usdc = await ethers.getContractAt(ERC20, "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    console.log('1: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('1: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('1: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);


    await (await usdPlus.approve(staticUsdPlus.address, 10*1e6, { maxFeePerGas: "250000000000", maxPriorityFeePerGas: "250000000000" }
    )).wait();
    await (await staticUsdPlus.deposit(10 * 1e6, wallet.address,{ maxFeePerGas: "250000000000", maxPriorityFeePerGas: "250000000000" }
    )).wait();

    console.log('2: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('2: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('2: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);


    let pool = await ethers.getContractAt(Pool, poolAddress, wallet);

    let targets = await pool.getTargets();
    let balances = await vault.getPoolTokens(await pool.getPoolId());

    console.log(`2: Targets: lower: ${targets[0].toString()} upper: ${targets[1].toString()}`);
    console.log(`2: Balances: ${balances[0].toString()} : ${balances[1].toString()}`);
    await (await usdc.approve(vault.address, 5 * 1e6, {
        maxFeePerGas: "250000000000",
        maxPriorityFeePerGas: "250000000000"
    })).wait();

    await (await vault.swap(
        {
            poolId: await pool.getPoolId(),
            kind: 0,
            assetIn: usdc.address,
            assetOut: poolAddress,
            amount: 5 * 1e6,
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
    console.log('3: Balance Pool LP: ' + await pool.balanceOf(wallet.address) / 1e6);

    targets = await pool.getTargets();
    balances = await vault.getPoolTokens(await pool.getPoolId());

    console.log(`3: Targets: lower: ${targets[0].toString()} upper: ${targets[1].toString()}`);
    console.log(`3: Balances: ${balances[0].toString()} : ${balances[1].toString()}`);


    await (await staticUsdPlus.approve(vault.address, 5 * 1e6, {
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
            amount: 5 * 1e6,
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
    console.log('4: Balance Pool LP: ' + await pool.balanceOf(wallet.address) / 1e6);

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

async function initWallet() {

    // let provider = new ethers.providers.JsonRpcProvider(process.env.ETH_NODE_URI_POLYGON);
    let provider = ethers.provider;
    console.log('Provider: ' + provider.connection.url);
    let wallet = await new ethers.Wallet(process.env.PK_POLYGON, provider);
    console.log('Wallet: ' + wallet.address);
    const balance = await provider.getBalance(wallet.address);

    return wallet;
}
