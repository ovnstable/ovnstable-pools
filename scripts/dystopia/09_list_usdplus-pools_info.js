const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const axios = require('axios')
const https = require('https')

let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let iUniswapV2FactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Factory.json')).abi;
// let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;
let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;

let dystFactoryAddress = "0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9";
const request = require('sync-request');
const BigNumber = require("bignumber.js");

const VOTER_ADDRESS = '0x649BdF58B09A0Cd4Ac848b42c4B5e1390A72A49A'
const VOTER_ABI = require('./voterABI').voterABI;

async function main() {

    let wallet = await initWallet(ethers);
    let dystFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, dystFactoryAddress, wallet);

    let usdPlusAddress = UsdPlusToken.address.toString().toLowerCase();

    const gaugesContract = await ethers.getContractAt(
        VOTER_ABI,
        VOTER_ADDRESS,
        wallet
    );


    let count = new BN((await dystFactory.allPairsLength()).toString());
    console.log(`Total pools on Dyst: ${count}`);

    let dir = 'pool_infos'
    makeDirIfNeed(dir);

    let poolInfosFileName = `${dir}/dystopiaPools.json`
    let usdPlusPoolInfosFileName = `${dir}/dystopiaPools_usdPlus.json`

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
            console.log(`loaded info pool: ${prevInfo.index} -> ${prevInfo.pool}: ${prevInfo.token0Symbol}/${prevInfo.token1Symbol} : ${prevInfo.token0}/${prevInfo.token1} [${prevInfo.stable ? "stable" : "unstable"}]`)
            index = index.subn(1);
            continue
        }

        let promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(new Promise((resolve, reject) => {
                (async () => {
                    let localIndex = index.toString();

                    let poolAddress = await dystFactory.allPairs(localIndex);
                    let pool = await ethers.getContractAt(IDystopiaPairAbi, poolAddress, wallet);
                    let poolInfo = await getPoolInfo(pool, localIndex);

                    resolve(poolInfo)
                })()
            }));

            if (index.eqn(0)) {
                break;
            }
            index = index.subn(1);
        }

        for (const poolInfo of await Promise.all(promises)) {
            console.log(`load info pool: ${poolInfo.index} -> ${poolInfo.pool}: ${poolInfo.token0Symbol}/${poolInfo.token1Symbol} : ${poolInfo.token0}/${poolInfo.token1} [${poolInfo.stable ? "stable" : "unstable"}]`)

            poolInfos[poolInfo.index] = poolInfo;
        }

        // let poolAddress = await dystFactory.allPairs(index.toString());
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

    // ----------

    let poolInfos_usdPlus = {};

    console.log(`--- dystopia usdPlus pools:`)

    index = count.subn(1);
    while (index.gte(zero)) {
        let poolInfo = poolInfos[index];

        if (poolInfo.token0.toString().toLowerCase() === usdPlusAddress ||
            poolInfo.token1.toString().toLowerCase() === usdPlusAddress
        ) {
            poolInfos_usdPlus[index] = poolInfo;
            console.log(`- ${poolInfo.pool}: ${poolInfo.token0Symbol}/${poolInfo.token1Symbol} [${poolInfo.stable ? "stable" : "unstable"}]`)
        }

        index = index.subn(1);
    }
    console.log(`--------------------------`)

    fs.writeFileSync(usdPlusPoolInfosFileName, JSON.stringify(poolInfos_usdPlus, null, 2));
    console.log(`usdPlus file stored`)

    console.log(`--- dystopia pools:`)


