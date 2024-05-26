export async function verifySignature(props: {
  publicKey: string;
  signature: string;
  timestamp: string;
  rawBody: string;
}): Promise<boolean> {
  // https://github.com/luisfun/discord-hono/blob/71e4111cd8e6f3d22808ecd33aab575139358243/src/verify.ts
  const publicKey = await crypto.subtle.importKey(
    'raw',
    hexToUint8Array(props.publicKey),
    // @ts-expect-error
    { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519', public: true },
    true,
    ['verify'],
  );

  return await crypto.subtle.verify(
    'NODE - ED25519',
    publicKey,
    hexToUint8Array(props.signature),
    hexToUint8Array(props.rawBody),
  );
}

function hexToUint8Array(hex: string) {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((val) => parseInt(val, 16)));
}
