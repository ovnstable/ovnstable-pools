const hre = require("hardhat");
const fs = require("fs");

const axios = require('axios')


const EXCHANGE = '0x6b3712943a913eb9a22b71d4210de6158c519970'


async function main() {

    // ----------

    let base = `https://api.polygonscan.com/api`
    let params = {
        module: 'account',
        action: 'txlist',
        address: EXCHANGE,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 10000,
        sort: 'desc',
        apikey: 'TYH6I5MDMJSF73TW9G3D6DVES8MCF2UV3M'
    };

    let res = await axios.get(base, {params});
    let result = res.data.result;
    let i = 0;
    for (const transactionInfo of result) {
        // console.log(`${transactionInfo.isError}`)
        if (transactionInfo.isError === "1") {

            let method;
            if (transactionInfo.input.startsWith("0x1e9a6950")) {
                // console.log(`redeem 0x1e9a6950`)
                method = 'redeem'
            } else if (transactionInfo.input.startsWith("0xcce7ec13")) {
                // console.log(`buy 0xcce7ec13`)
                method = 'buy   '
            } else if (transactionInfo.input.startsWith("0x63bd1d4a")) {
                // console.log(`payout 0x63bd1d4a`)
                method = 'payout'
            }
            console.log(`${new Date(transactionInfo.timeStamp * 1000).toLocaleString()} ${method} ${transactionInfo.hash} from ${transactionInfo.from}`);

        }
        // if (transactionInfo.hash === '0xe1c40dc08c177f6d310b23b8c3f17d5edf7bbc669a1f6a5dac56f1824ffc18fb') {
        //     // console.log(`${transactionInfo.hash} from ${transactionInfo.from}`);
        //     console.log(`${JSON.stringify(transactionInfo, null, 2)}`);
        //
        // }
        i++;
    }
    console.log(`i ${i}`)
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