// https://www.dextools.io/chain-polygon/api/common/ethPrice
    let ethPrice = await axios.get('https://www.dextools.io/chain-polygon/api/common/ethPrice');

    // console.log(ethPrice);
    let ethPriceUsd = parseFloat(ethPrice.data.result.ethPriceUsd.toFixed(20).toString());

    let timeEnd = Math.floor(new Date().getTime() / 1000)
    let timeStart = Math.floor(new Date(timeEnd * 1000 - (24 * 60 * 60 * 1000)).getTime() / 1000)


    let v = "{\"query\":\"{\\n  pairs(first: 1000) {\\n    address\\n    decimals\\n    name\\n    symbol\\n    isStable\\n    rewardType\\n    token0 {\\n      address\\n      chainId\\n      symbol\\n      name\\n      decimals\\n      isWhitelisted\\n      balance\\n      logoURI\\n      __typename\\n    }\\n    token1 {\\n      address\\n      chainId\\n      symbol\\n      name\\n      decimals\\n      isWhitelisted\\n      balance\\n      logoURI\\n      __typename\\n    }\\n    reserve0\\n    reserve1\\n    token0Price\\n    token1Price\\n    totalSupply\\n    claimable0\\n    claimable1\\n    gauge {\\n      address\\n      balance\\n      apr\\n      totalSupply\\n      reserve0\\n      reserve1\\n      weight\\n      weightPercent\\n      bribeAddress\\n      bribesEarned\\n      rewardsEarned\\n      bribe {\\n        address\\n        rewardRate\\n        rewardAmount\\n        __typename\\n      }\\n      __typename\\n    }\\n    gaugebribes {\\n      address\\n      rewardRate\\n      rewardAmount\\n      __typename\\n    }\\n    __typename\\n  }\\n}\",\"variables\":{}}";

    let respDd = await axios.post(`https://api.thegraph.com/subgraphs/name/dystopia-exchange/dystopia`, v);


    let balances = {};
    for (const pair of respDd.data.data.pairs) {
        let address = pair.address.toLowerCase();
        let reserve0 = parseFloat(pair.reserve0);
        let reserve1 = parseFloat(pair.reserve1);
        let token0Price = parseFloat(pair.token0Price);

        let token0address = pair.token0.address.toLowerCase();
        let token1address = pair.token1.address.toLowerCase();

        balances[address] = {
            address,
            reserve0,
            reserve1,
            token0Price,
            token0address,
            token1address
        };
    }

    let logEnabled = false;

    let toFile = "";

    index = count.subn(1);
    while (index.gte(zero)) {
        let poolInfo = poolInfos[index];

        poolInfos_usdPlus[index] = poolInfo;


        if (logEnabled) {
            // if (poolInfo.pool.toString().toLowerCase() !== "0x5A31F830225936CA28547Ec3018188af44F21467".toLowerCase()) {
            if (poolInfo.pool.toString().toLowerCase() !== "0xCE1923D2242BBA540f1d56c8E23b1FBEAe2596dc".toLowerCase()) {
                index = index.subn(1);
                continue;
            }
        }


        let totalWeight = (await gaugesContract.totalWeight()).toString();
        let poolWeight = (await gaugesContract.weights(poolInfo.pool)).toString();


        totalWeight = parseInt(totalWeight) != 0
            ? BigNumber(parseInt(totalWeight))
                .div(10 ** 18)
                .toFixed(2)
            : 0;

        poolWeight = parseInt(poolWeight) != 0
            ? BigNumber(parseInt(poolWeight))
                .div(10 ** 18)
                .toFixed(2)
            : 0;

        // console.log(`totalWeight: ${totalWeight}  poolWeight: ${poolWeight}`)

        let balance = balances[poolInfo.pool.toString().toLowerCase()];

        let info;
        try {
            info = await axios.get(`https://www.dextools.io/chain-polygon/api/pair/info?pair=${poolInfo.pool}`)
        } catch {
            info = await axios.get(`https://www.dextools.io/chain-polygon/api/pair/info?pair=${poolInfo.pool}`)
        }

        if (logEnabled) {
            console.log(info)
        }

        let tokenMain;
        if (info.data.tokenIndex !== undefined) {
            if (info.data.tokenIndex === 0) {
                tokenMain = info.data.token0.id.toLowerCase();
            } else {
                tokenMain = info.data.token1.id.toLowerCase();
            }
        } else if (info.data.info !== undefined) {
            tokenMain = info.data.info.address.toLowerCase();

        } else if (info.data.token !== undefined) {
            tokenMain = info.data.token.id.toLowerCase();
        } else if (Object.keys(info.data).length === 0) {
            // console.log(info)
            console.log(`${index.toString()}\t${poolInfo.pool}\t${poolInfo.token0Symbol}/${poolInfo.token1Symbol}\t-\t-\t${totalWeight}\t${poolWeight}`)

            toFile += `${index.toString()}\t${poolInfo.pool}\t${poolInfo.token0Symbol}/${poolInfo.token1Symbol}\t0\t0\t${totalWeight}\t${poolWeight}\n`;

            // tokenMain = info.data.token.id.toLowerCase();

            index = index.subn(1);
            continue;
        } else {
            console.log(info)
            console.log(`${index.toString()}\t${poolInfo.pool}\t${poolInfo.token0Symbol}/${poolInfo.token1Symbol}`)
            tokenMain = info.data.token.id.toLowerCase();

        }


        let status = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer-status?pair=${poolInfo.pool}`)
        if (logEnabled) {
            console.log(`status: ${status.data}`)
        }
        let timePoint = parseInt(status.data.toString().split("-")[0]);
        if (logEnabled) {
            console.log(`timePoint: ${timePoint}`)
        }

        if (logEnabled) {
            console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0&h=1`)
            console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0`)
            console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0`)
            console.log(`${new Date(timeStart * 1000)}`)
        }
        // let resp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0&h=1`)
        // let resp2 = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0`)


        let swaps;

        if (timeStart < timePoint) {
            if (logEnabled) {
                console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0&h=1`)
                console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0`)
                console.log(`${new Date(timeStart * 1000)}`)
            }
            let beforeTimePointResp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0&h=1`)
            swaps = beforeTimePointResp.data.result;
            if (logEnabled) {
                console.log(swaps.length)
            }
            let afterTimePointResp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0`)
            swaps = swaps.concat(afterTimePointResp.data.result);
            if (logEnabled) {
                console.log(swaps.length)
            }
        } else {
            if (logEnabled) {
                console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0`)
                console.log(`${new Date(timeStart * 1000)}`)
            }
            let afterStartTimeResp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0`)
            swaps = afterStartTimeResp.data.result;
            if (logEnabled) {
                console.log(swaps.length)
            }
        }

        // console.log(resp.data);
        // console.log(resp.data.result[0]);

        let lastTokenPriceInEth = 0;
        let lastTokenPriceInEthTimestamp = 0;
        let dailyVolumeInUsd = 0;
        // let arr = resp.data.result;


        let i = 0;
        for (const swapInfo of swaps) {
            if (swapInfo.timestamp < timeStart || timeEnd < swapInfo.timestamp) {
                if (logEnabled) {
                    console.log(`${i} skip ${new Date(swapInfo.timestamp * 1000)}`)
                }
                i++;
                continue;
            }

            let amountETH = parseFloat(swapInfo.amountETH.toFixed(20).toString());
            // let price = parseFloat(swapInfo.priceETH.toFixed(20).toString());
            let amountToken = parseFloat(swapInfo.amountToken.toFixed(20).toString());
            let price = amountToken / amountETH;
            if (lastTokenPriceInEth === 0 || lastTokenPriceInEthTimestamp < swapInfo.timestamp) {
                // сколько в эфире стоил основной токен при последнем обмене
                lastTokenPriceInEth = amountToken / amountETH;
            }

            let priceUsd = parseFloat(swapInfo.price.toFixed(20).toString());
            let priceEth = parseFloat(swapInfo.priceETH.toFixed(20).toString());

            let priceUsdPerEth = priceUsd / priceEth;

            if (logEnabled) {
                console.log(`${i} amountETH: ${amountETH}  price: ${price}  priceUsdPerEth: ${priceUsdPerEth}\t${new Date(swapInfo.timestamp * 1000)}`)
            }
            dailyVolumeInUsd += amountETH * priceUsdPerEth;
            i++;
        }
        if (logEnabled) {
            console.log("total: " + dailyVolumeInUsd)
            console.log(`ethPriceUsd: ${ethPriceUsd}  time: ${timeStart}`)
            console.log(`lastTokenPriceInEth: ${lastTokenPriceInEth}`)
        }
        let poolSize = 0;

        if (dailyVolumeInUsd !== 0) {
            if (logEnabled) {
                console.log(`tokenMain: ${tokenMain}`)
                console.log(`balance.token0address: ${balance.token0address}`)
                console.log(`balance.reserve0: ${balance.reserve0}`)
                console.log(`balance.reserve1: ${balance.reserve1}`)
                console.log(`balance.token0Price: ${balance.token0Price}`)
            }
            if (tokenMain === balance.token0address) {
                poolSize = balance.reserve0;
                poolSize += balance.reserve1 * balance.token0Price;
            } else {
                poolSize = balance.reserve1;
                poolSize += balance.reserve0 / balance.token0Price;
            }


            if (logEnabled) {
                console.log("poolSize: " + poolSize)
            }
            poolSize = poolSize / lastTokenPriceInEth * ethPriceUsd
            if (logEnabled) {
                console.log("poolSize: " + poolSize)
            }
        }

        console.log(`${index.toString()}\t${poolInfo.pool}\t${poolInfo.token0Symbol}/${poolInfo.token1Symbol}\t${poolSize.toFixed(2)}\t${dailyVolumeInUsd.toFixed(2)}\t${totalWeight}\t${poolWeight}`)
        toFile += `${index.toString()}\t${poolInfo.pool}\t${poolInfo.token0Symbol}/${poolInfo.token1Symbol}\t${poolSize.toFixed(2)}\t${dailyVolumeInUsd.toFixed(2)}\t${totalWeight}\t${poolWeight}\n`;

        index = index.subn(1);
    }
    console.log(`--------------------------`)

    fs.writeFileSync(`dystopia_votes_report_${timeStart}-${timeEnd}`, toFile);


    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------


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

        let stable = await pool.stable();

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
            stable: stable
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

