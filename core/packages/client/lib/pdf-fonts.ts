/**
 * jsPDF 的字体装载(站内所有 PDF 生成器共用)。
 *
 * jsPDF 内建的 14 个标准字体不带字形数据,中文和一部分记号字符会掉字,所以
 * public/fonts/ 里那三份 TTF 要显式塞进文档的虚拟文件系统。base64 只算一次,
 * 之后每份新文档复用同一个 promise。
 *
 * wqy-microhei 是 4MB,**只在真出中文时才 load**(`ensureCjkFont`)—— 无条件装
 * 会让每份纯记号的 PDF 都胖一圈。
 */
import type { jsPDF } from 'jspdf';

export const FONT_MONO = 'LiberationMono';
export const FONT_SANS = 'NotoSans';
export const FONT_CJK = 'wqy-microhei';

/** 有没有中日韩字形 —— 有才值得为它拖 4MB 字体。 */
export function hasCjk(s: string): boolean {
  return /[⺀-鿿豈-﫿＀-￯]/.test(s);
}

let monoB64: Promise<string> | null = null;
let sansB64: Promise<string> | null = null;
let cjkB64: Promise<string> | null = null;
const cjkLoadedDocs = new WeakSet<jsPDF>();

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked btoa to avoid call-stack issues on large fonts
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** 等宽 + 无衬线两份,任何文档都要。 */
export async function loadPdfFonts(doc: jsPDF): Promise<void> {
  monoB64 ??= fetchFontBase64('/fonts/LiberationMono-Regular.ttf');
  sansB64 ??= fetchFontBase64('/fonts/NotoSans-Regular.ttf');
  const [mono, sans] = await Promise.all([monoB64, sansB64]);
  doc.addFileToVFS('LiberationMono-Regular.ttf', mono);
  doc.addFont('LiberationMono-Regular.ttf', FONT_MONO, 'normal');
  doc.addFileToVFS('NotoSans-Regular.ttf', sans);
  doc.addFont('NotoSans-Regular.ttf', FONT_SANS, 'normal');
  doc.addFont('NotoSans-Regular.ttf', FONT_SANS, 'bold');  // bold simulated by jsPDF
}

/** 懒装 wqy-microhei;同一份文档重复调是空操作。 */
export async function ensureCjkFont(doc: jsPDF): Promise<void> {
  if (cjkLoadedDocs.has(doc)) return;
  cjkB64 ??= fetchFontBase64('/fonts/wqy-microhei.ttf');
  const cjk = await cjkB64;
  doc.addFileToVFS('wqy-microhei.ttf', cjk);
  doc.addFont('wqy-microhei.ttf', FONT_CJK, 'normal');
  doc.addFont('wqy-microhei.ttf', FONT_CJK, 'bold');
  cjkLoadedDocs.add(doc);
}
