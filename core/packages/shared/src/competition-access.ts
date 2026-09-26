/** Web gateway / independent API proof contract. Secrets stay server-side. */
export const COMPETITION_ACCESS_COOKIE = '__Secure-cuberoot_comp_manual';
export const COMPETITION_SERVICE_HEADER = 'x-cuberoot-comp-service';
export const COMPETITION_ACCESS_TTL = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
async function contextHash(context: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(context)));
}
async function key(secret: string) {
  if (secret.length < 32) throw new Error('Competition access signing key is not configured');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function createCompetitionProof(secret: string, purpose: 'browser' | 'service', context: string, now = Date.now(), browserTtl = COMPETITION_ACCESS_TTL) {
  if (!Number.isSafeInteger(browserTtl) || browserTtl <= 0 || browserTtl > COMPETITION_ACCESS_TTL) throw new Error('Invalid browser proof lifetime');
  const expires = Math.floor(now / 1000) + (purpose === 'browser' ? browserTtl : 60);
  // v2 revokes automatic browser grants AND old proxies that signed without
  // checking a manual browser proof first.
  const payload = `v2.${purpose}.${expires}.${await contextHash(context)}`;
  return `${payload}.${hex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)))}`;
}
export async function verifyCompetitionProof(secret: string, proof: string, purpose: 'browser' | 'service', context: string, now = Date.now()) {
  if (secret.length < 32 || proof.length > 256) return false;
  const match = /^v2\.(browser|service)\.(\d{10})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(proof);
  if (!match || match[1] !== purpose) return false;
  const remaining = Number(match[2]) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > (purpose === 'browser' ? COMPETITION_ACCESS_TTL : 60)) return false;
  if (match[3] !== await contextHash(context)) return false;
  const signature = Uint8Array.from(match[4].match(/../g)!, value => parseInt(value, 16));
  return crypto.subtle.verify('HMAC', await key(secret), signature, encoder.encode(proof.slice(0, -65)));
}
export function competitionCookie(header: string) {
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${COMPETITION_ACCESS_COOKIE}=`));
  return matches.length === 1 ? matches[0].slice(COMPETITION_ACCESS_COOKIE.length + 1) : '';
}
