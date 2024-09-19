import express from 'express';
import config from './config/general.json' assert { type: 'json' };
import swap from './config/swap.json' assert { type: 'json' };
import { getPairRate, getReverseRate } from './modules/getMarket.mjs';
import { generateShortUUID, isValidNanoAddress, isValidWowneroAddress } from './modules/utils.mjs';
import { createDepositAdd, createWithdraw } from './modules/wallet.mjs';
import { changeMoneyDetected, changeMoneyReceive, changeToError, changeToFinish, changeToSending, createPartner, createSwap, getInfoByAddress, getInfoByUUID, getInfoPartnerByUUID } from './modules/db.mjs';
import  TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import { createOrder, getEstimate, getLimits, getLimitsTest, getNanswapCurrency, getOrder } from './modules/nanswap.mjs';
import Decimal from 'decimal.js';

// replace the value below with the Telegram token you receive from @BotFather
const token = config["telegram_token"];

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

bot.sendMessage(config["telegram_chat"], "Le code démarre !!");

const app = express();
const port = config["port"];

// Middleware pour parser le corps des requêtes en JSON
app.use(express.json());

const toCors = { origin: "http://localhost:3000" }
app.use(cors(toCors));

// Route principale qui répond avec "Hello World!"
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Route pour traiter la requête GET avec des arguments
app.get('/get-estimate', async (req, res) => {
  try {
    const { from, to, amount } = req.query;

    if (!from || !to || !amount) {
      return res.status(400).json({ status: 'error', message: 'Les paramètres "from", "to" et "amount" sont requis.' });
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
      return res.status(400).json({ status: 'error', message: 'Le paramètre "amount" doit être un nombre.' });
    }

    let est;
    if ((from === "WOW" && to === "XNO") || (from === "XNO" && to === "WOW")) {
      est = Number(await getPairRate(`${from}/${to}`, amountNumber));
    } else if (from !== "WOW") {
      if (to !== "WOW") {
        est = (await getEstimate(from, to, amountNumber)).amountTo;
      } else {
        const esto = await getEstimate(from, "XNO", amountNumber);
        est = Number(await getPairRate(`XNO/${to}`, esto.amountTo));
      }
    } else {
      if (to !== "XNO") {
        const esto = Number(await getPairRate(`WOW/XNO`, amountNumber));
        est = (await getEstimate("XNO", to, esto)).amountTo;
      } else {
        est = Number(await getPairRate(`WOW/XNO`, amountNumber));
      }
    }

    res.json({ from, to, amountFrom: amountNumber, amountTo: est });
  } catch (error) {
    console.error('Erreur dans /get-estimate:', error);
    res.json({ status: 'error' });
  }
});

app.get('/get-estimate-reverse', async (req, res) => {
  try {
    const { from, to, amount } = req.query;

    if (!from || !to || !amount) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Les paramètres "from", "to" et "amount" sont requis.' 
      });
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Le paramètre "amount" doit être un nombre.' 
      });
    }

    const toAmount = Number(await getReverseRate(`${from}/${to}`, amountNumber));

    res.json({ 
      status: 'success',
      from, 
      to, 
      amountFrom: toAmount, 
      amountTo: amountNumber 
    });
  } catch (error) {
    console.error('Erreur dans /get-estimate-reverse:', error);
    res.json({ status: 'error' });
  }
});

app.get('/get-limits', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        status: 'error',
        message: 'Les paramètres "from" et "to" sont requis.'
      });
    }

    if (from === to) {
      return res.json({ status: "error", message: "Les devises 'from' et 'to' ne peuvent pas être identiques." });
    }

    const limits = await getLimitsTest(from.toUpperCase(), to.toUpperCase());
    res.json(limits);

  } catch (error) {
    console.error('Erreur dans /get-limits:', error);
    res.json({ status: "error" });
  }
});

