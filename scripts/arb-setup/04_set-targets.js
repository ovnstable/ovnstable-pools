const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {fromE18} = require("../../utils/decimals");
const {toE18, str} = require("../balancer-stable-pool-test-commons");

let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));

// replace addresses from deploy script
let linearPoolAUsdtAddress = "0xa94A92fC2cA0601481d5DE357489ceaEBa1C1Dc6";
let linearPoolADaiAddress = "0xBEa652AA29D38114e9D36F2A2E4167b13DF68e73"
let linearPoolUsdPlusAddress = "0x84e80625B6131DC07232Af9d148e691FBCE29Ac2";


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

