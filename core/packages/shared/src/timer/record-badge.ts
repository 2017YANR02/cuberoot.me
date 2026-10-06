export function getRecordClass(val: string): string {
  // 女子纪录 F 前缀(YT 在 F 前)归一为对应非女子码,末尾排名数字也剥掉再上色:
  // YTFWR→YTWR、FAsR→AsR、FWR2→WR、NR3→NR。
  const v = val.toUpperCase().replace(/^YTF/, 'YT').replace(/^F(?=[A-Z])/, '').replace(/\d+$/, '');
  // Personal-best labels incl. average variants (timer: "PB", "PB AO5", "PB AO12").
  // Treat the whole PB/PR family as a personal record so they share one badge color.
  if (/^P[RB](\s|$)/.test(v)) return 'pr';
  if (/^[FXU]?W[RB]$|^1STWR$|^NWR$|^RWR$|^YTW[RB]$|^XWR$/.test(v)) return 'wr';
  if (v === 'WCR') return 'wcr';
  if (v === 'CR') return 'cr';
  if (/(?:AS|E)[RB]$/.test(v) || /^(?:F|YT|X|U)?(?:SAR|SAB|NAR|NAB|OCR|OCB|AFR|AFB|ANR|ANB|ASR|ASB)$/.test(v)) return 'cr';
  if (/^[FXU]?N[RB]$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
  if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
    || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
  return 'other';
}

export function formatRecord(val: string | undefined): { text: string; className: string } | null {
  if (!val) return null;
  const s = String(val);
  const cancelled = /\bcancell?ed?\b|取消/i.test(s);
  const recordType = cancelled
    ? s.replace(/\s*\bcancell?ed?\b\s*|\s*取消\s*/gi, '').trim()
    : s;
  const cls = cancelled ? 'cancelled' : getRecordClass(recordType);
  return { text: recordType, className: `record-badge record-${cls}` };
}
