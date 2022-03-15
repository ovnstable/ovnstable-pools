const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {expect} = require("chai");


let Pool = JSON.parse(fs.readFileSync('./abi/StablePhantomPool.json'));
let Vault = JSON.parse(fs.readFileSync('./abi/VaultBalancer.json'));

let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
let daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
let lpUsdPlusAddress = "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425";

let ONE_LP = "1000000000000000000";

async function main() {

    let wallet = await initWallet();
    let poolAddress = "0xE051605A83dEAe38d26a7346B100EF1AC2ef8a0b";

    let stablePool = await ethers.getContractAt(Pool, poolAddress, wallet);
    let vault = await ethers.getContractAt(Vault, "0xba12222222228d8ba445958a75a0704d566bf2c8", wallet);
    let usdt = await ethers.getContractAt(ERC20, usdtAddress, wallet);
    let dai = await ethers.getContractAt(ERC20, daiAddress, wallet);
    let lpUsdPlus = await ethers.getContractAt(ERC20, lpUsdPlusAddress, wallet);
    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);


    // 1) Swaps

    // await showBalances();
    //
    // await swapDAItoLP();
    // await swapUSDTtoLP();
    // await swapUSDPlustoLP();
    //
    // await showBalances();
    //
    // await swapLPtoDAI();
    // await swapLPtoUSDT();
    // await swapLPtoUSDPlus();
    //
    // await showBalances();


    // 2) Set Liquidity index

    // let newLiquidityIndex = new BN(10).pow(new BN(24)); // 10^27
    // await setLiquidityIndex(newLiquidityIndex.toString());

    // await showBalances();


    async function setLiquidityIndex(value){
        console.log('[Set liquidity index]')

        console.log('Old liquidity index: ' + await usdPlus.liquidityIndex());
        await usdPlus.setLiquidityIndex(value);
        console.log('New liquidity index: ' + await usdPlus.liquidityIndex());
    }

    async function swapLPtoUSDT() {

        console.log('[Swap 1 LP to USDT] ...');
        await stablePool.approve(vault.address, ONE_LP);
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: stablePool.address,
                assetOut: usdt.address,
                amount: ONE_LP,
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );

    }

    async function swapLPtoUSDPlus() {

        console.log('[Swap 1 LP to USD+] ...');
        await stablePool.approve(vault.address, ONE_LP);
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: stablePool.address,
                assetOut: lpUsdPlus.address,
                amount: ONE_LP,
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );

    }

    async function swapUSDTtoLP() {

        console.log('[Swap all USDT to LP] ...');

        await usdt.approve(vault.address, await usdt.balanceOf(wallet.address));
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: usdt.address,
                assetOut: poolAddress,
                amount: await usdt.balanceOf(wallet.address),
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );


    }

    async function swapUSDPlustoLP() {

        console.log('[Swap all USD+ to LP] ...');

        await lpUsdPlus.approve(vault.address, await lpUsdPlus.balanceOf(wallet.address));
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: lpUsdPlus.address,
                assetOut: poolAddress,
                amount: await lpUsdPlus.balanceOf(wallet.address),
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );

    }

    async function swapDAItoLP() {

        console.log('[Swap all DAI to LP] ...');

        await dai.approve(vault.address, await dai.balanceOf(wallet.address));
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: dai.address,
                assetOut: poolAddress,
                amount: await dai.balanceOf(wallet.address),
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );

    }

    async function swapLPtoDAI() {

        console.log('[Swap 1 LP to DAI] ...');

        await stablePool.approve(vault.address, await stablePool.balanceOf(wallet.address));
        await vault.swap(
            {
                poolId: await stablePool.getPoolId(),
                kind: 0,
                assetIn: stablePool.address,
                assetOut: dai.address,
                amount: ONE_LP,
                userData: "0x",
            },
            {
                sender: wallet.address,
                fromInternalBalance: false,
                recipient: wallet.address,
                toInternalBalance: false,
            },
            0,
            1000000000000
        );

    }

    async function showBalances() {
        const {tokens, balances} = await vault.getPoolTokens(await stablePool.getPoolId());

        console.log('\n[Balance Stable Pool]:\n')

        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            let balance = balances[i];

            let name = "";
            switch (token.toLowerCase()) {
                case "0xc2132d05d31c914a87c6611c10748aeb04b58e8f".toLowerCase():
                    name = "USDT:     ";
                    balance = balance / 1e6;
                    break
                case "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063".toLowerCase():
                    name = "DAI:      ";
                    balance = balance / 1e18;
                    break
                case "0x1aAFc31091d93C3Ff003Cff5D2d8f7bA2e728425".toLowerCase():
                    name = "LP USD+:  "
                    balance = balance / 1e18;
                    break
                default:
                    name = "Stable LP:";
                    balance = balance / 1e18;
                    break

            }

            console.log(`- ${name}  ${balance}`);
        }

        console.log('\n[Balance user]:\n');
        console.log('- USDT:       ' + await usdt.balanceOf(wallet.address) / 1e6);
        console.log('- LP USD+:    ' + await lpUsdPlus.balanceOf(wallet.address) / 1e18);
        console.log('- DAI:        ' + await dai.balanceOf(wallet.address) / 1e18);
        console.log('- Stable LP:  ' + await stablePool.balanceOf(wallet.address) / 1e18);

        console.log();
    }


    async function execProposal(governator, ovn, id, wallet) {

        addresses.push(usdPlus.address);
        values.push(0);
        abis.push(usdPlus.interface.encodeFunctionData('grantRole', [await usdPlus.EXCHANGER(), exchangeNew.address]))

        let quorum = fromOvnGov(await governator.quorum(await ethers.provider.getBlockNumber() - 1));
        console.log('Quorum: ' + quorum);

        const proposalId = id;

        let votes = ethers.utils.parseUnits("100000100", 9);

        let state = proposalStates[await governator.state(proposalId)];
        if (state === "Executed") {
            return;
        }

        console.log('State status: ' + state)
        await ethers.provider.send('evm_mine'); // wait 1 block before opening voting

        console.log('Votes: ' + votes)
        await governator.castVote(proposalId, 1);

        let item = await governator.proposals(proposalId);
        console.log('Votes for: ' + item.forVotes / 10 ** 18);

        let total = fromOvnGov(await ovn.getVotes(wallet.address));
        console.log('Delegated ' + total)

        let waitBlock = 200;
        const sevenDays = 7 * 24 * 60 * 60;
        for (let i = 0; i < waitBlock; i++) {
            await ethers.provider.send("evm_increaseTime", [sevenDays])
            await ethers.provider.send('evm_mine'); // wait 1 block before opening voting
        }

        state = proposalStates[await governator.state(proposalId)];
        expect(state).to.eq('Succeeded');
        await governator.queueExec(proposalId);
        await ethers.provider.send('evm_mine'); // wait 1 block before opening voting
        await governator.executeExec(proposalId);


        state = proposalStates[await governator.state(proposalId)];
        console.log('State status: ' + state)
        expect(state).to.eq('Executed');


    }

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
