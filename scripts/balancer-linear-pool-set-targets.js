const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../utils/network");
const {fromE18} = require("../utils/decimals");
const {toE18, str} = require("./balancer-stable-pool-test-commons");

let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));

let linearPoolUsdPlusAddress = "0x6933ec1CA55C06a894107860c92aCdFd2Dd8512f";
let linearPoolADaiAddress = "0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E";
let linearPoolAUsdtAddress = "0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f";


async function main() {

    let wallet = await initWallet(ethers);

    let linearPoolUsdPlus = await ethers.getContractAt(LinearPool, linearPoolUsdPlusAddress, wallet);
    let linearPoolADai = await ethers.getContractAt(LinearPool, linearPoolADaiAddress, wallet);
    let linearPoolAUsdt = await ethers.getContractAt(LinearPool, linearPoolAUsdtAddress, wallet);


    await printTargets();

    await linearPoolUsdPlus.setTargets(str(toE18(40000)), str(toE18(60000)));
    await linearPoolADai.setTargets(str(toE18(40000)), str(toE18(60000)));
    await linearPoolAUsdt.setTargets(str(toE18(40000)), str(toE18(60000)));

    await printTargets();


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

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

