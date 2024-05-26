import { KeyObject, generateKeyPairSync, sign } from 'node:crypto';

export class RequestUtils {
  private readonly privateKey: KeyObject;
  readonly publicKey: string;

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    this.publicKey = publicKey
      .export({
        type: 'spki',
        format: 'der',
      })
      .toString('hex')
      // First 24 are DER prefix.
      .substring(24);

    this.privateKey = privateKey;
  }

  private sign(rawBody: string, timestamp: string): string {
    const toSign = Buffer.from(timestamp + rawBody);
    const signature = sign(null, toSign, this.privateKey);
    const signatureString = signature.toString('hex');
    return signatureString;
  }

  createRequest(body: {}, badSignature = false): Request {
    const rawBody = JSON.stringify(body);

    const timestamp = '12345';
    const signature = this.sign(rawBody, badSignature ? '67890' : timestamp);

    const req = new Request('https://test.com/interactions', {
      headers: {
        'x-signature-timestamp': timestamp,
        'x-signature-ed25519': signature,
      },
      body: rawBody,
      method: 'POST',
    });

    return req;
  }
}
