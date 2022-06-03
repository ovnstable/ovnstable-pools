const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const axios = require('axios')
const axiosRetry = require('axios-retry');
axiosRetry(axios, {retries: 3});

let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let iUniswapV2FactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Factory.json')).abi;
let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;

let dystFactoryAddress = "0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9";
const BigNumber = require("bignumber.js");
const {ZERO_ADDRESS} = require("@openzeppelin/test-helpers/src/constants");

const REWARD_ADDRESS = '0x39aB6574c289c3Ae4d88500eEc792AB5B947A5Eb'
const VOTER_ADDRESS = '0x649BdF58B09A0Cd4Ac848b42c4B5e1390A72A49A'
const VOTER_ABI = require('./voterABI').voterABI;
const BRIBE_ABI = require('./bribeABI').bribeABI;
const GAUGE_ABI = require('./gaugeABI').gaugeABI;

async function main() {

    let wallet = await initWallet(ethers);
    let dystFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, dystFactoryAddress, wallet);

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
            // console.log(`loaded info pool: ${prevInfo.index} -> ${prevInfo.pool}: ${prevInfo.token0Symbol}/${prevInfo.token1Symbol} : ${prevInfo.token0}/${prevInfo.token1} [${prevInfo.stable ? "stable" : "unstable"}]`)
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
            // console.log(`load info pool: ${poolInfo.index} -> ${poolInfo.pool}: ${poolInfo.token0Symbol}/${poolInfo.token1Symbol} : ${poolInfo.token0}/${poolInfo.token1} [${poolInfo.stable ? "stable" : "unstable"}]`)

            poolInfos[poolInfo.index] = poolInfo;
        }

        if (storeEveryCounter >= storeEvery) {
            fs.writeFileSync(poolInfosFileName, JSON.stringify(poolInfos, null, 2));
            // console.log(`stored`)
            storeEveryCounter = 0;
        } else {
            storeEveryCounter++;
        }
    }

    fs.writeFileSync(poolInfosFileName, JSON.stringify(poolInfos, null, 2));
    console.log(`stored fully`)

    // ----------

    let poolInfos_usdPlus = {};

    const config = {
        headers: {
            // "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0",
            "Host": "www.dextools.io",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Content-Type": "application/json",
            "DNT": "1",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Referer": "https://www.dextools.io/app/polygon/pair-explorer/0x1a5feba5d5846b3b840312bd04d76ddaa6220170",
            "Connection": "keep-alive",
            "Cookie": "_pk_id.4.b299=1b1b0bdf49f8fdb7.1653496983.; _pk_ses.4.b299=1",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache",
            "TE": "trailers",
        },
    };