// Route pour créer un nouvel élément
app.post('/create-order', async (req, res) => {
  try {
    const { from, to, amount, toAddress } = req.body;

    if (!from || !to || !amount) {
      return res.json({ status: "error", message: 'Les paramètres "from", "to" et "amount" sont requis.' });
    }

    const amountNumber = Number(amount);
    console.log(amountNumber);
    if (isNaN(amountNumber)) {
      return res.json({ status: "error", message: 'Le paramètre "amount" doit être un nombre.' });
    }

    const limitsTest = await getLimitsTest(from.toUpperCase(), to.toUpperCase());
    console.log(limitsTest);
    if (Number(limitsTest.min) > amountNumber) {
      return res.json({ status: "error", message: 'Le montant doit être supérieur au montant minimum' });
    }

    if (Number(limitsTest.max) < amountNumber) {
      return res.json({ status: "error", message: 'Le montant doit être inférieur au montant maximum' });
    }

    if (from !== "WOW" && to !== "WOW") {
      const order = await createOrder(from, to, amountNumber, toAddress);
      if (order.error) {
        return res.json(order);
      }
      const extraId = order.payinExtraId || null;
      await createPartner(order.id, order.from, order.to, null, extraId, order.payinAddress, order.payoutAddress, order.expectedAmountFrom, order.expectedAmountTo);
      return res.json({
        id: order.id,
        partnerId: order.id,
        from,
        to,
        expectedAmountFrom: order.expectedAmountFrom,
        expectedAmountTo: order.expectedAmountTo,
        payinAddress: order.payinAddress,
        payoutAddress: order.payoutAddress,
        extraId
      });
    }

    if (from === "WOW" && to !== "XNO") {
      const estimate = await getPairRate("WOW/XNO", amountNumber);
      const order = await createOrder("XNO", to, estimate, toAddress);
      console.log(order);
      if (order.error) {
        return res.json({status: "error", message: order.error})
      }
      const uuid = generateShortUUID();
      const deposit = await createDepositAdd(from);
      await createSwap(from, "XNO", amountNumber, estimate, deposit, order.payinAddress, "nop", "nop", uuid);
      const extraId = order.payinExtraId || null;
      await createPartner(order.id, order.from, order.to, uuid, extraId, order.payinAddress, order.payoutAddress, order.expectedAmountFrom, order.expectedAmountTo);
      return res.json({
        id: uuid,
        partnerId: order.id,
        from,
        to,
        expectedAmountFrom: amountNumber,
        expectedAmountTo: order.expectedAmountTo,
        payinAddress: deposit,
        payoutAddress: order.payoutAddress
      });
    }

    if (from !== "XNO" && to === "WOW") {
      const uuid = generateShortUUID();
      const deposit = await createDepositAdd("XNO");
      const order = await createOrder(from, "XNO", amountNumber, deposit);
      const estimate = await getPairRate("XNO/WOW", order.expectedAmountTo);
      const extraId = order.payinExtraId || null;
      await createPartner(order.id, order.from, order.to, uuid, extraId, order.payinAddress, order.payoutAddress, order.expectedAmountFrom, order.expectedAmountTo);
      await createSwap("XNO", "WOW", order.expectedAmountTo, estimate, deposit, toAddress, "nop", "nop", uuid);
      return res.json({
        id: uuid,
        partnerId: order.id,
        from,
        to,
        expectedAmountFrom: amountNumber,
        expectedAmountTo: estimate,
        payinAddress: order.payinAddress,
        payoutAddress: toAddress,
        extraId
      });
    }

    if ((from === "XNO" || from === "WOW") && (to === "XNO" || to === "WOW")) {
      if (to === "WOW" && !isValidWowneroAddress(toAddress)) {
        return res.json({ status: "error", message: "Adresse Wownero invalide" });
      }
      if (to === "XNO" && !isValidNanoAddress(toAddress)) {
        return res.json({ status: "error", message: "Adresse Nano invalide" });
      }

      const amountTo = await getPairRate(`${from}/${to}`, amountNumber);
      const uuid = generateShortUUID();
      const deposit = await createDepositAdd(from);
      await createSwap(from, to, amountNumber, amountTo, deposit, toAddress, "nop", "nop", uuid);
      return res.json({
        id: uuid,
        from,
        to,
        expectedAmountFrom: amountNumber,
        expectedAmountTo: Number(amountTo),
        payinAddress: deposit,
        payoutAddress: toAddress
      });
    }

    return res.json({ status: "error", message: "Combinaison de devises non prise en charge" });
  } catch (error) {
    console.error('Erreur dans /create-order:', error);
    return res.json({ status: "error" });
  }
});

