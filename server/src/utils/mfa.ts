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

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.substring(i, i + 8);
    if (byte.length === 8) bytes.push(parseInt(byte, 2));
  }
  return Buffer.from(bytes);
}

export function generateHotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1_000_000).toString().padStart(6, '0');
}

export function verifyTotp(token: string, secret: string, window = 1): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (generateHotp(secret, counter + i) === token) {
      return true;
    }
  }
  return false;
}

export function generateBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}
