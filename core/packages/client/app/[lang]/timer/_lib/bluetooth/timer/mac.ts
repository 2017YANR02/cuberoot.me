/**
 * The one MAC-discovery step that is specific to the QiYi Timer / Adapter.
 *
 * Everything else lives in `../mac.ts`: the QiYi timer advertises under the
 * same CIC as the QiYi cube (0x0504) and reads the FIRST six manufacturer
 * bytes reversed, which is exactly `QIYI_MAC_ADV`. So advertisement watching,
 * normalisation and byte conversion all come from there — only the
 * device-name fallback below has no cube equivalent.
 *
 * Why the timer needs a MAC at all: its AES key is fixed (sixteen 0x77 bytes,
 * see `./qiyi_timer.ts`), but the hello message carries the MAC as a payload
 * and the device ignores a hello whose MAC is not its own.
 */

/**
 * Fabricate the MAC from the device name. QiYi burns a fixed OUI-ish prefix
 * per product line and puts the low two bytes in the name
 * (`qiyitimer.js:230-234`):
 *
 *   QY-Timer-…-XXXX    ->  CC:A1:00:00:XX:XX
 *   QY-Adapter-…-XXXX  ->  CC:A8:00:00:XX:XX
 *
 * Note this DOES guess an OUI, which `../mac.ts`'s `parseMacFromName`
 * deliberately refuses to do for GAN. The difference is that GAN ships
 * several OUIs across batches, so a guess there derives a wrong AES key and
 * fails silently, whereas these two prefixes are csTimer's own hard-coded
 * `initMac` defaults for a single product line each — and a wrong guess here
 * costs only an unanswered hello, not a garbled turn stream. Still a guess:
 * it is tried AFTER advertisements and before the manual prompt.
 */
export function qiyiTimerMacFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const m = /^QY-(?:Timer|Adapter).*-([0-9A-F]{4})$/.exec(name.trim());
  if (!m) return null;
  const prefix = name.trim().startsWith('QY-Adapter') ? 'CC:A8' : 'CC:A1';
  return `${prefix}:00:00:${m[1].slice(0, 2)}:${m[1].slice(2, 4)}`.toUpperCase();
}
