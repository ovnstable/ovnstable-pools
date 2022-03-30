const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');

let BalancerFactory = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPoolFactory.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));


let BalancerFactoryAddress = "0xC6bD2497332d24094eC16a7261eec5C412B5a2C1";
let staticUsdPlusAddress = "0x5d9D8509C522a47D9285b9e4e9ec686e6A580850";
let mainToken = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let owner = "0xe497285e466227f4e8648209e34b465daa1f90a0";

async function main() {

    let wallet = await initWallet();
    let factory = await ethers.getContractAt(BalancerFactory, BalancerFactoryAddress, wallet);

    let upperTarget = new BN(10).pow(new BN(18)).muln(200000); // 200 000
    let swapFee = "100000000000000"; // 0.01%

    let tx = await (await factory.create('USDC-USD+ Linear Pool Token', 'LP-USDC-USD+', mainToken, staticUsdPlusAddress, upperTarget.toString(), swapFee, owner, {
        maxFeePerGas: "250000000000",
        maxPriorityFeePerGas: "250000000000"
    })).wait();
    const poolAddress = tx.events.find((e) => e.event == 'PoolCreated').args[0];

    let pool = await ethers.getContractAt(Pool, poolAddress, wallet);
    console.log('Pool ID: ' + await pool.getPoolId());
    console.log('Pool address: ' + poolAddress);
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
