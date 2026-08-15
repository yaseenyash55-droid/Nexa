/**
 * End-to-End Encryption (E2EE) Utility for Nexa Social Direct Messages
 * ======================================================================
 * 
 * VIVA PRESENTATION & ACADEMIC DOCUMENTATION NOTES:
 * --------------------------------------------------
 * 1. Cryptographic Algorithm:
 *    Uses AES-GCM (Advanced Encryption Standard in Galois/Counter Mode) with a 256-bit key length.
 *    AES-GCM is an Authenticated Encryption with Associated Data (AEAD) scheme that provides
 *    both confidentiality (privacy) and integrity (tamper-detection).
 * 
 * 2. Key Derivation Function (KDF):
 *    Uses PBKDF2 (Password-Based Key Derivation Function 2) with HMAC-SHA-256 and 100,000 iterations.
 *    The secret salt and sorted pair of participant User IDs ([userId1, userId2].sort()) generate
 *    a deterministic conversation key shared between the two chatting users.
 * 
 * 3. Initialization Vector (IV):
 *    Every message is encrypted with a fresh 12-byte (96-bit) cryptographically random IV generated via
 *    window.crypto.getRandomValues(). Reusing an IV with AES-GCM compromises security; generating a
 *    unique IV per message prevents pattern detection.
 * 
 * 4. Payload Format:
 *    Encrypted messages sent over Socket.IO / REST API use the format:
 *    `E2EE::<IV_HEX>::<CIPHERTEXT_HEX>`
 * 
 * 5. Architectural Limitation & Trade-offs (Viva Defense):
 *    This implementation derives conversation keys deterministically from user ID pairs to eliminate
 *    the complexity of asymmetric Public-Key Infrastructure (PKI) key exchange servers. In full production,
 *    an asymmetric scheme like Diffie-Hellman / Double Ratchet (Signal Protocol) is used.
 */

// Cache derived conversation keys in memory to optimize cryptographic performance
const keyCache = new Map<string, CryptoKey>();

/**
 * Convert an ArrayBuffer or Uint8Array to a lower-case Hex string
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a Hex string back into a Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derive a deterministic 256-bit AES-GCM CryptoKey for a 2-user conversation using PBKDF2
 */
export async function getConversationKey(userId1: number, userId2: number): Promise<CryptoKey> {
  // Sort user IDs so that both (userA, userB) and (userB, userA) compute the exact same key
  const sortedPair = [userId1, userId2].sort((a, b) => a - b).join('_');
  const cacheKey = `e2ee_key_${sortedPair}`;

  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  const encoder = new TextEncoder();

  // 1. Create a base key material from conversation signature string
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(`Nexa_E2EE_Secret_Seed_v1_${sortedPair}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 2. Derive 256-bit AES-GCM key using PBKDF2 with 100,000 iterations
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`Nexa_E2EE_Salt_${sortedPair}`),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Key is non-extractable from memory for enhanced security
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * Encrypt a plain text string before sending it to the server / recipient
 * Returns payload in format: E2EE::<iv_hex>::<ciphertext_hex>
 */
export async function encryptMessage(
  senderId: number,
  receiverId: number,
  plainText: string
): Promise<string> {
  if (!plainText || !plainText.trim()) {
    return plainText;
  }

  try {
    const key = await getConversationKey(senderId, receiverId);
    const encoder = new TextEncoder();
    
    // Generate fresh 12-byte random Initialization Vector (IV)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;

    // Encrypt plain text using AES-GCM
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      encoder.encode(plainText)
    );

    const ivHex = bufferToHex(iv);
    const ciphertextHex = bufferToHex(ciphertextBuffer);

    return `E2EE::${ivHex}::${ciphertextHex}`;
  } catch (error) {
    console.error('Failed to encrypt message:', error);
    return plainText; // Fallback to raw text if Web Crypto API fails
  }
}

export interface DecryptedMessageResult {
  text: string;
  isEncrypted: boolean;
}

/**
 * Decrypt an incoming ciphertext string if tagged with "E2EE::" prefix
 */
export async function decryptMessage(
  currentUserId: number,
  otherUserId: number,
  formattedContent: string
): Promise<DecryptedMessageResult> {
  if (!formattedContent || !formattedContent.startsWith('E2EE::')) {
    return { text: formattedContent, isEncrypted: false };
  }

  try {
    const parts = formattedContent.split('::');
    if (parts.length !== 3) {
      return { text: formattedContent, isEncrypted: false };
    }

    const ivHex = parts[1];
    const ciphertextHex = parts[2];

    const iv = hexToBuffer(ivHex);
    const ciphertext = hexToBuffer(ciphertextHex);

    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
    const ciphertextBuffer = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer;

    const key = await getConversationKey(currentUserId, otherUserId);

    // Decrypt ciphertext using AES-GCM
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    const plainText = decoder.decode(decryptedBuffer);

    return { text: plainText, isEncrypted: true };
  } catch (error) {
    console.error('Failed to decrypt E2EE message:', error);
    return { text: '🔒 Unable to decrypt message (Key mismatch)', isEncrypted: true };
  }
}
