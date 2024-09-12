import axios from 'axios';

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

export async function createOrder(from, to, amount, toAddress) {
    try {
        const data = {
            from: from,
            to: to,
            amount: amount,
            toAddress: toAddress
          };
      
          // Faire la requête POST
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
      console.error("Erreur lors de la récupération des tokens:", error);
      throw error;
    }
}