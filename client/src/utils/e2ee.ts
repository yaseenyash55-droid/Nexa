/**
 * Messaging Transport & Security Utility for Nexa Social
 * =======================================================
 * Direct messages are encrypted in-transit across all web and mobile clients
 * using Transport Layer Security (TLS 1.3 / HTTPS / WSS) and authenticated
 * using short-lived JWT bearer tokens.
 *
 * Real end-to-end encryption (E2EE) requires asymmetric public-key infrastructure
 * with verified identity keys and double-ratchet key exchange (e.g. Signal Protocol).
 */

export interface DecryptedMessageResult {
  text: string;
  isEncrypted: boolean;
}

/**
 * Prepares direct message content for transmission over TLS-encrypted REST/Socket.IO.
 * Sends raw UTF-8 content directly to preserve interoperability across web and Android.
 */
export async function encryptMessage(
  _senderId: number,
  _receiverId: number,
  plainText: string
): Promise<string> {
  return plainText;
}

/**
 * Processes incoming message content. If legacy simulated ciphertext is received,
 * handles gracefully without failing.
 */
export async function decryptMessage(
  _currentUserId: number,
  _otherUserId: number,
  formattedContent: string
): Promise<DecryptedMessageResult> {
  if (!formattedContent) {
    return { text: '', isEncrypted: false };
  }

  // Handle legacy simulated E2EE format if present
  if (formattedContent.startsWith('E2EE::')) {
    return { text: formattedContent, isEncrypted: false };
  }

  return { text: formattedContent, isEncrypted: false };
}
