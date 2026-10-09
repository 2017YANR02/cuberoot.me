const MAC_RE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

/** Validate + normalize to upper-case colon-separated "XX:XX:XX:XX:XX:XX". */
export function normalizeMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const trimmed = mac.trim();
  if (!MAC_RE.test(trimmed)) return null;
  return trimmed.replace(/-/g, ':').toUpperCase();
}

/** "AA:BB:CC:DD:EE:FF" -> Uint8Array([0xAA, ...]). Returns zeros on bad input. */
export function macStringToBytes(mac: string | null | undefined): Uint8Array {
  const out = new Uint8Array(6);
  const norm = normalizeMac(mac);
  if (!norm) return out;
  const parts = norm.split(':');
  for (let i = 0; i < 6; i++) out[i] = parseInt(parts[i], 16);
  return out;
}

export const QIYI_CIC_LIST: number[] = [0x0504];
export const QIYI_MAC_ADV = {brand: 'qiyi', cics: QIYI_CIC_LIST, layout: 'first6-reversed' as const};
export function macFromPayload(
  getByte: (k: number) => number,
  len: number,
  spec: {layout: 'first6-reversed' | 'last6-reversed'; maxPayloadBytes?: number},
): string | null {
  const n = spec.maxPayloadBytes === undefined ? len : Math.min(len, spec.maxPayloadBytes);
  if (n < 6) return null;
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    // 'last6-reversed': dv[n-1], dv[n-2], … dv[n-6]  (GAN, MoYu32)
    // 'first6-reversed': dv[5],  dv[4],   … dv[0]    (QiYi cube + timer)
    const idx = spec.layout === 'last6-reversed' ? n - 1 - i : 5 - i;
    parts.push((getByte(idx) & 0xff).toString(16).padStart(2, '0'));
  }
  return parts.join(':').toUpperCase();
}
