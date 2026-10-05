import { ExternalAccountClient, OAuth2Client } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
import { GOOGLE_MEMBERSHIP_PRODUCT_IDS } from '@cuberoot/shared/google-membership';
import { decodeGooglePlayRelayRequest, GOOGLE_PLAY_PACKAGE, GOOGLE_PLAY_RELAY_HEADER,
  GOOGLE_PLAY_RELAY_MAX_BYTES, verifyGooglePlayRelay } from '@cuberoot/shared/google-play-relay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const apiBase = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE}`;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function limitedBody(req: Request) {
  if (!req.body) throw new Error('Missing body');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > GOOGLE_PLAY_RELAY_MAX_BYTES) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

function googleClient() {
  const audience = process.env.GOOGLE_PLAY_WIF_AUDIENCE;
  const email = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!audience || !/^https:\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(audience)
    || !email || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(email)) throw new Error('WIF configuration unavailable');
  const client = ExternalAccountClient.fromJSON({
    type: 'external_account', audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken({ audience }) },
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    // This bounds impersonation/API transport, not the SDK's internal STS transport.
    // The caller's 50s deadline and this function's 60s runtime cap remain the outer bounds.
    transporterOptions: { timeout: 10_000, retry: false, maxRedirects: 0 },
  });
  if (!client) throw new Error('WIF client unavailable');
  return client;
}

/** Fixed operations only, never a general URL proxy or an entitlement authority. */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.GOOGLE_PLAY_RELAY_SECRET ?? '';
  if (process.env.VERCEL_ENV !== 'production' || secret.length < 32) return json({ error: 'Relay unavailable' }, 503);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415);
  let body: string;
  try { body = await limitedBody(req); } catch { return json({ error: 'Invalid body' }, 413); }
  if (!await verifyGooglePlayRelay(secret, body, req.headers.get(GOOGLE_PLAY_RELAY_HEADER) ?? '')) return json({ error: 'Unauthorized' }, 401);
  let operation;
  try { operation = decodeGooglePlayRelayRequest(JSON.parse(body)); } catch { /* invalid JSON */ }
  if (!operation) return json({ error: 'Invalid operation' }, 400);
  try {
    if (operation.operation === 'verifyPush') {
      const audience = process.env.GOOGLE_IAP_RTDN_AUDIENCE;
      const email = process.env.GOOGLE_IAP_RTDN_SERVICE_ACCOUNT;
      if (!audience || !email) throw new Error('Push configuration unavailable');
      const verifier = new OAuth2Client({ transporterOptions: { timeout: 10_000, retry: false, maxRedirects: 0 } });
      const ticket = await verifier.verifyIdToken({ idToken: operation.idToken, audience });
      const payload = ticket.getPayload();
      if (payload?.email !== email || payload.email_verified !== true) return json({ error: 'Wrong push identity' }, 401);
      return json({ verified: true });
    }
    // Obtain short-lived credentials only inside this authenticated production request.
    const client = googleClient();
    if (operation.operation === 'ready') {
      // A read-only probe checks both impersonation and existing Play app permissions.
      const products = await Promise.all(GOOGLE_MEMBERSHIP_PRODUCT_IDS.map(async productId => {
        await client.request({ url: `${apiBase}/monetization/subscriptions/${productId}`, timeout: 10_000, retry: false, maxRedirects: 0 });
        return productId;
      }));
      return json({ ready: true, products });
    }
    const token = encodeURIComponent(operation.token);
    if (operation.operation === 'subscription') {
      const { data } = await client.request({ url: `${apiBase}/purchases/subscriptionsv2/tokens/${token}`, timeout: 15_000, retry: false, maxRedirects: 0 });
      return json({ subscription: data });
    }
    await client.request({ method: 'POST', url: `${apiBase}/purchases/subscriptions/${operation.productId}/tokens/${token}:acknowledge`, data: {}, timeout: 15_000, retry: false, maxRedirects: 0 });
    return json({ acknowledged: true });
  } catch {
    // Never log Google errors: they can include auth headers, receipts and URLs.
    return json({ error: 'Google operation failed' }, 502);
  }
}
