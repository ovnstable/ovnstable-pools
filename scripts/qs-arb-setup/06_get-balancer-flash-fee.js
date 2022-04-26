const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {strPoint, str, toE18} = require("../balancer-stable-pool-test-commons");
const {toE6} = require("../../utils/decimals");

let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));
let IProtocolFeesCollectorAbi = JSON.parse(fs.readFileSync('./abi/build/IProtocolFeesCollector.json')).abi;


async function main() {

    let wallet = await initWallet(ethers);

    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    let protocolFeesCollectorAddress = await vault.getProtocolFeesCollector();
    console.log(`protocolFeesCollectorAddress: ${protocolFeesCollectorAddress}`);
    let protocolFeesCollector = await ethers.getContractAt(IProtocolFeesCollectorAbi, protocolFeesCollectorAddress, wallet);
    let flashLoanFeePercentage = await protocolFeesCollector.getFlashLoanFeePercentage();
    console.log(`flashLoanFeePercentage: ${flashLoanFeePercentage}`);

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
