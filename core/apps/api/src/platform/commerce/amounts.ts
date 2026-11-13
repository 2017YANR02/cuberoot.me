import { badRequest } from '../errors.js';

export function safeMoney(value: number | string, label = 'amount'): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) badRequest(`${label} is outside the supported range`);
  return amount;
}

export function safeSignedMoney(value: number | string, label = 'amount'): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) badRequest(`${label} is outside the supported range`);
  return amount;
}
