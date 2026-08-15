import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
function getMfaEncryptionKey(): Buffer {
  const configuredKey = process.env.MFA_ENCRYPTION_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured with at least 32 characters');
  }
  return crypto.createHash('sha256').update(configuredKey).digest();
}

export interface EncryptedSeed {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptTotpSeed(secret: string): EncryptedSeed {
  const iv = crypto.randomBytes(12);
  const key = getMfaEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag
  };
}

export function decryptTotpSeed(encrypted: EncryptedSeed): string {
  const key = getMfaEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(encrypted.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateRecoveryCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    
    rawCodes.push(code);
    hashedCodes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }

  return { rawCodes, hashedCodes };
}