app.post('/callback', async (req, res) => {
    const inputData = req.body;
    const headers = req.headers;
    console.log(inputData);
    if (headers.auth && headers.auth == config["nanauth"]) {
        if (inputData) {
            if (inputData.ticket && inputData.amount && inputData.address && inputData.tx_hash && inputData.tx_status) {
                
                const addUser = await getInfoByAddress(inputData.address);
                if (inputData.tx_status == "finish") {
                    console.log("etape 1");
                    if (Number(swap[`min${inputData.ticket.toUpperCase()}`]) <= Number(inputData.amount)) {
                        console.log("etape 2");
                        if (addUser) {
                            console.log("etape 3");

                            const fromCurrency = addUser["fromd"];
                            const toCurrency = addUser["tod"];
                            const amountTo = await getPairRate(`${fromCurrency.toUpperCase()}/${toCurrency.toUpperCase()}`, inputData.amount)
                            const newDepo = await changeMoneyReceive(inputData.tx_hash, inputData.address, inputData.amount, amountTo);
                            if (newDepo != false) {
                                console.log("etape 4");

                                await changeToSending(inputData.address);
                                if (Number(swap[`max${inputData.ticket.toUpperCase()}`]) >= Number(inputData.amount)) {
                                    console.log("etape 5");

                                    const wht = await createWithdraw(toCurrency.toUpperCase(), amountTo, addUser["payoutAddress"]);

                                    if (wht != false) {
                                        await changeToFinish(inputData.address, wht);
                                        bot.sendMessage(config["telegram_chat"], `New swap: ${inputData.address}, ${inputData.amount} ${fromCurrency}=>${amountTo} ${toCurrency}`);
                                    } else {
                                        await changeToError(inputData.address);
                                        bot.sendMessage(config["telegram_chat"], `New error: ${inputData.address}`);
                                    }
                                } else {
                                    bot.sendMessage(config["telegram_chat"], `New max: ${inputData.address}`);
                                }
                            }
                        }
                    }
                } else if (inputData.tx_status == "pending") {
                  await changeMoneyDetected(inputData.address);
                }
            }
        }  
    }  
    res.json({status: "ok"})
  });

app.get('/get-order', async (req, res) => {
    // Récupérer les arguments de la requête
    const id = req.query.id;
    
    const data = await getInfoByUUID(id);
    console.log(data);

    if (data) {
        res.json({ id: id, fromAmount: Number(data["amountFrom"]), toAmount: Number(data["amountTo"]), status: data["status"], from: data["fromd"], to: data["tod"], payinAddress: data["payinAddress"], payoutAddress: data["payoutAddress"], payinHash: data["payinHash"], payoutHash: data["payoutHash"] });
    } else {
        res.json({error: "Transaction doesn't exist"});
    }
  });

app.get('/get-order-all', async (req, res) => {
    // Récupérer les arguments de la requête
    const id = req.query.id;
    const partnerOrder = await getOrder(id);
    const partnerData = await getInfoPartnerByUUID(id);

    if (partnerData && !partnerOrder.error) {
      if (partnerData.our_id !== null) {
        const ourData = await getInfoByUUID(partnerData.our_id);
        if (ourData.fromd == "WOW") {
          let status;

          if (ourData.status == "pending") {
            status = "pending";
          } else if (ourData.status == "detected") {
            status = "detected";
          } else if (ourData.status == "error") {
            status = "error";
          } else {
            status = "exchanging";
          }

          let payoutHash = null;
          if (partnerOrder.status == "sending") {
            status = "sending";
          } else if (partnerOrder.status == "completed") {
            status = "completed";
            payoutHash = partnerOrder.payoutHash;
          } else if (partnerOrder.status == "error") {
            bot.sendMessage(config["telegram_chat"], `New partner error on ${id}, our ID: ${partnerData.our_id}`);
          }

          res.json({ id: id, fromAmount: Number(ourData.amountFrom), toAmount: Number(partnerOrder.expectedAmountTo), status: status, from: ourData.fromd, to: partnerData.toC, payinAddress: ourData.payinAddress, payoutAddress: partnerData.payoutAddress, payinHash: ourData.payinHash, payoutHash: partnerOrder.payoutHash });
        } else {
          let status;

          if (partnerOrder.status == "waiting") {
            status = "pending";
          } else if (partnerOrder.status == "error") {
            status = "error";
            bot.sendMessage(config["telegram_chat"], `New partner error on ${id}, our ID: ${partnerData.our_id}`);
          } else {
            status = "exchanging";
          }

          if (ourData.status == "sending") {
            status = "sending";
          } else if (ourData.status == "completed") {
            status = "completed";
          } 

          res.json({ id: id, fromAmount: Number(partnerOrder.expectedAmountFrom), toAmount: Number(ourData.amountTo), status: status, from: partnerData.fromC, to: ourData.tod, payinAddress: partnerData.payinAddress, payoutAddress: ourData.payoutAddress, payinHash: partnerOrder.payinHash, payoutHash: ourData.payoutHash });
        }
      } else {
        res.json({ id: id, fromAmount: Number(partnerOrder.expectedAmountFrom), toAmount: Number(partnerOrder.expectedAmountTo), status: partnerOrder.status, from: partnerOrder.from, to: partnerOrder.to, payinAddress: partnerOrder.payinAddress, payoutAddress: partnerOrder.payoutAddress, payinHash: partnerOrder.payinHash, payoutHash: partnerOrder.payoutHash });
      }
    } else {
        res.json({error: "Transaction doesn't exist"});
    }
  });

app.get('/all-currencies', async (req, res) => {
    const data = await getNanswapCurrency();

    res.json(data);
  });

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en écoute sur http://localhost:${port}`);
});
