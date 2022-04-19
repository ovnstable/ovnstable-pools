const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {toE6} = require("../../utils/decimals");
const {toE18} = require("../balancer-stable-pool-test-commons");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";


// Hardhat generated acc #1
// Account #1: 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 (100000000 ETH)
// Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
let arbBotAddress = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);
    let usdt = await ethers.getContractAt(ERC20, usdtAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, daiAddress, wallet);

    console.log('[Balance before on user]')
    console.log('USDC:   ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(wallet.address) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(wallet.address) / 1e18);

    console.log('[Balance before on bot]')
    console.log('USDC:   ' + await usdc.balanceOf(arbBotAddress) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(arbBotAddress) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(arbBotAddress) / 1e18);


    let amountInUsdc = toE6(5000);
    let amountInUsdt = toE6(5000);
    let amountInDai = toE18(5000);

    await (await usdc.transfer(arbBotAddress, amountInUsdc.toString(), gasOpts)).wait();
    await (await usdt.transfer(arbBotAddress, amountInUsdt.toString(), gasOpts)).wait();
    await (await dai.transfer(arbBotAddress, amountInDai.toString(), gasOpts)).wait();


    console.log('[Balance after on user]')
    console.log('USDC:   ' + await usdc.balanceOf(wallet.address) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(wallet.address) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(wallet.address) / 1e18);

    console.log('[Balance after on bot]')
    console.log('USDC:   ' + await usdc.balanceOf(arbBotAddress) / 1e6);
    console.log('USDT:   ' + await usdt.balanceOf(arbBotAddress) / 1e6);
    console.log('DAI:    ' + await dai.balanceOf(arbBotAddress) / 1e18);

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

