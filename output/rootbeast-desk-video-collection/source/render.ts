import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

type Scene = { id:string; title:string; animation:string; cycles:number; ambient:string; mug:number[]; panes?:number[][]; groundShadow?:boolean };
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '..');
const repo = resolve(here, '../../..');
const client = join(repo, 'core/packages/client');
const require = createRequire(join(client,'package.json'));
const { chromium } = require('@playwright/test');
const sharp = require('sharp');
const duration = 12, fps = 30;
const scenes:Scene[] = JSON.parse(await readFile(join(here,'scenes.json'),'utf8'));
const manifest = JSON.parse(await readFile(join(client,'public/deskpet/rootbeast/manifest.json'),'utf8'));
const baseTemplate = await readFile(join(repo,'output/rootbeast-desk-video/source/scene.html'),'utf8');
const only = process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const selected = scenes.filter(s=>!only||only.includes(s.id));
const preview = process.argv.includes('--preview');
const exists = async (file:string)=>access(file).then(()=>true,()=>false);
for (const folder of ['videos','covers','previews','source/scenes','source/qa']) await mkdir(join(output,folder),{recursive:true});

function resources(){
  const vm=execFileSync('vm_stat',{encoding:'utf8'});
  const get=(key:string)=>Number(vm.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1]??0);
  const pageSize=Number(vm.match(/page size of (\d+) bytes/)?.[1]??16384);
  return {
    boot:execFileSync('sysctl',['-n','kern.boottime'],{encoding:'utf8'}).trim(),
    swapouts:get('Swapouts'), freeBytes:(get('Pages free')+get('Pages speculative'))*pageSize,
    pressure:Number(execFileSync('memory_pressure',['-Q'],{encoding:'utf8'}).match(/percentage:\s+(\d+)/)?.[1]??0),
  };
}
const baselinePath=join(here,'resource-baseline.json');
const baseline=await exists(baselinePath)?JSON.parse(await readFile(baselinePath,'utf8')):resources();
if(!await exists(baselinePath))await writeFile(baselinePath,JSON.stringify(baseline,null,2));
function guard(){
  const current=resources();
  if(current.boot!==baseline.boot||current.swapouts>baseline.swapouts||current.freeBytes<2*1024**3||current.pressure<12){
    throw new Error(`Render resource stop; keep frames/checkpoints. ${JSON.stringify(current)}`);
  }
}
guard();

