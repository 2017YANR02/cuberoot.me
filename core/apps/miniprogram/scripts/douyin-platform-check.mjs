import { transform } from 'esbuild';

const forbidden = [
  /globalThis\.wx/,
  /\/auth\/wechat\/miniprogram/,
  /wechat_redirect/,
  /\bwx:/,
  /\.nextTick\s*\(/,
  /\.getDeviceInfo\s*\(/,
];

const wxMember = /\bwx\s*\./;

export async function findUnsupportedPlatformReference(contents, extension) {
  const match = forbidden.find(pattern => pattern.test(contents));
  if (match || !wxMember.test(contents)) return match;
  if (extension !== '.js') return wxMember;

  // The timer Worker can minify a local RegExp to wx. esbuild's define
  // substitutes only unbound identifiers, so a local wx.source stays local.
  const { code } = await transform(contents, { define: { wx: '__CUBEROOT_WECHAT_GLOBAL__' } });
  return /\b__CUBEROOT_WECHAT_GLOBAL__\s*\./.test(code) ? wxMember : undefined;
}
