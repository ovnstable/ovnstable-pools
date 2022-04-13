const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const {fromE18} = require("../utils/decimals");


let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let StablePhantomPool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));


let linearPoolUsdPlusAddress = "0x6933ec1CA55C06a894107860c92aCdFd2Dd8512f";
let linearPoolADaiAddress = "0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E";
let linearPoolAUsdtAddress = "0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f";
let stablePoolAddress = "0xF48f01DCB2CbB3ee1f6AaB0e742c2D3941039d56";


async function main() {

    let wallet = await initWallet();

    let stablePool = await ethers.getContractAt(StablePhantomPool, stablePoolAddress, wallet);
    let linearPoolUsdPlus = await ethers.getContractAt(LinearPool, linearPoolUsdPlusAddress, wallet);
    let linearPoolADai = await ethers.getContractAt(LinearPool, linearPoolADaiAddress, wallet);
    let linearPoolAUsdt = await ethers.getContractAt(LinearPool, linearPoolAUsdtAddress, wallet);

    console.log("--- fees: ");
    console.log("stablePool.swapFeePercentage:        " + fromE18(await stablePool.getSwapFeePercentage()));
    console.log("linearPoolUsdPlus.swapFeePercentage: " + fromE18(await linearPoolUsdPlus.getSwapFeePercentage()));
    console.log("linearPoolADai.swapFeePercentage:    " + fromE18(await linearPoolADai.getSwapFeePercentage()));
    console.log("linearPoolAUsdt.swapFeePercentage:   " + fromE18(await linearPoolAUsdt.getSwapFeePercentage()));
    console.log("----------");

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
