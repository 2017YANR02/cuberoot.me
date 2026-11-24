import { APPLE_MEMBERSHIP_PRODUCT_IDS, type AppleMembershipProduct, type AppleMembershipRequest, type AppleMembershipResult } from '@cuberoot/shared/apple-membership';
import type { WebSession } from '@cuberoot/shared/auth/web-session';

interface AppleTransaction { transactionId: string; signedTransaction: string }

export interface NativeAppleMembership {
  products(options: { sandboxOnly: boolean }): Promise<{ products: AppleMembershipProduct[] }>;
  purchase(options: { productId: string; appAccountToken: string; sandboxOnly: boolean }): Promise<Partial<AppleTransaction> & { status: 'purchased' | 'pending' | 'cancelled' }>;
  transactions(): Promise<{ transactions: AppleTransaction[] }>;
  restore(): Promise<{ transactions: AppleTransaction[] }>;
  finish(options: { transactionId: string }): Promise<void>;
  manage(): Promise<void>;
}

interface AppleMembershipOptions {
  apiBase: string;
  native: NativeAppleMembership;
  restoreSession(): Promise<WebSession | null>;
  sandboxOnly: boolean;
}

export function createAppleMembershipHandler({ apiBase, native, restoreSession, sandboxOnly }: AppleMembershipOptions) {
  let operation: Promise<unknown> = Promise.resolve();
  async function api(session: WebSession, path: string, body?: object) {
    const url = new URL(`${apiBase}/${path}`);
    if (sandboxOnly) url.searchParams.set('environment', 'sandbox');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url.href, { method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      if (!response.ok) throw new Error('Apple membership unavailable or not verified');
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  return async function handleAppleMembership(request: AppleMembershipRequest, initialSession: WebSession): Promise<Omit<AppleMembershipResult, 'type' | 'requestId'>> {
    const result = operation.catch(() => {}).then(async () => {
      const session = await restoreSession();
      if (!session || session.user.uid !== request.expectedUid || session.user.uid !== initialSession.user.uid) throw new Error('Account changed');
      const verify = async (transaction: AppleTransaction) => {
        // Capture the initiating account; logout/account switches cannot reassign a receipt.
        await api(session, 'verify', { signedTransaction: transaction.signedTransaction });
        await native.finish({ transactionId: transaction.transactionId });
      };
      if (request.action === 'manage') { await native.manage(); return { status: 'success' as const }; }
      if (request.action === 'products') {
        await api(session, 'me');
        const { products } = await native.products({ sandboxOnly });
        return { status: 'success' as const, products: products.filter(p => APPLE_MEMBERSHIP_PRODUCT_IDS.includes(p.id)) };
      }
      if (request.action === 'purchase') {
        const { appAccountToken } = await api(session, 'me');
        if (!request.productId || !APPLE_MEMBERSHIP_PRODUCT_IDS.includes(request.productId) || typeof appAccountToken !== 'string') throw new Error('Invalid purchase request');
      const result = await native.purchase({ productId: request.productId, appAccountToken, sandboxOnly });
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
}
