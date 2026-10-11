import { normalizeRemoteKey, remoteKeyFilename } from '@cuberoot/shared/remote-access';

const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const field = (v: Uint8Array) => concat(u32(v.length), v);
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v));
const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

/** OpenSSH's unencrypted Ed25519 key envelope; private material never leaves the browser. */
export async function createRemoteAccessKey() {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  if (!jwk.x || !jwk.d) throw Error('Ed25519 export is unavailable');
  const x = decode(jwk.x), seed = decode(jwk.d);
  const type = enc.encode('ssh-ed25519');
  const pub = concat(field(type), field(x));
  const check = crypto.getRandomValues(new Uint8Array(4));
  const secret = concat(check, check, field(type), field(x), field(concat(seed, x)), field(enc.encode('cuberoot-remote')));
  const padding = Uint8Array.from({ length: 8 - secret.length % 8 }, (_, i) => i + 1);
  const wire = concat(enc.encode('openssh-key-v1\0'), field(enc.encode('none')), field(enc.encode('none')),
    field(new Uint8Array()), u32(1), field(pub), field(concat(secret, padding)));
  const publicKey = normalizeRemoteKey(`ssh-ed25519 ${b64(pub)}`);
  const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64(wire).match(/.{1,70}/g)!.join('\n')}\n-----END OPENSSH PRIVATE KEY-----\n`;
  return { publicKey, privateKey, filename: remoteKeyFilename(publicKey) };
}
