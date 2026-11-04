import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

// Render the existing CubeRoot animation at exact timestamps, then encode it.
// No product source or generated public assets are changed.
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '..');
const client = resolve(here, '../../../core/packages/client');
const require = createRequire(join(client, 'package.json'));
const { chromium } = require('@playwright/test');
const sharp = require('sharp');
const duration = 12;
const fps = 30;
const frames = '/tmp/rootbeast-video-frames';

const svg = await readFile(join(client, 'public/deskpet/rootbeast/10-headphones.svg'), 'utf8');
const background = (await readFile(join(here, 'background.png'))).toString('base64');
const html = `<!doctype html>
<html lang="zh"><meta charset="utf-8"><title>根号兽 · 夜晚书桌</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#1e1718}
body{display:grid;place-items:center}
#stage{width:480px;height:270px;position:relative;overflow:hidden;transform-origin:center;isolation:isolate}
#background,#ambient{position:absolute;inset:0;width:480px;height:270px}
#pet{position:absolute;left:180px;top:70px;width:190px;height:190px}
#pet>svg{width:190px;height:190px;display:block}
</style>
<div id="stage"><img id="background" src="data:image/png;base64,${background}" alt="暖色像素书桌与窗外夜景"><canvas id="ambient" width="480" height="270"></canvas><div id="pet">${svg}</div></div>
<script>
const ctx=document.querySelector('#ambient').getContext('2d');
const animations=document.getAnimations();
for(const animation of animations) animation.pause();
const tau=Math.PI*2;
function block(x,y,w,h,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
window.renderAt=function(time){
 const t=((time%12)+12)%12;
 // The source cycle is 2.4 seconds: slow it to three seconds, four exact loops.
 for(const animation of animations) animation.currentTime=t*800;
 ctx.clearRect(0,0,480,270);
 const stars=[[155,43],[174,65],[219,68],[88,36],[119,49]];
 stars.forEach(([x,y],i)=>{
  const pulse=(Math.sin(tau*t/6+i*1.9)+1)/2;
  block(x,y,1,1,'#fff0cc',.25+.55*pulse);
  if(pulse>.8){block(x-1,y,3,1,'#d6c6e9',.18);block(x,y-1,1,3,'#d6c6e9',.18);}
 });
 // Warm bulbs brighten very gently and return to the same phase at 12 s.
 for(let i=0;i<17;i++){
  block(11+i*27.55,13,5,6,i%2?'#ffbe60':'#fff3b8',.045+.065*(1+Math.sin(tau*t/4+i*.65))/2);
 }
 // A single stepped shooting star stays inside the upper-right window pane.
 const shooting=(t-6.15)/.85;
 if(shooting>0&&shooting<1){
  const x=145+shooting*31,y=38+shooting*14;
  const a=Math.sin(shooting*Math.PI);
  for(let i=5;i>=0;i--)block(x-i*2,y-i,2,1,'#f9e7cb',a*(1-i/7));
 }
 // Two drifting amber leaves remain inside the unobstructed lower window.
 for(let i=0;i<2;i++){
  const p=(t/12+i*.5)%1;
  const x=69+i*68+p*18+Math.sin(p*tau)*4,y=104+p*48;
  const a=.65*Math.sin(p*Math.PI);
  block(x,y,2,2,i?'#dba05f':'#e5a65d',a);
  block(x+1,y-1,1,4,'#d88344',a);
 }
 // Three small steam wisps rise from the mug and dissolve before wrapping.
 for(let i=0;i<3;i++){
  const p=(t/4+i/3)%1;
  const x=355+Math.sin(p*tau+i)*2.2,y=204-p*21;
  const a=Math.sin(p*Math.PI)*.45;
  block(x,y,2,2,'#efddbe',a);
  block(x+1,y-2,1,2,'#efddbe',a*.8);
  block(x,y-4,1,2,'#efddbe',a*.55);
 }
 // Terminal cursor: subtle, with no additional text or labels.
 if(Math.floor(t*2)%2===0)block(121,208,2,3,'#eadcb8',.75);
 ctx.globalAlpha=1;
};
const stage=document.querySelector('#stage');
function fit(){stage.style.transform='scale('+Math.min(innerWidth/480,innerHeight/270)+')';}
addEventListener('resize',fit);fit();
window.renderAt(0);
// In an ordinary browser, the same standalone source runs as a looping scene.
if(!new URLSearchParams(location.search).has('render')){
 const start=performance.now();
 const tick=now=>{window.renderAt((now-start)/1000);requestAnimationFrame(tick)};
 requestAnimationFrame(tick);
}
</script></html>`;

await mkdir(output, { recursive: true });
await mkdir(frames, { recursive: true });
await writeFile(join(here, 'scene.html'), html);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
try {
  await page.goto(`file://${join(here, 'scene.html')}?render`);
  await page.evaluate(() => document.querySelector<HTMLImageElement>('#background')!.decode());
  await page.evaluate(() => document.fonts.ready);
  if (process.argv.includes('--preview')) {
    for (const [i, t] of [0, .75, 1.5, 2.25].entries()) {
      await page.evaluate(time => (window as any).renderAt(time), t);
      const png = await page.screenshot();
      await sharp(png).resize(1920,1080,{kernel:'nearest'}).png().toFile(join(output, `preview-${i}.png`));
    }
    console.log('Four preview frames rendered.');
  } else {
    for (let i = 0; i < duration * fps; i++) {
      await page.evaluate(time => (window as any).renderAt(time), i / fps);
      await page.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`) });
      if (i % 90 === 0) console.log(`Rendered ${i}/${duration * fps} frames`);
    }
    await sharp(join(frames,'0022.png')).resize(1920,1080,{kernel:'nearest'}).png().toFile(join(output,'封面.png'));
  }
} finally {
  await browser.close();
}

if (!process.argv.includes('--preview')) {
  const args = ['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',join(frames,'%04d.png'),
    '-vf','scale=1920:1080:flags=neighbor,setsar=1','-c:v','libx264','-preset','slow','-crf','15','-threads','2',
    '-pix_fmt','yuv420p','-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',
    '-metadata','title=根号兽 · 夜晚书桌','-metadata','comment=12-second loop. CubeRoot original mascot animation. AI-generated background.',
    '-an',join(output,'根号兽-夜晚书桌-1080p.mp4')];
  const child = spawn('ffmpeg',args,{stdio:'inherit'});
  await new Promise<void>((ok,fail)=>{child.on('error',fail);child.on('exit',code=>code===0?ok():fail(new Error(`ffmpeg: ${code}`)));});
  console.log('Encoded 12-second 1920 × 1080 MP4.');
}
