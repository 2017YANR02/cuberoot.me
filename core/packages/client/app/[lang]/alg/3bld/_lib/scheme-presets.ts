// Lettering-scheme presets + 24 orientation labels — pure data ported from
// spooncuber setcode.js (the scheme STRINGS only) and language.js (code1..code24).
//
// These are the 48-char 3x3 sticker-letter strings laid out over setcode.js
// `idOrder` (48 input-cell ids a11..a69, the 6-face net minus the 6 centers).
// They are the upstream module-level scheme defaults; copy byte-for-byte. The
// DOM/cookie scaffolding in setcode.js (setColor/setAll/init/getCookie) is NOT
// ported — only the load-bearing scheme strings.

/**
 * Default Chichu (彳亍) scheme, 48 chars over setcode.js idOrder.
 * Source: setcode.js setChichu() / init() codecookie.
 */
export const CHICHU_SCHEME = 'DEGCGAAJWIXKOOMREDCXTQLMKHIRZZPSBBLSQNJYHFFYWTNP';

/**
 * Standard Speffz scheme, 48 chars over the same idOrder.
 * Source: setcode.js setSpeffz().
 */
export const SPEFFZ_SCHEME = 'AABDBDCCUUVXVXWWEEFHFHGGMMNPNPOOIIJLJLKKQQRTRTSS';

export type SchemeId = 'chichu' | 'speffz';

/**
 * The two built-in lettering presets, keyed by scheme id.
 * 'chichu' is the upstream default.
 */
export const SCHEME_PRESETS: Record<SchemeId, string> = {
  chichu: CHICHU_SCHEME,
  speffz: SPEFFZ_SCHEME,
};

/**
 * The 24 cube-orientation labels (顶/前 color pairs), index 0..23 maps to
 * upstream code1..code24. Chinese (zh) strings verbatim from language.js arrLang.
 * code1 = 黄顶红前 (Yellow-top/Red-front) is the Chichu canonical orientation that
 * CubeModel.initialize() binds to. These feed the visual player / scheme-display
 * chooser only; they do NOT pre-rotate the lettering trace.
 */
export const ORIENTATION_LABELS_ZH: string[] = [
  '黄顶红前', // code1
  '黄顶橙前', // code2
  '黄顶蓝前', // code3
  '黄顶绿前', // code4
  '白顶红前', // code5
  '白顶橙前', // code6
  '白顶蓝前', // code7
  '白顶绿前', // code8
  '蓝顶红前', // code9
  '蓝顶橙前', // code10
  '蓝顶黄前', // code11
  '蓝顶白前', // code12
  '绿顶红前', // code13
  '绿顶橙前', // code14
  '绿顶黄前', // code15
  '绿顶白前', // code16
  '红顶蓝前', // code17
  '红顶绿前', // code18
  '红顶黄前', // code19
  '红顶白前', // code20
  '橙顶蓝前', // code21
  '橙顶绿前', // code22
  '橙顶黄前', // code23
  '橙顶白前', // code24
];
