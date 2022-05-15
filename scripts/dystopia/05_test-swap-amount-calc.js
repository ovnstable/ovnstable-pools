const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const {ZERO_ADDRESS, MAX_UINT256} = require("@openzeppelin/test-helpers/src/constants");
const {toEX, toE6} = require("../../utils/decimals");
const {evmCheckpoint, evmRestore} = require("../../utils/sharedBeforeEach")
const {toE18} = require("../balancer-stable-pool-test-commons");


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));
let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));

let IDystopiaPairAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaPair.json')).abi;
let IDystopiaRouterAbi = JSON.parse(fs.readFileSync('./abi/build/IDystopiaRouter.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let dystRouterAddress = "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e"

// replace addresses from create script
let dystPoolUsdcUsdPlusAddress = "0x421a018cC5839c4C0300AfB21C725776dc389B1a";


let gasOpts = {
    maxFeePerGas: "250000000000",
    maxPriorityFeePerGas: "250000000000"
};

let E18 = new BN(10).pow(new BN(18));

async function main() {

    let wallet = await initWallet(ethers);

    let dystRouter = await ethers.getContractAt(IDystopiaRouterAbi, dystRouterAddress, wallet);

    let dystPoolUsdcUsdPlus = await ethers.getContractAt(IDystopiaPairAbi, dystPoolUsdcUsdPlusAddress, wallet);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let weth = await ethers.getContractAt(ERC20, wethAddress, wallet);
    let wmatic = await ethers.getContractAt(ERC20, wmaticAddress, wallet);
    let usdc = await ethers.getContractAt(ERC20, usdcAddress, wallet);


    // await printUserBalances("before");
    await evmCheckpoint("default");
    try {
        await printBalancesQsPool(dystPoolUsdcUsdPlus)

        // let amountInUsdPlusToUsdc = toE6(9.995);
        let amountInUsdPlusToUsdc = new BN(toE6(1).toString());
        await swap5050(dystPoolUsdcUsdPlus, usdPlus, usdc, amountInUsdPlusToUsdc);

        // let amountInUsdcToUsdPlus = toE6(1000);
        // await swap5050(dystPoolUsdcUsdPlus, usdc, usdPlus, amountInUsdcToUsdPlus);

    } catch (e) {
        console.log(e);
    }
    // await printUserBalances("after");
    await evmRestore("default");


    async function swap5050(pool, tokenIn, tokenOut, amountIn) {

        let reserves = await pool.getReserves();
        console.log(`reserves[0]:  ${reserves[0]}`)
        console.log(`reserves[1]:  ${reserves[1]}`)

        console.log(`amountIn:     ${amountIn}`)
        console.log(`tokenIn:      ${tokenIn.address}`)
        console.log(`tokenOut:     ${tokenOut.address}`)

        let amountOutFromRouter = await dystRouter.getAmountOut(
            amountIn.toString(), tokenIn.address, tokenOut.address
        );
        console.log(`amountOutFromRouter:    ${amountOutFromRouter[0]}`)

        let amountOutFromPool = await dystPoolUsdcUsdPlus.getAmountOut(
            amountIn.toString(), tokenIn.address
        );
        console.log(`amountOutFromPool:      ${amountOutFromPool}`)


        let token0Address = await pool.token0();
        let token1Address = await pool.token1();
        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);
        let token0Decimals = await token0.decimals();
        let token1Decimals = await token1.decimals();


        let reserves0 = new BN(reserves[0].toString());
        let reserves1 = new BN(reserves[1].toString());

        let kInit = k(reserves0, reserves1, token0Decimals, token1Decimals);
        console.log(`kInit:    ${kInit}`)



        // rescale
        reserves0 = rescale(reserves0, token0Decimals, 18);
        reserves1 = rescale(reserves1, token1Decimals, 18);

        let SWAP_FEE = new BN(2000);

        console.log(`amountIn before fee: ${amountIn}`)
        amountIn = amountIn.sub(amountIn.div(SWAP_FEE));
        console.log(`amountIn before fee: ${amountIn}`)


        // let reserveA;
        // let reserveB;
        // let amountInScaled;
        //
        // if (tokenIn.address === token0Address) {
        //     reserveA = reserves0;
        //     reserveB = reserves1;
        //     amountInScaled = rescale(amountIn, token0Decimals, 18);
        // } else {
        //     reserveB = reserves0;
        //     reserveA = reserves1;
        //     amountInScaled = rescale(amountIn, token1Decimals, 18);
        // }
        // console.log(`reserveA:       ${reserveA}`)
        // console.log(`reserveB:       ${reserveB}`)
        // console.log(`amountInScaled: ${amountInScaled}`)



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
        if(reserves0.lt(y)){
            tokenInRes = token0;
            let amountInRes = y.sub(reserves0);
            amountInUnscaled = rescale(amountInRes, 18, token0Decimals)
        }else {
            tokenInRes = token1;
            let amountInRes = y.sub(reserves1);
            amountInUnscaled = rescale(amountInRes, 18, token1Decimals)
        }

        console.log(`tokenInRes: ${tokenInRes.address}`)
        console.log(`amountInUnscales: ${amountInUnscaled}`)

        // amountIn = amountIn.sub(amountIn.div(SWAP_FEE));

        let amountInUnscaledWithFee = amountInUnscaled.mul(SWAP_FEE).div(SWAP_FEE.subn(1))
        console.log(`amountInUnscaledWithFee: ${amountInUnscaledWithFee}`)




    }


    function f(x0, y) {
        let a = x0.mul(y).mul(y).div(E18).mul(y).div(E18).div(E18);
        let b = x0.mul(x0).div(E18).mul(x0).div(E18).mul(y).div(E18);
        return a.add(b);
    }


    function k(x, y, decimals0, decimals1) {
        let _x = rescale(x, decimals0, 18);
        let _y = rescale(y, decimals1, 18);

        // 18+18-18=18
        let _a = _x.mul(_y).div(E18);
        // 18+18-18=18, 18+18-18=18
        let _b = _x.mul(_x).div(E18).add(_y.mul(_y).div(E18));
        // x3y+y3x >= k
        // 18+18-18=18
        return _a.mul(_b).div(E18);
    }


    function rescale(value, fromDecimals, toDecimals) {
        let from = new BN(10).pow(new BN(fromDecimals));
        let to = new BN(10).pow(new BN(toDecimals));
        return value.mul(to).div(from);
    }

    // function sqrt(num) {
    //     if (num.lt(new BN(0))) {
    //         throw new Error("Sqrt only works on non-negtiave inputs")
    //     }
    //     if (num.lt(new BN(2))) {
    //         return num
    //     }
    //
    //     const smallCand = sqrt(num.shrn(2)).shln(1)
    //     const largeCand = smallCand.add(new BN(1))
    //
    //     if (largeCand.mul(largeCand).gt(num)) {
    //         return smallCand
    //     } else {
    //         return largeCand
    //     }
    // }


    function sqrt(x) {
        let z = x.addn(1).divn(2);
        let y = x;
        while (z.lt(y)) {
            y = z;
            z = x.div(z).add(z).divn(2);
        }
        return y;
    }


    async function printBalancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        console.log(`token0: ${token0Address}`)
        console.log(`token1: ${token1Address}`)

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        let token0Decimals = await token0.decimals();
        let token1Decimals = await token1.decimals();

        let reserve0Normalized = reserves[0] / 10 ** token0Decimals;
        let reserve1Normalized = reserves[1] / 10 ** token1Decimals;

        let price0Per1 = reserve0Normalized / reserve1Normalized;
        let price1Per0 = reserve1Normalized / reserve0Normalized;

        let balances0 = await token0.balanceOf(pool.address);
        let balances1 = await token1.balanceOf(pool.address);

        let balances0Normalized = balances0 / 10 ** token0Decimals;
        let balances1Normalized = balances1 / 10 ** token1Decimals;

        console.log(`-- balances for QS pool of ${token0Symbol}/${token1Symbol}`)
        console.log(`token0[${token0Symbol}]: ${reserve0Normalized}`)
        console.log(`token0[${token0Symbol}]: ${balances0Normalized}`)
        console.log(`token1[${token1Symbol}]: ${reserve1Normalized}`)
        console.log(`token1[${token1Symbol}]: ${balances1Normalized}`)
        console.log(`price0Per1: ${price0Per1}`);
        console.log(`price1Per0: ${price1Per0}`);
        console.log(`-------------------------------------`)
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
