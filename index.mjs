import express from 'express';
import config from './config/general.json' assert { type: 'json' };
import swap from './config/swap.json' assert { type: 'json' };
import { getPairRate, getReverseRate } from './modules/getMarket.mjs';
import { generateShortUUID, isValidNanoAddress, isValidWowneroAddress } from './modules/utils.mjs';
import { createDepositAdd, createWithdraw } from './modules/wallet.mjs';
import { changeMoneyDetected, changeMoneyReceive, changeToError, changeToFinish, changeToSending, createPartner, createSwap, getInfoByAddress, getInfoByUUID } from './modules/db.mjs';
import  TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';
import { createOrder, getEstimate, getLimits, getNanswapCurrency } from './modules/nanswap.mjs';
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

const toCors = { origin: "https://nanswap.com" }
app.use(cors(toCors));

// Route principale qui répond avec "Hello World!"
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Route pour traiter la requête GET avec des arguments
app.get('/get-estimate', async (req, res) => {
    // Récupérer les arguments de la requête
    const from = req.query.from;
    const to = req.query.to;
    const amount = req.query.amount;
  
    // Vérifier que tous les arguments sont présents
    if (!from || !to || !amount) {
      return res.status(400).send('Les paramètres "from", "to" et "amount" sont requis.');
    }  

    // Vérifier que amount est un nombre
    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
        return res.status(400).send('Le paramètre "amount" doit être un nombre.');
    }

    let est;
    if ((from == "WOW" && to == "XNO") || (from == "XNO" && to == "WOW")) {
      est = Number(await getPairRate(`${from}/${to}`, amountNumber));
    } else {
      if (from !== "WOW") {
        if (to !== "WOW") {
          console.log("1");
          est = (await getEstimate(from, to, amountNumber)).amountTo;
        } else {
          console.log("2");
          const esto = await getEstimate(from, "XNO", amountNumber);
          est = Number(await getPairRate(`XNO/${to}`, esto.amountTo));
        }
      } else {
        if (to !== "XNO") {
          console.log("3");
          const esto = Number(await getPairRate(`WOW/XNO`, amountNumber));
          est = (await getEstimate("XNO", to, esto)).amountTo;
        } else {
          console.log("4");
          est = Number(await getPairRate(`WOW/XNO`, amountNumber));
        }
      }
    }

    // const toAmount = Number(await getPairRate(`${from}/${to}`, amountNumber));
    // Envoyer la réponse
    res.json({ from: from, to: to, amountFrom: amountNumber, amountTo: est });
  });

app.get('/get-estimate-reverse', async (req, res) => {
    // Récupérer les arguments de la requête
    const from = req.query.from;
    const to = req.query.to;
    const amount = req.query.amount;
  
    // Vérifier que tous les arguments sont présents
    if (!from || !to || !amount) {
      return res.status(400).send('Les paramètres "from", "to" et "amount" sont requis.');
    }  

    // Vérifier que amount est un nombre
    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
        return res.status(400).send('Le paramètre "amount" doit être un nombre.');
    }

    const toAmount = Number(await getReverseRate(`${from}/${to}`, amountNumber));
    // Envoyer la réponse
    res.json({ from: from, to: to, amountFrom: toAmount, amountTo: amountNumber });
  });

app.get('/get-limits', async (req, res) => {
    // Récupérer les arguments de la requête
    const from = req.query.from;
    const to = req.query.to;
  
    // Vérifier que tous les arguments sont présents
    if (!from || !to) {
      return res.status(400).send('Les paramètres "from", "to" et "amount" sont requis.');
    }

    if (to !== "WOW" && from !== "WOW" && to !== "XNO") {
      console.log("1");
      const limits = await getLimits(from, to);
      return res.json({ from: from, to: to, min: limits.min, max: limits.max });
    }

    if ((from == "XNO" && to == "WOW") || (from == "WOW" && to == "XNO")) {
      console.log("2");
      if (to == "WOW") {
        const minEs = await getPairRate("WOW/XNO", new Decimal(swap[`minWOW`]).plus(new Decimal(5)));
        return res.json({ from: from, to: to, min: Number(minEs), max: swap[`max${from}`] }); 
      } else {
        return res.json({ from: from, to: to, min: swap[`min${from}`], max: swap[`max${from}`] });
      }
    }

    if (from == "WOW" && (to !== "XNO" || to !== "WOW")) {
      console.log("3");
      const limits = await getLimits("XNO", to);
      const minEs = await getPairRate("XNO/WOW", limits.min)
      
      return res.json({ from: from, to: to, min: Number(minEs), max: swap[`max${from}`] });
    }

    if ((from !== "XNO" || from !== "WOW") && (to == "XNO" || to == "WOW")) {
      console.log("4");
      const estim = await getEstimate("XNO", from, swap[`maxXNO`]);
      const limits = await getLimits(from, "XNO");

      let mino;

      if (to == "WOW") {
        const lmt = await getPairRate("WOW/XNO", new Decimal(swap[`minWOW`]).plus(new Decimal(1)));
        const est = await getEstimate("XNO", from, lmt);
        
        mino = est.expectedAmountTo;
      } else {
        mino = limits.min;
      }

      res.json({ from: from, to: to, min: mino, max: estim.amountTo });
    }

    if (from == to) {
        return res.json({status: "error", message: "Invalid to ticket"});
    }
  });

