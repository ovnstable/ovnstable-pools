const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');

let BalancerFactory = JSON.parse(fs.readFileSync('./abi/StablePhantomPoolFactory.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));
let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));

let USDPlus = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let BalancerFactoryAddress = "0xC128a9954e6c874eA3d62ce62B468bA073093F25";
let owner = "0xe497285e466227f4e8648209e34b465daa1f90a0";

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let lpUsdPlusAddress = "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425";

async function main() {

    let wallet = await initWallet();
    let poolAddress = createStablePool(wallet);
    // let poolAddress = "0xE051605A83dEAe38d26a7346B100EF1AC2ef8a0b";
    await tests(poolAddress, wallet);


}

async function createStablePool(wallet) {

    let factory = await ethers.getContractAt(BalancerFactory, BalancerFactoryAddress, wallet);


    let tokens = [usdtAddress, daiAddress, lpUsdPlusAddress];
    tokens.sort((tokenA, tokenB) => (tokenA.toLowerCase() > tokenB.toLowerCase() ? 1 : -1));

    let rateProviders = [lpUsdPlusAddress, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"];

    let tokenRateCacheDurations = [1800, 0, 0];

    console.log(tokens);
    console.log(rateProviders);
    console.log(tokenRateCacheDurations);

    await addLiquidityLinearPool(wallet);

    let amplificationParameter = "570";
    let swapFee = "100000000000000"; // 0.01%

    let promise = await factory.create(
        'Balancer USD+ Boosted StablePool',
        'bb-USD+',
        tokens,
        amplificationParameter.toString(),
        rateProviders,
        tokenRateCacheDurations,
        swapFee,
        owner);


    let tx = await promise.wait();
    const poolAddress = tx.events.find((e) => e.event == 'PoolCreated').args[0];
    console.log('Pool address: ' + poolAddress)

    return poolAddress;
}

async function tests(stablePoolAddress, wallet) {

    let stablePool = await ethers.getContractAt(Pool, stablePoolAddress, wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    await showBalances(vault, stablePool);

    await addLinearPool(wallet);
    // await addUSDT(wallet);
    await showBalances(vault, stablePool);


    async function addLinearPool(wallet) {

        let lpUsdPlus = await ethers.getContractAt(ERC20, lpUsdPlusAddress, wallet);

        let value = new BN(1).pow(new BN(18)).toString();
        console.log('Balance LP USD+: ' + await lpUsdPlus.balanceOf(wallet.address) / 1e18);

        await lpUsdPlus.approve(vault.address, value);
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: lpUsdPlus.address,
                assetOut: stablePoolAddress,
                amount: value,
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );

        console.log('Balance  LP USD+: ' + await lpUsdPlus.balanceOf(wallet.address) / 1e18);

    }

    async function addUSDT(wallet) {


        let usdt = await ethers.getContractAt(ERC20, usdtAddress, wallet);

        console.log('Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);

        await usdt.approve(vault.address, 5 * 1e6);
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: usdt.address,
                assetOut: stablePoolAddress,
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
            1000000000000
        );

        console.log('Balance USDT: ' + await usdt.balanceOf(wallet.address));

    }
}


async function addLiquidityLinearPool(wallet) {
    console.log('Add liquidity to LinearPool');

    let usdPlus = await ethers.getContractAt(USDPlus.abi, USDPlus.address, wallet);
    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);
    let usdc = await ethers.getContractAt(ERC20, "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet)

    let pool = await ethers.getContractAt(LinearPool, lpUsdPlusAddress, wallet);
    await usdPlus.approve(staticUsdPlus.address, 10 * 1e6);
    await staticUsdPlus.deposit(10 * 1e6, wallet.address);

    await usdc.approve(vault.address, 5 * 1e6);
    await vault.swap(
        {
            poolId: await pool.getPoolId(),
            kind: 0,
            assetIn: usdc.address,
            assetOut: lpUsdPlusAddress,
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
        1000000000000
    );

    await staticUsdPlus.approve(vault.address, 5 * 1e6);
    await vault.swap(
        {
            poolId: await pool.getPoolId(),
            kind: 0,
            assetIn: staticUsdPlus.address,
            assetOut: lpUsdPlusAddress,
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
        1000000000000
    );


    console.log('Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
    console.log('Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
    console.log('Balance LinearPool LP: ' + await pool.balanceOf(wallet.address) / 1e6);


    await showBalancesLinear(vault, pool);

}


async function showBalancesLinear(vault, pool, wallet) {
    const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());

    console.log('Balance Linear Pool:')

    console.log(`- LP:${balances[0]}`);
    console.log(`- USDC:${balances[1]}`);


}

async function showBalances(vault, pool) {
    const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());

    console.log('Balance Stable Pool:')

    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        let balance = balances[i];

        let name = "";
        switch (token.toLowerCase()) {
            case "0x2791bca1f2de4661ed88a30c99a7a9449aa84174".toLowerCase():
                name = "USDC";
                break
            case "0xc2132d05d31c914a87c6611c10748aeb04b58e8f".toLowerCase():
                name = "USDT";
                break
            case "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063".toLowerCase():
                name = "DAI ";
                break
            case "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425".toLowerCase():
                name = "USD+"
                break
            default:
                name = "LP  ";
                break

        }

        console.log(`- ${name}:${balance}`);
    }

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

async function initWallet() {

    let provider = ethers.provider;
    console.log('Provider: ' + provider.connection.url);
    let wallet = await new ethers.Wallet(process.env.PK_POLYGON, provider);
    console.log('Wallet: ' + wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance: ' + balance / 1e18);

    return wallet;
}
