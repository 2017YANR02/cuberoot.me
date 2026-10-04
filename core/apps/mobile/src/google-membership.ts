import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { GOOGLE_MEMBERSHIP_PRODUCT_IDS, type GoogleMembershipProduct, type GoogleMembershipRequest, type GoogleMembershipResult } from '@cuberoot/shared/google-membership';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { mobileApiUrl } from '@cuberoot/app-ui';
import { nativeMobileAuth } from './mobile-auth';

interface Purchase { purchaseToken: string; status: 'purchased' | 'pending'; obfuscatedAccountId?: string }
interface GoogleMembershipNative {
  addListener(event: 'transactionAvailable', listener: () => void): Promise<PluginListenerHandle>;
  products(): Promise<{ products: GoogleMembershipProduct[] }>;
  purchases(): Promise<{ purchases: Purchase[] }>;
  purchase(options: { productId: string; obfuscatedAccountId: string }): Promise<Purchase | { status: 'cancelled' }>;
  manage(): Promise<void>;
}
const native = registerPlugin<GoogleMembershipNative>('GoogleMembership');
let operation: Promise<unknown> = Promise.resolve();
async function api(session: WebSession, path: string, body?: object) {
  const response = await fetch(mobileApiUrl(`/v1/membership/google/${path}`), {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('Google membership not verified');
  return response.json();
}
export function handleGoogleMembership(request: GoogleMembershipRequest, initial: WebSession): Promise<Omit<GoogleMembershipResult, 'type' | 'requestId'>> {
  const result = operation.catch(() => {}).then(async () => {
    const session = await nativeMobileAuth.restore();
    if (!session || session.user.uid !== initial.user.uid || session.user.uid !== request.expectedUid) throw new Error('Account changed');
    if (request.action === 'manage') { await native.manage(); return { status: 'success' as const }; }
    const { obfuscatedAccountId } = await api(session, 'me');
    if (request.action === 'products') {
      const { products } = await native.products();
      return { status: 'success' as const, products: products.filter(p => GOOGLE_MEMBERSHIP_PRODUCT_IDS.includes(p.id)) };
    }
    if (request.action === 'purchase') {
      const current = await nativeMobileAuth.restore();
      if (!current || current.user.uid !== session.user.uid) throw new Error('Account changed');
      const purchase = await native.purchase({ productId: request.productId!, obfuscatedAccountId });
      if (purchase.status !== 'purchased') return { status: purchase.status };
      await api(session, 'verify', { purchaseToken: purchase.purchaseToken });
    } else {
      const { purchases } = await native.purchases();
      let failed = false;
      for (const purchase of purchases) {
        if (purchase.status !== 'purchased') continue;
        try { await api(session, 'verify', { purchaseToken: purchase.purchaseToken }); } catch { failed = true; }
      }
      // Also query persisted tokens: refunded/expired purchases disappear from the device query.
      await api(session, 'sync', {});
      if (failed && request.action === 'restore') throw new Error('Some purchases belong to another account or could not be verified');
    }
    return { status: 'success' as const };
  });
  operation = result;
  return result;
}
export const listenForGoogleMembership = (listener: () => void) => native.addListener('transactionAvailable', listener);
