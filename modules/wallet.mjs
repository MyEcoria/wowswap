import axios from 'axios';
import config from '../config/general.json' assert { type: 'json' };
import { logger } from './logger.mjs';

export async function createDepositAdd(ticket) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(ticket);
            const jsonData = {
                currency: ticket
            };
            
            // En-tête JSON de la requête
            const headers = {
                'Content-Type': 'application/json',
                'auth': config["nanpay"]
            };
            
            // URL de l'API cible
            const apiUrl = config["wallet"];
            
            // Effectuer la requête POST avec await
            const response = await axios.post(`${apiUrl}/wallet/deposit`, jsonData, {
                headers: headers
            });

            logger.error({ level: 'error', message: JSON.stringify(response.data)});

            if (response.data.error) {
                resolve(false); 
            } else {
                resolve(response.data.address);
            }
        } catch (error) {
            // Gérez l'erreur ici (enregistrement dans le journal, renvoi d'une réponse d'erreur, etc.)
            logger.error({ level: 'error', message: `Erreur lors de la requête : ${error.message}` });
            throw error; // Renvoie l'erreur pour que le code appelant puisse la gérer également si nécessaire
        }
    });
}

export async function createWithdraw(ticket, amount, to) {
    console.log(`${ticket}/${amount}/${to}`);
    return new Promise(async (resolve, reject) => {
        try {
            const jsonData = {
                currency: ticket.toLowerCase(),
                amount: Number(Number(amount).toFixed(4)),
                destination: to
            };
            
            // En-tête JSON de la requête
            const headers = {
                'Content-Type': 'application/json',
                'auth': config["nanpay"]
            };
            
            // URL de l'API cible
            const apiUrl = config["wallet"];
            
            // Effectuer la requête POST avec await
            const response = await axios.post(`${apiUrl}/wallet/withdraw`, jsonData, {
                headers: headers
            });
            console.log(response.data);

            if (response.data.success == false || (response.data.status && response.data.status == "error")) {
                resolve(false); 
            } else {
                if (response.data.hash) {
                    resolve(response.data.hash);
                } else {
                    resolve(response.data.tx_hash);
                }
            }
        } catch (error) {
            // Gérez l'erreur ici (enregistrement dans le journal, renvoi d'une réponse d'erreur, etc.)
            logger.error({ level: 'error', message: `Erreur lors de la requête : ${error.message}` });
            resolve(false);
            throw error; // Renvoie l'erreur pour que le code appelant puisse la gérer également si nécessaire
        }
    });
}