import axios from 'axios';
import { getPairRate } from './getMarket.mjs';
import swap from '../config/swap.json' assert { type: 'json' };
import Decimal from 'decimal.js';


export async function getNanswapCurrency() {
  try {
    // Récupérer les tokens existants depuis l'API Nanswap
    const response = await axios.get("https://api.nanswap.com/v1/all-currencies");
    const tokens = response.data;

    // Ajoutez manuellement le token WOW
    const wowToken = {
      "WOW": {
        "ticker": "WOW",
        "name": "Wownero",
        "image": "https://wownero.org/img/Wownero_Logo_ico.ico",
        "feeless": true
      }
    };

    // Convertir les objets en tableau d'entrées
    const tokensArray = Object.entries(tokens);

    // Ajouter WOW au début de la liste
    const updatedTokensArray = [["WOW", wowToken["WOW"]], ...tokensArray];

    // Reconstruire l'objet à partir du tableau
    const updatedTokens = Object.fromEntries(updatedTokensArray);

    // Retourner les tokens mis à jour
    return updatedTokens;

  } catch (error) {
    console.error("Erreur lors de la récupération des tokens:", error);
    throw error;
  }
}

export async function getEstimate(from, to, amount) {
    try {
      // Récupérer les tokens existants depuis l'API Nanswap
      const response = await axios.get(`https://api.nanswap.com/v1/get-estimate?from=${from}&to=${to}&amount=${amount}`);
      const tokens = response.data;
  
      return tokens;
      
  
    } catch (error) {
      console.error("Erreur lors de la récupération des tokens:", error);
      throw error;
    }
}

export async function createOrder(from, to, amount, toAddress, ip_user) {
  try {
    const data = {
      from: from,
      to: to,
      amount: amount,
      toAddress: toAddress,
      userDeviceId: ip_user
    };
  
    // Configuration des en-têtes
    const config = {
      headers: {
        'nanswap-api-key': 'c23424a1-0fd9-43eb-9eb2-8072a62920aa', // Remplacez par votre token réel
        'Content-Type': 'application/json'
      }
    };
  
    // Faire la requête POST avec des en-têtes
    const response = await axios.post("https://api.nanswap.com/v1/create-order", data, config);
  
    return response.data;
  
  } catch (error) {
    if (error.response) {
      // Si le statut est 400, renvoyer la réponse comme un résultat normal
      if (error.response.status === 400) {
        console.warn("Requête échouée avec un statut 400 :", error.response.data);
        return error.response.data; // Retourner les données malgré le statut 400
      }
    }
    
    // Si ce n'est pas une erreur 400, relancer l'erreur
    console.error("Erreur lors de la récupération des tokens:", error);
    throw error;
  }
}

export async function getLimits(from, to) {
  try {
    // Récupérer les tokens existants depuis l'API Nanswap
    const response = await axios.get(`https://api.nanswap.com/v1/get-limits?from=${from}&to=${to}`);
    const tokens = response.data;

    return tokens;
    

  } catch (error) {
    console.error("Erreur lors de la récupération des tokens:", error);
    throw error;
  }
}

export async function getOrder(id) {
  try {
    // Récupérer les tokens existants depuis l'API Nanswap
    const response = await axios.get(`https://api.nanswap.com/v1/get-order?id=${id}`);
    const tokens = response.data;

    return tokens;
    

  } catch (error) {
    console.error("Erreur lors de la récupération des tokens:", error);
    throw error;
  }
}

export async function getLimitsTest(from, to) {
  let toReturn; 
  let limits;
  if (to !== "WOW" && from !== "WOW" && to !== "XNO") {
    console.log("1");
    limits = await getLimits(from, to);
    toReturn = { from, to, min: limits.min, max: limits.max };
  }

  if ((from === "XNO" && to === "WOW") || (from === "WOW" && to === "XNO")) {
    console.log("2");
    if (to === "WOW") {
      const minEs = await getPairRate("WOW/XNO", new Decimal(swap[`minWOW`]).plus(new Decimal(5)));
      toReturn = { from, to, min: Number(minEs), max: swap[`max${from}`] };
    } else {
      toReturn = { from, to, min: swap[`min${from}`], max: swap[`max${from}`] };
    }
  }

  if (from === "WOW" && to !== "XNO" && to !== "WOW") {
    console.log("3");
    limits = await getLimits("XNO", to);
    let lim;
    const testLim = await getPairRate("WOW/XNO", new Decimal(swap[`minWOW`]).plus(new Decimal(5)));
    if (limits.min < testLim) {
      lim = testLim;
    } else {
      lim = limits.min;
    }
    const minEs = await getPairRate("XNO/WOW", lim);
    toReturn = { from, to, min: Number(minEs), max: swap[`max${from}`] };
  }

  if ((from !== "XNO" && from !== "WOW") && (to === "XNO" || to === "WOW")) {
    console.log("4");
    const estim = await getEstimate("XNO", from, swap[`maxXNO`]);
    limits = await getLimits(from, "XNO");

    let mino;

    if (to === "WOW") {
      const lmt = await getPairRate("WOW/XNO", new Decimal(swap[`minWOW`]).plus(new Decimal(1)));
      const est = await getEstimate("XNO", from, lmt);
      mino = est.error ? limits.min : est.amountTo;
    } else {
      mino = limits.min;
    }

    toReturn = { from, to, min: mino, max: estim.amountTo };
  }

  if (toReturn.max == null) {
    toReturn.max = 100000000000;
  }

  return toReturn;
}