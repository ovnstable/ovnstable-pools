const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../utils/network");

let StaticATokenLM = JSON.parse(fs.readFileSync('./abi/StaticATokenLM.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/AaveLinearPool.json'));


// - Deployed Static Wrapper for amUSDT
// - Proxy:  0x548571A302D354B190AE6E9107552aB4F7FD9DC5
// - Impl :  0x291fDbAe94960C6bda7A481de0bCAdE03Cab1461

// - Deployed Static Wrapper for amDAI
// - Proxy:  0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab
// - Impl :  0x692AeF68A9c106FE470D69Ec0B28ef5b563B65a2


let poolUSDT = "0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f";
let poolDAI = "0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E"

let staticAmDAIAddress = "0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab";
let staticAmUSDTAddress = "0x548571A302D354B190AE6E9107552aB4F7FD9DC5";

let DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

let BalanceFactoryAave = "0xf302f9F50958c5593770FDf4d4812309fF77414f";
let owner = "0xe497285e466227f4e8648209e34b465daa1f90a0";

async function main() {

    let wallet = await initWallet(ethers);

    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);
    let poolUsdt = await ethers.getContractAt(Pool, poolUSDT, wallet);
    let poolDai = await ethers.getContractAt(Pool, poolDAI, wallet);


    let staticAmUSDT = await ethers.getContractAt(StaticATokenLM.abi, staticAmUSDTAddress, wallet);
    let usdt = await ethers.getContractAt(ERC20, USDT, wallet);

    let staticAmDAI = await ethers.getContractAt(StaticATokenLM.abi, staticAmDAIAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, DAI, wallet);

    await putDAI();
    await putUSDT();

    async function putDAI() {

        console.log('1: Balance DAI: ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('1: Balance StaticDAI: ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);
        console.log('1: Balance LP DAI: ' + await poolDai.balanceOf(wallet.address) / 1e18);

        let amount = new BN(10).pow(new BN(18)).muln(2).toString();
        let convertedAmount = await staticAmDAI.staticToDynamicAmount(amount);
        await (await dai.approve(staticAmDAI.address, convertedAmount, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();

        await (await staticAmDAI.deposit(wallet.address, convertedAmount, 0, true, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();


        await swap(dai, poolDai, amount, await poolDai.getPoolId())

        console.log('2: Balance DAI: ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('2: Balance StaticDAI: ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);
        console.log('2: Balance LP DAI: ' + await poolDai.balanceOf(wallet.address) / 1e18);

        await swap(staticAmDAI, poolDai, await staticAmDAI.balanceOf(wallet.address), await poolDai.getPoolId())

        console.log('3: Balance DAI: ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('3: Balance StaticDAI: ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);
        console.log('3: Balance LP DAI: ' + await poolDai.balanceOf(wallet.address) / 1e18);
    }

    async function putUSDT() {

        console.log('1: Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('1: Balance StaticUSDT: ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
        console.log('1: Balance LP USDT: ' + await poolUsdt.balanceOf(wallet.address) / 1e18);

        let amount = new BN(10).pow(new BN(6)).muln(2).toString();
        let convertedAmount = await staticAmUSDT.staticToDynamicAmount(amount);
        await (await usdt.approve(staticAmUSDT.address, convertedAmount, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();

        await (await staticAmUSDT.deposit(wallet.address, convertedAmount, 0, true, {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();


        await swap(usdt, poolUsdt, amount, await poolUsdt.getPoolId())

        console.log('2: Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('2: Balance StaticUSDT: ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
        console.log('2: Balance LP USDT: ' + await poolUsdt.balanceOf(wallet.address) / 1e18);

        await swap(staticAmUSDT, poolUsdt, await staticAmUSDT.balanceOf(wallet.address), await poolUsdt.getPoolId())

        console.log('3: Balance USDT: ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance StaticUSDT: ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
        console.log('3: Balance LP USDT: ' + await poolUsdt.balanceOf(wallet.address) / 1e18);
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
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
