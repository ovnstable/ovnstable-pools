const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const BN = require('bn.js');
const {initWallet} = require("../../utils/network");
const univ3prices = require('@thanpolas/univ3prices')


let ERC20 = JSON.parse(fs.readFileSync('./abi/ERC20.json'));

let iUniswapV2FactoryAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Factory.json')).abi;
let iUniswapV2PairAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV2Pair.json')).abi;
let iUniswapV3PoolAbi = JSON.parse(fs.readFileSync('./abi/build/IUniswapV3Pool.json')).abi;

let usdcAddress = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
let wethAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
let wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

let qsFactoryAddress = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
let qsRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

let uniV3PoolWmaticUsdcAddress = "0xa374094527e1673a86de625aa59517c5de346d32"
let uniV3PoolUsdcWethAddress = "0x45dda9cb7c25131df268515131f647d726f50608"

let qsPoolWmaticUsdcAddress = "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827"
let qsPoolUsdcWethAddress = "0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d"


async function main() {

    let wallet = await initWallet(ethers);
    let qsFactory = await ethers.getContractAt(iUniswapV2FactoryAbi, qsFactoryAddress, wallet);
    let qsPoolWmaticUsdc = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolWmaticUsdcAddress, wallet);
    let qsPoolUsdcWeth = await ethers.getContractAt(iUniswapV2PairAbi, qsPoolUsdcWethAddress, wallet);

    let uniV3PoolWmaticUsdc = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolWmaticUsdcAddress, wallet);
    let uniV3PoolUsdcWeth = await ethers.getContractAt(iUniswapV3PoolAbi, uniV3PoolUsdcWethAddress, wallet);


    let qsPairWmaticUsdc = await qsFactory.getPair(
        wmaticAddress,
        usdcAddress
    );
    let qsPairUsdcWeth = await qsFactory.getPair(
        usdcAddress,
        wethAddress
    );
    console.log(`pairWmaticUsdc address: ${qsPairWmaticUsdc}`);
    console.log(`pairUsdcWeth address:   ${qsPairUsdcWeth}`);
    console.log(`-------------------------------------`)

    await printBalancesQsPool(qsPoolWmaticUsdc);
    await printBalancesQsPool(qsPoolUsdcWeth);

    await printBalancesUniV3(uniV3PoolWmaticUsdc);
    await printBalancesUniV3(uniV3PoolUsdcWeth);


    async function printBalancesUniV3(pool) {

        let slotUsdcWeth = await pool.slot0();
        let sqrtPriceX96UsdcWeth = slotUsdcWeth[0];
        let liquidity = await pool.liquidity();


        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        const tokenDecimals = [
            await token0.decimals(),
            await token1.decimals(),
        ];

        let price0Per1 = univ3prices.sqrtPrice(tokenDecimals, sqrtPriceX96UsdcWeth).toFixed({
            reverse: false,
            decimalPlaces: 18,
        });
        let price1Per0 = univ3prices.sqrtPrice(tokenDecimals, sqrtPriceX96UsdcWeth).toFixed({
            reverse: true,
            decimalPlaces: 18,
        });

        console.log(`-- info for Uni V3 pool of ${token0Symbol}/${token1Symbol}`)
        console.log(`liquidity: ${liquidity}`)
        console.log(`price0Per1: ${price0Per1}`);
        console.log(`price1Per0: ${price1Per0}`);
        console.log(`-------------------------------------`)
    }

    async function printBalancesQsPool(pool) {
        let reserves = await pool.getReserves();
        let token0Address = await pool.token0();
        let token1Address = await pool.token1();

        let token0 = await ethers.getContractAt(ERC20, token0Address, wallet);
        let token1 = await ethers.getContractAt(ERC20, token1Address, wallet);

        let token0Symbol = await token0.symbol();
        let token1Symbol = await token1.symbol();

        let reserve0Normalized = reserves[0] / 10 ** (await token0.decimals());
        let reserve1Normalized = reserves[1] / 10 ** (await token1.decimals());

        let price0Per1 = reserve0Normalized / reserve1Normalized;
        let price1Per0 = reserve1Normalized / reserve0Normalized;

        console.log(`-- balances for QS pool of ${token0Symbol}/${token1Symbol}`)
        console.log(`token0[${token0Symbol}]: ${reserve0Normalized}`)
        console.log(`token1[${token1Symbol}]: ${reserve1Normalized}`)
        console.log(`price0Per1: ${price0Per1}`);
        console.log(`price1Per0: ${price1Per0}`);
        console.log(`-------------------------------------`)
    }


// https://medium.com/taipei-ethereum-meetup/uniswap-v3-features-explained-in-depth-178cfe45f223
    function calculateAmounts(requiredPool) {
        // Fee tier to tick cpacing
        let tickSpacing = feeTierToTickSpacing(requiredPool.feeTier)

        const tokenDecimals = [
            requiredPool.token0.decimals,
            requiredPool.token1.decimals
        ]

        // Get the reserves of Liquidity Pool.
        return univ3prices.getAmountsForCurrentLiquidity(
            tokenDecimals,
            requiredPool.liquidity,
            requiredPool.sqrtPrice,
            tickSpacing,
            {tickStep: 5}
        )
    }

    /*
        Convert fee tiers tick to a price

        https://uniswap.org/whitepaper-v3.pdf
        The initial fee tiers and tick spacings supported
        are 0.05% (with a tick spacing of 10, approximately 0.10% between
        initializable ticks), 0.30% (with a tick spacing of 60, approximately
        0.60% between initializable ticks), and 1% (with a tick spacing of
        200, approximately 2.02% between ticks
    */
    function feeTierToTickSpacing(feeTier) {
        switch (feeTier) {
            case 500:
                return 10
            case 3000:
                return 60
            case 10000:
                return 200
            default:
                return 60
        }
    }


}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
