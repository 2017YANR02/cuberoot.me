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
