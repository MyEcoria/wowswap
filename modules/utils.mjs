import crypto from 'crypto';

export function generateShortUUID(length = 6) {
    // Générer des octets aléatoires
    const buffer = crypto.randomBytes(length);
  
    // Convertir les octets en une chaîne hexadécimale et tronquer à la longueur souhaitée
    return buffer.toString('hex').slice(0, length);
  }

export function isValidWowneroAddress(address) {
    const wowneroAddressRegex = /^[a-zA-Z0-9]{95}$/;
    return wowneroAddressRegex.test(address);
}

export function isValidNanoAddress(address) {
  const nanoAddressRegex = /^nano_[13]{1}[13456789abcdefghijkmnopqrstuwxyz]{59}$/;
  return nanoAddressRegex.test(address);
}