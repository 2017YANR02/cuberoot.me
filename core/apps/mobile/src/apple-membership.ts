import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { APPLE_MEMBERSHIP_PRODUCT_IDS, type AppleMembershipProduct, type AppleMembershipRequest, type AppleMembershipResult } from '@cuberoot/shared/apple-membership';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { nativeMobileAuth } from './mobile-auth';
import { mobileApiUrl } from '@cuberoot/app-ui';

interface AppleTransaction { transactionId: string; signedTransaction: string }
interface NativeAppleMembership {
  addListener(event: 'transactionAvailable', listener: () => void): Promise<PluginListenerHandle>;
  products(): Promise<{ products: AppleMembershipProduct[] }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<Partial<AppleTransaction> & { status: 'purchased' | 'pending' | 'cancelled' }>;
  transactions(): Promise<{ transactions: AppleTransaction[] }>;
  restore(): Promise<{ transactions: AppleTransaction[] }>;
  finish(options: { transactionId: string }): Promise<void>;
  manage(): Promise<void>;
}
const native = registerPlugin<NativeAppleMembership>('AppleMembership');
const apiBase = mobileApiUrl('/v1/membership/apple');
let operation: Promise<unknown> = Promise.resolve();
async function api(session: WebSession, path: string, body?: object) {
  const response = await fetch(`${apiBase}/${path}`, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Apple membership unavailable or not verified');
  return response.json();
}
export async function handleAppleMembership(request: AppleMembershipRequest, initialSession: WebSession): Promise<Omit<AppleMembershipResult, 'type' | 'requestId'>> {
  const result = operation.catch(() => {}).then(async () => {
    const session = await nativeMobileAuth.restore();
    if (!session || session.user.uid !== request.expectedUid || session.user.uid !== initialSession.user.uid) throw new Error('Account changed');
    const verify = async (transaction: AppleTransaction) => {
      // Capture the initiating account; logout/account switches cannot reassign a receipt.
      await api(session, 'verify', { signedTransaction: transaction.signedTransaction });
      await native.finish({ transactionId: transaction.transactionId });
    };
    if (request.action === 'manage') { await native.manage(); return { status: 'success' as const }; }
    if (request.action === 'products') {
      await api(session, 'me');
      const { products } = await native.products();
      return { status: 'success' as const, products: products.filter(p => APPLE_MEMBERSHIP_PRODUCT_IDS.includes(p.id)) };
    }
    if (request.action === 'purchase') {
      const { appAccountToken } = await api(session, 'me');
      const result = await native.purchase({ productId: request.productId!, appAccountToken });
      if (result.status !== 'purchased') return { status: result.status };
      if (!result.signedTransaction || !result.transactionId) throw new Error('Missing transaction');
      await verify(result as AppleTransaction);
    } else {
      const { transactions } = request.action === 'restore' ? await native.restore() : await native.transactions();
      let failed = false;
      for (const transaction of transactions) {
        try { await verify(transaction); } catch { failed = true; }
      }
      if (failed) throw new Error('Some transactions could not be verified for this account');
    }
    return { status: 'success' as const };
  });
  operation = result;
  return result;
}

export function listenForAppleMembership(listener: () => void) {
  return native.addListener('transactionAvailable', listener);
}
