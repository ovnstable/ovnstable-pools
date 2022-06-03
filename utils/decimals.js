const BN = require("bn.js");
module.exports = {

    toE18: (value) => value * 10 ** 18,
    fromE18: (value) => value / 10 ** 18,

    toE6: (value) => value * 10 ** 6,
    fromE6: (value) => value / 10 ** 6,

    toEX: (value, x) => value * 10 ** x,
    fromEX: (value, x) => value / 10 ** x,

    toUSDC: (value) => value * 10 ** 6,
    fromUSDC: (value) => value / 10 ** 6,

    toOvn: (value) => value * 10 ** 6,
    fromOvn: (value) => value / 10 ** 6,

    toOvnGov: (value) => value * 10 ** 18,
    fromOvnGov: (value) => value / 10 ** 18,

    pointed: (value, decimals) => {
        let str = value.toString();
        if (str.length <= decimals) {
            return "0." + "0".repeat(decimals - str.length) + str;
        }

        let main = str.slice(0, str.length - decimals);
        let fraction = str.slice(str.length - decimals, str.length);
        return main + "." + fraction;
    },

}
