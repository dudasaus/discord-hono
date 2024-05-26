import { generateKeyPairSync, sign, verify } from 'crypto';
import { beforeAll, describe, expect, test } from 'vitest';
import { verifySignature } from '../src/verify';

describe('verify', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  const publicKeyString = publicKey
    .export({
      type: 'spki',
      format: 'der',
    })
    .toString('hex')
    // First 24 are DER prefix.
    .substring(24);

  const rawBody = 'i am the raw body';
  const timestamp = '1716724915005';
  const toSign = Buffer.from(timestamp + rawBody);

  const signature = sign(null, toSign, privateKey);
  const signatureString = signature.toString('hex');

  test('verifies legit signatures', () => {
    expect(verify(null, toSign, publicKey, signature)).toBe(true);
    expect(
      verifySignature({
        publicKey: publicKeyString,
        timestamp,
        rawBody,
        signature: signatureString,
      }),
    ).toBe(true);
  });

  test('rejects bad signatures', () => {
    expect(verify(null, Buffer.from('i am wrong'), publicKey, signature)).toBe(
      false,
    );
  });
});
