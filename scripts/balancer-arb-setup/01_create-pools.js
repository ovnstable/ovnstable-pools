const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");

let BalancerFactory = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPoolFactory.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));


let BalancerErc4626FactoryAddress = "0xC6bD2497332d24094eC16a7261eec5C412B5a2C1";
let BalancerAaveFactoryAddress = "0xf302f9F50958c5593770FDf4d4812309fF77414f";

let USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

let staticUsdPlusAddress = "0x5d9D8509C522a47D9285b9e4e9ec686e6A580850";
let staticAmDAI = "0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab";
let staticAmUSDT = "0x548571A302D354B190AE6E9107552aB4F7FD9DC5";


async function main() {

    let wallet = await initWallet(ethers);
    let factoryErc4626 = await ethers.getContractAt(BalancerFactory, BalancerErc4626FactoryAddress, wallet);
    let factoryAave = await ethers.getContractAt(BalancerFactory, BalancerAaveFactoryAddress, wallet);

    let upperTarget = new BN(10).pow(new BN(18)).muln(200000); // 200 000
    let swapFee = "1000000000000000"; // 0.1%
    let owner = wallet.address;

    let linearPoolUsdPlusAddress = await createPool(factoryErc4626, 'USDC-USD+ Linear Pool', 'USDC-USD+', USDC, staticUsdPlusAddress);
    let linearPoolAUsdtAddress = await createPool(factoryAave, 'Balancer Aave Boosted Pool (USDT)', 'bb-a-USDT', USDT, staticAmUSDT);
    let linearPoolADaiAddress = await createPool(factoryAave, 'Balancer Aave Boosted Pool (DAI)', 'bb-a-DAI', DAI, staticAmDAI);

    console.log(`let linearPoolAUsdtAddress = "${linearPoolUsdPlusAddress}";`);
    console.log(`let linearPoolADaiAddress = "${linearPoolAUsdtAddress}"`);
    console.log(`let linearPoolUsdPlusAddress = "${linearPoolADaiAddress}";`);


    async function createPool(factory, name, symbol, tokenA, tokenB) {
        console.log(`Start creation for ${name}`)
        let tx = await (await factory.create(name, symbol, tokenA, tokenB, upperTarget.toString(), swapFee, owner, {
            maxFeePerGas: "100000000000",
            maxPriorityFeePerGas: "100000000000"
        })).wait();
        let poolAddress = tx.events.find((e) => e.event === 'PoolCreated').args[0];

        let pool = await ethers.getContractAt(Pool, poolAddress, wallet);

        console.log(`${name} [${symbol}]:`)
        console.log('- Pool ID:      ' + await pool.getPoolId());
        console.log('- Pool address: ' + poolAddress);
        return poolAddress;
    }

    // Start creation for USDC-USD+ Linear Pool
    // USDC-USD+ Linear Pool [USDC-USD+]:
    // - Pool ID: 0x84e80625b6131dc07232af9d148e691fbce29ac2000000000000000000000485
    // - Pool address: 0x84e80625B6131DC07232Af9d148e691FBCE29Ac2
    // Start creation for Balancer Aave Boosted Pool (USDT)
    // Balancer Aave Boosted Pool (USDT) [bb-a-USDT]:
    // - Pool ID: 0xa94a92fc2ca0601481d5de357489ceaeba1c1dc6000000000000000000000486
    // - Pool address: 0xa94A92fC2cA0601481d5DE357489ceaEBa1C1Dc6
    // Start creation for Balancer Aave Boosted Pool (DAI)
    // Balancer Aave Boosted Pool (DAI) [bb-a-DAI]:
    // - Pool ID: 0xbea652aa29d38114e9d36f2a2e4167b13df68e73000000000000000000000487
    // - Pool address: 0xBEa652AA29D38114e9D36F2A2E4167b13DF68e73
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