// Route pour créer un nouvel élément
app.post('/create-order', async (req, res) => {
  const body = req.body;
  const from = body.from;
  const to = body.to;
  const amount = body.amount;
  const toAddress = body.toAddress;

  if (!from || !to) {
    return res.status(400).send('Les paramètres "from", "to" et "amount" sont requis.');
  }

  if (from == "WOW" && to !== "XNO") {
    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
        return res.status(400).send('Le paramètre "amount" doit être un nombre.');
    }

    const estimate = await getPairRate("WOW/XNO", amountNumber);
    const order = await createOrder("XNO", to, estimate, toAddress);
    const uuid = generateShortUUID();
    const deposit = await createDepositAdd(from);
    await createSwap(from, "XNO", amountNumber, estimate, deposit, order.payinAddress, "nop", "nop", uuid);
    let extraId;
    if (order.payinExtraId) {
      extraId = order.payinExtraId;
    } else {
      extraId = null;
    }
    await createPartner(order.id, order.from, order.to, uuid, extraId, order.payinAddress, order.payoutAddress, order.expectedAmountFrom, order.expectedAmountTo);
    res.json({id: uuid, from: from, to: to, expectedAmountFrom: amountNumber, expectedAmountTo: order.expectedAmountTo, payinAddress: deposit, payoutAddress: order.payoutAddress});
  }

  if (from !== "XNO" && to == "WOW") {
    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
        return res.status(400).send('Le paramètre "amount" doit être un nombre.');
    }

    const uuid = generateShortUUID();
    const deposit = await createDepositAdd("XNO");

    const order = await createOrder(from, "XNO", amountNumber, deposit);
    const estimate = await getPairRate("XNO/WOW", order.expectedAmountTo);

    let extraId;
    if (order.payinExtraId) {
      extraId = order.payinExtraId;
    } else {
      extraId = null;
    }

    await createPartner(order.id, order.from, order.to, uuid, extraId, order.payinAddress, order.payoutAddress, order.expectedAmountFrom, order.expectedAmountTo);
    await createSwap("XNO", "WOW", order.expectedAmountTo, estimate, deposit, toAddress, "nop", "nop", uuid);
    
    res.json({id: uuid, from: from, to: to, expectedAmountFrom: amountNumber, expectedAmountTo: estimate, payinAddress: order.payinAddress, payoutAddress: toAddress});
  }

  if ((from == "XNO" || from == "WOW") && (to == "XNO" || to == "WOW")) {
    const amountNumber = Number(amount);
      if (isNaN(amountNumber)) {
          return res.status(400).send('Le paramètre "amount" doit être un nombre.');
      }

    if (to == "WOW") {
      if (!isValidWowneroAddress(toAddress)) {
        return res.json({status: "error", message: "Invalid wownero address"});
      }
    } else {
      if (!isValidNanoAddress(toAddress)) {
        return res.json({status: "error", message: "Invalid nano address"});
      }
    }


    const amountTo = await getPairRate(`${from}/${to}`, amountNumber);

    const uuid = generateShortUUID();

    const deposit = await createDepositAdd(from);

    await createSwap(from, to, amountNumber, amountTo, deposit, toAddress, "nop", "nop", uuid);

    res.json({id: uuid, from: from, to: to, expectedAmountFrom: amountNumber, expectedAmountTo: Number(amountTo), payinAddress: deposit, payoutAddress: toAddress});
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

  app.get('/all-currencies', async (req, res) => {
    const data = await getNanswapCurrency();

    res.json(data);
  });

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en écoute sur http://localhost:${port}`);
});
