import {jsPDF} from 'jspdf';
import {Canvg} from 'canvg';
import {DOMParser} from '@xmldom/xmldom';
import {assistantPdfDocument} from '@cuberoot/shared/assistant-pdf';
import {documentExportFilename, renderDocumentPdf} from '@cuberoot/shared/document-export';
import {createPdfFonts} from '@cuberoot/shared/pdf-fonts';
import {assistantAnswerText, type AssistantAnswer, type AssistantAlgorithmCard} from '@cuberoot/shared/site-assistant';
import {algorithmCaseImage} from '@cuberoot/puzzle-render-core/alg-case-image';
import {miniProgramApi, isDouyinMiniProgram} from './platform';
import {API_ORIGIN, SITE_ORIGIN} from './runtime-config';
import themes from '../theme.json';

type Canvas = WechatMiniprogram.Canvas;
const PIXELS = 384;
const fonts = createPdfFonts(async filename => miniProgramApi().arrayBufferToBase64(await resource(`${SITE_ORIGIN}/fonts/${filename}`)));

function resource(url:string):Promise<ArrayBuffer> {
  // Only the public assets already used by cards and website PDF exports.
  if(!url.startsWith(`${SITE_ORIGIN}/`) && !url.startsWith(`${API_ORIGIN}/`)) throw new Error('Unsupported PDF resource');
  return new Promise((resolve,reject)=>miniProgramApi().request({url,responseType:'arraybuffer',timeout:20000,
    success:r=>r.statusCode===200 && r.data instanceof ArrayBuffer ? resolve(r.data) : reject(new Error('PDF resource unavailable')),
    fail:reject,
  }));
}
function utf8(data:ArrayBuffer):string {
  const bytes=new Uint8Array(data);let escaped='';
  for(const byte of bytes) escaped+=`%${byte.toString(16).padStart(2,'0')}`;
  return decodeURIComponent(escaped);
}
async function diagram(card:AssistantAlgorithmCard):Promise<string> {
  const image=await algorithmCaseImage(card,PIXELS);
  if(image.svg) return image.svg;
  if(!image.src) throw new Error('PDF diagram unavailable');
  const url=image.src.startsWith('/v1/') ? `${API_ORIGIN}${image.src.slice(3)}` : `${SITE_ORIGIN}${image.src}`;
  const data=await resource(url),bytes=new Uint8Array(data);
  const type=bytes[0]===137 && bytes[1]===80 ? 'png' : bytes[0]===255 && bytes[1]===216 ? 'jpeg' : null;
  return type ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIXELS} ${PIXELS}"><image href="data:image/${type};base64,${miniProgramApi().arrayBufferToBase64(data)}" width="${PIXELS}" height="${PIXELS}"/></svg>` : utf8(data);
}

/** Uses the page's native Canvas 2D node on both platforms, without a WebView. */
export function assistantPdfCanvas(page:WechatMiniprogram.Page.Instance<any,any>):Promise<Canvas> {
  return new Promise((resolve,reject)=>miniProgramApi().createSelectorQuery().in(page)
    .select('#assistant-pdf-canvas').fields({node:true,size:true}).exec((rows:Array<{node?:Canvas}>)=>{
      const canvas=rows[0]?.node;
      if(!canvas) { reject(new Error('PDF canvas unavailable')); return; }
      canvas.width=PIXELS;canvas.height=PIXELS;resolve(canvas);
    }));
}

export async function buildAssistantPdf(question:string,result:AssistantAnswer,lang:'zh'|'en',canvas:Canvas,check:()=>void):Promise<ArrayBuffer> {
  check();
  const doc=await assistantPdfDocument(question,assistantAnswerText({...result,artifacts:[]},SITE_ORIGIN),lang,result.artifacts,async card=>{check();return diagram(card);});
  check();
  const pdf=new jsPDF({unit:'pt',format:'a4',compress:true});
  const drawSvg=async (output:jsPDF,svg:string,x:number,y:number,w:number,h:number)=>{
    check();
    canvas.width=PIXELS;canvas.height=PIXELS;
    const ctx=canvas.getContext('2d');
    // jsPDF's raw RGBA encoder stores RGB. Composite onto paper first so
    // transparent SVG margins cannot become a black rectangle in the PDF.
    ctx.fillStyle='white';ctx.fillRect(0,0,PIXELS,PIXELS);
    let imageFailed=false;
    const render=Canvg.fromString(ctx as unknown as Parameters<typeof Canvg.fromString>[0],svg.replace(/var\(--muted-foreground\)/g,themes.light.tabBarColor),{
      DOMParser:DOMParser as unknown as NonNullable<Parameters<typeof Canvg.fromString>[2]>['DOMParser'],
      ignoreAnimation:true,ignoreMouse:true,ignoreDimensions:true,ignoreClear:true,scaleWidth:PIXELS,scaleHeight:PIXELS,
      // The canonical case drawings do not use filters or pattern canvases.
      createCanvas:()=>{throw new Error('Unsupported PDF SVG canvas');},
      createImage:src=>new Promise((resolve,reject)=>{
        if(!/^data:image\/(png|jpeg);base64,/.test(src)) {imageFailed=true;reject(new Error('Unsupported PDF SVG image'));return;}
        const image=canvas.createImage();image.onload=()=>resolve(image as never);image.onerror=error=>{imageFailed=true;reject(error);};image.src=src;
      }),
      fetch:async()=>{throw new Error('External SVG resource rejected');},
    });
    await render.render();check();
    if(imageFailed) throw new Error('PDF image could not be loaded');
    output.addImage(ctx.getImageData(0,0,PIXELS,PIXELS),'RGBA',x,y,w,h);
  };
  await renderDocumentPdf(pdf,question || 'CubeRoot',doc,{fonts,drawSvg},{brand:true,subtitle:{zh:'对话记录',en:'Conversation'}[lang]});
  check();return pdf.output('arraybuffer');
}

let fileSequence=0;
export async function openAssistantPdf(bytes:ArrayBuffer,title:string,check:()=>void):Promise<void> {
  const api=miniProgramApi(),fs=api.getFileSystemManager();
  const directory=`${api.env.USER_DATA_PATH}/assistant-pdf`;
  const filename=documentExportFilename(title || 'CubeRoot','pdf');
  const filePath=`${directory}/${Date.now()}-${++fileSequence}-${filename}`;
  check();
  try {fs.mkdirSync(directory,true);} catch { /* Existing export directory. writeFile reports other failures. */ }
  try {
    await new Promise<void>((resolve,reject)=>fs.writeFile({filePath,data:bytes,success:()=>resolve(),fail:reject}));
    check();
    await new Promise<void>((resolve,reject)=>{
      const open=api.openDocument as (options:WechatMiniprogram.OpenDocumentOption & {fileName?:string})=>void;
      open.call(api,{filePath,fileType:'pdf',...(isDouyinMiniProgram() ? {fileName:filename} : {showMenu:true}),success:()=>resolve(),fail:reject});
    });
  } catch(error) {
    try {fs.unlinkSync(filePath);} catch { /* Only this unfinished export is removed. */ }
    throw error;
  }
  // Keep the three most recent private export cache files. User-saved copies
  // belong to the system document viewer and are never touched here.
  try {
    const files=fs.readdirSync(directory).filter(name=>/^\d+-\d+-.+\.pdf$/.test(name)).sort((a,b)=>Number(b.split('-')[0])-Number(a.split('-')[0]));
    for(const old of files.slice(3)) if(`${directory}/${old}`!==filePath) fs.unlinkSync(`${directory}/${old}`);
  } catch { /* Cache cleanup does not turn a successful export into a failure. */ }
}
