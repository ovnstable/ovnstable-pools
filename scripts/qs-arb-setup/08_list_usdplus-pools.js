const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let iUniswapV2FactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Factory.json')).abi;
let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;

let qsFactoryAddress = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";


async function main() {

    let wallet = await initWallet(ethers);
    let qsFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, qsFactoryAddress, wallet);


    let count = new BN((await qsFactory.allPairsLength()).toString());
    console.log(`Total pools on QS: ${count}`);

    // let index = new BN(0);
    // while (index.lt(count)) {
    //
    //     let poolAddress = await qsFactory.allPairs(index.toString());
    //
    //     let pool = await ethers.getContractAt(iUniswapV2PairAbi, poolAddress, wallet);
    //     let poolInfo = await getPoolInfo(pool);
    //
    //
    //     console.log(`pool: ${index} -> ${poolAddress}: ${poolInfo.token0Symbol}/${poolInfo.token1Symbol}`)
    //
    //
    //     index = index.addn(1);
    // }


    let dir = 'pool_infos'
    makeDirIfNeed(dir);

    let poolInfosFileName = `${dir}/qsPools2.json`

    let poolInfos = {};
    if (fs.existsSync(poolInfosFileName)) {
        poolInfos = JSON.parse(fs.readFileSync(poolInfosFileName, "utf8"));
    }

    let storeEvery = 0;
    let storeEveryCounter = 0;

    let zero = new BN(0);
    let index = count.subn(1);
    while (index.gte(zero)) {

        let prevInfo = poolInfos[index];
        if (prevInfo !== undefined) {
            console.log(`pool!: ${prevInfo.index} -> ${prevInfo.pool}: ${prevInfo.token0Symbol}/${prevInfo.token1Symbol} : ${prevInfo.token0}/${prevInfo.token1}`)
            index = index.subn(1);
            continue
        }

        let promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(new Promise((resolve, reject) => {
                (async () => {
                    let localIndex = index.toString();

                    let poolAddress = await qsFactory.allPairs(localIndex);
                    let pool = await ethers.getContractAt(iUniswapV2PairAbi, poolAddress, wallet);
                    let poolInfo = await getPoolInfo(pool, localIndex);

                    resolve(poolInfo)
                })()
            }));
            index = index.subn(1);
        }

        for (const poolInfo of await Promise.all(promises)) {
            console.log(`pool: ${poolInfo.index} -> ${poolInfo.pool}: ${poolInfo.token0Symbol}/${poolInfo.token1Symbol} : ${poolInfo.token0}/${poolInfo.token1}`)

            poolInfos[poolInfo.index] = poolInfo;
        }

        // let poolAddress = await qsFactory.allPairs(index.toString());
        //
        // let pool = await ethers.getContractAt(iUniswapV2PairAbi, poolAddress, wallet);
        // let poolInfo = await getPoolInfo(pool, index);
        //
        // poolInfos[index] = poolInfo;
        // console.log(`pool: ${index} -> ${poolAddress}: ${poolInfo.token0Symbol}/${poolInfo.token1Symbol} : ${poolInfo.token0}/${poolInfo.token1}`)
        // index = index.subn(1);

        if (storeEveryCounter >= storeEvery) {
            fs.writeFileSync(poolInfosFileName, JSON.stringify(poolInfos, null, 2));
            console.log(`stored`)
            storeEveryCounter = 0;
        } else {
            storeEveryCounter++;
        }
    }

    fs.writeFileSync(poolInfosFileName, JSON.stringify(poolInfos, null, 2));
    console.log(`stored fully`)


    async function getPoolInfo(pool, index) {
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await symbolOrNull(token0);
        let token1Symbol = await symbolOrNull(token1);

        let token0Name = await nameOrNull(token0);
        let token1Name = await nameOrNull(token1);

        let token0Decimals = await decimalsOrNull(token0);
        let token1Decimals = await decimalsOrNull(token1);

        return {
            pool: pool.address,
            index: index.toString(),
            token0: token0Address,
            token1: token1Address,
            token0Symbol: token0Symbol,
            token1Symbol: token1Symbol,
            token0Name: token0Name,
            token1Name: token1Name,
            token0Decimals: token0Decimals,
            token1Decimals: token1Decimals,
        }
    }


    async function symbolOrNull(token) {
        try {
            return await token.symbol();
        } catch {
            return null;
        }
    }

    async function nameOrNull(token) {
        try {
            return await token.name();
        } catch {
            return null;
        }
    }

    async function decimalsOrNull(token) {
        try {
            return await token.decimals();
        } catch {
            return null;
        }
    }

    function makeDirIfNeed(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
