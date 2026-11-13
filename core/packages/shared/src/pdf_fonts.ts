import type {jsPDF} from 'jspdf';
export const FONT_MONO = 'LiberationMono';
export const FONT_SANS = 'NotoSans';
export const FONT_CJK = 'wqy-microhei';

/** 有没有中日韩字形 —— 有才值得为它拖 4MB 字体。 */
export function hasCjk(s: string): boolean {
  return /[⺀-鿿豈-﫿＀-￯]/.test(s);
}


export function createPdfFonts(source:(filename:string)=>Promise<string>) {
  const cache=new Map<string,Promise<string>>();
  const load=(filename:string)=>{
    let pending=cache.get(filename);
    if(!pending) { pending=source(filename).catch(error=>{cache.delete(filename);throw error;}); cache.set(filename,pending); }
    return pending;
  };
  const cjkLoadedDocs=new WeakSet<jsPDF>();
/** 等宽 + 无衬线两份,任何文档都要。 */
async function loadPdfFonts(doc: jsPDF): Promise<void> {
  const [mono, sans] = await Promise.all([load('LiberationMono-Regular.ttf'),load('NotoSans-Regular.ttf')]);
  doc.addFileToVFS('LiberationMono-Regular.ttf', mono);
  doc.addFont('LiberationMono-Regular.ttf', FONT_MONO, 'normal');
  doc.addFileToVFS('NotoSans-Regular.ttf', sans);
  doc.addFont('NotoSans-Regular.ttf', FONT_SANS, 'normal');
  doc.addFont('NotoSans-Regular.ttf', FONT_SANS, 'bold');  // bold simulated by jsPDF
}

/** 懒装 wqy-microhei;同一份文档重复调是空操作。 */
async function ensureCjkFont(doc: jsPDF): Promise<void> {
  if (cjkLoadedDocs.has(doc)) return;
  const cjk = await load('wqy-microhei.ttf');
  doc.addFileToVFS('wqy-microhei.ttf', cjk);
  doc.addFont('wqy-microhei.ttf', FONT_CJK, 'normal');
  doc.addFont('wqy-microhei.ttf', FONT_CJK, 'bold');
  cjkLoadedDocs.add(doc);
}

  return {FONT_MONO,FONT_SANS,FONT_CJK,hasCjk,loadPdfFonts,ensureCjkFont};
}
