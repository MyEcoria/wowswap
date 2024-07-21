import crypto from 'crypto';

export function generateShortUUID(length = 6) {
    // Générer des octets aléatoires
    const buffer = crypto.randomBytes(length);
  
    // Convertir les octets en une chaîne hexadécimale et tronquer à la longueur souhaitée
    return buffer.toString('hex').slice(0, length);
  }