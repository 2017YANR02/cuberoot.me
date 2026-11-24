import { afterEach, describe, expect, it, vi } from 'vitest';
import { Environment, InAppOwnershipType, Type } from '@apple/app-store-server-library';
import { appleMembershipExpiry, assertMembershipTransaction } from '../src/payment/apple-membership-policy.js';
import { appleIapAccountEnvironment, appleIapEnvironmentEnabled } from '../src/payment/apple-membership.js';
const transaction = { bundleId: 'me.cuberoot.app', productId: 'me.cuberoot.app.membership.monthly', type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
  inAppOwnershipType: InAppOwnershipType.PURCHASED, transactionId: '10001', originalTransactionId: '10000', appAccountToken: 'c73ca215-ea11-4376-ae45-8d6418e72b52',
  environment: Environment.PRODUCTION, expiresDate: 2_000_000_000_000, signedDate: 1_999_000_000_000 };
const renewal = { originalTransactionId: '10000', environment: Environment.PRODUCTION, autoRenewStatus: 0 };

describe('Apple membership environment access', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('limits sandbox-only mode to explicit requests from allowlisted accounts and sandbox notifications', () => {
    vi.stubEnv('APPLE_IAP_ENABLED', '0');
    vi.stubEnv('APPLE_IAP_SANDBOX_ENABLED', '1');
    vi.stubEnv('APPLE_IAP_SANDBOX_USER_IDS', ' 7, 42 ');
    expect(appleIapAccountEnvironment(7, ['sandbox'])).toBe(Environment.SANDBOX);
    expect(appleIapAccountEnvironment(8, ['sandbox'])).toBeNull();
    expect(appleIapAccountEnvironment(7, [])).toBeNull();
    expect(appleIapAccountEnvironment(7, ['sandbox', 'sandbox'])).toBeNull();
    expect(appleIapAccountEnvironment(7, ['production'])).toBeNull();
    expect(appleIapEnvironmentEnabled(Environment.PRODUCTION)).toBe(false);
    expect(appleIapEnvironmentEnabled(Environment.SANDBOX)).toBe(true);
  });

  it('preserves regular production requests when production is enabled', () => {
    vi.stubEnv('APPLE_IAP_ENABLED', '1');
    vi.stubEnv('APPLE_IAP_SANDBOX_ENABLED', '0');
    vi.stubEnv('APPLE_IAP_SANDBOX_USER_IDS', '7');
    expect(appleIapAccountEnvironment(8, [])).toBe(Environment.PRODUCTION);
    expect(appleIapAccountEnvironment(7, ['sandbox'])).toBe(Environment.SANDBOX);
    expect(appleIapAccountEnvironment(8, ['sandbox'])).toBeNull();
  });
});

describe('Apple membership policy after signature verification', () => {
  it('cancellation retains the already paid period', () => expect(appleMembershipExpiry(transaction, renewal, 1)).toBe(transaction.expiresDate));
  it.each([2, 3, 5])('status %i does not grant access', status => expect(appleMembershipExpiry(transaction, renewal, status)).toBe(0));
  it('refund and upgrade revoke the old grant', () => {
    expect(appleMembershipExpiry({ ...transaction, revocationDate: transaction.signedDate }, renewal, 1)).toBe(0);
    expect(appleMembershipExpiry({ ...transaction, isUpgraded: true }, renewal, 1)).toBe(0);
  });
  it('only an explicit grace-period status uses signed grace expiry', () => {
    const r = { ...renewal, gracePeriodExpiresDate: transaction.expiresDate + 1000 };
    expect(appleMembershipExpiry(transaction, r, 4)).toBe(transaction.expiresDate + 1000);
    expect(appleMembershipExpiry(transaction, r, 1)).toBe(transaction.expiresDate);
    expect(() => appleMembershipExpiry(transaction, renewal, 4)).toThrow();
  });
  it('rejects family sharing, other applications, unknown products and malformed tokens', () => {
    for (const change of [{ bundleId: 'other.app' }, { productId: 'other' }, { appAccountToken: '' }, { inAppOwnershipType: InAppOwnershipType.FAMILY_SHARED }, { expiresDate: NaN }]) {
      expect(() => assertMembershipTransaction({ ...transaction, ...change })).toThrow();
    }
  });
  it('rejects a renewal from another environment, chain or account', () => {
    for (const change of [{ environment: Environment.SANDBOX }, { originalTransactionId: '999' }, { appAccountToken: 'different' }]) {
      expect(() => appleMembershipExpiry(transaction, { ...renewal, ...change }, 1)).toThrow();
    }
  });
});
