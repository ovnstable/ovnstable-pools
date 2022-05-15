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

let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;
let IDystopiaRouterAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaRouter.json')).abi;


let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";


let dystRouterAddress = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"

// replace addresses from create script
let dystPoolUsdcUsdPlusAddress = "0x421a018cC5839c4C0300AfB21C725776dc389B1a";

let E18 = new BN(10).pow(new BN(18));

let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

async function main() {

    let wallet = await initWallet(ethers);

    let dystRouter = await ethers.getContractAt(IDystopiaRouterAbi, dystRouterAddress, wallet);

    let dystPoolUsdcUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdcUsdPlusAddress, wallet);

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
    async function chain_DY_UN(
        token0,
        token1,
        usdcIn
    ) {
        let token1Received = await swapDY(token0, token1, usdcIn);
        let usdcOut = await unwrap(token1Received)
    }

    /**
     * usdc -> wr() -> usd+ -> qs() -> usdc
     * Put usd+ to pool
     */
    async function chain_WR_DY(
        token0,
        token1,
        usdcIn
    ) {
        let token0Received = await wrap(usdcIn);
        let usdcOut = await swapDY(token0, token1, token0Received);
    }


    async function fixUsdcUsdPlus() {

        let qsPool = dystPoolUsdcUsdPlus;
        let lowerChangePriceBound = lowerChangePriceUsdPlusUsdc;
        let upperChangePriceBound = upperChangePriceUsdPlusUsdc;

        let params = await getFixParams(
            qsPool,
            lowerChangePriceBound,
            upperChangePriceBound
        );

        console.log(`params.skip: ${params.skip}`);
        if (!params.skip) {
            console.log(`params.tokenIn: ${params.tokenIn.address}`);
            console.log(`params.usdcIn: ${params.usdcIn}`);
            console.log(`params.usdcOut: ${params.usdcOut}`);
            console.log(`params.reserves[0]: ${params.reserves[0]}`);
            console.log(`params.reserves[1]: ${params.reserves[1]}`);
        }

        if (params.skip) {
            return;
        }
        await fix(params);
    }


    async function getFixParams(
        pool,
        lowerChangePriceBound,
        upperChangePriceBound
    ) {
        let SWAP_FEE = new BN(2000);

        let reserves = await pool.getReserves();
        console.log(`reserves[0]:  ${reserves[0]}`)
        console.log(`reserves[1]:  ${reserves[1]}`)

        let token0Address = await pool.token0();
        let token1Address = await pool.token1();
        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);
        let token0Decimals = await token0.decimals();
        let token1Decimals = await token1.decimals();


        let reserves0Pre = new BN(reserves[0].toString());
        let reserves1Pre = new BN(reserves[1].toString());

        // rescale
        let reserves0 = rescale(reserves0Pre, token0Decimals, 18);
        let reserves1 = rescale(reserves1Pre, token1Decimals, 18);

        let kInit = k(reserves0, reserves1);
        console.log(`kInit:    ${kInit}`)

        // домножаем на е18 т.к. надо скомпенсировать то что вместо 4*е18 осталось только одно
        let t1 = kInit.divn(2).mul(E18);
        // домножаем на е18 чтобы скомпенсировать еще 2*е18, компенсируется два т.к. перед этим уже был
        // корень из числа и поулчается что домножение как бы удвается по сути
        let t2 = sqrt(t1).mul(E18);
        // и тут y уже нормированный в е18 поулчается
        let y = sqrt(t2);
        // let y = sqrt(sqrt(kInit.divn(2)));
        console.log(`t1:    ${t1}`)
        console.log(`t2:    ${t2}`)
        console.log(`y:    ${y}`)


        let amountInUnscaled;
        let tokenInRes;
        let tokenOutRes;
        if (reserves0.lt(y)) {
            tokenInRes = token0;
            tokenOutRes = token1;
            let amountInRes = y.sub(reserves0);
            amountInUnscaled = rescale(amountInRes, 18, token0Decimals)
        } else {
            tokenInRes = token1;
            tokenOutRes = token0;
            let amountInRes = y.sub(reserves1);
            amountInUnscaled = rescale(amountInRes, 18, token1Decimals)
        }

        console.log(`tokenInRes: ${tokenInRes.address}`)
        console.log(`amountInUnscales: ${amountInUnscaled}`)


        let amountInUnscaledWithFee = amountInUnscaled.mul(SWAP_FEE).div(SWAP_FEE.subn(1))
        console.log(`amountInUnscaledWithFee: ${amountInUnscaledWithFee}`)

        let amountOutFromPool = await dystPoolUsdcUsdPlus.getAmountOut(
            amountInUnscaledWithFee.toString(), tokenInRes.address
        );
        console.log(`amountOutFromPool:      ${amountOutFromPool}`)

        return {
            pool: pool,
            tokenIn: tokenInRes,
            usdcIn: amountInUnscaledWithFee,
            usdcOut: amountOutFromPool,
            tokens: [
                tokenInRes,
                tokenOutRes
            ],
            reserves: [
                reserves0Pre,
                reserves1Pre,
            ]
        }
    }

    function k(_x, _y) {
        let _a = _x.mul(_y).div(E18);
        let _b = _x.mul(_x).div(E18).add(_y.mul(_y).div(E18));
        return _a.mul(_b).div(E18);
    }


    function rescale(value, fromDecimals, toDecimals) {
        let from = new BN(10).pow(new BN(fromDecimals));
        let to = new BN(10).pow(new BN(toDecimals));
        return value.mul(to).div(from);
    }


    async function fix(params) {

        let pool = params.pool;
        let token0Address = await pool.token0();
        if (params.tokenIn.address === token0Address) {
            await pullUsdPlusFromPool(
                params.tokens[0],
                params.tokens[1],
                pool
            )
        } else {
            await putUsdPlusToPool(
                params.tokens[0],
                params.tokens[1],
                pool
            )
        }

        let balancesCurrent = await balancesQsPool(pool);
        console.log(`balancesCurrent.reserve0: ${balancesCurrent.reserve0}`)
        console.log(`balancesCurrent.reserve1: ${balancesCurrent.reserve1}`)
    }


    async function putUsdPlusToPool(
        token0, token1,
        pool
    ) {
        let forDyst = await calcAInForDyst(pool);
        let aIn = forDyst.amountIn;
        console.log(`aIn: ${aIn}`)

        let usdcIn = calcAInForWrap(aIn);
        let usdcOut = await calcAOutForDY(pool, aIn, token0);

        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${usdcIn.sub(usdcOut)}`)

        // for 6 decimal in
        let E3 = new BN(10).pow(new BN(3));
        if (aIn.lt(E3)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return;
        }

        await chain_WR_DY(token0, token1, usdcIn)
    }


    async function pullUsdPlusFromPool(
        token0, token1,
        pool
    ) {
        let forDyst = await calcAInForDyst(pool);
        let aIn = forDyst.amountIn;
        console.log(`aIn: ${aIn}`)

        let usdcIn = aIn;
        let usdcOut = calcAOutOnWrap(await calcAOutForDY(pool, aIn, token0));
        console.log(`USDC for loan: ${usdcIn}`)
        console.log(`USDC after   : ${usdcOut}`)
        console.log(`Lost         : ${usdcIn.sub(usdcOut)}`)

        // for 6 decimal in
        let E3 = new BN(10).pow(new BN(3));
        if (aIn.lt(E3)) { // 0.001
            console.log(`aIn too low, skip actions`)
            return;
        }

        await chain_DY_UN(token0, token1, usdcIn);

    }

    async function calcAInForDyst(pool) {
        let SWAP_FEE = new BN(2000);

        let reserves = await pool.getReserves();
        console.log(`reserves[0]:  ${reserves[0]}`)
        console.log(`reserves[1]:  ${reserves[1]}`)

        let token0Address = await pool.token0();
        let token1Address = await pool.token1();
        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);
        let token0Decimals = await token0.decimals();
        let token1Decimals = await token1.decimals();


        let reserves0Pre = new BN(reserves[0].toString());
        let reserves1Pre = new BN(reserves[1].toString());

        // rescale
        let reserves0 = rescale(reserves0Pre, token0Decimals, 18);
        let reserves1 = rescale(reserves1Pre, token1Decimals, 18);

        let kInit = k(reserves0, reserves1);
        console.log(`kInit:    ${kInit}`)

        // домножаем на е18 т.к. надо скомпенсировать то что вместо 4*е18 осталось только одно
        let t1 = kInit.divn(2).mul(E18);
        // домножаем на е18 чтобы скомпенсировать еще 2*е18, компенсируется два т.к. перед этим уже был
        // корень из числа и поулчается что домножение как бы удвается по сути
        let t2 = sqrt(t1).mul(E18);
        // и тут y уже нормированный в е18 поулчается
        let y = sqrt(t2);
        // let y = sqrt(sqrt(kInit.divn(2)));
        console.log(`t1:    ${t1}`)
        console.log(`t2:    ${t2}`)
        console.log(`y:    ${y}`)


        let amountInUnscaled;
        let tokenInRes;
        if (reserves0.lt(y)) {
            tokenInRes = token0;
            let amountInRes = y.sub(reserves0);
            amountInUnscaled = rescale(amountInRes, 18, token0Decimals)
        } else {
            tokenInRes = token1;
            let amountInRes = y.sub(reserves1);
            amountInUnscaled = rescale(amountInRes, 18, token1Decimals)
        }

        console.log(`tokenInRes: ${tokenInRes.address}`)
        console.log(`amountInUnscales: ${amountInUnscaled}`)

        let amountInUnscaledWithFee = amountInUnscaled.mul(SWAP_FEE).div(SWAP_FEE.subn(1))
        console.log(`amountInUnscaledWithFee: ${amountInUnscaledWithFee}`)

        return {
            amountIn: amountInUnscaledWithFee,
            tokenIn: tokenInRes
        };
    }


    // same to getAmountOut()
    async function calcAOutForDY(pool, amountIn, tokenIn) {
        let amountOut = await pool.getAmountOut(
            amountIn.toString(), tokenIn.address
        );
        return new BN(amountOut.toString());
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

    async function swapDY(tokenIn, tokenOut, amountIn) {
        await tokenIn.approve(dystRouter.address, amountIn.toString());
        let result = await dystRouter.callStatic.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            tokenIn.address,
            tokenOut.address,
            true,
            wallet.address,
            MAX_UINT256.toString()
        );
        await dystRouter.swapExactTokensForTokensSimple(
            amountIn.toString(),
            0,
            tokenIn.address,
            tokenOut.address,
            true,
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
