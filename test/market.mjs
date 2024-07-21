import { getNanoPrice, getPairRate, getReverseRate, getWowneroPrice, getWowneroQuantity } from "../modules/getMarket.mjs";

// console.log(await getWowneroPrice(true, 1000));
// console.log(await getWowneroPrice(false, 1000));
// console.log(await getNanoPrice());

// console.log(await getWowneroQuantity(true, 10));
// console.log(await getWowneroQuantity(false, 10));

// console.log(await getPairRate("XNO/WOW", 100));
// console.log(await getPairRate("WOW/XNO", 100));

console.log(await getReverseRate("XNO/WOW", 100));
console.log(await getReverseRate("WOW/XNO", 100));