function motionScript(config:Scene, sourceDuration:number){
  const grounding=config.groundShadow?`const petSvg=document.querySelector('#pet>svg');const contactShadow=petSvg.querySelector(':scope>ellipse');const hindFeet=[...petSvg.querySelectorAll('[data-rig-part="HL"],[data-rig-part="HR"]')];`:'';
  const groundFrame=config.groundShadow?`if(contactShadow&&hindFeet.length){const bounds=petSvg.getBoundingClientRect();const floor=Math.max(...hindFeet.map(foot=>foot.getBoundingClientRect().bottom));contactShadow.setAttribute('cy',String((floor-bounds.top)/bounds.height*640+3));}`:'';
  return `<script>
const config=${JSON.stringify(config)}, tau=Math.PI*2;
const ctx=document.querySelector('#ambient').getContext('2d');
const animations=document.getAnimations();
for(const animation of animations)animation.pause();${grounding}
const panes=config.panes||[[40,33,88,50],[135,33,89,50],[40,101,184,63]];
function block(x,y,w,h,color,a=1){ctx.globalAlpha=a;ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function outside(fn){ctx.save();ctx.beginPath();for(const p of panes)ctx.rect(...p);ctx.clip();fn();ctx.restore()}
window.renderAt=function(time){
 const t=((time%12)+12)%12;
 for(const animation of animations)animation.currentTime=t*${sourceDuration*config.cycles/12*1000};${groundFrame}
 ctx.clearRect(0,0,480,270);
 const mode=config.ambient;
 outside(()=>{
  if(['night','moon','magic'].includes(mode)){
   [[155,43],[174,65],[219,68],[88,36],[119,49]].forEach(([x,y],i)=>{
    const p=(1+Math.sin(tau*t/6+i*1.9))/2;
    block(x,y,1,1,'#fff0cc',.2+.5*p);
    if(p>.87){block(x-1,y,3,1,'#d6c6e9',.16);block(x,y-1,1,3,'#d6c6e9',.16)}
   });
   const p=(t-6.3)/.9;
   if(mode!=='moon'&&p>0&&p<1)for(let i=5;i>=0;i--)block(145+p*31-i*2,39+p*14-i,2,1,'#f9e7cb',Math.sin(p*Math.PI)*(1-i/7));
  }else if(mode==='rain'){
   for(let i=0;i<34;i++){
    const p=(t/1.5+i*.6180339887)%1;
    const x=42+(i*29)%180-p*5,y=31+p*145;
    block(x,y,1,3,'#b7c8dd',.19+(i%3)*.045);
    block(x-1,y+3,1,3,'#a4bdd5',.14);
   }
  }else if(mode==='snow'){
   for(let i=0;i<22;i++){
    const p=(t/12+i*.6180339887)%1;
    const x=43+(i*29)%179+Math.sin(p*tau+i)*3,y=31+p*145;
    block(x,y,1+(i%3===0?1:0),1,'#f4f5ff',.35+.25*Math.sin(p*Math.PI));
   }
  }else{
   for(let i=0;i<5;i++){
    const p=(t/12+i/5)%1;
    const x=55+i*31+p*12+Math.sin(p*tau)*3,y=55+p*103;
    const colors=mode==='sunset'?['#e5a65d','#d88344']:mode==='garden'?['#eac6b7','#f2d2c3']:['#fff1cd','#edddba'];
    block(x,y,1+(i%2),1,colors[i%2],Math.sin(p*Math.PI)*.38);
   }
  }
 });
 for(let i=0;i<3;i++){
  const p=(t/4+i/3)%1,x=config.mug[0]+Math.sin(p*tau+i)*2.2,y=config.mug[1]-2-p*21;
  const a=Math.sin(p*Math.PI)*.38;
  block(x,y,2,2,'#efddbe',a);block(x+1,y-2,1,2,'#efddbe',a*.8);block(x,y-4,1,2,'#efddbe',a*.55);
 }
 ctx.globalAlpha=1;
};
const stage=document.querySelector('#stage');
function fit(){stage.style.transform='scale('+Math.min(innerWidth/480,innerHeight/270)+')'}
addEventListener('resize',fit);fit();window.renderAt(0);
if(!new URLSearchParams(location.search).has('render')){const start=performance.now();const tick=now=>{window.renderAt((now-start)/1000);requestAnimationFrame(tick)};requestAnimationFrame(tick)}
</script>`;
}

async function runFfmpeg(args:string[]){
 const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});
 await new Promise<void>((ok,fail)=>{
  let stopped=false;
  const interval=setInterval(()=>{try{guard()}catch(error){stopped=true;child.kill('SIGTERM');clearInterval(interval);fail(error)}},5000);
  child.on('error',error=>{clearInterval(interval);fail(error)});
  child.on('exit',code=>{clearInterval(interval);if(stopped)return;code===0?ok():fail(new Error(`ffmpeg: ${code}`))});
 });
}

