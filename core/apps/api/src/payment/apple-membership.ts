import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { query, withTransaction } from '../db/connection.js';
import { APPLE_MEMBERSHIP_APP_ID, APPLE_MEMBERSHIP_BUNDLE, assertMembershipTransaction, appleMembershipExpiry } from './apple-membership-policy.js';

export type AppleEnvironment = Environment.PRODUCTION | Environment.SANDBOX;
export const appleIapEnabled = () => process.env.APPLE_IAP_ENABLED === '1';
const clients = new Map<AppleEnvironment, { verifier: SignedDataVerifier; api: AppStoreServerAPIClient }>();
function client(environment: AppleEnvironment) {
  if (!appleIapEnabled()) throw new Error('Apple membership is not configured');
  const existing = clients.get(environment);
  if (existing) return existing;
  const paths = (process.env.APPLE_IAP_ROOT_CERT_PATHS ?? '').split(',').filter(Boolean);
  const keyPath = process.env.APPLE_IAP_KEY_PATH;
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const issuer = process.env.APPLE_IAP_ISSUER_ID;
  if (!paths.length || !keyPath || !keyId || !issuer) throw new Error('Apple membership configuration incomplete');
  const value = {
    verifier: new SignedDataVerifier(paths.map(p => readFileSync(p)), true, environment, APPLE_MEMBERSHIP_BUNDLE, APPLE_MEMBERSHIP_APP_ID),
    api: new AppStoreServerAPIClient(readFileSync(keyPath, 'utf8'), keyId, issuer, APPLE_MEMBERSHIP_BUNDLE, environment),
  };
  clients.set(environment, value);
  return value;
}
function sandboxAllowed(uid: number) {
  return (process.env.APPLE_IAP_SANDBOX_USER_IDS ?? '').split(',').map(s => s.trim()).includes(String(uid));
}
export async function appleAccountToken(uid: number): Promise<string> {
  // Check all required credentials before presenting a purchasable product.
  client(Environment.PRODUCTION);
  return withTransaction(async run => {
    await run('SELECT id FROM app_users WHERE id = ? FOR UPDATE', [uid]);
    const rows = await run<{ token: string }>('SELECT token FROM apple_membership_accounts WHERE user_id = ? ORDER BY created_at LIMIT 1', [uid]);
    if (rows[0]) return rows[0].token;
    const token = randomUUID();
    await run('INSERT INTO apple_membership_accounts (token, user_id) VALUES (?, ?)', [token, uid]);
    return token;
  });
}

/** Always query Apple's current status. A stale device receipt or out-of-order
 * notification is only a lookup hint and can never undo a refund/revocation. */
export async function reconcileAppleSubscription(environment: AppleEnvironment, originalId: string, expectedUid?: number): Promise<void> {
  if (!/^\d+$/.test(originalId)) throw new Error('Invalid Apple original transaction');
  const { verifier, api } = client(environment);
  await withTransaction(async run => {
    await run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`apple:${environment}:${originalId}`]);
    const response = await api.getAllSubscriptionStatuses(originalId);
    const item = response.data?.flatMap(g => g.lastTransactions ?? []).find(t => t.originalTransactionId === originalId);
    if (!item?.signedTransactionInfo || !item.signedRenewalInfo || !item.status) throw new Error('Apple subscription status unavailable');
    const [transaction, renewal] = await Promise.all([
      verifier.verifyAndDecodeTransaction(item.signedTransactionInfo),
      verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo),
    ]);
    const expiry = appleMembershipExpiry(transaction, renewal, item.status);
    if (transaction.originalTransactionId !== originalId) throw new Error('Mismatched Apple subscription');
    const token = transaction.appAccountToken!.toLowerCase();
    const accounts = await run<{ user_id: number | null }>('SELECT user_id FROM apple_membership_accounts WHERE token = ? FOR SHARE', [token]);
    if (!accounts.length) throw new Error('Unknown Apple account token');
    const uid = accounts[0].user_id == null ? null : Number(accounts[0].user_id);
    if (expectedUid != null && uid !== expectedUid) throw new Error('This purchase belongs to another CubeRoot account');
    const granted = uid != null && (environment === Environment.PRODUCTION || sandboxAllowed(uid));
    if (expectedUid != null && !granted) throw new Error('Sandbox purchases require an enabled test account');
    const previous = await run<{ account_token: string }>('SELECT account_token FROM apple_membership_subscriptions WHERE environment = ? AND original_transaction_id = ?', [environment, originalId]);
    if (previous[0] && previous[0].account_token !== token) throw new Error('Apple purchase ownership changed');
    await run(`INSERT INTO apple_membership_subscriptions
      (environment, original_transaction_id, account_token, transaction_id, product_id, status, expires_at, auto_renew, grants_membership, signed_transaction, signed_renewal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (environment, original_transaction_id) DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id, product_id = EXCLUDED.product_id,
        status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, auto_renew = EXCLUDED.auto_renew,
        grants_membership = EXCLUDED.grants_membership, signed_transaction = EXCLUDED.signed_transaction,
        signed_renewal = EXCLUDED.signed_renewal, checked_at = NOW()`,
    [environment, originalId, token, transaction.transactionId, transaction.productId, item.status, new Date(expiry), renewal.autoRenewStatus === 1, granted, item.signedTransactionInfo, item.signedRenewalInfo]);
  });
}

export async function verifyApplePurchase(signedTransaction: string, uid: number): Promise<void> {
  // Never use unverified JWS environment or account fields to choose the grant.
  let verified: { environment: AppleEnvironment; originalId: string } | undefined;
  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX] as const) {
    try {
      const t = await client(environment).verifier.verifyAndDecodeTransaction(signedTransaction);
      assertMembershipTransaction(t);
      const owners = await query<{ user_id: number | null }>('SELECT user_id FROM apple_membership_accounts WHERE token = ?', [t.appAccountToken]);
      if (Number(owners[0]?.user_id) !== uid) throw new Error('Purchase account mismatch');
      verified = { environment, originalId: t.originalTransactionId! };
      break;
    } catch { /* Try the other independently verified Apple environment. */ }
  }
  if (!verified) throw new Error('Apple transaction could not be verified for this account');
  await reconcileAppleSubscription(verified.environment, verified.originalId, uid);
}

export async function receiveAppleNotification(environment: AppleEnvironment, signedPayload: string): Promise<void> {
  const { verifier } = client(environment);
  const notification = await verifier.verifyAndDecodeNotification(signedPayload);
  if (!notification.notificationUUID) throw new Error('Missing Apple notification ID');
  const seen = await query('SELECT 1 FROM apple_membership_notifications WHERE environment = ? AND notification_id = ?', [environment, notification.notificationUUID]);
  if (seen.length) return;
  if (notification.notificationType !== 'TEST') {
    if (!notification.data?.signedTransactionInfo) throw new Error('Unsupported Apple notification payload');
    const t = await verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo);
    assertMembershipTransaction(t);
    await reconcileAppleSubscription(environment, t.originalTransactionId!);
  }
  await query('INSERT INTO apple_membership_notifications (environment, notification_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [environment, notification.notificationUUID]);
}

export async function appleSubscriptionStatus(uid: number) {
  return query<{ environment: string; product_id: string; expires_at: Date; auto_renew: boolean; status: number }>(
    `SELECT s.environment, s.product_id, s.expires_at, s.auto_renew, s.status
     FROM apple_membership_subscriptions s JOIN apple_membership_accounts a ON a.token = s.account_token
     WHERE a.user_id = ? ORDER BY s.expires_at DESC`, [uid]);
}
