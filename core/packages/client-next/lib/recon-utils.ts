// Minimal port from packages/client/src/utils/recon_utils.ts.
// Provides record-badge helpers + wcaPersonUrl.
import { ISO2_TO_CONTINENT } from './continent';

export function getRecordClass(val: string): string {
  const v = val.toUpperCase();
  if (/^[FXU]?W[RB]$|^1STWR$|^RWR$|^YTW[RB]$|^XWR$/.test(v)) return 'wr';
  if (v === 'WCR') return 'wcr';
  if (v === 'CR') return 'cr';
  if (/(?:AS|E)[RB]$/.test(v) || /^(?:F|YT|X|U)?(?:SAR|SAB|NAR|NAB|OCR|OCB|AFR|AFB|ANR|ANB|ASR|ASB)$/.test(v)) return 'cr';
  if (/^[FXU]?N[RB]$|^NWR$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
  if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
    || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
  return 'other';
}

const CONTINENT_TO_RECORD: Record<string, string> = {
  AF: 'AfR', AS: 'AsR', EU: 'ER', NA: 'NAR', SA: 'SAR', OC: 'OcR',
};

export function expandContinentRecord(val: string | undefined | null, iso2: string | undefined | null): string {
  if (!val) return '';
  if (!iso2) return val;
  if (!/\bCR\b/.test(val)) return val;
  const cont = ISO2_TO_CONTINENT[iso2.toUpperCase()];
  const code = cont && CONTINENT_TO_RECORD[cont];
  if (!code) return val;
  return val.replace(/\bCR\b/, code);
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

export function wcaPersonUrl(personId: string): string {
  return `https://www.worldcubeassociation.org/persons/${personId}`;
}
