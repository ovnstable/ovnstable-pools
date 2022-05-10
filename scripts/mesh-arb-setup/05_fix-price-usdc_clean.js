const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {ZERO_ADDRESS, MAX_UINT256} = require("@openzeppelin/test-helpers/src/constants");
const {toEX, toE6} = require("../../utils/decimals");
const {evmCheckpoint, evmRestore} = require("../../utils/sharedBeforeEach")
const {toE18} = require("../balancer-stable-pool-test-commons");
const {BigNumber} = require("ethers");
const {bold} = require("@defi-wonderland/smock/dist/src/chai-plugin/color");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let Exchange = JSON.parse(fs.readFileSync('./abi/Exchange.json'));

let iMeshLpAbi = JSON.parse(fs.readFileSync('./abi/build/IMeshLP.json')).abi;
let iUniswapV2Router02Abi = JSON.parse(fs.readFileSync('./abi/IUniswapV2Router02.json'));


let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";


let meshRouterAddress = "0x10f4A785F458Bc144e3706575924889954946639"


// replace addresses from create script
let meshPoolUsdcUsdPlusAddress = "0x68b7cEd0dBA382a0eC705d6d97608B7bA3CD8C55";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let meshRouter = await ethers.getContractAt(iUniswapV2Router02Abi, meshRouterAddress, wallet);

    let meshPoolUsdcUsdPlus = await ethers.getContractAt(iMeshLpAbi, meshPoolUsdcUsdPlusAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);

    console.log(`usdPlus.exchange: ${await usdPlus.exchange()}`)
    let exchange = await ethers.getContractAt(Exchange.abi, await usdPlus.exchange(), wallet);


    let lowerChangePriceUsdPlusUsdc = 0.9999; // 1 pp
    let upperChangePriceUsdPlusUsdc = 1.0001; // 1 pp


    await evmCheckpoint("default");
    try {

        await fixUsdcUsdPlus();
        await fixUsdcUsdPlus();

    } catch (e) {
        console.log(e);
    }

    await evmRestore("default");

    /**
     * usdc -> qs() -> usd+ -> un() -> usdc
     * Put usdc to pool
     */
    async function chain_QS_UN(
        token0,
        token1,
        usdcIn
    ) {
        let token1Received = await swapQS(token0, token1, usdcIn);
        let usdcOut = await unwrap(token1Received)
    }

    /**
     * usdc -> wr() -> usd+ -> qs() -> usdc
     * Put usd+ to pool
     */
    async function chain_WR_QS(
        token0,
        token1,
        usdcIn
    ) {
        let token0Received = await wrap(usdcIn);
        let usdcOut = await swapQS(token0, token1, token0Received);
    }


    async function fixUsdcUsdPlus() {

        let qsPool = meshPoolUsdcUsdPlus;
        let isUsdPlusLeft = false;
        let lowerChangePriceBound = lowerChangePriceUsdPlusUsdc;
        let upperChangePriceBound = upperChangePriceUsdPlusUsdc;

        let params = await getFixParams(
            qsPool,
            isUsdPlusLeft,
            lowerChangePriceBound,
            upperChangePriceBound
        );

        console.log(`params.skip: ${params.skip}`);
        if (!params.skip) {
            console.log(`params.putUsdPlusToPool: ${params.putUsdPlusToPool}`);
            console.log(`params.tokens[0]: ${params.tokens[0].address}`);
            console.log(`params.tokens[1]: ${params.tokens[1].address}`);
            console.log(`params.reserves[0]: ${params.reserves[0]}`);
            console.log(`params.reserves[1]: ${params.reserves[1]}`);
            console.log(`params.reserves[2]: ${params.reserves[2]}`);
            console.log(`params.reserves[3]: ${params.reserves[3]}`);
        }

        if (params.skip) {
            return;
        }
        await fix(params);
    }


    async function getFixParams(
        meshPool,
        isUsdPlusLeft,
        lowerChangePriceBound,
        upperChangePriceBound
    ) {

        // balances with prices fields
        let balancesCurrent = await balancesQsPool(meshPool);
        let balancesTarget = await getSampleTargets(meshPool);

        let currentPrice0Per1 = balancesCurrent.price0Per1
        let targetPrice0Per1 = balancesTarget.price0Per1
        console.log(`currentPrice0Per1: ${currentPrice0Per1}`)
        console.log(`targetPrice0Per1 : ${targetPrice0Per1}`)

        // changePrice = (rA_0/rA_1)/(rB_0/rB_1);
        let changePrice = targetPrice0Per1 / currentPrice0Per1
        console.log(`changePrice: ${changePrice}`)

        if (lowerChangePriceBound < changePrice && changePrice < upperChangePriceBound) {
            console.log(`changePrice in bound ${lowerChangePriceBound}-${upperChangePriceBound}, skip actions`)
            return {
                skip: true
            };
        }

        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
        console.log(`balancesTarget.reserve0:  ${balancesTarget.reserve0}`)
        console.log(`balancesTarget.reserve1:  ${balancesTarget.reserve1}`)


        let rCur0 = new BN(balancesCurrent.reserve0.toString());
        let rCur1 = new BN(balancesCurrent.reserve1.toString());
        let rTar0 = new BN(balancesTarget.reserve0.toString());
        let rTar1 = new BN(balancesTarget.reserve1.toString());


        // let params = {
        //     usdcToUsdPlus: false,
        //     tokens: [token0, token1],
        //     reserves: [rIn0, rOut0, rIn1, rOut1]
        // }

        let params;

        if (isUsdPlusLeft) {
            // usd+ - usdc

            if (changePrice < 1) {

                // amount usd+ more than should be, so need to put usdc in pool and get usd+ from

                console.log(`changePrice < 1 => usdc->usd+`)

                params = {
                    putUsdPlusToPool: false,
                    tokens: [usdc, usdPlus],
                    reserves: [rCur1, rCur0, rTar1, rTar0]
                }
            } else {
                console.log(`changePrice > 1 => usd+->usdc`)

                params = {
                    putUsdPlusToPool: true,
                    tokens: [usdPlus, usdc],
                    reserves: [rCur0, rCur1, rTar0, rTar1]
                }
            }
        } else {
            if (changePrice < 1) {
                console.log(`changePrice < 1 => usd+->usdc`)

                params = {
                    putUsdPlusToPool: true,
                    tokens: [usdPlus, usdc],
                    reserves: [rCur1, rCur0, rTar1, rTar0]
                }

            } else {
                console.log(`changePrice > 1 => usdc->usd+`)

                params = {
                    putUsdPlusToPool: false,
                    tokens: [usdc, usdPlus],
                    reserves: [rCur0, rCur1, rTar0, rTar1]
                }
            }
        }


        let fee = new BN((await meshPool.fee()).toString());
        let fee100 = new BN(10000);


        params['fee'] = fee;
        params['fee100'] = fee100;

        return params;
    }


    async function fix(params) {
        if (params.putUsdPlusToPool) {
            await putUsdPlusToPool(
                params.tokens[0],
                params.tokens[1],
                params.reserves[0],
                params.reserves[1],
                params.reserves[2],
                params.reserves[3],
                params.fee,
                params.fee100,
            )
        } else {
            await pullUsdPlusFromPool(
                params.tokens[0],
                params.tokens[1],
                params.reserves[0],
                params.reserves[1],
                params.reserves[2],
                params.reserves[3],
                params.fee,
                params.fee100,
            )
        }

        balancesCurrent = await balancesQsPool(meshPoolUsdcUsdPlus);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)

    }


    async function putUsdPlusToPool(
        token0, token1,
        rIn0, rOut0, rIn1, rOut1,
        fee, fee100
    ) {
        let aIn = calcAInForMesh(rIn0, rOut0, rIn1, rOut1, fee, fee100)
        console.log(`aIn: ${aIn}`)

        let usdcIn = calcAInForWrap(aIn);
        let usdcOut = calcAOutForQS(usdcIn, rIn0, rOut0, fee, fee100);

        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${usdcIn.sub(usdcOut)}`)

        // for 6 decimal in
        let E3 = new BN(10).pow(new BN(3));
        if (aIn.lt(E3)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return;
        }

        await chain_WR_QS(token0, token1, usdcIn)
    }


    async function pullUsdPlusFromPool(
        token0, token1,
        rIn0, rOut0, rIn1, rOut1,
        fee, fee100
    ) {
        let aIn = calcAInForMesh(rIn0, rOut0, rIn1, rOut1, fee, fee100)
        console.log(`aIn: ${aIn}`)

        let usdcIn = aIn;
        let usdcOut = calcAOutOnWrap(calcAOutForQS(aIn, rIn0, rOut0, fee, fee100));
        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${usdcIn.sub(usdcOut)}`)

        // for 6 decimal in
        let E3 = new BN(10).pow(new BN(3));
        if (aIn.lt(E3)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return;
        }

        await chain_QS_UN(token0, token1, usdcIn);

    }

    function calcAInForMesh(rIn0, rOut0, rIn1, rOut1, fee, fee100) {
        // remove half fee from amountIn

        // p1 = rIn1/rOut1

        let feeR = fee100.sub(fee);

        let _2 = new BN(2);
        let _3 = new BN(3);
        let _8 = new BN(8);


        let a = _8.mul(fee100).mul(fee100).mul(feeR).mul(fee100.add(feeR));
        let b = fee100.mul(fee100).mul(fee100.sub(feeR)).mul(fee100.sub(feeR));
        let c = _2.mul(fee100).mul(feeR).mul(fee100.add(feeR)).mul(fee100.sub(feeR));
        let d = feeR.mul(feeR).mul(feeR.add(fee100)).mul(feeR.add(fee100));
        let e = fee100.mul(_3.mul(feeR).add(fee100));
        let f = feeR.mul(feeR.add(fee100));


        let t1 = a.mul(rIn0).mul(rOut0).mul(rIn1).div(rOut1);
        let t2 = b.mul(rIn0).mul(rIn0);
        let t3 = c.mul(rIn0);
        let underSqrt = t1.add(t2).sub(t3).add(d);

        let tSqrt = sqrt(underSqrt)
        let t4 = e.mul(rIn0)
        let nominator0 = f.sub(t4).add(tSqrt)
        let nominator1 = f.sub(t4).sub(tSqrt)

        let result0 = nominator0.div(f.muln(2))
        let result1 = nominator1.div(f.muln(2))
        console.log(`result0: ${result0}`);
        console.log(`result1: ${result1}`);
        if (result0.ltn(0)) {
            throw new Error("Result is below zero")
        }

        return result0;
    }


    // same to getAmountOut()
    function calcAOutForQS(aIn, rIn0, rOut0, fee, fee100) {
        let feeR = fee100.sub(fee);

        let amountInWithFee = aIn.mul(feeR);
        let numerator = amountInWithFee.mul(rOut0);
        let denominator = rIn0.mul(fee100).add(amountInWithFee);
        let amountOut = numerator.div(denominator);

        return amountOut;
    }

    function calcAInForWrap(aOut) {
        let _9996 = new BN(9996);
        let _10000 = new BN(10000);
        return aOut.mul(_10000).div(_9996);
    }

    function calcAOutOnWrap(aIn) {
        let _9996 = new BN(9996);
        let _10000 = new BN(10000);
        return aIn.mul(_9996).div(_10000);
    }

    function sqrt(num) {
        if (num.lt(new BN(0))) {
            throw new Error("Sqrt only works on non-negtiave inputs")
        }
        if (num.lt(new BN(2))) {
            return num
        }

        const smallCand = sqrt(num.shrn(2)).shln(1)
        const largeCand = smallCand.add(new BN(1))

        if (largeCand.mul(largeCand).gt(num)) {
            return smallCand
        } else {
            return largeCand
        }
    }

    // usdc -> usd+
    async function wrap(amountIn) {
        await usdc.approve(exchange.address, amountIn.toString());
        let result = await exchange.callStatic.buy(usdcAddress, amountIn.toString());
        await exchange.buy(usdcAddress, amountIn.toString());
        return result;
    }

    //  usd+ -> usdc
    async function unwrap(amountIn) {
        await usdPlus.approve(exchange.address, amountIn.toString());
        let result = await exchange.callStatic.redeem(usdcAddress, amountIn.toString());
        await exchange.redeem(usdcAddress, amountIn.toString());
        return result;
    }

    async function swapQS(tokenIn, tokenOut, amountIn) {
        await tokenIn.approve(meshRouter.address, amountIn.toString());
        let path = [tokenIn.address, tokenOut.address];
        let result = await meshRouter.callStatic.swapExactTokensForTokens(
            amountIn.toString(),
            0,
            path,
            wallet.address,
            MAX_UINT256.toString()
        );
        await meshRouter.swapExactTokensForTokens(
            amountIn.toString(),
            0,
            path,
            wallet.address,
            MAX_UINT256.toString()
        );
        return result[1];
    }


    async function balancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let reserve0Normalized = reserves[0] / 10 ** (await token0.decimals());
        let reserve1Normalized = reserves[1] / 10 ** (await token1.decimals());

        let price0Per1 = reserve0Normalized / reserve1Normalized;

        return {
            reserve0: reserves[0],
            reserve1: reserves[1],
            price0Per1: price0Per1,
        }
    }


    async function getSampleTargets(pool) {
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let reserve0 = 10 ** (await token0.decimals())
        let reserve1 = 10 ** (await token1.decimals())

        let reserve0Normalized = 10 ** 18;
        let reserve1Normalized = 10 ** 18;

        let price0Per1 = reserve0Normalized / reserve1Normalized;

        return {
            reserve0: reserve0,
            reserve1: reserve1,
            price0Per1: price0Per1,
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
