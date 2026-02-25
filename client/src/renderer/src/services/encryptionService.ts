import sodium from 'libsodium-wrappers';

let _sodium: typeof sodium;

export async function initializeSodium(): Promise<void> {
  await sodium.ready;
  _sodium = sodium;
}

function requireSodium(): typeof sodium {
  if (!_sodium) {
    throw new Error('Sodium not initialized — call initializeSodium() first');
  }
  return _sodium;
}

export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const keypair = requireSodium().crypto_box_keypair();
  return { publicKey: keypair.publicKey, secretKey: keypair.privateKey };
}

export function decryptGroupKey(encryptedBlob: string, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array {
  const s = requireSodium();
  const cipherBytes = s.from_base64(encryptedBlob);
  return s.crypto_box_seal_open(cipherBytes, publicKey, secretKey);
}

export function encryptMessage(plaintext: string, groupKey: Uint8Array): { ciphertext: string; nonce: string } {
  const s = requireSodium();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const ciphertext = s.crypto_secretbox_easy(
    plaintext,
    nonce,
    groupKey,
  );
  return {
    ciphertext: s.to_base64(ciphertext),
    nonce: s.to_base64(nonce),
  };
}

export function decryptMessage(ciphertext: string, nonce: string, groupKey: Uint8Array): string {
  const s = requireSodium();
  const cipherBytes = s.from_base64(ciphertext);
  const nonceBytes = s.from_base64(nonce);
  const plainBytes = s.crypto_secretbox_open_easy(cipherBytes, nonceBytes, groupKey);
  return s.to_string(plainBytes);
}

export function serializeKey(key: Uint8Array): string {
  return requireSodium().to_base64(key);
}

export function deserializeKey(base64: string): Uint8Array {
  return requireSodium().from_base64(base64);
}
