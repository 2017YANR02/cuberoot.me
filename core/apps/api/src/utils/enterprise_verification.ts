import { createHash } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import type { EnterpriseBankRecipient, EnterpriseVerificationDraft, EnterpriseBankReceipt } from '@cuberoot/shared/teaching';

export function invalid(message: string): never {
  throw new HTTPException(400, { message });
}
export function requiredText(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid('Invalid field');
  return value.trim();
}
export function bankAccount(value: unknown): string {
  const account = requiredText(value, 60).replace(/\s/g, '');
  if (!/^\d{6,40}$/.test(account)) invalid('Invalid bank account');
  return account;
}
export function validCreditCode(code: string): boolean {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  const weights = [1,3,9,27,19,26,16,17,20,29,25,13,8,24,10,30,28];
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(code)) return false;
  return alphabet[(31 - weights.reduce((sum, weight, i) => sum + alphabet.indexOf(code[i]) * weight, 0) % 31) % 31] === code[17];
}
export function licenseImage(value: unknown): string {
  const image = requiredText(value, 2_800_000);
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) invalid('License must be a PNG or JPEG image');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 16 || bytes.toString('base64') !== match[2]) invalid('Invalid license image');
  if (match[1] === 'png' ? bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' : bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') invalid('Invalid license image');
  return image;
}
export function parseDraft(body: Record<string, unknown>): EnterpriseVerificationDraft {
  const creditCode = requiredText(body.creditCode, 18).toUpperCase();
  if (!validCreditCode(creditCode)) invalid('Invalid unified social credit code');
  if (body.declaration !== true) invalid('Authorization declaration required');
  return {
    legalName: requiredText(body.legalName, 160), creditCode,
    representative: requiredText(body.representative, 100),
    contactName: requiredText(body.contactName, 100), contactPhone: requiredText(body.contactPhone, 40),
    payerAccount: bankAccount(body.payerAccount), payerBank: requiredText(body.payerBank, 160),
    licenseDataUrl: licenseImage(body.licenseDataUrl), declaration: true,
  };
}
export function parseRecipient(body: Record<string, unknown>): EnterpriseBankRecipient {
  if (typeof body.enabled !== 'boolean') invalid('Invalid enabled value');
  return { enabled: body.enabled, accountName: requiredText(body.accountName, 160),
    bankName: requiredText(body.bankName, 160), accountNumber: bankAccount(body.accountNumber),
    refundNotice: requiredText(body.refundNotice, 1000) };
}
export function parseReceipt(body: Record<string, unknown>): EnterpriseBankReceipt {
  if (!Number.isInteger(body.amountMinor) || Number(body.amountMinor) < 1 || Number(body.amountMinor) > 100_000_000) invalid('Invalid transfer amount');
  const receivedAt = requiredText(body.receivedAt, 40);
  if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(receivedAt) || !Number.isFinite(Date.parse(receivedAt))) invalid('Invalid received date');
  return { transactionId: requiredText(body.transactionId, 160), payerName: requiredText(body.payerName, 160),
    payerAccount: bankAccount(body.payerAccount), amountMinor: Number(body.amountMinor),
    reference: requiredText(body.reference, 40), receivedAt };
}
export function assertReceiptMatches(receipt: EnterpriseBankReceipt, expected: {
  legalName: string; payerAccount: string; amountMinor: number; reference: string; createdAt: string; expiresAt: string;
}, now = Date.now()): void {
  if (receipt.payerName !== expected.legalName || receipt.payerAccount !== expected.payerAccount
    || receipt.amountMinor !== expected.amountMinor || receipt.reference !== expected.reference
    || Date.parse(receipt.receivedAt) < Date.parse(expected.createdAt)
    || Date.parse(receipt.receivedAt) > Date.parse(expected.expiresAt)
    || Date.parse(receipt.receivedAt) > now) invalid('Bank receipt does not match application');
}
export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
