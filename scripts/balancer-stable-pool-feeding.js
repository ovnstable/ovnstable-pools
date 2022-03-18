const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {web3} = require("@openzeppelin/test-helpers/src/setup");

let Pool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));

let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let lpUsdPlusAddress = "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425";

let stablePoolAddress = "0xE051605A83dEAe38d26a7346B100EF1AC2ef8a0b";
async function main() {

    let wallet = await initWallet();

    let stablePool = await ethers.getContractAt(Pool, stablePoolAddress, wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);

    console.log("stablePool.getPoolId: " + await stablePool.getPoolId());

    await showBalances(vault, stablePool);
    await initPool(wallet);
    await showBalances(vault, stablePool);

    async function initPool(wallet) {
        console.log('[Init Stable pool] ...');
        console.log("stablePool.totalSupply: " + await stablePool.totalSupply());

        let lpUsdPlus = await ethers.getContractAt(ERC20, lpUsdPlusAddress, wallet);
        let usdt = await ethers.getContractAt(ERC20, usdtAddress, wallet);
        let dai = await ethers.getContractAt(ERC20, daiAddress, wallet);


        console.log('Balance LP USD+: ' + await lpUsdPlus.balanceOf(wallet.address) / 1e18);

        // Same to (['uint256', 'uint256[]'], [StablePoolJoinKind.INIT, amountsIn]);
        let {tokens, initAmountsIn} = await makeInitialBalances(vault, stablePool);
        let userData = web3.eth.abi.encodeParameters(['uint256', 'uint256[]'], [0, initAmountsIn]);
        console.log(`userData: ${userData}`);

        let value18 = new BN(10).pow(new BN(18)).muln(35000).toString(); // approve for 35000$
        let value6 = new BN(10).pow(new BN(6)).muln(35000).toString(); // approve for 35000$

        await (await lpUsdPlus.approve(vault.address, value18)).wait();
        await (await usdt.approve(vault.address, value6)).wait();
        await (await dai.approve(vault.address, value18)).wait();
        console.log("Vault approved");

        let uint256Max = new BN(2).pow(new BN(256)).subn(1).toString(); // type(uint256).max

        console.log("Before stable joinPool")
        await (await vault.joinPool(
            await stablePool.getPoolId(),
            wallet.address,
            wallet.address,
            {
                assets: tokens,
                maxAmountsIn: [uint256Max, uint256Max, uint256Max, uint256Max],
                userData: userData,
                fromInternalBalance: false
            }
        )).wait();
        console.log("joinPool done")

        console.log('Balance  LP USD+: ' + await lpUsdPlus.balanceOf(wallet.address) / 1e18);
        console.log('Balance  ST LP USD+: ' + await stablePool.balanceOf(wallet.address) / 1e18);

    }
}



async function showBalances(vault, pool) {
    const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());

    console.log('Balance Stable Pool:')

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

        console.log(`- ${name}:${balance}`);
    }

}

async function makeInitialBalances(vault, pool) {
    const {tokens, balances} = await vault.getPoolTokens(await pool.getPoolId());

    console.log('Init balances:')

    let initAmountsIn = []

    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];

        let name = "";
        switch (token.toLowerCase()) {
            case "0xc2132d05d31c914a87c6611c10748aeb04b58e8f".toLowerCase():
                name = "USDT";
                initAmountsIn[i] = new BN(10).pow(new BN(6)).muln(35000).toString(); // 35000$
                break
            case "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063".toLowerCase():
                name = "DAI ";
                initAmountsIn[i] = new BN(10).pow(new BN(18)).muln(35000).toString(); // 35000$
                break
            case lpUsdPlusAddress.toLowerCase():
                name = "LP ";
                initAmountsIn[i] = new BN(10).pow(new BN(18)).muln(35000).toString(); // 35000$
                break
            default:
                name = "Stable LP  ";
                initAmountsIn[i] = "9000000000000000000";
                break
        }

        console.log(`- ${name}: ${initAmountsIn[i]}`);
    }

    console.log(`- tokens array: ${tokens}`);
    console.log(`- initAmountsIn array: ${initAmountsIn}`);
    console.log(`------------------------------------`);

    return {
        tokens: tokens,
        initAmountsIn: initAmountsIn
    };
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
