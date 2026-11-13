import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createCanvas,Image} from '@napi-rs/canvas';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {AssistantAnswer} from '@cuberoot/shared/site-assistant';

const mocks=vi.hoisted(()=>({douyin:false,files:new Map<string,ArrayBuffer>(),request:vi.fn(),open:vi.fn(),write:vi.fn(),unlink:vi.fn()}));
vi.mock('../src/lib/platform',()=>({isDouyinMiniProgram:()=>mocks.douyin,miniProgramApi:()=>({
  request:mocks.request,openDocument:mocks.open,env:{USER_DATA_PATH:'native://user'},
  arrayBufferToBase64:(data:ArrayBuffer)=>Buffer.from(data).toString('base64'),
  getFileSystemManager:()=>({mkdirSync:vi.fn(),writeFile:mocks.write,readdirSync:()=>['unrelated.txt',...mocks.files.keys()].map(f=>f.split('/').at(-1)!),unlinkSync:mocks.unlink}),
})}));
vi.mock('@cuberoot/shared/pdf-fonts',async original=>process.env.ASSISTANT_PDF_ASSET_ORIGIN ? original() : {
  // Keep CI offline. Optional local evidence uses the real public font loader.
  createPdfFonts:()=>({FONT_MONO:'courier',FONT_SANS:'helvetica',FONT_CJK:'helvetica',hasCjk:()=>false,loadPdfFonts:async()=>{},ensureCjkFont:async()=>{}}),
});
import {buildAssistantPdf,openAssistantPdf} from '../src/lib/assistant-pdf';

const selected="R U R' U' R' F R2 U' R' U' R U R' F'";
const result:AssistantAnswer={answer:'当前公式 **已切换**。\n\nT &amp; PLL',sources:[],artifacts:[{
  kind:'algorithms',version:1,title:'PLL',puzzle:'3x3',set:'pll',offset:0,total:1,display:'both',
  cards:[{caseId:1,name:'T',href:'/alg/3x3/pll#T',puzzle:'3x3',set:'pll',alg:selected,sticker:{kind:'raw',tag:'pll',attrs:{}},alternative:1,alternativeCount:2}],
}]};
beforeEach(()=>{
  vi.clearAllMocks();mocks.files.clear();mocks.douyin=false;
  mocks.request.mockImplementation(async options=>{
    if(!process.env.ASSISTANT_PDF_ASSET_ORIGIN) {options.fail(new Error('Unexpected network'));return;}
    try {
      const response=await fetch(new URL(new URL(options.url).pathname,process.env.ASSISTANT_PDF_ASSET_ORIGIN));
      options.success({statusCode:response.status,data:await response.arrayBuffer()});
    } catch(error) {options.fail(error);}
  });
  mocks.write.mockImplementation(options=>{mocks.files.set(options.filePath,options.data);options.success();});
  mocks.open.mockImplementation(options=>options.success());
  mocks.unlink.mockImplementation(path=>mocks.files.delete(path));
});

describe('native assistant PDF',()=>{
  it('renders actual PDF bytes with the selected formula and a nonempty diagram',async()=>{
    const canvas=createCanvas(384,384);Object.assign(canvas,{createImage:()=>new Image()});
    const bytes=await buildAssistantPdf('T 公式怎么拧？',result,'zh',canvas as never,()=>{});
    expect(Buffer.from(bytes).subarray(0,5).toString()).toBe('%PDF-');
    expect(Buffer.from(bytes).toString('latin1')).toContain('/Subtype /Image');
    const pixels=canvas.getContext('2d').getImageData(0,0,384,384).data;
    expect([...pixels.slice(0,4)]).toEqual([255,255,255,255]);
    let colored=0;for(let i=0;i<pixels.length;i+=4) if(pixels[i+3]>0 && Math.abs(pixels[i]-pixels[i+2])>30) colored++;
    expect(colored).toBeGreaterThan(1000);
    await openAssistantPdf(bytes,'T 公式怎么拧？',()=>{});
    expect([...mocks.files.values()][0]).toBe(bytes);
    expect(mocks.open.mock.calls[0][0]).toMatchObject({fileType:'pdf',showMenu:true});
    if(process.env.ASSISTANT_PDF_EVIDENCE_DIR && process.env.ASSISTANT_PDF_ASSET_ORIGIN) {
      mkdirSync(process.env.ASSISTANT_PDF_EVIDENCE_DIR,{recursive:true});
      writeFileSync(resolve(process.env.ASSISTANT_PDF_EVIDENCE_DIR,'mini-current-formula.pdf'),Buffer.from(bytes));
    }
  });
  it('keeps text-only exports free of diagrams and works without Intl.Segmenter',async()=>{
    const canvas=createCanvas(384,384),copy=structuredClone(result);
    (copy.artifacts![0] as any).display='text';
    const descriptor=Object.getOwnPropertyDescriptor(Intl,'Segmenter')!;
    Object.defineProperty(Intl,'Segmenter',{value:undefined,configurable:true});
    try {
      const bytes=await buildAssistantPdf('T',copy,'en',canvas as never,()=>{});
      expect(Buffer.from(bytes).toString('latin1')).not.toContain('/Subtype /Image');
    } finally {Object.defineProperty(Intl,'Segmenter',descriptor);}
  });
  it('uses Douyin file naming rather than the WeChat-only menu option',async()=>{
    mocks.douyin=true;await openAssistantPdf(new ArrayBuffer(8),'T / PLL',()=>{});
    expect(mocks.open.mock.calls[0][0]).toMatchObject({fileName:'T _ PLL.pdf',fileType:'pdf'});
    expect(mocks.open.mock.calls[0][0]).not.toHaveProperty('showMenu');
  });
  it('never opens a partial or cancelled export and preserves unrelated files',async()=>{
    mocks.write.mockImplementationOnce(options=>options.fail(new Error('disk full')));
    await expect(openAssistantPdf(new ArrayBuffer(8),'T',()=>{})).rejects.toThrow('disk full');
    expect(mocks.open).not.toHaveBeenCalled();
    let checks=0;
    await expect(openAssistantPdf(new ArrayBuffer(8),'T',()=>{if(++checks===2)throw new Error('cancelled');})).rejects.toThrow('cancelled');
    expect(mocks.open).not.toHaveBeenCalled();expect(mocks.files.size).toBe(0);
    mocks.open.mockImplementationOnce(options=>options.fail(new Error('viewer unavailable')));
    await expect(openAssistantPdf(new ArrayBuffer(8),'T',()=>{})).rejects.toThrow('viewer unavailable');
    expect(mocks.files.size).toBe(0);
    expect(mocks.unlink.mock.calls.every(([path])=>path.startsWith('native://user/assistant-pdf/'))).toBe(true);
  });
});
