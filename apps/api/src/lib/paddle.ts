function hexToBytes(hex: string) {
  const normalized = hex.trim().toLowerCase();
  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }

  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a[index] ^ b[index];
  }

  return mismatch === 0;
}

export function parsePaddleSignature(header: string | null | undefined) {
  if (!header) {
    throw new Error("Missing Paddle-Signature header.");
  }

  const parts = header.split(";").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("ts="))?.slice(3);
  const signatures = parts.filter((part) => part.startsWith("h1=")).map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new Error("Malformed Paddle-Signature header.");
  }

  return { timestamp, signatures };
}

export async function verifyPaddleSignature(rawBody: string, header: string | null | undefined, secret: string) {
  const { timestamp, signatures } = parsePaddleSignature(header);
  const signedPayload = `${timestamp}:${rawBody}`;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(signedPayload)));

  return signatures.some((signature) => timingSafeEqual(digest, hexToBytes(signature)));
}
