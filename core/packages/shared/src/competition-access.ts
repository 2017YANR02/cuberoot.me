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
export async function createCompetitionProof(secret: string, purpose: 'browser' | 'service', context: string, now = Date.now(), browserTtl = COMPETITION_ACCESS_TTL, uniqueBrowserSession = false) {
  if (!Number.isSafeInteger(browserTtl) || browserTtl <= 0 || browserTtl > COMPETITION_ACCESS_TTL) throw new Error('Invalid browser proof lifetime');
  const expires = Math.floor(now / 1000) + (purpose === 'browser' ? browserTtl : 60);
  // v2 revokes automatic browser grants AND old proxies that signed without
  // checking a manual browser proof first.
  const binding = await contextHash(context);
  const payload = purpose === 'browser' && uniqueBrowserSession
    ? `v3.browser.${expires}.${binding}.${crypto.randomUUID()}`
    : `v2.${purpose}.${expires}.${binding}`;
  return `${payload}.${hex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)))}`;
}
export async function readCompetitionProof(secret: string, proof: string, purpose: 'browser' | 'service', context: string, now = Date.now()) {
  if (secret.length < 32 || proof.length > 256) return null;
  const fields = proof.split('.');
  const [version, signedPurpose, expiry, binding] = fields;
  const signature = fields.at(-1) ?? '';
  const sessionId = version === 'v3' ? fields[4] : null;
  if (version === 'v3') {
    if (purpose !== 'browser' || fields.length !== 6 || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(sessionId ?? '')) return null;
  } else if (version !== 'v2' || fields.length !== 5) return null;
  if (signedPurpose !== purpose || !/^\d{10}$/.test(expiry) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expires = Number(expiry);
  const remaining = expires - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > (purpose === 'browser' ? COMPETITION_ACCESS_TTL : 60)) return null;
  if (binding !== await contextHash(context)) return null;
  const bytes = Uint8Array.from(signature.match(/../g)!, value => parseInt(value, 16));
  if (!await crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(proof.slice(0, -65)))) return null;
  return { expires, sessionId };
}
export async function verifyCompetitionProof(secret: string, proof: string, purpose: 'browser' | 'service', context: string, now = Date.now()) {
  return !!await readCompetitionProof(secret, proof, purpose, context, now);
}
export function competitionCookie(header: string) {
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${COMPETITION_ACCESS_COOKIE}=`));
  return matches.length === 1 ? matches[0].slice(COMPETITION_ACCESS_COOKIE.length + 1) : '';
}
