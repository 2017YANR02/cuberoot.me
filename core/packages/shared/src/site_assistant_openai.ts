/** Server-to-server contract. No keys or region decisions come from the browser. */
export const ASSISTANT_OPENAI_MODEL = 'gpt-6-luna';
export const ASSISTANT_OPENAI_RELAY_PATH = '/api/site-assistant/openai/chat/completions';
export const ASSISTANT_OPENAI_RESPONSES_PATH = '/api/site-assistant/openai/responses';
export type AssistantOpenAIRelayPath = typeof ASSISTANT_OPENAI_RELAY_PATH | typeof ASSISTANT_OPENAI_RESPONSES_PATH;
export const ASSISTANT_OPENAI_BODY_BYTES = 4_000_000;
export const ASSISTANT_OPENAI_MAX_TOKENS = 16_384;

// Official API support list, checked 2026-11-15:
// https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories
// Ukraine has territorial exceptions: country-only GeoIP cannot establish eligibility.
// Unknown locations and UA remain on Bailian until finer location checks exist.
const countries = new Set(`AL DZ AF AX AD AO AG AR AM AW AU AT AZ BS BH BD BB BE BZ BM BJ BT BO BA BW BR BN BG BF BI CV KH CM CA KY CF TD CL CO KM CG CD CR CI HR CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FO FJ FI FR GF PF TF GA GM GE DE GH GR GD GL GT GP GN GW GY HT VA HN HU IS IN ID IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MA MZ MM NA NR NP NL NC NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RE RO RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SR SE CH SD SJ TW TJ TZ TH TL TG TO TT TN TR TM TV UG AE GB US UY UZ VU VN WF YE ZM ZW`.split(' '));
export function assistantOpenAICountrySupported(country: string | null | undefined): boolean {
  return typeof country === 'string' && countries.has(country.toUpperCase());
}

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
  if (!assistantOpenAICountrySupported(country)) throw new Error('Unsupported assistant region');
  const expires = Math.floor(now / 1000) + 60;
  const signature = hex(await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(await payload(country, body, expires, path))));
  return `${expires}.${signature}`;
}
export async function verifyAssistantOpenAI(secret: string, country: string, body: string, proof: string, now = Date.now(), path: AssistantOpenAIRelayPath = ASSISTANT_OPENAI_RELAY_PATH) {
  if (secret.length < 32 || !assistantOpenAICountrySupported(country)) return false;
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(proof);
  if (!match) return false;
  const remaining = Number(match[1]) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > 60) return false;
  return crypto.subtle.verify('HMAC', await signingKey(secret), Uint8Array.from(match[2].match(/../g)!, b => parseInt(b, 16)), encoder.encode(await payload(country, body, Number(match[1]), path)));
}