const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:480,height:270},deviceScaleFactor:1});
const cdp=await browser.newBrowserCDPSession();
const processInfo=await cdp.send('SystemInfo.getProcessInfo');
const browserPid=processInfo.processInfo.find((p:any)=>p.type==='browser')?.id;
console.log(JSON.stringify({rendererPid:process.pid,browserPid,scenes:selected.length,preview}));
try{
 for(const config of selected){
  const source=manifest.find((s:any)=>s.id===config.animation);
  if(!source)throw new Error(`Unknown animation: ${config.animation}`);
  const name=`${config.id.slice(0,2)}-${config.title}`;
  const svg=await readFile(join(client,'public/deskpet/rootbeast',source.file),'utf8');
  const background=await readFile(join(here,'backgrounds',`${config.id}.png`));
  let html=baseTemplate
    .replace(/<title>[\s\S]*?<\/title>/,`<title>根号兽 · ${config.title}</title>`)
    .replace(/(<img id="background" src=")[^"]+("[^>]*>)/,`$1data:image/png;base64,${background.toString('base64')}$2`)
    .replace(/<div id="pet">[\s\S]*?<\/div><\/div>\s*<script>/,`<div id="pet">${svg}</div></div>\n<script>`)
    .replace(/<script>[\s\S]*?<\/script>/,motionScript(config,source.duration));
  const hash=createHash('sha256').update(html).digest('hex');
  const scenePath=join(here,'scenes',`${config.id}.html`);
  const qaPath=join(here,'qa',`${config.id}.json`);
  const mp4=join(output,'videos',`${name}.mp4`);
  const previous=await exists(qaPath)?JSON.parse(await readFile(qaPath,'utf8')):null;
  if(!preview&&previous?.hash===hash&&previous?.complete&&await exists(mp4)){console.log(`Keep verified render: ${name}`);continue}
  await writeFile(scenePath,html);
  await page.goto(`${pathToFileURL(scenePath).href}?render`);
  await page.evaluate(()=>Promise.all([document.querySelector<HTMLImageElement>('#background')!.decode(),document.fonts.ready]));
  const snap=async(t:number)=>{await page.evaluate(time=>(window as any).renderAt(time),t);return page.screenshot()};
  const first=await snap(0),last=await snap(duration-1/fps),active=await snap((duration/config.cycles)*.375);
  const diff=async(a:Buffer,b:Buffer)=>{
   const region={left:185,top:85,width:170,height:160};
   const aa=await sharp(a).extract(region).removeAlpha().raw().toBuffer();
   const bb=await sharp(b).extract(region).removeAlpha().raw().toBuffer();
   let sum=0,changed=0;for(let i=0;i<aa.length;i++){const d=Math.abs(aa[i]-bb[i]);sum+=d;if(d>10)changed++}
   return {meanChannelDifference:+(sum/aa.length).toFixed(4),changedChannelPct:+(100*changed/aa.length).toFixed(3)};
  };
  const qa={id:config.id,title:config.title,animation:source.file,hash,sourceDuration:source.duration,cycles:config.cycles,
    rendererPid:process.pid,browserPid,loopBoundary:await diff(first,last),actionDifference:await diff(first,active),complete:false};
  const poster=await snap(source.poster*duration/config.cycles);
  await sharp(poster).resize(1920,1080,{kernel:'nearest'}).png().toFile(join(output,'covers',`${name}.png`));
  const poses=[];
  for(const [i,p] of [0,.125,.375,.625].entries())poses.push({input:await snap(p*duration/config.cycles),left:i*480,top:0});
  await sharp({create:{width:1920,height:270,channels:3,background:'#201b20'}}).composite(poses).png().toFile(join(here,'qa',`${config.id}-poses.png`));
  await writeFile(qaPath,JSON.stringify(qa,null,2));
  console.log(`Preview ready: ${name}; action Δ=${qa.actionDifference.meanChannelDifference}, boundary Δ=${qa.loopBoundary.meanChannelDifference}`);
  if(preview)continue;
  const frames=join('/tmp/rootbeast-video-collection',`${config.id}-${hash.slice(0,10)}`);
  await mkdir(frames,{recursive:true});
  for(let i=0;i<duration*fps;i++){
   const file=join(frames,`${String(i).padStart(4,'0')}.png`);
   if(!await exists(file))await writeFile(file,await snap(i/fps));
   if(i%90===0){guard();console.log(`${name}: ${i}/${duration*fps} frames`)}
  }
  await runFfmpeg(['-framerate',String(fps),'-i',join(frames,'%04d.png'),'-vf','scale=1920:1080:flags=neighbor,setsar=1',
   '-c:v','libx264','-preset','slow','-crf','15','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',
   '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-metadata',`title=根号兽 · ${config.title}`,'-an',mp4]);
  await runFfmpeg(['-i',mp4,'-filter_complex','[0:v]fps=12,scale=640:360:flags=neighbor,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-threads','2','-loop','0',join(output,'previews',`${name}.gif`)]);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,nb_frames,r_frame_rate','-of','json',mp4],{encoding:'utf8'}));
  if(probe.format.duration!=='12.000000'||probe.streams[0].width!==1920||probe.streams[0].height!==1080||probe.streams[0].nb_frames!=='360')throw new Error(`Invalid video: ${name}`);
  await writeFile(qaPath,JSON.stringify({...qa,probe,complete:true,resourceAtEnd:resources()},null,2));
  console.log(`Complete: ${name}`);
 }
}finally{await browser.close()}
