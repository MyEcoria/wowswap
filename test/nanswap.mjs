import { createOrder, getNanswapCurrency } from "../modules/nanswap.mjs";

console.log(await getNanswapCurrency());
console.log(await createOrder("BAN", "BTC", 10000, "nano_3ktmq6dpwcc694hrnjzfdykbqeuj4w5w8nut3uqm5pgwa4m9jmstoc4ntu6p"));