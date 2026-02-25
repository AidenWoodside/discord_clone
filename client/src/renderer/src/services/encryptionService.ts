import sodium from 'libsodium-wrappers';

let _sodium: typeof sodium;

export async function initializeSodium(): Promise<void> {
  await sodium.ready;
  _sodium = sodium;
}

export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const keypair = _sodium.crypto_box_keypair();
  return { publicKey: keypair.publicKey, secretKey: keypair.privateKey };
}

export function decryptGroupKey(encryptedBlob: string, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array {
  const cipherBytes = _sodium.from_base64(encryptedBlob);
  return _sodium.crypto_box_seal_open(cipherBytes, publicKey, secretKey);
}

export function encryptMessage(plaintext: string, groupKey: Uint8Array): { ciphertext: string; nonce: string } {
  const nonce = _sodium.randombytes_buf(_sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = _sodium.crypto_secretbox_easy(
    plaintext,
    nonce,
    groupKey,
  );
  return {
    ciphertext: _sodium.to_base64(ciphertext),
    nonce: _sodium.to_base64(nonce),
  };
}

export function decryptMessage(ciphertext: string, nonce: string, groupKey: Uint8Array): string {
  const cipherBytes = _sodium.from_base64(ciphertext);
  const nonceBytes = _sodium.from_base64(nonce);
  const plainBytes = _sodium.crypto_secretbox_open_easy(cipherBytes, nonceBytes, groupKey);
  return _sodium.to_string(plainBytes);
}

export function serializeKey(key: Uint8Array): string {
  return _sodium.to_base64(key);
}

export function deserializeKey(base64: string): Uint8Array {
  return _sodium.from_base64(base64);
}
