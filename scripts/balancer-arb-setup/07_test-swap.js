const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {strPoint, str, toE18} = require("../balancer-stable-pool-test-commons");
const {toE6} = require("../../utils/decimals");

let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let StaticATokenLM = JSON.parse(fs.readFileSync('./abi/StaticATokenLM.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));


// replace addresses from deploy script
let linearPoolAUsdtAddress = "0xa94A92fC2cA0601481d5DE357489ceaEBa1C1Dc6";
let linearPoolADaiAddress = "0xBEa652AA29D38114e9D36F2A2E4167b13DF68e73"
let linearPoolUsdPlusAddress = "0x84e80625B6131DC07232Af9d148e691FBCE29Ac2";


let staticAmDAIAddress = "0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab";
let staticAmUSDTAddress = "0x548571A302D354B190AE6E9107552aB4F7FD9DC5";

let DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";

let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let staticUsdPlus = await ethers.getContractAt(StaticUsdPlus.abi, StaticUsdPlus.address, wallet);
    let usdc = await ethers.getContractAt(ERC20, USDC, wallet);

    let staticAmUSDT = await ethers.getContractAt(StaticATokenLM.abi, staticAmUSDTAddress, wallet);
    let usdt = await ethers.getContractAt(ERC20, USDT, wallet);

    let staticAmDAI = await ethers.getContractAt(StaticATokenLM.abi, staticAmDAIAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, DAI, wallet);

    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    let linearPoolUsdPlus = await ethers.getContractAt(LinearPool, linearPoolUsdPlusAddress, wallet);
    let linearPoolADai = await ethers.getContractAt(LinearPool, linearPoolADaiAddress, wallet);
    let linearPoolAUsdt = await ethers.getContractAt(LinearPool, linearPoolAUsdtAddress, wallet);


    console.log('[Balance before on user]')
    console.log('USDC:      ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('USDT:      ' + await usdt.balanceOf(wallet.address) / 1e6);
    console.log('DAI:       ' + await dai.balanceOf(wallet.address) / 1e18);
    console.log('stUSDPlus: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
    console.log('stUSDT:    ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
    console.log('stDAI:     ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);


    // let usdPlusAmount = toE6(2000);
    // await printBalances(vault, linearPoolUsdPlus);
    // await swap(usdc, staticUsdPlus, usdPlusAmount, linearPoolUsdPlus)
    // // await swap(staticUsdPlus, usdc, usdPlusAmount, linearPoolUsdPlus)
    // await printBalances(vault, linearPoolUsdPlus);

    // let aDaiAmount = toE18(5000);
    // await printBalances(vault, linearPoolADai);
    // await swap(dai, staticAmDAI, aDaiAmount, linearPoolADai)
    // // await swap(staticAmDAI, dai, aDaiAmount, linearPoolADai)
    // await printBalances(vault, linearPoolADai);
    //
    let aUsdtAmount = toE6(5000);
    await printBalances(vault, linearPoolAUsdt);
    await swap(usdt, staticAmUSDT, aUsdtAmount, linearPoolAUsdt)
    // await swap(staticAmUSDT, usdt, aUsdtAmount, linearPoolAUsdt)
    await printBalances(vault, linearPoolAUsdt);

    console.log('[Balance after on user]')
    console.log('USDC:      ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('USDT:      ' + await usdt.balanceOf(wallet.address) / 1e6);
    console.log('DAI:       ' + await dai.balanceOf(wallet.address) / 1e18);
    console.log('stUSDPlus: ' + await staticUsdPlus.balanceOf(wallet.address) / 1e6);
    console.log('stUSDT:    ' + await staticAmUSDT.balanceOf(wallet.address) / 1e6);
    console.log('stDAI:     ' + await staticAmDAI.balanceOf(wallet.address) / 1e18);


    async function swap(tokenIn, tokenOut, amount, pool) {
        let poolId = await pool.getPoolId();

        await (await tokenIn.approve(vault.address, str(amount), gasOpts)).wait();

        await (await vault.swap(
            {
                poolId: poolId,
                kind: 0,
                assetIn: tokenIn.address,
                assetOut: tokenOut.address,
                amount: str(amount),
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
            gasOpts
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
