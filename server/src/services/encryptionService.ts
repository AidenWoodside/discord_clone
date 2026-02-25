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

function requireSodium(): typeof sodium {
  if (!_sodium) {
    throw new Error('Sodium not initialized — call initializeSodium() first');
  }
  return _sodium;
}

export function generateGroupKey(): Uint8Array {
  return requireSodium().crypto_secretbox_keygen();
}

export function getGroupKey(): Uint8Array {
  return requireSodium().from_base64(GROUP_ENCRYPTION_KEY!);
}

export function encryptGroupKeyForUser(groupKey: Uint8Array, userPublicKey: Uint8Array): string {
  const s = requireSodium();
  const sealed = s.crypto_box_seal(groupKey, userPublicKey);
  return s.to_base64(sealed);
}

export function deserializePublicKey(base64: string): Uint8Array {
  return requireSodium().from_base64(base64);
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
