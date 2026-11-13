import {build,type PluginBuild} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe,expect,it} from 'vitest';
import {createCanvas,Image} from '@napi-rs/canvas';
// @ts-expect-error build tooling is plain ESM.
import {nativePdfPlugin} from '../scripts/build-pdf-runtime.mjs';

describe('PDF bundle in native Mini Program sandboxes',()=>{
  it.each(['wechat','douyin'])('loads %s without browser globals or DOM entity decoding',async target=>{
    const root=resolve(import.meta.dirname,'..');
    const bundled=await build({absWorkingDir:root,entryPoints:['src/lib/assistant-pdf.ts'],bundle:true,write:false,format:'iife',globalName:'NativePdf',platform:'browser',target:'chrome91',minify:true,define:{__MINI_PROGRAM_TARGET__:JSON.stringify(target)},plugins:[
      {name:'offline-test-fonts',setup(b:PluginBuild){b.onResolve({filter:/^@cuberoot\/shared\/pdf-fonts$/},()=>({path:fileURLToPath(new URL('./fixtures/pdf-core-fonts.ts',import.meta.url))}));}},nativePdfPlugin(root),
    ]});
    const files=new Map<string,ArrayBuffer>();let opened:any;
    const api={env:{USER_DATA_PATH:'native://user'},
      arrayBufferToBase64:(bytes:ArrayBuffer)=>Buffer.from(bytes).toString('base64'),
      base64ToArrayBuffer:(text:string)=>Uint8Array.from(Buffer.from(text,'base64')).buffer,
      getFileSystemManager:()=>({mkdirSync:()=>{},writeFile:(o:any)=>{files.set(o.filePath,o.data);o.success();},readdirSync:()=>[],unlinkSync:()=>{}}),
      openDocument:(o:any)=>{opened=o;o.success();},
    };
    const sandbox:any={console,setTimeout,clearTimeout,ArrayBuffer,Uint8Array,Uint8ClampedArray,globalThis:undefined,window:undefined,document:undefined,[target==='wechat'?'wx':'tt']:api};
    runInNewContext(bundled.outputFiles[0].text,sandbox,{timeout:10000});
    expect(typeof sandbox.NativePdf.buildAssistantPdf).toBe('function');
    const canvas=createCanvas(384,384);Object.assign(canvas,{createImage:()=>new Image()});
    const bytes=await sandbox.NativePdf.buildAssistantPdf('T / PLL',{answer:'T &amp; PLL',sources:[],artifacts:[{kind:'algorithms',version:1,title:'PLL',puzzle:'3x3',set:'pll',display:'both',offset:0,total:1,cards:[{name:'T',puzzle:'3x3',set:'pll',alg:"R U R' U' R' F R2 U' R' U' R U R' F'",sticker:{kind:'raw',tag:'pll',attrs:{}},alternative:1,alternativeCount:2,href:'/alg/3x3/pll#T'}]}]},'en',canvas,()=>{});
    expect(Buffer.from(bytes).toString('latin1')).toContain('/Subtype /Image');
    await sandbox.NativePdf.openAssistantPdf(bytes,'T / PLL',()=>{});
    expect(opened.fileType).toBe('pdf');
    expect(opened.showMenu).toBe(target==='wechat' ? true : undefined);
    expect(files.size).toBe(1);
  });
});
