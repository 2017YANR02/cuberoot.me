/** Shared safe rendering for saved WCA Markdown and HTML. */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const client=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(client,'package.json'));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {default:Markdown}=await import(require.resolve('react-markdown'));
const {default:gfm}=await import(require.resolve('remark-gfm'));
const {parseHTML}=require('linkedom');
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const safeUrl=(url:string)=>/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(url)?'mailto:'+url:/^(https?:\/\/|mailto:)/i.test(url)?url:(/^\/(?!\/)/.test(url)?'https://www.worldcubeassociation.org'+url:null);
const allowed=new Set(['p','div','br','strong','em','b','i','u','s','ul','ol','li','blockquote','h2','h3','h4','table','thead','tbody','tr','th','td','code','pre','hr','sup','sub']);
export function sanitize(html:string){
 const {document}=parseHTML('<html><body>'+html+'</body></html>');
 const node=(n:any):string=>{
  if(n.nodeType===3)return escape(n.textContent??'');
  if(n.nodeType!==1)return '';
  const rawTag=n.localName.toLowerCase();
  const tag=rawTag==='h1'?'h2':rawTag;
  if(['script','style','iframe','object','embed','form','input','button'].includes(tag))return '';
  const children=Array.from(n.childNodes).map(node).join('');
  if(tag==='a'){const url=safeUrl(n.getAttribute('href')??'');return url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${children}</a>`:children;}
  if(tag==='img'){const url=safeUrl(n.getAttribute('src')??'');return url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(n.getAttribute('alt')||url)}</a>`:'';}
  if(!allowed.has(tag))return children;
  if(tag==='br'||tag==='hr')return `<${tag}>`;
  if(tag==='li'){const value=n.getAttribute('value');return `<li${value&&/^-?\d+$/.test(value)?` value="${value}"`:''}>${children}</li>`;}
  if(tag==='ol'){const start=n.getAttribute('start');return `<ol${start&&/^-?\d+$/.test(start)?` start="${start}"`:''}>${children}</ol>`;}
  return `<${tag}>${children}</${tag}>`;
 };
 return Array.from(document.body.childNodes).map(node).join('');
}
// Keep intentional gaps in source case numbers; repeated 1. remains normal Markdown.
function sourceListNumbers(){
 return (tree:any,file:any)=>{
  const text=String(file.value);
  const walk=(node:any)=>{
   if(node.type==='list'&&node.ordered){
    const numbers=node.children.map((item:any)=>Number(text.slice(item.position.start.offset).match(/^(\d+)[.)]/)?.[1]));
    if(numbers.every((n:number,i:number)=>Number.isFinite(n)&&(i===0||n>numbers[i-1]))&&numbers.some((n:number,i:number)=>i>0&&n!==numbers[i-1]+1)){
     node.children.forEach((item:any,i:number)=>{item.data={...item.data,hProperties:{...item.data?.hProperties,value:numbers[i]}};});
    }
   }
   node.children?.forEach(walk);
  };walk(tree);
 };
}
export const markdown=(s:string)=>sanitize(renderToStaticMarkup(React.createElement(Markdown,{remarkPlugins:[gfm,sourceListNumbers],children:s.replace(/<!--[\s\S]*?-->/g,'').replace(/\]\((https?:\/\/[^)\n]+)\)/g,(full,url)=>/[\"']/.test(url)?full:']('+url.replace(/ /g,'%20')+')')})));
