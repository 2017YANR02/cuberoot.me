import { expect, it } from 'vitest';
import { assertReceiptMatches, validCreditCode, licenseImage, parseDraft, parseRecipient } from '../src/utils/enterprise_verification.js';
const code = '91350211M000100Y46';
const expected = { legalName: '测试企业', payerAccount: '123456789', amountMinor: 17, reference: 'CR-TEST', createdAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-08T00:00:00Z' };
const receipt = { transactionId: 'BANK123', payerName: expected.legalName, payerAccount: expected.payerAccount, amountMinor: 17, reference: expected.reference, receivedAt: '2026-01-02T00:00:00Z' };
it('requires the credit-code checksum, not just 18 characters', () => {
  // Fixed checksum fixture; changing the final character must be rejected.
  expect(validCreditCode('91350211M000100Y46')).toBe(true);
  expect(validCreditCode('91350211M000100Y44')).toBe(false);
  expect(validCreditCode('IIIIIIIIIIIIIIIIII')).toBe(false);
});
it.each([
  { payerName: '其他企业' }, { payerAccount: '123456780' }, { amountMinor: 18 },
  { reference: 'CR-OTHER' }, { receivedAt: '2025-12-31T00:00:00Z' }, { receivedAt: '2026-01-09T00:00:00Z' },
])('rejects mismatched bank evidence %j', difference => {
  expect(() => assertReceiptMatches({ ...receipt, ...difference }, expected, Date.parse('2026-01-10T00:00:00Z'))).toThrow();
});
it('accepts an exact receipt but rejects future-dated evidence', () => {
  expect(() => assertReceiptMatches(receipt, expected, Date.parse('2026-01-03T00:00:00Z'))).not.toThrow();
  expect(() => assertReceiptMatches(receipt, expected, Date.parse('2026-01-01T00:00:00Z'))).toThrow();
});
it('does not accept SVG, HTML or mislabeled uploads', () => {
  expect(() => licenseImage('data:image/svg+xml;base64,PHN2Zz4=')).toThrow();
  expect(() => licenseImage('data:image/png;base64,' + Buffer.from('<html>not a license image</html>').toString('base64'))).toThrow();
});
it('requires the applicant declaration and explicit recipient settings', () => {
  expect(() => parseDraft({ creditCode: code, declaration: false })).toThrow();
  expect(() => parseRecipient({ enabled: 'false' })).toThrow();
  expect(() => parseRecipient({ enabled: true, accountName: '测试', bankName: '测试', accountNumber: 'personal', refundNotice: '退款' })).toThrow();
});
