export function getRecordClass(val: string): string {
  // 女子纪录 F 前缀(YT 在 F 前)归一为对应非女子码,末尾排名数字也剥掉再上色:
  // YTFWR→YTWR、FAsR→AsR、FWR2→WR、NR3→NR。
  const normalized = val.toUpperCase().replace(/^YTF/, 'YT').replace(/^F(?=[A-Z])/, '');
  let end = normalized.length;
  while (end > 0 && normalized.charCodeAt(end - 1) >= 48 && normalized.charCodeAt(end - 1) <= 57) end--;
  const v = normalized.slice(0, end);
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
    ? s.split(/\bcancell?ed?\b|取消/gi).map((part, index, parts) =>
      index === 0 ? part.trimEnd() : index === parts.length - 1 ? part.trimStart() : part.trim()).join('').trim()
    : s;
  const cls = cancelled ? 'cancelled' : getRecordClass(recordType);
  return { text: recordType, className: `record-badge record-${cls}` };
}
