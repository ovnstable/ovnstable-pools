const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {strPoint, str} = require("../balancer-stable-pool-test-commons");

let StaticATokenLM = JSON.parse(fs.readFileSync('./abi/StaticATokenLM.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/AaveLinearPool.json'));

let USDPlus = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));


// replace addresses from deploy script
let linearPoolAUsdtAddress = "0xa94A92fC2cA0601481d5DE357489ceaEBa1C1Dc6";
let linearPoolADaiAddress = "0xBEa652AA29D38114e9D36F2A2E4167b13DF68e73"
let linearPoolUsdPlusAddress = "0x84e80625B6131DC07232Af9d148e691FBCE29Ac2";



// - Deployed Static Wrapper for amUSDT
// - Proxy:  0x548571A302D354B190AE6E9107552aB4F7FD9DC5
// - Impl :  0x291fDbAe94960C6bda7A481de0bCAdE03Cab1461

// - Deployed Static Wrapper for amDAI
// - Proxy:  0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab
// - Impl :  0x692AeF68A9c106FE470D69Ec0B28ef5b563B65a2
let staticAmDAIAddress = "0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab";
let staticAmUSDTAddress = "0x548571A302D354B190AE6E9107552aB4F7FD9DC5";

let DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";



async function main() {

    let wallet = await initWallet(ethers);

    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);
    let poolUsdt = await ethers.getContractAt(Pool, linearPoolAUsdtAddress, wallet);
    let poolDai = await ethers.getContractAt(Pool, linearPoolADaiAddress, wallet);
    let poolUsdPlus = await ethers.getContractAt(Pool, linearPoolUsdPlusAddress, wallet);

    let usdc = await ethers.getContractAt(ERC20, USDC, wallet);
    let usdPlus = await ethers.getContractAt(USDPlus.abi, USDPlus.address, wallet);
    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);

    let staticAmUSDT = await ethers.getContractAt(StaticATokenLM.abi, staticAmUSDTAddress, wallet);
    let usdt = await ethers.getContractAt(ERC20, USDT, wallet);

    let staticAmDAI = await ethers.getContractAt(StaticATokenLM.abi, staticAmDAIAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, DAI, wallet);

    let amountInDai = 50000;
    let amountInUsdt = 50000;
    let amountInUsdc = 50000;
    let amountToUsdPlus = 50000;

    await printBalances(vault, poolUsdt)
    await printBalances(vault, poolDai)
    await printBalances(vault, poolUsdPlus)

    await putDAI();
    await putUSDT();
    await putUsdPlus();

    await printBalances(vault, poolUsdt)
    await printBalances(vault, poolDai)
    await printBalances(vault, poolUsdPlus)


    async function putDAI() {
        let poolId = await poolDai.getPoolId();

        console.log('1: Balance DAI: ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('1: Balance StaticDAI: ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);
        console.log('1: Balance LP DAI: ' + await poolDai.balanceOf(wallet.address) / 1e18);

        let amount = new BN(10).pow(new BN(18)).muln(amountInDai).toString();
        let convertedAmount = await staticAmDAI.staticToDynamicAmount(amount);
        await (await dai.approve(staticAmDAI.address, convertedAmount, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();

        await (await staticAmDAI.deposit(wallet.address, convertedAmount, 0, true, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();


        await swap(dai, poolDai, amount, poolId)

        console.log('2: Balance DAI: ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('2: Balance StaticDAI: ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);
        console.log('2: Balance LP DAI: ' + await poolDai.balanceOf(wallet.address) / 1e18);

        await swap(staticAmDAI, poolDai, await staticAmDAI.balanceOf(wallet.address), poolId)

        console.log('3: Balance DAI: ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('3: Balance StaticDAI: ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);
        console.log('3: Balance LP DAI: ' + await poolDai.balanceOf(wallet.address) / 1e18);
    }

    async function putUSDT() {
        let poolId = await poolUsdt.getPoolId();

        console.log('1: Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('1: Balance StaticUSDT: ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
        console.log('1: Balance LP USDT: ' + await poolUsdt.balanceOf(wallet.address) / 1e18);

        let amount = new BN(10).pow(new BN(6)).muln(amountInUsdt).toString();
        let convertedAmount = await staticAmUSDT.staticToDynamicAmount(amount);
        await (await usdt.approve(staticAmUSDT.address, convertedAmount, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();

        await (await staticAmUSDT.deposit(wallet.address, convertedAmount, 0, true, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();


        await swap(usdt, poolUsdt, amount, poolId)

        console.log('2: Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('2: Balance StaticUSDT: ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
        console.log('2: Balance LP USDT: ' + await poolUsdt.balanceOf(wallet.address) / 1e18);

        await swap(staticAmUSDT, poolUsdt, await staticAmUSDT.balanceOf(wallet.address), poolId)

        console.log('3: Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance StaticUSDT: ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance LP USDT: ' + await poolUsdt.balanceOf(wallet.address) / 1e18);
    }

    async function putUsdPlus() {
        let poolId = await poolUsdPlus.getPoolId();

        console.log('1: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
        console.log('1: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
        console.log('1: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);

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

        let amountUsdcToLpScaled = new BN(10).pow(new BN(6)).muln(amountInUsdc).toString();
        let amountStUsdPlusToLpScaled = new BN(10).pow(new BN(6)).muln(amountToUsdPlus).toString();

        await swap(usdc, poolUsdPlus, amountUsdcToLpScaled, poolId)

        console.log('3: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance Pool LP: ' + await poolUsdPlus.balanceOf(wallet.address) / 1e18);

        await swap(staticUsdPlus, poolUsdPlus, amountStUsdPlusToLpScaled, poolId)


        console.log('4: Balance USD+: ' + await usdPlus.balanceOf(wallet.address) / 1e6);
        console.log('4: Balance USDC: ' + await usdc.balanceOf(wallet.address) / 1e6);
        console.log('4: Balance StaticUSD+: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
        console.log('4: Balance Pool LP: ' + await poolUsdPlus.balanceOf(wallet.address) / 1e18);

    }

    async function swap(tokenIn, tokenOut, amount, poolId) {

        await (await tokenIn.approve(vault.address, amount, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();

        await (await vault.swap(
            {
                poolId: poolId,
                kind: 0,
                assetIn: tokenIn.address,
                assetOut: tokenOut.address,
                amount: amount,
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
    }

    async function printBalances(vault, pool) {
        console.log(`-- balances: ${pool.address}`)
        const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());
        let map = {};
        for (let i = 0; i < balances.length; i++) {
            let tokenAddress = tokens[i].toLowerCase();
            if (tokenAddress === pool.address.toLowerCase()) {
                continue;
            }
            let token = await ethers.getContractAt(ERC20, tokenAddress, wallet);
            let decimals = await token.decimals();
            map[tokenAddress] = strPoint(balances[i], str(decimals));
            console.log(`${tokenAddress}: ${map[tokenAddress]}`)
        }
        let decimals = await pool.decimals();
        map[pool.address.toLowerCase()] = strPoint(await pool.getVirtualSupply(), str(decimals));
        console.log(`${pool.address.toLowerCase()}: ${map[pool.address.toLowerCase()]}`)
        console.log(`--------------`)
    }

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
