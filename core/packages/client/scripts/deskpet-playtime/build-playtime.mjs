#!/usr/bin/env node
// Original Clawd mini-stories. Run with --check to detect stale generated assets.
// Character geometry comes from the existing canonical static sprite.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { bubblegum } from './bubblegum.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../public/deskpet/playtime');
const base = readFileSync(resolve(HERE, '../../public/deskpet/clawd-static-base.svg'), 'utf8');
const part = (id) => {
  const rect = base.match(new RegExp(`<rect id="${id}"[^>]*/>`))?.[0];
  if (!rect) throw new Error(`Canonical Clawd part missing: ${id}`);
  return rect.replace(/ id="[^"]+"/, '');
};
const skin = '#DE886D', ink = '#171717', cream = '#FFF0CE', gold = '#FFD45C';
const pink = '#F58BB7', blue = '#69C9EB', purple = '#A391ED', green = '#8DD78B';
const r = (x,y,w,h,c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const p = (d,c) => `<path d="${d}" fill="${c}"/>`;
const l = (d,c=cream,w=.55) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="square" stroke-linejoin="miter"/>`;
const at = (html,x=0,y=0,s=1,angle=0) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(${angle})">${html}</g>`;
const t = (x=0,y=0,angle=0,sx=1,sy=sx) => `transform:translate(${x}px,${y}px) rotate(${angle}deg) scale(${sx},${sy});`;
const o = (value) => `opacity:${value};`;
const star = (c=gold) => p('M0-3h1v2h2v1H1v2H0V0h-2v-1h2z',c);
const heart = p('M-3-2h2v1h2v-1h2v3H2v1H1v1H0V2h-1V1h-1V0h-1z',pink);
const cloud = p('M-5 0v-2h3v-2h4v2h3v2h2v3H-7V0z',cream);
const moon = p('M1-5h3v1H2v2H1v4h1v2h2v1H0V4h-2V2h-1v-4h1v-2h3z',gold);
const chick = p('M0-2h3v1h1v3H0V1h-1v-2h1z',gold)+r(2,-1,.55,.7,ink)+r(4,0,1,.6,'#F7944F')+l('M1 2v1m2-1v1','#F7944F');
const butterfly = p('M-1 0l-3-2v3l3 1z',pink)+p('M1 0l3-2v3L1 2z',purple)+r(-.4,-.6,.8,3,cream);
const sock = p('M-1-4h3v6H0v1h-3V1h2z',blue)+r(-1,-4,3,1,cream)+r(-3,1,2,1.3,pink);
const leaf = p('M-5 1l4-4h6L2 1l-4 2z',green)+l('M-4 2L3-1','#4D9E6D',.5);
const cup = r(-2,-3,4,5,cream)+r(-2,-1,4,1,pink)+l('M2-2h2v3H2',cream,.7);
const sparkles = at(star(),-3,0,.5)+at(star(cream),18,-3,.45)+at(star(pink),7,-8,.35);

function stage(index, draw) {
  let serial = 0;
  const styles = [];
  function a(html, frames, origin='0px 0px', timing='ease-in-out') {
    const name = `pt${index}-${++serial}`;
    if (!frames.length || frames[0][0] !== 0) throw new Error(`${name}: missing initial pose`);
    if (frames.at(-1)[0] !== 100) frames = [...frames, [100, frames[0][1]]];
    let previous = -1;
    for (const [percent, css] of frames) {
      if (percent <= previous || percent > 100 || /NaN|undefined/.test(css)) throw new Error(`${name}: invalid timeline`);
      previous = percent;
    }
    styles.push(`.${name}{transform-origin:${origin};animation:${name} 8s ${timing} infinite}`,
      `@keyframes ${name}{${frames.map(([n,v])=>`${n}%{${v}}`).join('')}}`);
    return `<g class="${name}">${html}</g>`;
  }
  function v(html, start, end=92) {
    if (!(start > 0 && end > start && end < 100)) throw new Error('Visibility must have a reset interval');
    return a(html, [[0,o(0)],...(start>.1?[[start-.1,o(0)]]:[]),[start,o(1)],[end,o(1)],[end+.1,o(0)]], '0px 0px','linear');
  }
  function crab(frames=[[0,t()]], extra='', options={}) {
    const { left=[[0,t()]], right=[[0,t()]], eyes, mood, moodAt=50, moodEnd=88 } = options;
    const normal = `<g fill="${ink}">${part('left-eye')}${part('right-eye')}</g>`;
    let face = a(normal, eyes || [[0,t()],[12,t()],[13,t(0,0,0,1,.1)],[14,t()],[72,t()],[73,t(.5,0)],[85,t()]],'7.5px 9px');
    if (mood) {
      face = a(face, [[0,o(1)],[moodAt-.1,o(1)],[moodAt,o(0)],[moodEnd,o(0)],[moodEnd+.1,o(1)]]);
      const expression = mood==='happy' ? l('M4 9l1-1 1 1m3 0l1-1 1 1',ink,.65)
        : mood==='dizzy' ? l('M3.5 8l2 2m0-2l-2 2m6-2l2 2m0-2l-2 2',ink,.65)
        : mood==='sleep' ? l('M4 9h2m3 0h2',ink,.65)
        : r(3.5,7.5,2,3,cream)+r(9.5,7.5,2,3,cream)+r(4.2,8.3,.7,1.4,ink)+r(10.2,8.3,.7,1.4,ink)+r(7,11,1,1,ink);
      face += v(expression,moodAt,moodEnd);
    }
    const body = `<g fill="${skin}">${part('torso')}${['outer-left-leg','inner-left-leg','inner-right-leg','outer-right-leg'].map(part).join('')}${a(part('left-arm'),left,'2px 10px')}${a(part('right-arm'),right,'13px 10px')}</g>`;
    return a(body+face+extra,frames,'7.5px 15px');
  }
  const art = draw({a,v,crab});
  return { art: r(1,15.6,13,.55,'#141414')+art, css:styles.join('\n') };
}

const scenes = [];
function add(id,zh,en,description,descriptionEn,draw,poster=.65) {
  scenes.push({id,zh,en,description,descriptionEn,draw,poster});
}
add('bubblegum','吹泡泡糖','Bubble trouble','越吹越大，啪！糊一脸，再偷偷露出眼睛。','Bigger, bigger… POP! Two eyes peek out of the gum.',null,.79);

add('sock-fishing','今日大鱼','Catch of the day','使出吃奶的劲，钓上来一只袜子。','A mighty tug lands one very unimpressive sock.',({a,v,crab})=>{
  const fishing = l('M13 9L18-3', '#BE8F61',.7)+a(l('M18-3v16',cream,.3),[[0,t()],[30,t()],[43,t(0,0,0,1,.25)],[80,t(0,0,0,1,.25)],[94,t()]],'18px -3px');
  return r(14,14,10,.7,blue)+r(16,16,6,.5,blue)+crab([[0,t()],[25,t(0,0,7)],[34,t(-1,1,-12)],[42,t(-2,-1,-18)],[50,t()],[92,t()]],fishing,{mood:'shock',moodAt:48,right:[[0,t(0,0,-28)],[30,t(0,0,-28)],[44,t(0,0,-60)],[88,t(0,0,-60)]]})+
    v(a(at(sock,18,2),[[0,t(0,14)],[30,t(0,14)],[43,t(0,0,-15)],[55,t(0,0,12)],[66,t(0,0,-8)],[86,t()],[94,t(0,14)]],'18px 0px'),33,94)+v(at(p('M0 0v-3h1v2H0m3 0v-2h1v3',blue),16,13),35,41);
});
add('skateboard','帅不过三秒','Almost a pro','起跳转板，落地摇晃，假装一切尽在掌握。','A kickflip, a wobbly landing, and a very deliberate cool pose.',({a,v,crab})=>{
  const board = r(-1,15,17,1,purple)+r(0,16,2,1.4,ink)+r(12,16,2,1.4,ink)+r(1,14.5,13,.5,cream);
  return a(board,[[0,t(-4)],[20,t(0)],[32,t(2,-8,-170)],[42,t(3,-4,-360)],[49,t(3,0,-360)],[80,t(3,0,-360)],[100,t(-4,0,-360)]],'7.5px 15px')+
    crab([[0,t(-4)],[20,t()],[28,t(1,1,0,1.12,.83)],[34,t(2,-10,-9)],[43,t(3,-5,8)],[49,t(3,1,0,1.15,.83)],[55,t(3,0,-16)],[60,t(3,0,12)],[65,t(3,0,-6)],[72,t(3)],[85,t(3)],[100,t(-4)]],v(r(3,8,3,1.7,ink)+r(9,8,3,1.7,ink)+r(6,8,3,.5,ink),72,90),{left:[[0,t()],[32,t(0,0,70)],[52,t(0,0,-45)],[60,t(0,0,50)],[74,t()]],right:[[0,t()],[32,t(0,0,-70)],[52,t(0,0,45)],[60,t(0,0,-50)],[74,t()]]})+v(at(star(),20,1,.5),73,86);
});
add('cardboard','箱子成精','Suspicious box','纸箱悄悄走路，被发现后立刻装死。','The box tiptoes past, then freezes when its eyes are spotted.',({a,v,crab})=>{
  const box = r(-1,5,17,10,'#C59A67')+r(6,5,3,3,'#E4C18F')+l('M-1 5l2-3h13l2 3','#F0CCA0',.5);
  const moving = [[0,t(-4)],[16,t(-2,-.5,2)],[24,t(0,0,-2)],[32,t(2,-.5,2)],[42,t(4)],[73,t(4)],[84,t(2,-.5,-2)],[100,t(-4)]];
  return a(crab([[0,t()]])+box+v(r(3.8,8,2,1,ink)+r(9.2,8,2,1,ink),44,65),moving,'7.5px 15px')+v(at(p('M0-3h1v3H0zm0 4h1v1H0',gold),20,2),41,64);
});
add('soda','汽水上头','Soda hiccup','猛灌汽水，打出一个把自己罩住的嗝。','One fizzy sip traps the drinker in a giant hiccup bubble.',({a,v,crab})=>{
  const can = r(13,6,3,5,purple)+r(13,6,3,.6,cream)+l('M14 8h1l-1 2h1',gold,.5);
  const bubble = l('M1-11h13v2h3v3h2v11h-2v3h-3v2H1V8h-3V5h-2V-6h2v-3h3z',blue,.6)+r(0,-7,1,4,cream);
  return crab([[0,t()],[20,t(0,0,-5)],[30,t()],[40,t(0,-2,0,1.06,.95)],[50,t(0,-4)],[72,t(0,-5,-8)],[80,t(0,-5,7)],[84,t(0,1,0,1.15,.8)],[90,t()]],a(can,[[0,t()],[15,t(-3,-1,-65)],[28,t(-3,-1,-65)],[34,t()]],'14px 8px'),{mood:'shock',moodAt:39,moodEnd:83})+
    v(a(bubble,[[0,t(0,0,0,.1)],[39,t(0,0,0,.1)],[47,t(0,-1,0,1)],[73,t(0,-2)],[82,t(0,-2,0,1.08)],[84,t(0,-2,0,1.2)]],'7.5px 6px'),39,83)+v(sparkles,84,88);
});
add('butterfly','头顶有客','Butterfly guest','追着蝴蝶转来转去，最后它停在头顶。','Following a butterfly in circles, then trying to look up at the guest.',({a,v,crab})=>{
  const flap = a(butterfly,[[0,t()],[6,t(0,0,0,.25,1)],[12,t()],[18,t(0,0,0,.25,1)],[24,t()],[30,t(0,0,0,.25,1)],[36,t()],[42,t(0,0,0,.25,1)],[50,t()],[70,t()],[76,t(0,0,0,.25,1)],[82,t()],[88,t(0,0,0,.25,1)]]);
  return crab([[0,t()],[15,t(-2,0,-12)],[30,t(2,0,12)],[45,t()],[70,t()],[80,t(0,-1)],[90,t()]],'',{eyes:[[0,t()],[15,t(-.7,-.3)],[30,t(.7,-.3)],[50,t(0,-1)],[70,t(0,-1)],[90,t()]],left:[[0,t()],[18,t(0,0,65)],[30,t()]],right:[[0,t()],[30,t(0,0,-65)],[45,t()]]})+
    a(flap,[[0,t(-7,-8)],[15,t(-4,1)],[30,t(20,-3)],[42,t(10,-8)],[53,t(7.5,4)],[70,t(7.5,4)],[83,t(17,-7)],[100,t(-7,-8)]])+v(at(heart,18,-1,.55),57,73);
});
add('jetpack','点火失败','Chicken-powered','认真倒数点火，背包喷出来的却是一只小鸡。','A dramatic launch countdown. The jetpack ejects a chicken.',({a,v,crab})=>{
  const pack = r(-1,7,3,6,purple)+r(13,7,3,6,purple)+r(-1,7,3,1,cream)+r(13,7,3,1,cream);
  return crab([[0,t()],[22,t(0,1,0,1.05,.88)],[32,t(-.4,1)],[35,t(.4,1)],[38,t(-.4,1)],[42,t(0,-2)],[46,t(0,1,0,1.1,.85)],[53,t()]],pack,{mood:'shock',moodAt:47,left:[[0,t()],[25,t(0,0,40)],[46,t(0,0,-30)],[60,t()]],right:[[0,t()],[25,t(0,0,-40)],[46,t(0,0,30)],[60,t()]]})+
    v(a(at(cloud,7.5,15,.4),[[0,t()],[39,t()],[47,t(0,0,0,2.1)],[55,t(0,0,0,2.7)]] ,'7.5px 15px'),39,55)+
    v(a(chick,[[0,t(14,14)],[42,t(14,14)],[51,t(21,10,-12)],[58,t(21,14)],[65,t(21,13)],[70,t(21,14)],[88,t(21,14)]]),44,91);
});
add('mini-me','分身慢半拍','Copycat lag','大螃蟹挥手，小分身总慢半拍，最后抢先跳起来。','The tiny copy lags behind every wave, then jumps ahead.',({a,v,crab})=>{
  const big = crab([[0,t(-3)],[66,t(-3)],[75,t(-3,-2)],[81,t(-3)]],'',{right:[[0,t()],[15,t(0,0,-70)],[24,t()],[36,t(0,0,-70)],[44,t()]],mood:'shock',moodAt:59,moodEnd:70});
  const little = at(crab([[0,t()],[58,t()],[65,t(0,-7)],[72,t()]],'',{left:[[0,t()],[25,t(0,0,70)],[32,t()],[46,t(0,0,70)],[53,t()]],mood:'happy',moodAt:62}),14,7.5,.5);
  return big+v(a(little,[[0,t(0,0,0,0)],[7,t(0,0,0,0)],[12,t(0,0,0,1)],[88,t(0,0,0,1)],[93,t(0,0,0,0)]],'17.5px 15px'),7,93)+v(at(star(),20,0,.5),64,72);
});
add('paper-weights','纸片猛男','Paperweight champion','举铁憋得满脸通红，风一吹才发现是纸片。','A heroic lift… until a breeze reveals the paper barbell.',({a,v,crab})=>{
  const bar = r(-4,8,23,.8,cream)+r(-5,5,3,7,purple)+r(17,5,3,7,purple)+r(-4,5,1,7,'#CEC0FF')+r(18,5,1,7,'#CEC0FF');
  return crab([[0,t()],[20,t(0,1,0,1.1,.85)],[27,t(.3,1)],[32,t(-.3,1)],[40,t()],[63,t()],[67,t(0,-1,-6)],[76,t()]],v(r(3,10.5,2,.7,pink)+r(10,10.5,2,.7,pink),18,57),{mood:'shock',moodAt:64,left:[[0,t()],[41,t(0,-7,40)],[60,t(0,-7,40)],[73,t()]],right:[[0,t()],[41,t(0,-7,-40)],[60,t(0,-7,-40)],[73,t()]]})+
    a(bar,[[0,t()],[20,t(0,.5)],[38,t(0,-8)],[57,t(0,-8)],[66,t(3,-11,-15,1,.12)],[76,t(8,-16,20,1,.12)],[88,t(0,-18,-10,1,.12)],[93,t(0,0,0,1,.12)],[100,t()]],'7.5px 8px')+v(l('M-9-3h7m-5 2h8',blue,.4),61,79);
});
add('star-catch','接住流星','Pocket starlight','接住一颗流星，捂一捂，胸前亮起小小的光。','Catch a falling star and tuck its warm glow close.',({a,v,crab})=>{
  return crab([[0,t()],[25,t(0,1)],[36,t(0,-2)],[42,t()],[72,t(0,0,0,1.03,.98)],[90,t()]],v(at(star(),7.5,11,1.1),42,88),{mood:'happy',moodAt:43,left:[[0,t()],[28,t(2,-3,70)],[45,t(4,0,20)],[84,t(4,0,20)]],right:[[0,t()],[28,t(-2,-3,-70)],[45,t(-4,0,-20)],[84,t(-4,0,-20)]]})+
    v(a(star(),[[0,t(-9,-18,0,.3)],[8,t(-9,-18,0,.3)],[30,t(7.5,1,150,1.1)],[41,t(7.5,11,180,1.1)]]),8,41)+v(l('M-6-15L1-8M-5-18L-1-14',gold,.5),12,24)+v(a(sparkles,[[0,o(.3)],[50,o(.3)],[60,o(1)],[73,o(.3)],[83,o(1)]]),48,90);
});

add('portal','门怎么又是我','Portal problem','走进右边的门，却从左边掉出来，回头看懵了。','Enter on the right, tumble out on the left, stare in disbelief.',({a,v,crab})=>{
  const portal = (color) => l('M0-5h3v2h1V9H3v2H0V9h-1V-3h1z',color,.8)+l('M1-3v11',color,.3);
  const first = a(crab([[0,t()],[15,t(4)],[27,t(10)]]),[[0,o(1)],[28,o(1)],[28.1,o(0)],[95,o(0)],[100,o(1)]]);
  const second = v(crab([[0,t(-14,-7,-90,.25,1)],[32,t(-14,-7,-90,.25,1)],[40,t(-7,-3,-35)],[47,t(-4,1,0,1.15,.8)],[53,t(-4)],[70,t(-4,0,-10)],[88,t()]],'',{mood:'shock',moodAt:48,moodEnd:80}),32,99.9);
  return at(portal(blue),-7,3)+at(portal(purple),20,3)+first+second+v(at(star(blue),-6,-5,.5),32,46);
});
add('pancake','煎饼帽子','Pancake hat','一抛一转很专业，一接……接在了脑袋上。','A professional flip. A perfectly unprofessional landing.',({a,v,crab})=>{
  const pancake = r(-3,-.8,6,1.5,'#E9AE59')+r(-2,-1.3,4,.6,cream)+r(-.7,-1.9,1.4,.7,gold);
  return crab([[0,t()],[22,t(0,1,-5)],[29,t(0,-1,5)],[53,t()],[56,t(0,1,0,1.08,.88)],[62,t()]],l('M13 10h4', '#929EB7',.7)+r(17,9,7,1.2,'#596983'),{mood:'shock',moodAt:56,moodEnd:79,right:[[0,t()],[24,t(0,0,-35)],[37,t()]]})+
    a(pancake,[[0,t(20,8)],[22,t(20,8)],[34,t(16,-12,190)],[43,t(10,-8,340)],[55,t(7.5,5,360)],[87,t(7.5,5,360)],[94,t(20,8,360)],[100,t(20,8,360)]])+v(at(star(),18,1,.45),60,76);
});
add('popcorn','爆米花雪崩','Popcorn avalanche','一粒玉米试探着跳起，下一秒爆米花把螃蟹埋了。','One innocent kernel, then a popcorn avalanche.',({a,v,crab})=>{
  const corn = p('M-1-1h2v1h1v2H1v1h-2V2h-1V0h1z',cream)+r(0,1,.7,.6,gold);
  let kernels = '';
  for(let i=0;i<13;i++) {
    const begin = 28+i*1.5, x = -2+(i*7)%19;
    kernels += v(a(corn,[[0,t(18,12,0,.3)],[begin,t(18,12,0,.3)],[begin+12,t(10+(i%4)*2,-9-(i%3)*2,i*31,.6)],[begin+29,t(x,10+(i%3)*2,i*59,.9)],[86,t(x,10+(i%3)*2,i*59,.9)],[95,t(x,17,i*59,0)]]),begin,95);
  }
  return crab([[0,t()],[34,t()],[43,t(0,-2)],[55,t(0,1,0,1.08,.87)],[89,t()]],'',{mood:'shock',moodAt:35,moodEnd:57})+r(15,10,6,5,pink)+r(16,10,1,5,cream)+r(19,10,1,5,cream)+r(14.5,9,7,1,cream)+kernels+v(r(4,8,1,2,ink)+r(10,8,1,2,ink),60,85);
});
add('yarn','越理越乱','Yarn trap','追毛线球追得很开心，回头发现自己被缠成粽子。','Chase the yarn, then discover the yarn has caught you.',({a,v,crab})=>{
  const ball = p('M-2-3h4v1h1v4H2v1h-4V2h-1v-4h1z',pink)+l('M-2-1h4m-4 2h4m-3-4l2 6','#C7568A',.4);
  return crab([[0,t(-2)],[20,t(0,0,8)],[35,t(2,0,-9)],[49,t(0,0,6)],[58,t()],[66,t(-.4)],[70,t(.4)],[74,t(-.4)],[82,t()]],
    v(l('M1 7l13 3M1 9l13 3M2 12L13 7M4 6l6 7M2 11h11',pink,.65),44,88),{mood:'shock',moodAt:56,moodEnd:88})+
    a(ball,[[0,t(20,13)],[22,t(17,13,150)],[36,t(-5,13,450)],[53,t(20,13,810)],[85,t(20,13,810)],[100,t(20,13,1080)]])+v(l('M13 12L18 14',pink,.35),54,88);
});
add('rainboat','雨伞变小船','Umbrella boat','撑伞躲雨，伞被吹翻，干脆坐进去划船。','The umbrella flips in the rain. Fine: it is a boat now.',({a,v,crab})=>{
  const umbrella = p('M-7 0v-2h2v-2h3v-1h4v1h3v2h2v2z',blue)+p('M-2-4h4v4h-4z',purple)+l('M0 0v8h2V7',cream,.5);
  const drops = Array.from({length:9},(_,i)=>a(l(`M${-5+i*3} -8l-1 2`,blue,.4),[[0,t(0,(i%3)*3)+o(0)],[8,t(0,(i%3)*3)+o(1)],[35,t(0,13+(i%3)*3)+o(1)],[43,t(0,18)+o(0)],[100,t(0,18)+o(0)]])).join('');
  return v(at(cloud,8,-13,.95),4,49)+drops+v(r(-6,16,30,.6,blue)+r(-2,17.5,18,.5,blue),48,92)+
    crab([[0,t()],[28,t()],[38,t(0,0,-10)],[52,t(0,-3)],[60,t(0,-1)],[70,t(2,-2,3)],[82,t(4,-1,-3)],[95,t()]],v(a(l('M13 6l6 9m-2-2l2-1 2 3-2 1z', '#CFAD79',.7),[[0,t()],[60,t()],[70,t(-1,0,-12)],[82,t()]],'13px 6px'),59,90),{mood:'happy',moodAt:59})+
    a(at(umbrella,7.5,-1),[[0,t()],[30,t()],[44,t(2,3,180)],[56,t(0,15,180)],[70,t(2,14,183)],[82,t(4,15,177)],[94,t(0,0,360)],[100,t(0,0,360)]],'7.5px -1px');
});
add('invisible-wall','空气墙','Invisible wall','小心摸到一堵空气墙，绕过去才发现墙也跟着走。','Feel an invisible wall, sidestep it, and find it has followed.',({a,v,crab})=>{
  const wall = l('M17-3v18m-2-17h2m0 16h-2',blue,.45);
  return crab([[0,t(-3)],[18,t()],[27,t(2,0,7)],[31,t(0,-.5,-8)],[38,t()],[50,t(-4)],[60,t(-2,0,7)],[65,t(-4,0,-9)],[85,t(-4)],[100,t(-3)]],'',{mood:'shock',moodAt:63,moodEnd:83,right:[[0,t()],[20,t(0,-1,-25)],[35,t()],[54,t(0,-1,-25)],[70,t()]]})+
    v(a(wall,[[0,t()],[37,t()],[52,t(-4)],[83,t(-4)]]),26,84)+v(at(star(cream),16,8,.4),28,33)+v(at(star(cream),12,8,.4),62,67);
});
add('ufo','外星人退货','Alien return policy','被飞碟吸走，三秒后退回来，头上多了两根天线。','Beamed up, promptly returned, now with complimentary antennae.',({a,v,crab})=>{
  const ufo = p('M-3-3h6v1h2v3H-5v-3h2z',blue)+r(-7,1,14,2,purple)+r(-4,3,1,1,gold)+r(0,3,1,1,gold)+r(4,3,1,1,gold);
  return a(at(ufo,7.5,-13),[[0,t(-17)],[15,t()],[77,t()],[88,t(17,-4)],[94,t(17,-4)+o(0)],[99,t(-17)+o(0)],[100,t(-17)+o(1)]])+
    v(p('M4-9h7l7 25H-3z','#69C9EB30'),23,75)+
    crab([[0,t()],[25,t()],[38,t(0,-13,0,.4)],[43,t(0,-20,0,0)],[56,t(0,-20,0,0)],[63,t(0,-12,0,.4)],[73,t()],[77,t(0,1,0,1.12,.85)],[82,t()]],
      v(l('M5 6L4 2m6 4l1-4',green,.5)+r(3,1,2,1.5,green)+r(10,1,2,1.5,green),61,93),{mood:'shock',moodAt:65,moodEnd:91});
});
add('balloon','气球遛螃蟹','Balloon walks crab','本想牵着气球散步，结果被气球牵着飞。','Taking the balloon for a walk turns into the balloon taking charge.',({a,v,crab})=>{
  const balloon = p('M-2-5h4v1h2v2h1v4H4v2H2v1h-4V4h-2V2h-1v-4h1v-2h2z',pink)+r(-2,-3,1,3,cream)+p('M0 5l-1 2h2z',pink);
  return a(crab([[0,t()],[25,t()],[33,t(0,-1)],[40,t(0,1)],[48,t(0,-3)],[70,t(0,-6)],[82,t(0,-3)],[92,t()]],'',{mood:'shock',moodAt:45,moodEnd:84,right:[[0,t(0,0,-40)],[44,t(0,-3,-70)],[85,t(0,-3,-70)]]})+
    a(at(balloon,17,-6)+l('M17 1L14 9',cream,.35),[[0,t()],[25,t(2,-2)],[40,t(0,-1)],[50,t(0,-4)],[70,t(-2,-6)],[84,t(1,-3)]]),[[0,t()],[48,t()],[60,t(-3)],[74,t(2)],[90,t()]],'7.5px 15px');
});
add('rabbit-hat','魔术被反杀','Rabbit magician','伸手进帽子抓兔子，兔子却把螃蟹提了起来。','Reaching for a rabbit… which lifts the magician instead.',({a,v,crab})=>{
  const hat = r(15,10,8,5,purple)+r(13,9,12,1.5,ink)+r(15,11,8,1,pink);
  const rabbit = p('M-3-4v-5h2v4h2v-4h2v5h1v5h-8v-5z',cream)+r(-2,-8,.7,3,pink)+r(2,-8,.7,3,pink)+r(-2,-3,.6,1,ink)+r(2,-3,.6,1,ink)+r(0,-1,1,.6,pink)+l('M-4-1L-9 1',cream,1.2);
  return crab([[0,t()],[22,t(3,0,15)],[38,t(3,0,15)],[53,t(3,-6,15)],[66,t(3,-6,-12)],[77,t(3,-6,9)],[87,t(0,1,0,1.1,.85)],[94,t()]],'',{mood:'shock',moodAt:49,moodEnd:85,right:[[0,t()],[23,t(1,0,20)],[40,t(1,0,20)],[59,t(0,-3,-55)],[87,t()]]})+
    v(a(at(rabbit,19,10),[[0,t(0,6)],[34,t(0,6)],[51,t(0,-2)],[80,t(0,-2)],[91,t(0,6)]]),35,91)+hat+v(at(star(pink),19,-5,.4),52,78);
});
add('magnet','磁铁不听话','Magnet mayhem','想吸回一枚硬币，结果连锅都飞到脸上。','Trying to fetch a coin attracts an entire frying pan.',({a,v,crab})=>{
  const magnet = p('M13 5h2v4h2V5h2v6h-6z',pink)+r(13,4,2,2,cream)+r(17,4,2,2,cream);
  const pan = p('M-3-4h6v1h1v6H3v1h-6V3h-1v-6h1z','#65758A')+r(-2,-3,4,6,'#354354')+r(-.6,4,1.2,5,'#BA8B5E');
  return crab([[0,t()],[26,t(0,0,4)],[48,t()],[53,t(-2,-1,-13)],[60,t(-2)],[82,t(-2)],[94,t()]],magnet,{mood:'shock',moodAt:46,moodEnd:85})+
    v(a(r(-1,-1,2,2,gold),[[0,t(24,14)],[20,t(24,14)],[40,t(17,4,180)],[82,t(17,4,180)]]),4,91)+
    v(a(pan,[[0,t(30,-8,-50)],[36,t(30,-8,-50)],[51,t(5.5,9,8)],[57,t(5.5,9,-8)],[63,t(5.5,9)],[83,t(5.5,9)],[92,t(5.5,18,0,.2)]]),38,92)+v(l('M20 5l2-1m-2 3h3m-3 2l2 1',blue,.4),22,42);
});

add('snowball','滚出一个自己','Snow clone','认真滚雪球，最后给雪螃蟹点上两只眼睛。','Roll a snowball, then reveal a tiny snow-crab friend.',({a,v,crab})=>{
  const snow = p('M-3-4h6v1h1v6H3v1h-6V3h-1v-6h1z',cream)+r(-2,-2,1,2,'#D7EAF4');
  const snowCrab = r(14,9,7,4,cream)+r(12.5,11,1.5,1.5,cream)+r(21,11,1.5,1.5,cream)+r(15,13,1,2,cream)+r(19,13,1,2,cream)+v(r(16,10.5,.7,1.5,ink)+r(19,10.5,.7,1.5,ink),64,91);
  return crab([[0,t(-5)],[20,t(-3,0,8)],[35,t(-1,0,8)],[47,t(1,0,8)],[58,t(-2)],[91,t(-2)]],'',{right:[[0,t(0,0,-25)],[58,t(0,0,-25)],[65,t(1,-1,-60)],[75,t()]],mood:'happy',moodAt:69})+
    v(a(snow,[[0,t(10,14,0,.25)],[20,t(12,13,90,.4)],[35,t(15,12,180,.65)],[49,t(18,11,270,1)],[57,t(18,11,270,1)]]),.1,57)+v(snowCrab,57.1,91)+v(at(star(blue),23,4,.5),69,87);
});
add('leaf-parachute','树叶降落伞','Leaf parachute','拿树叶当降落伞，落地后还要优雅地鞠一躬。','A drifting leaf parachute, a bumpy landing, and a gracious bow.',({a,v,crab})=>{
  const rig = at(leaf,7.5,-5,2)+l('M0-4L2 8m13-14l-2 14',cream,.35);
  return a(crab([[0,t()],[69,t()],[74,t(0,1,0,1.15,.8)],[81,t()],[85,t(0,0,14,1,.8)],[91,t()]],'',{mood:'happy',moodAt:79,right:[[0,t(0,-2,-60)],[70,t(0,-2,-60)],[79,t()]],left:[[0,t(0,-2,60)],[70,t(0,-2,60)],[79,t()]]})+
    a(rig,[[0,t()],[70,t()],[83,t(13,17,35,.4)],[89,t(13,19,35,0)],[99,t(13,19,35,0)],[100,t()]],'7.5px -5px'),[[0,t(0,-15,0,.1)+o(0)],[4,t(0,-15,0,.5)+o(1)],[12,t(-4,-11,-10)],[28,t(4,-7,10)],[44,t(-3,-4,-8)],[61,t(2,-2,6)],[72,t()],[93,t()+o(1)],[97,t()+o(0)],[100,t(0,-15,0,.1)+o(0)]],'7.5px 15px');
});
add('selfie','拍照必眨眼','Blink and miss it','摆好姿势，闪光一响就闭眼，照片还慢慢显影。','Perfect pose, perfectly timed blink, an awkward instant photo.',({a,v,crab})=>{
  const camera = r(15,7,8,5,purple)+r(17,6,3,1,purple)+r(17,8,3,3,ink)+r(18,8.5,1,1,blue)+r(21,7.5,1,1,cream);
  const photo = r(15,0,8,9,cream)+r(16,1,6,6,'#36505F')+v(r(17,3,4,2.5,skin)+l('M17.5 4h1m1 0h1',ink,.4),61,90);
  return crab([[0,t()],[16,t(0,0,-9)],[28,t(0,0,9)],[37,t()],[53,t()],[61,t(0,0,-8)],[85,t()]],'',{mood:'sleep',moodAt:41,moodEnd:49,left:[[0,t()],[25,t(0,0,80)],[52,t()]]})+camera+
    v(r(-9,-17,34,34,cream),43,44)+v(a(photo,[[0,t(0,10,0,1,.1)],[49,t(0,10,0,1,.1)],[64,t(0,-1)],[86,t(0,-1)],[94,t(0,12,0,.1)]],'19px 9px'),49,94)+v(at(p('M0-3h1v3H0zm0 4h1v1H0',gold),5,-2),66,83);
});
add('treasure','宝箱有脾气','Chest surprise','开箱期待大宝贝，弹出来的拳套把小皇冠送上头。','A spring-loaded boxing glove delivers a surprisingly royal reward.',({a,v,crab})=>{
  const chest = r(15,10,9,5,'#AD734E')+r(15,10,9,1,gold)+r(18.5,10,2,2,gold);
  const crown = p('M-4 0v-4l2 2 2-3 2 3 2-2v4z',gold)+r(-.5,-2,1,1,pink);
  return crab([[0,t()],[26,t(1,0,10)],[44,t(1,0,10)],[52,t(-2,-1,-18)],[60,t()],[76,t()],[83,t(0,-1)],[90,t()]],'',{mood:'happy',moodAt:70,right:[[0,t()],[27,t(1,-1,-45)],[50,t(0,0,50)],[65,t()]]})+
    v(a(l('M19 12l-2-2 4-2-4-2 4-2-2-2',cream,.5)+r(17,-1,5,4,pink),[[0,t(0,9,0,1,.1)],[38,t(0,9,0,1,.1)],[48,t(-6,0,-15)],[57,t(-6,0,-15)],[65,t(0,9,0,1,.1)]],'19px 12px'),38,65)+
    chest+a(r(15,7,9,3,'#D6A16C')+r(15,9,9,.7,gold),[[0,t()],[25,t()],[39,t(0,0,100)],[80,t(0,0,100)],[94,t()]],'24px 10px')+
    v(a(crown,[[0,t(19,9,0,.3)],[43,t(19,9,0,.3)],[57,t(9,-6,-15)],[67,t(7.5,6)],[90,t(7.5,6)]]),43,93);
});
add('donut','甜甜圈救生圈','Donut dilemma','呼啦圈摇得起劲，才发现甜甜圈卡在了肚子上。','Hula-hoop triumph becomes a rather sticky waist situation.',({a,v,crab})=>{
  const ring = p('M-6-2h2v-2h8v2h2v4H4v2h-8V2h-2zM-3-1v2h6v-2z','#E4A663').replace('/>',' fill-rule="evenodd"/>')+l('M-5-1v2h2v2h6V1h2v-2H3v-2h-6v2z',pink,1.1)+r(-4,-1,1,.5,blue)+r(2,-3,1,.5,gold)+r(3,1,1,.5,cream);
  return crab([[0,t()],[18,t(-1,0,-8)],[28,t(1,0,8)],[38,t(-1,0,-8)],[49,t(1,0,8)],[56,t()],[65,t(0,-2,0,.92,1.15)],[70,t(0,1,0,1.1,.85)],[78,t()]],'',{mood:'shock',moodAt:56,moodEnd:87,left:[[0,t()],[56,t(1,0,-30)],[65,t(1,-2,-30)],[78,t()]],right:[[0,t()],[56,t(-1,0,30)],[65,t(-1,-2,30)],[78,t()]]})+
    a(at(ring,7.5,11,1.3),[[0,t(0,0,0,1,.35)],[18,t(-1,0,-10,1,.35)],[28,t(1,0,10,1,.35)],[38,t(-1,0,-10,1,.35)],[49,t(1,0,10,1,.35)],[56,t(0,0,0,.8,.7)],[65,t(0,-2,0,.8,.7)],[70,t(0,1,0,.8,.7)],[88,t(0,0,0,.8,.7)],[100,t(0,0,0,1,.35)]],'7.5px 11px');
});
add('origami','纸鹤活了','Paper takes flight','折好的纸鹤突然活了，叼走头上的小花。','A folded crane comes alive and steals the flower.',({a,v,crab})=>{
  const crane = p('M-4 1L0-1l4 2-3 1-1-1-3 1z',cream)+p('M2 0l2-4 2 1-2 0-1 4z',cream)+a(p('M0 1l-3-6 6 4z','#D4DDFA'),[[0,t()],[36,t()],[43,t(0,0,0,1,.2)],[50,t()],[58,t(0,0,0,1,.2)],[67,t()],[74,t(0,0,0,1,.2)],[83,t()],[90,t(0,0,0,1,.2)]],'0px 1px');
  const flower = p('M-1-2h2v1h1v2H1v1h-2V1h-1v-2h1z',pink)+r(-.5,-.5,1,1,gold);
  return crab([[0,t()],[15,t(0,.5)],[25,t()],[47,t()],[56,t(0,0,-6)],[68,t()]],v(at(flower,4,5,.7),.1,59),{mood:'shock',moodAt:54,moodEnd:75,left:[[0,t(3,0)],[17,t(4,-1)],[29,t(3,0)],[39,t()]],right:[[0,t(-3,0)],[17,t(-4,-1)],[29,t(-3,0)],[39,t()]]})+
    v(at(p('M-4 0h8l-2 4h-4z',cream),7.5,10),.1,28)+v(a(crane+v(at(flower,5,-2,.7),60,92),[[0,t(7.5,10,0,.8)],[29,t(7.5,10,0,.8)],[44,t(10,-4)],[59,t(0,6)],[67,t(2,-7)],[81,t(15,-11)],[94,t(27,-18)]]),29,94);
});
add('drum-solo','鼓点炸开花','Drumroll fireworks','鼓棒越敲越快，最后一击把音符敲成烟花。','A faster and faster drumroll ends in pixel fireworks.',({a,v,crab})=>{
  const drum = r(1,12,13,4,purple)+r(0,11,15,1.5,cream)+r(1,16,13,.6,cream)+l('M2 13l2 2 2-2 2 2 2-2 2 2',gold,.4);
  const beat = [[0,t()],[12,t(0,0,-35)],[17,t()],[25,t(0,0,-35)],[30,t()],[36,t(0,0,-35)],[40,t()],[45,t(0,0,-35)],[48,t()],[52,t(0,0,-45)],[56,t()],[62,t(0,0,-80)],[69,t()],[83,t()]];
  let fireworks = '';
  for(let i=0;i<9;i++) {
    const angle=i*Math.PI*2/9;
    fireworks+=v(a(at(star([pink,blue,gold][i%3]),7.5,-7,.5),[[0,t()],[67,t()],[77,t(Math.cos(angle)*12,Math.sin(angle)*9)],[87,t(Math.cos(angle)*13,Math.sin(angle)*9+3)+o(0)]]),67,87);
  }
  return fireworks+crab([[0,t()],[16,t(0,.3)],[30,t()],[39,t(0,.3)],[48,t()],[59,t(0,1,0,1.1,.87)],[65,t(0,-2)],[70,t()]],a(l('M0 8l5 3', '#D4B27F',.7),beat,'0px 8px')+a(l('M15 8l-5 3','#D4B27F',.7),beat.map(([n,s])=>[n,s.replace(/rotate\(-/,'rotate(')]),'15px 8px'),{mood:'happy',moodAt:70})+drum;
});
add('moon-hammock','月亮吊床','Moon hammock','拉下月亮当吊床，刚躺好就开始打盹。','Pull the moon down, curl up, and rock yourself to sleep.',({a,v,crab})=>{
  const rope = a(l('M13 9L17-10',cream,.3),[[0,t()],[20,t()],[42,t(0,0,0,1,.3)],[52,t(0,0,0,1,.3)],[60,t(0,0,0,1,0)]],'13px 9px');
  const hammock = a(at(moon,17,-12,1.3),[[0,t()],[20,t()],[40,t(-9,20,-40,1.4)],[50,t(-9,23,-80,1.4)],[63,t(-9,23,-90,1.4)],[75,t(-8,22,-82,1.4)],[86,t(-9,23,-92,1.4)],[99,t()]],'17px -12px');
  return v(rope,.1,59)+hammock+crab([[0,t()],[20,t(0,0,-12)],[34,t(0,1,-18)],[46,t(0,-3)],[57,t(0,-3,12,.8)],[65,t(0,-3,22,.8)],[76,t(1,-4,14,.8)],[87,t(0,-3,24,.8)],[100,t()]],'',{mood:'sleep',moodAt:58,moodEnd:90,right:[[0,t(0,0,-40)],[35,t(0,0,-70)],[55,t()]]})+
    v(a(l('M15-2h3l-3 3h3m1-8h2l-2 2h2',purple,.5),[[0,t()+o(0)],[65,t()+o(1)],[86,t(0,-3)+o(0)]]),65,87)+v(at(star(cream),-3,-9,.4),60,86);
});
add('pixel-sneeze','喷嚏散架','Pixel sneeze','一个喷嚏打散成像素，装回去时眼睛还装反了。','Sneeze into pixels, rebuild, then fix the misplaced eyes.',({a,v,crab})=>{
  let pieces='';
  for(let i=0;i<18;i++) {
    const x=2+(i%6)*1.8,y=6+Math.floor(i/6)*2.4;
    const dx=Math.cos(i*2.4)*12,dy=-5-Math.abs(Math.sin(i*2.4))*13;
    pieces+=v(a(r(x,y,1.8,2.4,skin),[[0,t()],[35,t()],[48,t(dx,dy,i*37)],[58,t(dx,dy+2,i*37)],[71,t()]]),35,71);
  }
  const intact = a(crab([[0,t()],[13,t(0,-.3,0,1.03,.98)],[23,t(0,-.8,0,.94,1.08)],[31,t(0,1,0,1.15,.8)],[35,t(0,-1)],[72,t()]],'',{eyes:[[0,t()],[19,t(0,0,0,1,.2)],[31,t(0,0,0,1,.2)],[72,t()]]}),[[0,o(1)],[34.9,o(1)],[35,o(0)],[71,o(0)],[71.1,o(1)]]);
  return intact+pieces+v(r(3,7,3,4,skin)+r(9,7,3,4,skin)+a(r(4,11,1,2,ink)+r(10,7,2,1,ink),[[0,t()],[76,t()],[83,t(0,-.6)]]) ,71.1,85)+v(at(cloud,18,8,.5),33,40)+v(at(star(pink),19,1,.5),86,91);
});
add('rebel-shadow','影子先下班','Shadow has plans','自己停下了，影子还在跳舞，最后只好跟着它跳。','The crab stops. Its shadow keeps dancing. Better join in.',({a,v,crab})=>{
  const silhouette = `<g fill="#A391ED">${part('torso')}${part('left-arm')}${part('right-arm')}${part('outer-left-leg')}${part('outer-right-leg')}</g>`;
  const shadow = a(at(silhouette,16,4,.65),[[0,t()],[18,t(0,-2,-12)],[27,t(0,0,12)],[36,t(0,-2,-12)],[45,t(0,0,12)],[54,t(0,-2,-12)],[63,t(0,0,12)],[72,t(0,-2,-12)],[81,t(0,0,12)],[90,t()]],'21px 14px');
  return v(shadow,4,92)+crab([[0,t(-3)],[20,t(-3)],[28,t(-3,0,8)],[48,t(-3,0,8)],[54,t(-3,-2,-12)],[63,t(-3,0,12)],[72,t(-3,-2,-12)],[81,t(-3,0,12)],[90,t(-3)]],'',{mood:'happy',moodAt:53,moodEnd:89,eyes:[[0,t()],[27,t(.7)],[49,t(.7)],[54,t()]],left:[[0,t()],[54,t(0,0,60)],[63,t(0,0,-30)],[72,t(0,0,60)],[81,t(0,0,-30)],[90,t()]],right:[[0,t()],[54,t(0,0,30)],[63,t(0,0,-60)],[72,t(0,0,30)],[81,t(0,0,-60)],[90,t()]]})+v(at(star(pink),20,-2,.5),65,83);
});

const xml = (s) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
if (scenes.length !== 30 || new Set(scenes.map(s=>s.id)).size !== 30) throw new Error('Exactly 30 unique stories are required');
const files = new Map();
const manifest = scenes.map(({id,zh,en,description,descriptionEn,draw,poster},i)=>{
  const file = `${String(i+1).padStart(2,'0')}-${id}.svg`;
  const title = `${zh} / ${en}`;
  let svg;
  if (!draw) svg = bubblegum;
  else {
    const {art,css} = stage(i+1,draw);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -22 41 42" role="img" aria-labelledby="pt${i+1}-title pt${i+1}-desc" data-duration="8" data-playtime="pt${i+1}">
<title id="pt${i+1}-title">${xml(title)}</title><desc id="pt${i+1}-desc">${xml(description+' '+descriptionEn)}</desc>
<style>${css}\n@media(prefers-reduced-motion:reduce){svg[data-playtime="pt${i+1}"] g{animation-play-state:paused!important;animation-delay:-${poster*8}s!important}}</style>
${art}</svg>`;
  }
  files.set(file,`<!-- Generated by scripts/deskpet-playtime/build-playtime.mjs; edit the source. -->\n${svg}\n`);
  return {file,zh,en,description,descriptionEn,duration:8,poster};
});
files.set('manifest.json',JSON.stringify(manifest,null,2)+'\n');
if (process.argv.includes('--check')) {
  const stale = [...files].filter(([name,content])=>{try{return readFileSync(join(OUT,name),'utf8')!==content;}catch{return true;}}).map(([name])=>name);
  const unexpected = readdirSync(OUT).filter(name=>!files.has(name));
  if (stale.length || unexpected.length) throw new Error(`Playtime drift: ${[...stale,...unexpected].join(', ')}`);
  console.log('30 Clawd stories: generated assets and manifest are current.');
} else {
  mkdirSync(OUT,{recursive:true});
  for (const [name,content] of files) writeFileSync(join(OUT,name),content);
  console.log(`Built ${scenes.length} Clawd stories and manifest in ${OUT}`);
}
