const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../utils/network");

let StaticATokenLM = JSON.parse(fs.readFileSync('./abi/StaticATokenLM.json'));


// - Deployed Static Wrapper for amUSDT
// - Proxy:  0x548571A302D354B190AE6E9107552aB4F7FD9DC5
// - Impl :  0x291fDbAe94960C6bda7A481de0bCAdE03Cab1461

// - Deployed Static Wrapper for amDAI
// - Proxy:  0xa84B5B903f62ea61dfAac3f88123cC6B21Bb81ab
// - Impl :  0x692AeF68A9c106FE470D69Ec0B28ef5b563B65a2


async function main() {

    let wallet = await initWallet(ethers);

    let staticFactory = await ethers.getContractFactory(StaticATokenLM.abi, StaticATokenLM.bytecode, wallet);



    let amUSDT = "0x60D55F02A771d515e077c9C2403a1ef324885CeC"; // amUSDT
    let amUSDTsymbol = "amUSDT";

    await deployAToken(amUSDT, amUSDTsymbol);

    async function deployAToken(aTokenAddress, symbol){
        console.log('Deploy: ' + symbol);

        const aToken = await staticFactory.deploy();
        await aToken.deployed();
        console.log("AToken deployed to:", aToken.address);

        let lendingPool = "0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf";
        let fullName = `Wrapped ${symbol}`;

        await (await aToken.initialize(lendingPool, aTokenAddress, fullName, symbol)).wait();
        console.log('Initialize completed');
    }
}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
