const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const {fromE18} = require("../utils/decimals");
const {initWallet} = require("../utils/network");
const {str, strPoint} = require("./balancer-stable-pool-test-commons");
const BN = require("bn.js");


let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let StablePhantomPool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let linearPoolUsdPlusAddress = "0x6933ec1CA55C06a894107860c92aCdFd2Dd8512f";
let linearPoolADaiAddress = "0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E";
let linearPoolAUsdtAddress = "0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f";
let stablePoolAddress = "0xF48f01DCB2CbB3ee1f6AaB0e742c2D3941039d56";


async function main() {

    let wallet = await initWallet(ethers);

    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    let stablePool = await ethers.getContractAt(StablePhantomPool, stablePoolAddress, wallet);
    let linearPoolUsdPlus = await ethers.getContractAt(LinearPool, linearPoolUsdPlusAddress, wallet);
    let linearPoolADai = await ethers.getContractAt(LinearPool, linearPoolADaiAddress, wallet);
    let linearPoolAUsdt = await ethers.getContractAt(LinearPool, linearPoolAUsdtAddress, wallet);


    await printFees();
    await printTargets();
    await printBalances(vault, linearPoolUsdPlus)
    await printBalances(vault, linearPoolADai)
    await printBalances(vault, linearPoolAUsdt)
    await printBalances(vault, stablePool)


    async function printFees() {
        console.log("--- fees: ");
        console.log("stablePool.swapFeePercentage:        " + fromE18(await stablePool.getSwapFeePercentage()));
        console.log("linearPoolUsdPlus.swapFeePercentage: " + fromE18(await linearPoolUsdPlus.getSwapFeePercentage()));
        console.log("linearPoolADai.swapFeePercentage:    " + fromE18(await linearPoolADai.getSwapFeePercentage()));
        console.log("linearPoolAUsdt.swapFeePercentage:   " + fromE18(await linearPoolAUsdt.getSwapFeePercentage()));
        console.log("----------");
    }

    async function printTargets() {
        console.log("--- targets: ");
        let targets;
        targets = await linearPoolUsdPlus.getTargets();
        console.log(`linearPoolUsdPlus.target: ${fromE18(targets[0])} upper: ${fromE18(targets[1])}`);
        targets = await linearPoolADai.getTargets();
        console.log(`linearPoolADai.target   : ${fromE18(targets[0])} upper: ${fromE18(targets[1])}`);
        targets = await linearPoolAUsdt.getTargets();
        console.log(`linearPoolAUsdt.target  : ${fromE18(targets[0])} upper: ${fromE18(targets[1])}`);
        console.log("----------");
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
