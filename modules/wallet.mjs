import axios from 'axios';
import config from '../config/general.json' assert { type: 'json' };
import crypto from 'crypto';
import { logger } from './logger.mjs';

export async function createDepositAdd(ticket) {
    return new Promise(async (resolve, reject) => {
        try {
            const jsonData = {
                currency: ticket,
                time: Date.now()
            };

            const withdrawalRequestBody = JSON.stringify(jsonData);
            const withdrawalRequestSign = crypto.createHmac('sha256', config["nanpriv"]).update(withdrawalRequestBody).digest('base64');
            
            const headers = {
                'Content-Type': 'application/json',
                'auth': config["nanpay"],
                'sign': withdrawalRequestSign
            };
            const apiUrl = config["wallet"];
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
            logger.error({ level: 'error', message: `Erreur lors de la requête : ${error.message}` });
            throw error;
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

            const withdrawalRequestBody = JSON.stringify(jsonData);
            const withdrawalRequestSign = crypto.createHmac('sha256', config["nanpriv"]).update(withdrawalRequestBody).digest('base64');

            const headers = {
                'Content-Type': 'application/json',
                'auth': config["nanpay"],
                'sign': withdrawalRequestSign
            };
            const apiUrl = config["wallet"];
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
            logger.error({ level: 'error', message: `Erreur lors de la requête : ${error.message}` });
            resolve(false);
            throw error;
        }
    });
}