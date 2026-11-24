/** Server-to-server contract. Keys stay on the server. */
export const ASSISTANT_OPENAI_MODEL = 'gpt-6-luna';
export const ASSISTANT_OPENAI_RELAY_PATH = '/api/site-assistant/openai/chat/completions';
export const ASSISTANT_OPENAI_RESPONSES_PATH = '/api/site-assistant/openai/responses';
export type AssistantOpenAIRelayPath = typeof ASSISTANT_OPENAI_RELAY_PATH | typeof ASSISTANT_OPENAI_RESPONSES_PATH;
export const ASSISTANT_OPENAI_BODY_BYTES = 4_000_000;
export const ASSISTANT_OPENAI_MAX_TOKENS = 16_384;

// Keep the legacy country slot in the signed payload for rolling deployments.
// New requests leave the slot empty.
const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
async function signingKey(secret: string) {
  if (secret.length < 32) throw new Error('Assistant relay is not configured');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function payload(country: string, body: string, expires: number, path: AssistantOpenAIRelayPath) {
  const hash = hex(await crypto.subtle.digest('SHA-256', encoder.encode(body)));
  return `assistant-openai-v1\n${path}\n${country}\n${expires}\n${hash}`;
}
export async function signAssistantOpenAI(secret: string, country: string, body: string, now = Date.now(), path: AssistantOpenAIRelayPath = ASSISTANT_OPENAI_RELAY_PATH) {
  const expires = Math.floor(now / 1000) + 60;
  const signature = hex(await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(await payload(country, body, expires, path))));
  return `${expires}.${signature}`;
}
export async function verifyAssistantOpenAI(secret: string, country: string, body: string, proof: string, now = Date.now(), path: AssistantOpenAIRelayPath = ASSISTANT_OPENAI_RELAY_PATH) {
  if (secret.length < 32) return false;
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(proof);
  if (!match) return false;
  const remaining = Number(match[1]) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > 60) return false;
  return crypto.subtle.verify('HMAC', await signingKey(secret), Uint8Array.from(match[2].match(/../g)!, b => parseInt(b, 16)), encoder.encode(await payload(country, body, Number(match[1]), path)));
}
