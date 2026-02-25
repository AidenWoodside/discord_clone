import { describe, it, expect, beforeAll } from 'vitest';
import sodium from 'libsodium-wrappers';
import {
  initializeSodium,
  generateKeyPair,
  decryptGroupKey,
  encryptMessage,
  decryptMessage,
  serializeKey,
  deserializeKey,
} from './encryptionService';

describe('client encryptionService', () => {
  beforeAll(async () => {
    await initializeSodium();
    await sodium.ready;
  });

  describe('generateKeyPair', () => {
    it('should return a valid X25519 keypair (32-byte public + 32-byte secret)', () => {
      const { publicKey, secretKey } = generateKeyPair();
      expect(publicKey).toBeInstanceOf(Uint8Array);
      expect(secretKey).toBeInstanceOf(Uint8Array);
      expect(publicKey.length).toBe(32);
      expect(secretKey.length).toBe(32);
    });

    it('should generate unique keypairs', () => {
      const kp1 = generateKeyPair();
      const kp2 = generateKeyPair();
      expect(sodium.to_base64(kp1.publicKey)).not.toBe(sodium.to_base64(kp2.publicKey));
    });
  });

  describe('decryptGroupKey roundtrip', () => {
    it('should decrypt a group key encrypted with crypto_box_seal', () => {
      const groupKey = sodium.crypto_secretbox_keygen();
      const { publicKey, secretKey } = generateKeyPair();

      // Simulate server-side encryption
      const sealed = sodium.crypto_box_seal(groupKey, publicKey);
      const encryptedBlob = sodium.to_base64(sealed);

      // Client-side decryption
      const decrypted = decryptGroupKey(encryptedBlob, publicKey, secretKey);
      expect(sodium.to_base64(decrypted)).toBe(sodium.to_base64(groupKey));
    });
  });

  describe('encryptMessage + decryptMessage roundtrip', () => {
    it('should encrypt and decrypt correctly', () => {
      const groupKey = sodium.crypto_secretbox_keygen();
      const plaintext = 'Hello from the client!';

      const { ciphertext, nonce } = encryptMessage(plaintext, groupKey);
      const decrypted = decryptMessage(ciphertext, nonce, groupKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (unique nonces)', () => {
      const groupKey = sodium.crypto_secretbox_keygen();
      const { ciphertext: c1, nonce: n1 } = encryptMessage('same text', groupKey);
      const { ciphertext: c2, nonce: n2 } = encryptMessage('same text', groupKey);

      expect(c1).not.toBe(c2);
      expect(n1).not.toBe(n2);
    });
  });

  describe('decryptMessage with wrong key', () => {
    it('should throw when decrypting with wrong key', () => {
      const key1 = sodium.crypto_secretbox_keygen();
      const key2 = sodium.crypto_secretbox_keygen();
      const { ciphertext, nonce } = encryptMessage('secret', key1);

      expect(() => decryptMessage(ciphertext, nonce, key2)).toThrow();
    });
  });

  describe('serializeKey / deserializeKey roundtrip', () => {
    it('should serialize and deserialize a key correctly', () => {
      const groupKey = sodium.crypto_secretbox_keygen();
      const serialized = serializeKey(groupKey);
      expect(typeof serialized).toBe('string');

      const deserialized = deserializeKey(serialized);
      expect(sodium.to_base64(deserialized)).toBe(sodium.to_base64(groupKey));
    });
  });
});
