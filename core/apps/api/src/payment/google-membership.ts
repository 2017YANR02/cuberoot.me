import { randomUUID } from 'node:crypto';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { query, withTransaction } from '../db/connection.js';
import { GOOGLE_MEMBERSHIP_PACKAGE, googleMembershipGrant, type GoogleSubscription } from './google-membership-policy.js';
import { validGooglePurchaseToken } from '@cuberoot/shared/google-play-relay';
import type { GoogleMembershipProductId } from '@cuberoot/shared/google-membership';
import { googlePlayRelay, useGooglePlayRelay } from './google-play-relay.js';
export { validGooglePurchaseToken } from '@cuberoot/shared/google-play-relay';

export const googleIapEnabled = () => process.env.GOOGLE_IAP_ENABLED === '1';
let auth: GoogleAuth | undefined;
function client() {
  if (!googleIapEnabled() || !process.env.GOOGLE_IAP_KEY_PATH) throw new Error('Google membership configuration incomplete');
  return auth ??= new GoogleAuth({ keyFile: process.env.GOOGLE_IAP_KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
}
const apiBase = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_MEMBERSHIP_PACKAGE}/purchases`;
export async function googleAccountId(uid: number): Promise<string> {
  if (!googleIapEnabled()) throw new Error('Google membership disabled');
  if (useGooglePlayRelay()) {
    if ((await googlePlayRelay({ operation: 'ready' })).ready !== true) throw new Error('Google relay not ready');
  } else await client().getAccessToken();
  return withTransaction(async run => {
    const users = await run('SELECT id FROM app_users WHERE id = ? FOR UPDATE', [uid]);
    if (!users.length) throw new Error('Account unavailable');
    const existing = await run<{ token: string }>('SELECT token FROM google_membership_accounts WHERE user_id = ? ORDER BY created_at LIMIT 1', [uid]);
    if (existing[0]) return existing[0].token;
    const token = randomUUID();
    await run('INSERT INTO google_membership_accounts (token, user_id) VALUES (?, ?)', [token, uid]);
    return token;
  });
}
/** A notification/client token is only a lookup hint. Serialize Google reconciliation
 * (including replacement chains) so delayed responses cannot resurrect revoked grants. */
export async function reconcileGoogleSubscription(token: string, expectedUid?: number): Promise<void> {
  if (!validGooglePurchaseToken(token)) throw new Error('Invalid purchase token');
  if (!googleIapEnabled()) throw new Error('Google membership disabled');
  const api = useGooglePlayRelay() ? null : await client().getClient();
  const acknowledged = await withTransaction(async run => {
    await run("SELECT pg_advisory_xact_lock(hashtextextended('google-membership', 0))");
    const data = api
      ? (await api.request<GoogleSubscription>({ url: `${apiBase}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, timeout: 20_000 })).data
      : (await googlePlayRelay({ operation: 'subscription', token })).subscription as GoogleSubscription;
    const grant = googleMembershipGrant(data);
    let accountId = data.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    const linked = data.linkedPurchaseToken ? await run<{ account_token: string }>('SELECT account_token FROM google_membership_subscriptions WHERE purchase_token = ?', [data.linkedPurchaseToken]) : [];
    if (!accountId) accountId = linked[0]?.account_token;
    if (!accountId || !/^[0-9a-f-]{36}$/i.test(accountId)) throw new Error('Missing purchase owner');
    if (linked[0] && linked[0].account_token !== accountId) throw new Error('Replacement ownership mismatch');
    const accounts = await run<{ user_id: number | null }>('SELECT user_id FROM google_membership_accounts WHERE token = ? FOR SHARE', [accountId]);
    if (!accounts.length) throw new Error('Unknown purchase owner');
    const uid = accounts[0].user_id == null ? null : Number(accounts[0].user_id);
    if (expectedUid != null && expectedUid !== uid) throw new Error('Purchase belongs to another account');
    const testAllowed = !data.testPurchase || (process.env.GOOGLE_IAP_TEST_USER_IDS ?? '').split(',').map(s => s.trim()).includes(String(uid));
    if (expectedUid != null && !testAllowed) throw new Error('Test account not enabled');
    const previous = await run<{ account_token: string; superseded: boolean; linked_purchase_token: string | null }>('SELECT account_token, superseded, linked_purchase_token FROM google_membership_subscriptions WHERE purchase_token = ?', [token]);
    if (previous[0] && previous[0].account_token !== accountId) throw new Error('Purchase ownership changed');
    if (previous[0]?.linked_purchase_token && data.linkedPurchaseToken && previous[0].linked_purchase_token !== data.linkedPurchaseToken) throw new Error('Replacement chain changed');
    const replacements = await run('SELECT 1 FROM google_membership_subscriptions WHERE linked_purchase_token = ?', [token]);
    await run(`INSERT INTO google_membership_subscriptions
      (purchase_token, account_token, product_id, state, expires_at, auto_renew, grants_membership, test_purchase, linked_purchase_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (purchase_token) DO UPDATE SET state = EXCLUDED.state, expires_at = EXCLUDED.expires_at,
        auto_renew = EXCLUDED.auto_renew, grants_membership = EXCLUDED.grants_membership,
        test_purchase = EXCLUDED.test_purchase,
        linked_purchase_token = COALESCE(google_membership_subscriptions.linked_purchase_token, EXCLUDED.linked_purchase_token), checked_at = NOW()`,
    [token, accountId, grant.productId, data.subscriptionState, new Date(grant.expiry), grant.autoRenew,
      uid != null && testAllowed && grant.active && !previous[0]?.superseded && replacements.length === 0, Boolean(data.testPurchase), grant.pending ? null : (data.linkedPurchaseToken ?? null)]);
    if (data.linkedPurchaseToken && !grant.pending) {
      await run('UPDATE google_membership_subscriptions SET superseded = TRUE, grants_membership = FALSE WHERE purchase_token = ?', [data.linkedPurchaseToken]);
    }
    return !grant.pending && data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' ? grant.productId : null;
  });
  // Acknowledge only after durable grant/ownership storage; retry is safe if the response is lost.
  if (acknowledged) {
    if (api) await api.request({ method: 'POST', url: `${apiBase}/subscriptions/${encodeURIComponent(acknowledged)}/tokens/${encodeURIComponent(token)}:acknowledge`, data: {}, timeout: 20_000 });
    else if ((await googlePlayRelay({ operation: 'acknowledge', token, productId: acknowledged as GoogleMembershipProductId })).acknowledged !== true) throw new Error('Google acknowledgement failed');
  }
}
export async function syncGoogleSubscriptions(uid: number) {
  const subscriptions = await query<{ purchase_token: string }>(`SELECT s.purchase_token FROM google_membership_subscriptions s
    JOIN google_membership_accounts a ON a.token = s.account_token
    WHERE a.user_id = ? AND NOT s.superseded AND s.state NOT IN ('SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED')`, [uid]);
  for (const s of subscriptions) await reconcileGoogleSubscription(s.purchase_token, uid);
}
export async function verifyGooglePushAuthorization(authorization: string | undefined) {
  const audience = process.env.GOOGLE_IAP_RTDN_AUDIENCE;
  const email = process.env.GOOGLE_IAP_RTDN_SERVICE_ACCOUNT;
  if (!audience || !email || !authorization?.startsWith('Bearer ')) throw new Error('Push authentication required');
  if (useGooglePlayRelay()) {
    if ((await googlePlayRelay({ operation: 'verifyPush', idToken: authorization.slice(7) })).verified !== true) throw new Error('Wrong push identity');
    return;
  }
  const ticket = await new OAuth2Client().verifyIdToken({ idToken: authorization.slice(7), audience });
  const payload = ticket.getPayload();
  if (payload?.email !== email || payload.email_verified !== true) throw new Error('Wrong push identity');
}
