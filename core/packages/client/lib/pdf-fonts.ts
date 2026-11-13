import {createPdfFonts} from '@cuberoot/shared/pdf-fonts';
export {FONT_MONO,FONT_SANS,FONT_CJK,hasCjk} from '@cuberoot/shared/pdf-fonts';
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


export const {loadPdfFonts,ensureCjkFont}=createPdfFonts(filename=>fetchFontBase64('/fonts/'+filename));
