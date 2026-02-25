import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.hoisted(() => {
  // Generate a valid base64-encoded 32-byte key for testing
  // Using a fixed test key (32 bytes of 0x01, base64 encoded)
  process.env.GROUP_ENCRYPTION_KEY = 'rSxlHxEjeJC7RY079zu0Kg9fHWEIdAtGE4s76zAI9Rw';
});

import {
  initializeSodium,
  generateGroupKey,
  getGroupKey,
  encryptGroupKeyForUser,
  encryptMessage,
  decryptMessage,
} from './encryptionService.js';
import sodium from 'libsodium-wrappers';

describe('encryptionService', () => {
  beforeAll(async () => {
    await initializeSodium();
    await sodium.ready;
  });

  describe('generateGroupKey', () => {
    it('should return a 32-byte Uint8Array', () => {
      const key = generateGroupKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateGroupKey();
      const key2 = generateGroupKey();
      expect(sodium.to_base64(key1)).not.toBe(sodium.to_base64(key2));
    });
  });

  describe('getGroupKey', () => {
    it('should return the group key from env var', () => {
      const key = getGroupKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });
  });

  describe('encryptGroupKeyForUser + decrypt roundtrip', () => {
    it('should encrypt group key and decrypt with keypair', () => {
      const groupKey = generateGroupKey();
      const keypair = sodium.crypto_box_keypair();

      const encryptedBlob = encryptGroupKeyForUser(groupKey, keypair.publicKey);
      expect(typeof encryptedBlob).toBe('string');
      expect(encryptedBlob.length).toBeGreaterThan(0);

      // Decrypt using the keypair
      const sealed = sodium.from_base64(encryptedBlob);
      const decryptedKey = sodium.crypto_box_seal_open(sealed, keypair.publicKey, keypair.privateKey);
      expect(sodium.to_base64(decryptedKey)).toBe(sodium.to_base64(groupKey));
    });
  });

  describe('encryptMessage + decryptMessage roundtrip', () => {
    it('should encrypt and decrypt plaintext correctly', () => {
      const groupKey = generateGroupKey();
      const plaintext = 'Hello, encrypted world!';

      const { ciphertext, nonce } = encryptMessage(plaintext, groupKey);
      expect(typeof ciphertext).toBe('string');
      expect(typeof nonce).toBe('string');

      const decrypted = decryptMessage(ciphertext, nonce, groupKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt empty string correctly', () => {
      const groupKey = generateGroupKey();
      const { ciphertext, nonce } = encryptMessage('', groupKey);
      const decrypted = decryptMessage(ciphertext, nonce, groupKey);
      expect(decrypted).toBe('');
    });

    it('should encrypt unicode correctly', () => {
      const groupKey = generateGroupKey();
      const plaintext = 'Hello 🌍 こんにちは 你好';
      const { ciphertext, nonce } = encryptMessage(plaintext, groupKey);
      const decrypted = decryptMessage(ciphertext, nonce, groupKey);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptMessage nonce uniqueness', () => {
    it('should generate unique nonce per call', () => {
      const groupKey = generateGroupKey();
      const { nonce: nonce1 } = encryptMessage('test', groupKey);
      const { nonce: nonce2 } = encryptMessage('test', groupKey);
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('decryptMessage with wrong key', () => {
    it('should throw when decrypting with wrong key', () => {
      const groupKey1 = generateGroupKey();
      const groupKey2 = generateGroupKey();
      const { ciphertext, nonce } = encryptMessage('secret', groupKey1);

      expect(() => decryptMessage(ciphertext, nonce, groupKey2)).toThrow();
    });
  });

  describe('decryptMessage with wrong nonce', () => {
    it('should throw when decrypting with wrong nonce', () => {
      const groupKey = generateGroupKey();
      const { ciphertext } = encryptMessage('secret', groupKey);
      const { nonce: wrongNonce } = encryptMessage('other', groupKey);

      expect(() => decryptMessage(ciphertext, wrongNonce, groupKey)).toThrow();
    });
  });
});
