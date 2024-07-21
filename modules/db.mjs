import mysql from 'mysql2/promise';
import config from '../config/db.json' assert { type: 'json' };
import Decimal from 'decimal.js';
import { logger } from './logger.mjs';

const dbConfig = {
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  //port: config.port,
};

const pool = mysql.createPool(dbConfig);

export async function createSwap(from, to, amountFrom, amountTo, payinAddress, payoutAddress, payinHash, payoutHash, uuid) {
    const connection = await pool.getConnection();
    try {

      const sql = 'INSERT INTO swap (fromd, tod, amountFrom, amountTo, payinAddress, payoutAddress, payinHash, payoutHash, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const [result] = await connection.execute(sql, [from, to, Number(amountFrom), Number(amountTo), payinAddress, payoutAddress, payinHash, payoutHash, uuid]);
      logger.log({ level: 'info', message: `L'adresse ${uuid} vient d'être enregistrée` });
      return true;
    } catch (error) {
      logger.log({ level: 'error', message: `Création de compte : ${error.message}` });
      return false;
    } finally {
      connection.release();
    }
  }

  export async function changeMoneyReceive(payinHash, payinAddress, amountFrom, amountTo) {
    const connection = await pool.getConnection();
    try {
        const updateSQL = `UPDATE swap SET payinHash = ?, status = ?, amountFrom = ?, amountTo = ? WHERE payinAddress = ?`;
        const [result] = await connection.execute(updateSQL, [payinHash, "exchanging", Number(amountFrom), Number(amountTo), payinAddress]);
  
      if (result.affectedRows > 0) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      logger.log({ level: 'error', message: `Erreur lors du changement de mot de passe : ${error.message}` });
      return false;
    } finally {
      connection.release();
    }
  }

  export async function getInfoByAddress(address) {
    const connection = await pool.getConnection();
    try {
      const sql = 'SELECT * FROM swap WHERE payinAddress = ?';
      const [rows] = await connection.execute(sql, [address]);
      return rows.length ? rows[0] : null;
    } catch (error) {
      logger.log({ level: 'error', message: `Erreur lors de la récupération des informations par email : ${error.message}` });
      return null;
    } finally {
      connection.release();
    }
  }

  export async function getInfoByUUID(uuid) {
    const connection = await pool.getConnection();
    try {
      const sql = 'SELECT * FROM swap WHERE uuid = ?';
      const [rows] = await connection.execute(sql, [uuid]);
      return rows.length ? rows[0] : null;
    } catch (error) {
      logger.log({ level: 'error', message: `Erreur lors de la récupération des informations par email : ${error.message}` });
      return null;
    } finally {
      connection.release();
    }
  }

  export async function changeToSending(payinAddress) {
    const connection = await pool.getConnection();
    try {
        const updateSQL = `UPDATE swap SET status = ? WHERE payinAddress = ?`;
        const [result] = await connection.execute(updateSQL, ["sending", payinAddress]);
  
      if (result.affectedRows > 0) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      logger.log({ level: 'error', message: `Erreur lors du changement de mot de passe : ${error.message}` });
      return false;
    } finally {
      connection.release();
    }
  }

  export async function changeToFinish(payinAddress, payoutHash) {
    const connection = await pool.getConnection();
    try {
        const updateSQL = `UPDATE swap SET status = ?, payoutHash = ? WHERE payinAddress = ?`;
        const [result] = await connection.execute(updateSQL, ["completed", payoutHash, payinAddress]);
  
      if (result.affectedRows > 0) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      logger.log({ level: 'error', message: `Erreur lors du changement de mot de passe : ${error.message}` });
      return false;
    } finally {
      connection.release();
    }
  }

  export async function changeToError(payinAddress) {
    const connection = await pool.getConnection();
    try {
        const updateSQL = `UPDATE swap SET status = ? WHERE payinAddress = ?`;
        const [result] = await connection.execute(updateSQL, ["error", payinAddress]);
  
      if (result.affectedRows > 0) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      logger.log({ level: 'error', message: `Erreur lors du changement de mot de passe : ${error.message}` });
      return false;
    } finally {
      connection.release();
    }
  }