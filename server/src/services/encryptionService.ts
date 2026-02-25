import sodium from 'libsodium-wrappers';

const GROUP_ENCRYPTION_KEY = process.env.GROUP_ENCRYPTION_KEY;
if (!GROUP_ENCRYPTION_KEY) {
  throw new Error('GROUP_ENCRYPTION_KEY environment variable is required');
}

let _sodium: typeof sodium;

export async function initializeSodium(): Promise<void> {
  await sodium.ready;
  _sodium = sodium;
}

export function generateGroupKey(): Uint8Array {
  return _sodium.crypto_secretbox_keygen();
}

export function getGroupKey(): Uint8Array {
  return _sodium.from_base64(GROUP_ENCRYPTION_KEY!);
}

export function encryptGroupKeyForUser(groupKey: Uint8Array, userPublicKey: Uint8Array): string {
  const sealed = _sodium.crypto_box_seal(groupKey, userPublicKey);
  return _sodium.to_base64(sealed);
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