// https://www.dextools.io/chain-polygon/api/common/ethPrice
    let ethPrice = await axios.get('https://www.dextools.io/chain-polygon/api/common/ethPrice', config);

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
            if (poolInfo.pool.toString().toLowerCase() !== "0x60c088234180b36EDcec7AA8Aa23912Bb6bed114".toLowerCase()) {
                // if (poolInfo.pool.toString().toLowerCase() !== "0x1A5FEBA5D5846B3b840312Bd04D76ddaa6220170".toLowerCase()) {
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
            info = await axios.get(`https://www.dextools.io/chain-polygon/api/pair/info?pair=${poolInfo.pool}`, config)
        } catch {
            info = await axios.get(`https://www.dextools.io/chain-polygon/api/pair/info?pair=${poolInfo.pool}`, config)
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


        let status = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer-status?pair=${poolInfo.pool}`, config)
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
            let beforeTimePointResp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0&h=1`, config)
            swaps = beforeTimePointResp.data.result;
            if (logEnabled) {
                console.log(swaps.length)
            }
            let afterTimePointResp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timePoint}-0`, config)
            swaps = swaps.concat(afterTimePointResp.data.result);
            if (logEnabled) {
                console.log(swaps.length)
            }
        } else {
            if (logEnabled) {
                console.log(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0`)
                console.log(`${new Date(timeStart * 1000)}`)
            }
            let afterStartTimeResp = await axios.get(`https://www.dextools.io/chain-polygon/api/Quickswap/1/pairexplorer?v=2.15.2&pair=${poolInfo.pool}&ts=${timeStart}-0`, config)
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

        let tvlRes = await tvl(balance);

        if (logEnabled) {
            console.log(`tvl: ${tvlRes}`)
        }

        let bribesUsd = 0.;
        let bribesString = "";
        let bribes = await getRewardForPool(poolInfo.pool);
        if (logEnabled) {
            console.log(bribes.length);
            for (const bribe of bribes) {
                console.log(`bribe: ${bribe.symbol} ${bribe.rewardAmount.toString()}`);
            }
        }

        for (const bribe of bribes) {
            if (logEnabled) {
                console.log(`bribe: ${bribe.symbol} ${bribe.rewardAmount.toString()}`);
            }

            bribesString += `\t${bribe.symbol}\t${bribe.rewardAmount}`

            if (bribe.rewardAmount.eq(new BN(0)) || bribe.decimals === null) {
                continue;
            }

            let priceUsd = await getPriceUsd(bribe.token);
            let priceE18 = priceToBN_E18(priceUsd);

            bribe.rewardUsd = bribe.rewardAmount
                .mul(priceE18)
                .div(new BN(10).pow(new BN(18 - 2)))
                .div(new BN(10).pow(new BN(bribe.decimals.toString())))
                .toNumber() / 100

            if (logEnabled) {
                console.log(`priceUsd: ${priceUsd}`);
                console.log(`priceE18: ${priceE18}`);
                console.log(`bribe.decimals: ${bribe.decimals}`);
                console.log(`rewardUsd: ${bribe.rewardUsd}`);
            }

            bribesUsd = bribesUsd + bribe.rewardUsd;
        }
        if (logEnabled) {
            console.log(`total bribesUsd: ${bribesUsd}`);
        }

        let aprRes = await apr(poolInfo.pool, tvlRes)

        let line = `${index.toString()}\t`;
        line += `${poolInfo.pool}\t`
        line += `${replaceMai(poolInfo.token0Symbol)}/${replaceMai(poolInfo.token1Symbol)}\t`
        line += `${tvlRes.toFixed(2)}\t`
        line += `${dailyVolumeInUsd.toFixed(2)}\t`
        line += `${totalWeight}\t`
        line += `${poolWeight}\t`
        line += `${(aprRes*40/100).toFixed(2)}\t`
        line += `${aprRes.toFixed(2)}\t`
        line += `${bribesUsd}`
        line += `${bribesString}`

        console.log(`${line}`);
        toFile += `${line}\n`;

        index = index.subn(1);
    }
    console.log(`--------------------------`)

    fs.writeFileSync(`dystopia_votes_report_${timeStart}-${timeEnd}`, toFile);
    // https://www.dextools.io/chain-polygon/api/common/ethPrice

    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------


    function priceToBN_E18(token0PriceUsd) {
        let priceStr = token0PriceUsd.toString();
        if (!priceStr.includes('.')) {
            priceStr = priceStr + ".0";
        }
        let res = priceStr.split(".");
        let decimals = res[1].length;
        let priceAtE18 = new BN(res[0]).mul(new BN(10).pow(new BN(decimals))).add(new BN(res[1]));
        if (decimals > 18) {
            priceAtE18 = priceAtE18.div(new BN(10).pow(new BN(decimals - 18)))
        } else if (decimals < 18) {
            priceAtE18 = priceAtE18.mul(new BN(10).pow(new BN(18 - decimals)))
        }

        return priceAtE18;
    }


    async function tvl(balance) {

        if (balance.token0address === '0x39ab6574c289c3ae4d88500eec792ab5b947a5eb' || balance.token1address === '0x39ab6574c289c3ae4d88500eec792ab5b947a5eb') {
            let a, b, totalVolumeInUsdInReserve1, totalVolumeInUsdInReserve0;
            if (balance.token0address === '0x39ab6574c289c3ae4d88500eec792ab5b947a5eb') {


                b = await axios.get('https://api.dexscreener.io/latest/dex/pairs/polygon/0x1e08a5b6a1694bc1a65395db6f4c506498daa349')
                totalVolumeInUsdInReserve0 = BigNumber(
                    balance.reserve0
                ).multipliedBy(BigNumber(b.data.pair.priceUsd));

                a = await axios.get(
                    `https://api.coingecko.com/api/v3/simple/token_price/polygon-pos?contract_addresses=${balance.token1address}&vs_currencies=usd`
                );
                if (a.data[balance.token1address] === undefined) {
                    return 0;
                }
                totalVolumeInUsdInReserve1 = BigNumber(
                    balance.reserve1
                ).multipliedBy(BigNumber(a.data[balance.token1address].usd));

                // console.log(`t0: ${totalVolumeInUsdInReserve0} price: ${b.data.pair.priceUsd}`)
                // console.log(`t1: ${totalVolumeInUsdInReserve1} price: ${a.data[pair.token1.address].usd}`)
            } else {
                a = await axios.get(
                    `https://api.coingecko.com/api/v3/simple/token_price/polygon-pos?contract_addresses=${balance.token0address}&vs_currencies=usd`
                );
                if (a.data[balance.token0address] === undefined) {
                    return 0;
                }

                totalVolumeInUsdInReserve0 = BigNumber(
                    balance.reserve0
                ).multipliedBy(BigNumber(a.data[balance.token0address].usd));

                b = await axios.get('https://api.dexscreener.io/latest/dex/pairs/polygon/0x1e08a5b6a1694bc1a65395db6f4c506498daa349')

                totalVolumeInUsdInReserve1 = BigNumber(
                    balance.reserve1
                ).multipliedBy(BigNumber(b.data.pair.priceUsd));

                // console.log(`t0: ${totalVolumeInUsdInReserve0} price: ${a.data[pair.token0.address].usd}`)
                // console.log(`t1: ${totalVolumeInUsdInReserve1} price: ${b.data.pair.priceUsd}`)
            }


            const totalVolumeInUsd =
                Number(totalVolumeInUsdInReserve0) +
                Number(totalVolumeInUsdInReserve1);
            return Number(totalVolumeInUsd);

        } else {
            const a = await axios.get(
                `https://api.coingecko.com/api/v3/simple/token_price/polygon-pos?contract_addresses=${balance.token0address},${balance.token1address}&vs_currencies=usd`
            );
            // console.log(`a.data: ${balance.token0address},${balance.token1address}`)
            // console.log(`a.data: ${JSON.stringify(a.data, null,2)}`)

            if (a.data[balance.token0address] === undefined) {
                return 0;
            }
            if (a.data[balance.token1address] === undefined) {
                return 0;
            }
            const totalVolumeInUsdInReserve0 = BigNumber(
                balance.reserve0
            ).multipliedBy(BigNumber(a.data[balance.token0address].usd));

            const totalVolumeInUsdInReserve1 = BigNumber(
                balance.reserve1
            ).multipliedBy(BigNumber(a.data[balance.token1address].usd));


            // console.log(`t0: ${totalVolumeInUsdInReserve0} price: ${a.data[balance.token0address].usd}`)
            // console.log(`t1: ${totalVolumeInUsdInReserve1} price: ${a.data[balance.token1address].usd}`)

            const totalVolumeInUsd =
                Number(totalVolumeInUsdInReserve0) +
                Number(totalVolumeInUsdInReserve1);
            return Number(totalVolumeInUsd);
        }
    }

    async function getPriceUsd(tokenAddress) {
        tokenAddress = tokenAddress.toLowerCase();
        if (tokenAddress === '0x39ab6574c289c3ae4d88500eec792ab5b947a5eb') {
            let b = await axios.get('https://api.dexscreener.io/latest/dex/pairs/polygon/0x1e08a5b6a1694bc1a65395db6f4c506498daa349')
            // console.log(`getPriceUsd: 1: ${b.data.pair.priceUsd}`)
            return Number(b.data.pair.priceUsd);
        } else {
            let a = await axios.get(
                `https://api.coingecko.com/api/v3/simple/token_price/polygon-pos?contract_addresses=${tokenAddress}&vs_currencies=usd`
            );
            if (a.data[tokenAddress] === undefined) {
                return 0;
            }
            // console.log(`getPriceUsd: 2: ${a.data[tokenAddress].usd}`)
            return Number(a.data[tokenAddress].usd);
        }
    }


    async function apr(poolAddress, totalVolumeInUsd) {
        let gaugeAddress = await gaugesContract.gauges(poolAddress);
        if (logEnabled) {
            console.log(`gaugeAddress: ${gaugeAddress}`)
        }

        if (gaugeAddress === ZERO_ADDRESS) {
            return 0;
        }

        const gaugeContract = await ethers.getContractAt(
            GAUGE_ABI,
            gaugeAddress,
            wallet
        );

        const rewardRate = await gaugeContract.rewardRate(REWARD_ADDRESS)
        if (logEnabled) {
            console.log(`rewardRate: ${rewardRate}`)
        }

        let dystprice = BigNumber(await getPriceUsd('0x39ab6574c289c3ae4d88500eec792ab5b947a5eb'));
        if (logEnabled) {
            console.log(`dystprice: ${dystprice}`)
        }

        const secondsPerYear = 31622400;

        const valuePerYear = new BigNumber(secondsPerYear)
            .multipliedBy(BigNumber(rewardRate.toString()))
            .div(10 ** 18);
        if (logEnabled) {
            console.log(`valuePerYear: ${valuePerYear}`)
        }
        const apr = new BigNumber(valuePerYear)
            .multipliedBy(dystprice)
            .div(BigNumber(totalVolumeInUsd))
            .div(10 ** 18)
            .multipliedBy(100)
            .toFixed(4);
        if (logEnabled) {
            console.log(`apr: ${apr}`)
        }
        return Number(apr);
    }

    async function getRewardForPool(poolAddress) {

        let gaugeAddress = await gaugesContract.gauges(poolAddress);
        if (logEnabled) {
            console.log(`gaugeAddress: ${gaugeAddress}`)
        }

        if (gaugeAddress === ZERO_ADDRESS) {
            return [];
        }

        const bribeAddress = await gaugesContract.bribes(gaugeAddress);
        if (logEnabled) {
            console.log(`bribeAddress: ${bribeAddress}`)
        }

        const bribeContract = await ethers.getContractAt(
            BRIBE_ABI,
            bribeAddress,
            wallet
        );

        const rewardsListLength = await bribeContract.rewardTokensLength();
        if (logEnabled) {
            console.log(`rewardsListLength: ${rewardsListLength}`)
        }

        if (rewardsListLength === 0) {
            return [];
        }


        const bribeTokens = [
            {address: "", rewardAmount: 0, rewardRate: 0},
        ];
        for (let i = 0; i < rewardsListLength; i++) {
            let bribeTokenAddress = await bribeContract.rewardTokens(i);
            if (logEnabled) {
                console.log(`${i} bribeTokenAddress: ${bribeTokenAddress}`)
            }
            bribeTokens.push({
                address: bribeTokenAddress,
                rewardAmount: 0,
                rewardRate: 0,
            });
        }

        bribeTokens.shift();

        const bribes = await Promise.all(
            bribeTokens.map(async (bribe, idx) => {

                const rewardRate = await bribeContract.rewardRate(bribe.address);
                if (logEnabled) {
                    console.log(`${idx} rewardRate: ${rewardRate}`)
                }
                let token = await ethers.getContractAt(ERC20, bribe.address, wallet);

                let symbol = await symbolOrNull(token);
                let decimals = await decimalsOrNull(token);

                bribe = {
                    token: bribe.address,
                    symbol: symbol,
                    decimals: decimals,
                    rewardAmount: new BN(rewardRate.toString())
                        .muln(604800)
                        .div(new BN(10).pow(new BN(18)))
                    // .divn(10 ** parseInt(decimals))
                    // .toFixed(parseInt(decimals)),
                };

                return bribe;
            })
        );

        return bribes;
    }


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

    function replaceMai(text) {
        if (!text) {
            return text;
        }
        return text.replace("miMATIC", "MAI");
    }

    async function symbolOrNull(token) {
        try {
            return replaceMai(await token.symbol());
        } catch {
            return null;
        }
    }

    async function nameOrNull(token) {
        try {
            return replaceMai(await token.name());
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

