import express from 'express';
import config from './config/general.json' assert { type: 'json' };
import swap from './config/swap.json' assert { type: 'json' };
import { getPairRate, getReverseRate } from './modules/getMarket.mjs';
import { generateShortUUID, isValidNanoAddress, isValidWowneroAddress } from './modules/utils.mjs';
import { createDepositAdd, createWithdraw } from './modules/wallet.mjs';
import { changeMoneyReceive, changeToError, changeToFinish, changeToSending, createSwap, getInfoByAddress, getInfoByUUID } from './modules/db.mjs';
import  TelegramBot from 'node-telegram-bot-api';
import cors from 'cors';

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

    const toAmount = Number(await getPairRate(`${from}/${to}`, amountNumber));
    // Envoyer la réponse
    res.json({ from: from, to: to, amountFrom: amountNumber, amountTo: toAmount });
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

    if (from !== "XNO" && from !== "WOW") {
        return res.json({status: "error", message: "Invalid from ticket"});
    }

    if (to !== "XNO" && to !== "WOW") {
        return res.json({status: "error", message: "Invalid to ticket"});
    }

    if (from == to) {
        return res.json({status: "error", message: "Invalid to ticket"});
    }

    res.json({ from: from, to: to, min: swap[`min${from}`], max: swap[`max${from}`] });
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

  if (from !== "XNO" && from !== "WOW") {
      return res.json({status: "error", message: "Invalid from ticket"});
  }

  if (to !== "XNO" && to !== "WOW") {
      return res.json({status: "error", message: "Invalid to ticket"});
  }

  if (from == to) {
      return res.json({status: "error", message: "Invalid to ticket"});
  }

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
    const data = {
        "XNO": {
          "ticker": "XNO",
          "name": "Nano",
          "image": "https://nanswap.com/logo/XNO.svg",
          "feeless": true
        },
        "WOW": {
          "ticker": "WOW",
          "name": "Wownero",
          "image": "https://wownero.org/img/Wownero_Logo_ico.ico",
          "feeless": true
        }
    }

    res.json(data);
  });

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en écoute sur http://localhost:${port}`);
});
