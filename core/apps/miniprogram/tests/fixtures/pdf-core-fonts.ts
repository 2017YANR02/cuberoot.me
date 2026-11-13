// Offline PDF runtime tests use jsPDF's embedded core fonts. Separate local
// evidence exercises the production CJK TTF loader through public asset URLs.
export const createPdfFonts=()=>({FONT_MONO:'courier',FONT_SANS:'helvetica',FONT_CJK:'helvetica',hasCjk:()=>false,loadPdfFonts:async()=>{},ensureCjkFont:async()=>{}});
