const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../utils/network");

let BalancerFactory = JSON.parse(fs.readFileSync('./abi/AaveLinearPoolFactory.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/AaveLinearPool.json'));


// - Deployed Static Wrapper for amUSDT
// - Proxy:  0x548571A302D354B190AE6E9107552aB4F7FD9DC5
// - Impl :  0x291fDbAe94960C6bda7A481de0bCAdE03Cab1461

// - Deployed Static Wrapper for amDAI
// - Proxy:  0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab
// - Impl :  0x692AeF68A9c106FE470D69Ec0B28ef5b563B65a2

let staticAmDAI = "0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab";
let staticAmUSDT = "0x548571A302D354B190AE6E9107552aB4F7FD9DC5";

let DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

let BalanceFactoryAave = "0xf302f9F50958c5593770FDf4d4812309fF77414f";
let owner = "0xe497285e466227f4e8648209e34b465daa1f90a0";

async function main() {

    let wallet = await initWallet(ethers);
    let factory = await ethers.getContractAt(BalancerFactory, BalanceFactoryAave, wallet);

    let upperTarget = new BN(10).pow(new BN(18)).muln(200000); // 200 000
    let swapFee = "1000000000000000"; // 0.1%

    let tx = await (await factory.create('Balancer Aave Boosted Pool (USDT)', 'bb-a-USDT', USDT, staticAmUSDT, upperTarget.toString(), swapFee, owner, {
        maxFeePerGas: "100000000000",
        maxPriorityFeePerGas: "100000000000"
    })).wait();
    let poolAddress = tx.events.find((e) => e.event == 'PoolCreated').args[0];

    let pool = await ethers.getContractAt(Pool, poolAddress, wallet);
    console.log('USDT: ')
    console.log('Pool ID: ' + await pool.getPoolId());
    console.log('Pool address: ' + poolAddress);

    tx = await (await factory.create('Balancer Aave Boosted Pool (DAI)', 'bb-a-DAI', DAI, staticAmDAI, upperTarget.toString(), swapFee, owner, {
        maxFeePerGas: "100000000000",
        maxPriorityFeePerGas: "100000000000"
    })).wait();
    poolAddress = tx.events.find((e) => e.event == 'PoolCreated').args[0];

    pool = await ethers.getContractAt(Pool, poolAddress, wallet);

    console.log('DAI:')
    console.log('Pool ID: ' + await pool.getPoolId());
    console.log('Pool address: ' + poolAddress);
}


// USDT:
// Pool ID: 0x8a819a4cabd6efcb4e5504fe8679a1abd831dd8f00000000000000000000042d
// Pool address: 0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f
// DAI:
// Pool ID: 0x0503dd6b2d3dd463c9bef67fb5156870af63393e00000000000000000000042e
// Pool address: 0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
