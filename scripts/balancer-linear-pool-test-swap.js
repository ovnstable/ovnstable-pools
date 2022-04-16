const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../utils/network");
const {strPoint, str, toE18} = require("./balancer-stable-pool-test-commons");

let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let StaticATokenLM = JSON.parse(fs.readFileSync('./abi/StaticATokenLM.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));

let linearPoolUsdPlusAddress = "0x6933ec1CA55C06a894107860c92aCdFd2Dd8512f";
let linearPoolADaiAddress = "0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E";
let linearPoolAUsdtAddress = "0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f";


let staticAmDAIAddress = "0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab";
let staticAmUSDTAddress = "0x548571A302D354B190AE6E9107552aB4F7FD9DC5";

let DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";


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


    // let usdPlusAmount = 5000 * 1e6;
    // await printBalances(vault, linearPoolUsdPlus);
    // await swap(usdc, staticUsdPlus, usdPlusAmount, linearPoolUsdPlus)
    // // await swap(staticUsdPlus, usdc, usdPlusAmount, linearPoolUsdPlus)
    // await printBalances(vault, linearPoolUsdPlus);

    // let aDaiAmount = toE18(5000);
    // await printBalances(vault, linearPoolADai);
    // // await swap(dai, staticAmDAI, aDaiAmount, linearPoolADai)
    // await swap(staticAmDAI, dai, aDaiAmount, linearPoolADai)
    // await printBalances(vault, linearPoolADai);
    //
    let aUsdtAmount = 5000 * 1e6;
    await printBalances(vault, linearPoolAUsdt);
    // await swap(usdt, staticAmUSDT, 5000 * 1e6, linearPoolAUsdt)
    await swap(staticAmUSDT, usdt, 5000 * 1e6, linearPoolAUsdt)
    await printBalances(vault, linearPoolAUsdt);


    async function swap(tokenIn, tokenOut, amount, pool) {
        let poolId = await pool.getPoolId();

        await (await tokenIn.approve(vault.address, str(amount), {
            maxFeePerGas: "250000000000",
            maxPriorityFeePerGas: "250000000000"
        })).wait();

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
