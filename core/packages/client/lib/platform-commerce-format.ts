import type { useT } from '@/hooks/useT';

export function commerceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function commerceMoney(value: unknown, currency: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(String(currency))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currency) }).format(amount / 100);
}
export function commerceText(data: Record<string, unknown>, key: string, t: ReturnType<typeof useT>): string {
  const zh = String(data[`${key}Zh`] ?? data[`${key}En`] ?? data[key] ?? '');
  const en = String(data[`${key}En`] ?? data[`${key}Zh`] ?? data[key] ?? '');
  return t(zh, en);
}
