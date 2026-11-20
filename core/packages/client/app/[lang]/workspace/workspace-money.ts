import type { Lang } from '@/i18n/tr';

const formatOptions: Intl.NumberFormatOptions = {
  style: 'currency', currency: 'CNY', minimumFractionDigits: 0, maximumFractionDigits: 2,
};
const formatters = { en: new Intl.NumberFormat('en', formatOptions), zh: new Intl.NumberFormat('zh-CN', formatOptions) };

export function formatCnyCents(cents: number, lang: Lang) {
  return formatters[lang].format(cents / 100);
}

export function parseCnyCents(raw: string) {
  if (raw === '') return 0;
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(raw)) return NaN;
  const [yuan, fen = ''] = raw.split('.');
  return Number(yuan) * 100 + Number(fen.padEnd(2, '0'));
}
