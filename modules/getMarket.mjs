import Decimal from 'decimal.js';
import axios from 'axios';
import config from '../config/general.json' assert { type: 'json' };

export async function getWowneroPrice(achat = true, quantity) {

    const nonkyc = await axios.get("https://api.nonkyc.io/api/v2/market/getorderbookbysymbol/WOW_USDT");

    if (achat == true) {
        const bids = nonkyc.data.asks;
        let quantity_rest = quantity;
        let t_price = 0;
        bids.forEach(bid => {
            if (quantity_rest != 0) {
                const price = bid.price;
                const numberprice = bid.numberprice;
                const quantity = bid.quantity;
            
                if (quantity < quantity_rest) {
                    quantity_rest = new Decimal(quantity_rest).minus(new Decimal(quantity));
                    t_price = new Decimal(t_price).plus(new Decimal(quantity).mul(new Decimal(price)));
                } else {
                    t_price = new Decimal(t_price).plus(new Decimal(quantity_rest).mul(new Decimal(price))); 
                    quantity_rest = 0;
                }
            }
        });

        return new Decimal(t_price).mul(new Decimal(config["marge"]));
    } else {
        const bids = nonkyc.data.bids;
        let quantity_rest = quantity;
        let t_price = 0;
        bids.forEach(bid => {
            if (quantity_rest != 0) {
                const price = bid.price;
                const numberprice = bid.numberprice;
                const quantity = bid.quantity;
            
                if (quantity < quantity_rest) {
                    quantity_rest = new Decimal(quantity_rest).minus(new Decimal(quantity));
                    t_price = new Decimal(t_price).plus(new Decimal(quantity).mul(new Decimal(price)));
                } else {
                    t_price = new Decimal(t_price).plus(new Decimal(quantity_rest).mul(new Decimal(price))); 
                    quantity_rest = 0;
                }
            }
        });

        return new Decimal(t_price).mul(new Decimal(config["marge"]));
    }

}

export async function getWowneroQuantity(achat = true, pr) {

    const nonkyc = await axios.get("https://api.nonkyc.io/api/v2/market/getorderbookbysymbol/WOW_USDT");

    if (achat == true) {
        const bids = nonkyc.data.asks;
        let t_quantity = 0;
        let t_price = pr;
        bids.forEach(bid => {
            if (t_price != 0) {
                const price = bid.price;
                const numberprice = bid.numberprice;
                const quantity = bid.quantity;
                const theTPrice = new Decimal(price).mul(new Decimal(quantity));
                if (theTPrice < t_price) {
                    t_price = new Decimal(t_price).minus(new Decimal(theTPrice));
                    t_quantity = new Decimal(t_quantity).plus(new Decimal(quantity));
                } else {
                    t_quantity = new Decimal(t_quantity).plus(new Decimal(t_price).dividedBy(new Decimal(price))); 
                    t_price = 0
                }
            }
        });

        return new Decimal(t_quantity).mul(new Decimal(config["marge"]));
    } else {
        const bids = nonkyc.data.bids;
        let t_quantity = 0;
        let t_price = pr;
        bids.forEach(bid => {
            if (t_price != 0) {
                const price = bid.price;
                const numberprice = bid.numberprice;
                const quantity = bid.quantity;
                const theTPrice = new Decimal(price).mul(new Decimal(quantity));
                if (theTPrice < t_price) {
                    t_price = new Decimal(t_price).minus(new Decimal(theTPrice));
                    t_quantity = new Decimal(t_quantity).plus(new Decimal(quantity));
                } else {
                    t_quantity = new Decimal(t_quantity).plus(new Decimal(t_price).dividedBy(new Decimal(price))); 
                    t_price = 0
                }
            }
        });

        return new Decimal(t_quantity).mul(new Decimal(config["marge"]));
    }

}

export async function getNanoPrice() {
    const nanswap = await axios.get("https://data.nanswap.com/nano-price-stats?toCurrency=USD");

    return nanswap.data[0].midPrice
}

export async function getPairRate(pair, amount) {
    const NanoPrice = await getNanoPrice();
    if (pair == "XNO/WOW") {
        const totalUSD = new Decimal(amount).mul(new Decimal(NanoPrice));
        return await getWowneroQuantity(true, totalUSD);
    } else if (pair == "WOW/XNO") {
        const totalUSD = await getWowneroPrice(false, amount);
        return new Decimal(totalUSD).dividedBy(new Decimal(NanoPrice))
    } else {
        return false;
    }
}

export async function getReverseRate(pair, amount) {
    const NanoPrice = await getNanoPrice();
    if (pair == "XNO/WOW") {
        const totalUSD = await getWowneroPrice(true, amount);
        return new Decimal(totalUSD).mul(new Decimal(NanoPrice));
    } else if (pair == "WOW/XNO") {
        const totalUSD = new Decimal(NanoPrice).mul(amount);
        return await getWowneroQuantity(false, totalUSD);
    } else {
        return false;
    }
}