const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {web3} = require("@openzeppelin/test-helpers/src/setup");

let BalancerFactory = JSON.parse(fs.readFileSync('./abi/StablePhantomPoolFactory.json'));
let Pool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));
let LinearPool = JSON.parse(fs.readFileSync('./abi/ERC4626LinearPool.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));

let USDPlus = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let StaticUsdPlus = JSON.parse(fs.readFileSync('./abi/StaticUsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let BalancerFactoryAddress = "0xC128a9954e6c874eA3d62ce62B468bA073093F25";
let owner = "0xe497285e466227f4e8648209e34b465daa1f90a0";

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let lpUsdPlusAddress = "0x6933ec1CA55C06a894107860c92aCdFd2Dd8512f";

let lpDai = "0x0503Dd6b2D3Dd463c9BeF67fB5156870Af63393E";
let lpUsdt = "0x8A819a4caBD6EfCb4E5504fE8679A1aBD831Dd8f";

async function main() {

    let wallet = await initWallet();
    let poolAddress = await createStablePool(wallet);

    let stablePool = await ethers.getContractAt(Pool, poolAddress, wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    await showBalances(vault, stablePool);

}

async function createStablePool(wallet) {

    let factory = await ethers.getContractAt(BalancerFactory, BalancerFactoryAddress, wallet);


    let tokens = [lpUsdt, lpDai, lpUsdPlusAddress];
    tokens.sort((tokenA, tokenB) => (tokenA.toLowerCase() > tokenB.toLowerCase() ? 1 : -1));


    let rateProviders = [lpDai, lpUsdPlusAddress, lpUsdt];

    let tokenRateCacheDurations = [1800, 1800, 1800];

    console.log(tokens);
    console.log(rateProviders);
    console.log(tokenRateCacheDurations);

    let amplificationParameter = "570";
    let swapFee = "100000000000000"; // 0.01%

    let promise = await factory.create(
        'Balancer USD+ StablePool',
        'bb-USD+',
        tokens,
        amplificationParameter.toString(),
        rateProviders,
        tokenRateCacheDurations,
        swapFee,
        owner,
        { maxFeePerGas: "100000000000", maxPriorityFeePerGas: "100000000000" }
        );


    let tx = await promise.wait();
    const poolAddress = tx.events.find((e) => e.event == 'PoolCreated').args[0];

    console.log('[Created Stable Pool] => ' + poolAddress);

    return poolAddress;
}


async function showBalances(vault, pool) {
    const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());

    console.log('Balance Stable Pool:')
    console.log('Tokens:   ' + tokens);
    console.log('Balances: ' + balances);


    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        let balance = balances[i];

        let name = "";
        switch (token.toLowerCase()) {
            case "0x2791bca1f2de4661ed88a30c99a7a9449aa84174".toLowerCase():
                name = "USDC";
                break
            case "0xc2132d05d31c914a87c6611c10748aeb04b58e8f".toLowerCase():
                name = "USDT";
                break
            case "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063".toLowerCase():
                name = "DAI ";
                break
            case "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425".toLowerCase():
                name = "USD+"
                break
            default:
                name = "LP  ";
                break

        }

        // console.log(`- ${name}:${balance}`);
    }

}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

async function initWallet() {

    // let provider = new ethers.providers.JsonRpcProvider(process.env.ETH_NODE_URI_POLYGON);
    let provider = ethers.provider;
    console.log('Provider: ' + provider.connection.url);
    let wallet = await new ethers.Wallet(process.env.PK_POLYGON, provider);
    console.log('Wallet: ' + wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance: ' + balance / 1e18);

    return wallet;
}
