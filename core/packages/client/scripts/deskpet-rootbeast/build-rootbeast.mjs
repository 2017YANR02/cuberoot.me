// node scripts/deskpet-rootbeast/build-rootbeast.mjs [--check]
// Source of the loops and their bilingual runtime/gallery manifest.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { choreography } from './choreography.mjs';
import { turningCube } from './cube-motion.mjs';
import { defs, stage, red, blue, ink, cream, gold, pink, mint, violet, p, line, rect, circle, at, t, opacity, star, heart, cloud, moon, bug, butterfly, tile, laptop, book, magnifier, balloon, umbrella, board, cup } from './rig.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/deskpet/rootbeast');
// Seconds per complete performance, including the readable finishing pose.
// Resting loops breathe slowly; active gestures should complete in a few beats.
const durations = {
  idle:5.4, hello:2.8, walk:1.6, 'double-jump':2.6, drag:2.4,
  annoyed:2.8, thinking:3.6, typing:2.4, building:3.2, headphones:2.4,
  juggling:2.4, sweeping:2.8, carrying:3.2, debugger:3, wizard:3.2,
  'deep-thought':4, boss:3, happy:2.4, error:3.2, notification:2.4,
  reading:3.6, bubble:3.2, yawning:3.8, dozing:3.6, sleeping:4.8,
  waking:3.2, inspection:3.4, cubing:2.8, timer:4, 'personal-best':2.8,
  pop:2.6, teaching:3.2, bubblegum:3.2, fishing:3.2, skateboard:2.8,
  box:3, soda:2.8, 'paper-plane':3.2, 'catch-star':3.2, umbrella:3.6,
  puddle:2.6, balloon:3.6, popcorn:2.8, butterfly:2.8, 'paper-boat':3.2,
  stretch:3.6, sneak:3.2, dance:2.4, portal:3.2, 'moon-hug':4,
  'cube-pop':3.4,
};
const scenes = [];
const add = (id, zh, en, description, descriptionEn, draw, poster = .45) => {
  const duration = durations[id];
  if (!Number.isFinite(duration) || duration < 1 || duration > 6) throw Error(`Invalid duration for ${id}`);
  scenes.push({ id, zh, en, description: choreography[id]?.description ?? description, descriptionEn: choreography[id]?.descriptionEn ?? descriptionEn, draw, duration, poster });
};
const zzz = ({a}, x = 496, y = 339) => [0,1,2].map(i => at(a(`<text fill="${cream}" font-family="system-ui,sans-serif" font-size="${23+i*6}" font-weight="700">z</text>`, [[0,t(0,0)+opacity(0)],[12+i*14,t(0,0)+opacity(0)],[23+i*14,t(0,-20)+opacity(1)],[60+i*10,t(14,-68)+opacity(0)],[100,t(14,-68)+opacity(0)]]),x+i*21,y-i*13)).join('');

add('idle','待机','Idle','轻轻呼吸，眨眨眼，根号尾巴慢慢摇。','A quiet breath, a blink, and a gentle wag of the radical tail.',({pet})=>pet());
add('hello','挥爪问好','Hello','抬起前爪挥两下，再稳稳放回地面。','A front paw waves twice, then returns to the ground.',({pet,glints})=>pet()+glints(104,350));
add('walk','小步散步','Little steps','四条腿交替迈步，身体跟着轻轻起伏。','Alternating feet carry the little cube along with a soft bob.',({pet})=>pet());
add('double-jump','腾空翻跟头','Somersault','蹲下蓄力，腾空翻一圈，落地后举爪庆祝。','Crouch, turn a full somersault, then land and celebrate.',({pet,v})=>pet()+v(at(star(),98,290),18,55));
add('drag','被拎起来','Picked up','离开地面时四爪轻晃，尾巴也跟着摆。','All four feet dangle and sway when lifted.',({pet})=>pet());
add('annoyed','轻轻抗议','A little protest','左右摇摇身子，尾巴抖一下就原谅你。','A small wiggle and a tail flick, then all is forgiven.',({pet,v})=>pet()+v(at(line('M-14-14V0H0M14 14V0H0',red,8),109,328),15,48));
add('thinking','认真思考','Thinking','歪头看看冒出来的想法，根号尾巴也像在思考。','A head tilt follows a trail of floating ideas.',({pet,float})=>pet()+float(circle(0,0,8),132,283,5)+float(circle(0,0,14),107,246,8)+float(at(cloud,0,0,.67)+at(tile(red,36),0,-5),83,195));
add('typing','打字','Typing','前爪交替敲键盘，写完一行就停一下。','Two paws alternate at the keyboard, pausing between lines.',({pet,a})=>pet()+at(laptop,313,524)+a(line('M288 467H309',gold,5),[[0,opacity(1)],[48,opacity(1)],[50,opacity(0)],[98,opacity(0)]],undefined,'steps(1)'));
add('building','搭积木','Building blocks','把红蓝积木一层层叠好，最后轻轻扶正。','Red and blue blocks rise into a stack, then get a final gentle nudge.',({pet,a,grip})=>{
  // The hand releases each block at its final world position; it never drops
  // out of the sky. These beats and paw positions match the character plan.
  const blocks = [0,1,2].map(i => {
    const pickup = [0,30,50][i], placed = [23,43,63][i];
    const color = i % 2 ? red : blue;
    const held = a(tile(color,32/.73),[[0,opacity(pickup === 0 ? 1 : 0)],[pickup,opacity(1)],[placed,opacity(0)]],undefined,'steps(1,end)');
    const stacked = a(at(tile(color,32),...grip(placed)),[[0,opacity(0)],[placed-.001,opacity(0)],[placed,opacity(1)],[92,opacity(1)],[96,opacity(0)],[100,opacity(0)]]);
    return { held, stacked };
  });
  return pet({held:blocks.map(({held})=>({art:held}))})+blocks.map(({stacked})=>stacked).join('');
});
add('headphones','戴耳机','Headphones','戴上耳机点头打拍子，尾巴跟着音乐轻摆。','Headphones on, head bobbing, and the tail keeping time.',({pet,float})=>pet({extra:line('M-239-161Q-254-305-89-309 87-315 99-175',ink,22)+rect(-257,-196,39,87,ink,15)+rect(81,-191,39,87,ink,15)})+float(at(`<text fill="${gold}" font-size="57" font-family="serif">♪</text>`,0,0),90,265)+float(at(`<text fill="${pink}" font-size="47" font-family="serif">♫</text>`,0,0),520,390));
add('juggling','抛接方块','Juggling','三枚彩色方块轮流飞起，前爪忙得刚刚好。','Three colorful tiles arc between busy paws.',({pet,a,grip})=>pet()+[red,blue,gold].map((color,i)=>{
  const left = grip(0), right = grip(0,'R');
  const phase = i/3;
  const times = [...new Set([0,100,...Array.from({length:32},(_,step)=>((step/32-phase+1)%1)*100)])].sort((left,right)=>left-right);
  const frames = times.map(time=>{
    const cycle = time/100+phase, position = cycle%1;
    const outward = position<.5, flight = outward ? position*2 : (position-.5)*2;
    const from = outward ? left : right, to = outward ? right : left;
    const x = from[0]+(to[0]-from[0])*flight;
    const y = from[1]+(to[1]-from[1])*flight-4*280*flight*(1-flight);
    return [time,t(x,y,cycle*360)];
  });
  return a(tile(color,37),frames,undefined,'linear');
}).join(''));
add('sweeping','打扫桌面','Sweeping','挥动小扫帚，把灰尘扫成一颗小星星。','A tiny broom gathers dust into a little star.',({pet,v})=>pet({held:[{art:v(line('M0-65V170',cream,9)+at(p('M-21 7H21L36 54H-36Z',gold)+line('M-10 19-16 45M0 19V46M10 19 17 45',ink,3),0,160),0,73)}]})+v(at(star(),91,563,.55),55,90));
add('carrying','搬运方块','Special delivery','抱住一枚大方块，小心翼翼往前挪。','One oversized tile takes careful little steps to deliver.',({pet})=>pet({carried:at(tile(red,161),-42,-34)}));
add('debugger','捉虫侦探','Bug detective','放大镜追着小虫走，找到以后开心地抬爪。','A magnifier follows the bug, then a paw celebrates the discovery.',({pet,a})=>pet()+a(at(bug,87,551,.55),[[0,t(-25)],[35,t(18)],[60,t(-15)],[100,t(-25)]])+a(at(magnifier,99,459,.78),[[0,t(-15,0,-8)],[40,t(22,25,8)],[70,t(-12,0,-8)]],'99px 459px'));
add('wizard','根号魔法','Radical magic','小魔杖一挥，尾巴召来一串闪亮星星。','A tiny wand calls a trail of stars from the radical tail.',({pet,v,glints})=>pet({held:[{art:line('M0 20 0-94',cream,9)+at(star(),0,-99),angle:-25}]})+v(glints(514,203)+glints(571,298),25,78));
add('deep-thought','深度思考','Deep thought','几枚方块围着根号尾巴转，想法逐渐连起来。','Orbiting tiles connect into a new idea above the radical tail.',({pet,a})=>pet()+a(at(line('M-87 0 0-60 80 7 0 50Z',mint,3)+at(tile(blue,28),-87,0)+at(tile(red,28),0,-60)+at(tile(gold,28),80,7)+at(tile(mint,28),0,50),327,122),[[0,t(0,0,-5)],[50,t(0,0,10)]],'327px 122px'));
add('boss','小小老板','Tiny boss','戴墨镜敲键盘，写完以后自信地点点头。','Sunglasses, a keyboard, and a very confident nod.',({pet,a})=>pet({extra:rect(-228,-165,82,54,ink,14)+rect(9,-167,93,57,ink,14)+line('M-144-143H9',ink,11)+line('M-210-157-191-135M33-158 53-137',cream,4)})+at(laptop,313,524)+a(at(star(gold),114,274),[[0,t(0,0,0,.7)],[50,t(0,0,40,1.1)]],'114px 274px'));
add('happy','开心庆祝','Celebration','轻轻跳起来，彩纸在两边洒下。','A joyful hop under a shower of confetti.',({pet,a})=>pet()+[0,1,2,3,4,5,6,7].map(i=>a(at(rect(-5,-11,10,22,[red,blue,gold,pink][i%4],3),75+i*69,202+(i%3)*33),[[0,t(0,-30,i*17)+opacity(0)],[20,t(0,-30,i*17)+opacity(1)],[74,t(15,230,i*17+180)+opacity(1)],[90,t(20,260,i*17+220)+opacity(0)]],`${75+i*69}px ${202+(i%3)*33}px`)).join(''));
add('error','出错了','Oops','方块忽然裂开，根号兽一惊，又把它拼好。','A tile splits apart; a startled shuffle brings it back together.',({pet,a})=>pet()+at(a(p('M-32-32H3L-9-8 6 6-9 32H-32Z',red),[[0,t()],[28,t(-12,0,-12)],[58,t(-12,0,-12)],[80,t()]])+a(p('M9-32H32V32H-2L13 6-2-8Z',blue),[[0,t()],[28,t(12,0,12)],[58,t(12,0,12)],[80,t()]]),114,301));
add('notification','来消息啦','New message','小铃铛响了，根号兽立刻抬起头。','A bell rings and the little beast perks up.',({pet,a})=>pet()+at(a(p('M-27 16Q-20 1-20-14Q-20-42 0-42 21-42 21-14Q21 0 29 16Z',gold)+circle(0,26,8,gold)+line('M-44-19Q-55-4-43 11M45-19Q55-4 44 11',cream,5),[[0,t()],[17,t(0,0,-17)],[25,t(0,0,17)],[33,t(0,0,-17)],[41,t(0,0,17)],[55,t()]]),103,285));
add('reading','翻书','Reading','低头认真看书，用前爪轻轻翻过一页。','A careful reader turns a page with one small paw.',({pet,a})=>pet()+at(book,286,506)+a(at(p('M0-26Q43-50 83-22V51Q40 31 0 55Z',mint),286,506),[[0,t()],[33,t()],[49,t(0,0,0,-1,1)],[68,t(0,0,0,-1,1)],[90,t()]],'286px 506px'));
add('bubble','吹泡泡','Bubbles','吹出大小泡泡，用鼻尖轻轻碰一碰。','Small bubbles drift away from a curious nose.',({pet,a})=>pet()+[0,1,2].map(i=>a(at(`<circle r="${22+i*9}" fill="${mint}" fill-opacity=".24" stroke="${cream}" stroke-width="4"/>`+line('M-12-7Q-10-17 0-18',cream,3),118-i*24,438-i*49),[[0,t(15,25)+opacity(.15)],[40,t(-15,-25)+opacity(1)],[80,t(4,-90)+opacity(0)],[100,t(15,25)+opacity(.15)]])).join(''));
add('yawning','打哈欠','Yawn and stretch','眼皮慢慢垂下，前爪往前伸，尾巴向后舒展。','Sleepy eyes, paws stretched forward, and a long tail stretch.',({pet})=>pet());
add('dozing','打盹','Nodding off','眼睛半闭，脑袋一点一点，又努力坐稳。','Half-closed eyes and a head that keeps nodding off.',({pet})=>pet());
add('sleeping','睡个好觉','Sleeping','收起小爪子，身体随呼吸起伏，轻轻冒出呼噜。','Tucked paws, slow breathing, and drifting little snores.',s=>s.pet()+zzz(s));
add('waking','睡醒伸懒腰','Waking up','从小小一团舒展开来，抖抖尾巴迎接新一天。','Uncurl, stretch, and shake the radical tail for a new day.',({pet,glints,v})=>pet()+v(glints(125,274),30,78));
add('inspection','研究魔方','Exploring the cube','坐稳捧好魔方，转动顶层，认真看看颜色怎样变化。','Hold the cube steadily, turn the top layer, and study how the colors change.',({pet,a})=>pet()+at(turningCube(a,143,{alg:"R U F",beats:[[20,36],[53,69]]}),310,502));
add('cubing','练习复原','Solving practice','前爪忙着练习，打乱的魔方复原后闪一下。','Busy paws practice a solve; the finished cube gets a sparkle.',({pet,a,v,glints})=>{
  return pet()+at(turningCube(a,143,{alg:'U2',moves:["U'","U'"],beats:[[14,32],[40,58]]}),310,508)+v(glints(124,450),65,94);
});
add('timer','计时准备','Ready to time','双爪放好，绿灯亮起；抬爪后数字开始递增，结束时停表，再归零。','Paws down, green light on; lifting the paws starts the count, then the timer stops and resets.',({pet,a,v})=>{
  // Count real centiseconds from paws-off (47%) to the stop (81%), using the
  // same duration as the character. Digits remain seekable with the SVG.
  const finish = Math.round(durations.timer * (81 - 47));
  const digit = (place, x) => {
    const frames = [[0,t()]];
    let previous = 0;
    for (let tick = 1; tick <= finish; tick++) {
      const value = Math.floor(tick / place) % 10;
      if (value !== previous) frames.push([47 + tick / durations.timer,t(0,-30 * value)]);
      previous = value;
    }
    frames.push([96,t(0,-30 * previous)],[96.1,t()],[100,t()]);
    const strip = Array.from({length:10},(_,value)=>`<text x="${x}" y="${7 + value * 30}">${value}</text>`).join('');
    return `<g data-timer-digit="${place}">${a(strip,frames,undefined,'steps(1,end)')}</g>`;
  };
  const display = `<clipPath id="rb-timer-display"><rect x="-32" y="-11" width="64" height="23"/></clipPath><g data-timer-display="" clip-path="url(#rb-timer-display)" text-anchor="middle" fill="${ink}" font-family="monospace" font-size="21">${digit(100,-19)}<text x="-6" y="7">.</text>${digit(10,6)}${digit(1,19)}</g>`;
  return pet()+at(rect(-160,-17,320,36,ink,18)+rect(-61,-11,122,23,cream,5)+circle(-116,0,10,blue)+circle(116,0,10,blue)+display+v(circle(0,-33,8,mint),35,72),310,574);
});
add('personal-best','新纪录','Personal best','金色奖牌亮起来，根号兽开心地跳一下。','A golden medal lights up a proud little victory hop.',({pet,a,glints})=>pet()+at(a(p('M-33-84H-2L9-32-12-21Z',blue)+p('M7-84H36L13-18-10-34Z',red)+circle(0,0,38,gold)+at(star(cream),0,0,.85),[[0,t()],[26,t(0,-25,12)],[44,t(0,0,-8)],[70,t()]]),116,456)+glints(102,333));
add('pop','飞棱救援','Flying piece','魔方转动后飞出一枚棱块，赶紧扑过去救回来。','A turn ejects an edge piece, prompting a quick rescue.',({pet,a})=>pet()+at(turningCube(a,113,{alg:'R',moves:['U'],beats:[[5,18]],pop:[21,39,80],popVector:[-151,-188]}),294,511));
add('teaching','魔方小老师','Cube tutor','拿起教棒，配合顶层转动讲解一个小技巧。','Use a pointer to demonstrate a top-layer turning tip.',({pet,a})=>pet({held:[{art:line('M0 15 0-107',cream,8),angle:-24}]})+at(turningCube(a,121,{alg:"R U R'",beats:[[20,36],[52,68]]}),111,270)+at(line('M-26 0H26M12-13 26 0 12 13',gold,5),111,183));
add('bubblegum','泡泡糖','Bubblegum','泡泡越吹越大，啪地一下变成两颗小爱心。','A pink bubble grows, pops, and turns into two tiny hearts.',({pet,a,v})=>pet({extra:at(a(circle(0,0,100,pink)+line('M-50-28Q-39-60-12-67',cream,8),[[0,t(0,0,0,.04)+opacity(1)],[20,t(0,0,0,.4)+opacity(1)],[50,t(0,0,0,1.2)+opacity(1)],[56,t(0,0,0,1.25)+opacity(1)],[57,opacity(0)],[100,opacity(0)]]),-74,-112)})+v(at(heart,181,444,.6)+at(heart,314,452,.4),58,78));
add('fishing','钓一只小虫','Bug fishing','甩出小钓竿，没钓到鱼，却钓到调皮的小虫。','The little rod reels in a mischievous bug instead of a fish.',({pet})=>pet({held:[{art:line('M0 16-28-165',gold,9)+line('M-28-165Q-124-170-113-29',ink,4)+at(bug,-113,-10,.5)}]}));
add('skateboard','滑板出发','Skateboard ride','站稳滑板向前滑，拐弯时尾巴帮忙保持平衡。','A smooth ride with the radical tail balancing through a turn.',({pet,a})=>a(pet({y:484})+at(board,320,546),[[0,t(-38)],[50,t(38)],[100,t(-38)]]) );
add('box','箱子里探头','Box surprise','躲进快递箱，再慢慢探出头来看看你。','Hide in a parcel, then peek out to see who is there.',({pet,a})=>pet({scale:.58,y:469})+rect(162,427,317,142,gold,10)+p('M162 427 125 391H284L314 427ZM314 427 347 390H516L479 427Z',cream)+rect(295,427,33,142,cream,0)+a(at(heart,319,492,.8),[[0,t(0,0,0,.85)],[50,t(0,0,0,1.05)]],'319px 492px'));
add('soda','汽水打嗝','Soda hiccup','喝一口汽水，忍不住小小地打个嗝。','A sip of soda ends in one tiny surprise hiccup.',({pet,a,v})=>pet({held:[{art:a(cup,[[0,t()],[22,t(0,-15,-12)],[40,t(0,-15,-12)],[53,t()]])}]})+v(at(circle(0,0,9,mint),160,380)+at(circle(0,0,6,mint),177,348),49,74));
add('paper-plane','纸飞机','Paper plane','轻轻一推，纸飞机绕过根号尾巴飞回来。','A paper plane loops around the radical tail and comes back.',({pet,a})=>pet()+a(at(p('M-45 10 47-29 13 32-1 8Z',cream)+p('M-1 8 47-29-16 20Z',mint),102,407),[[0,t()],[20,t()],[40,t(185,-285,9)],[62,t(426,-99,56)],[83,t(68,-50,-20)],[100,t()]],'102px 407px'));
add('catch-star','接住星星','Catch a star','一颗星星慢慢落下，刚好落进小爪子里。','A falling star lands softly in a waiting paw.',({pet,a,glints,v,grip})=>{
  // The world-space fall meets the left paw at 50%, then stays attached as
  // the character brings the star in for a hug. Reset after it is hidden.
  const catchOffset = [0,-44], landing = grip(50,'L',catchOffset);
  const falling = a(at(star(gold),130,151,1.5),[[0,t(0,0,-15)],[10,t(0,-5,-8)],[18,t(0,0,-15),'ease-in'],[50,t(landing[0]-130,landing[1]-151,0)],[96,t(0,0,-15)],[100,t(0,0,-15)]],'130px 151px');
  const visibleFall = a(falling,[[0,opacity(1)],[49.999,opacity(1)],[50,opacity(0)],[96,opacity(0)],[100,opacity(1)]]);
  const held = a(at(star(gold),...catchOffset,1.5/.73),[[0,opacity(0)],[49.999,opacity(0)],[50,opacity(1)],[90,opacity(1)],[96,opacity(0)],[100,opacity(0)]]);
    return pet({held:[{art:held,inFront:true}]})+visibleFall+v(glints(83,361),50,69);
});
add('umbrella','撑伞听雨','Rainy day','撑起红白小伞，听雨点落在伞面上。','A red-and-white umbrella catches the gentle rain.',({pet,a})=>pet({held:[{art:at(umbrella,-32,-176,1.2)}]})+[0,1,2,3,4,5].map(i=>a(at(line('M0 0-6 19',mint,5),76+i*92,117+(i%2)*38),[[0,t()+opacity(0)],[15,t()+opacity(.8)],[80,t(-18,115)+opacity(0)],[100,t()+opacity(0)]])).join(''));
add('puddle','踩水坑','Puddle hop','轻轻跳进小水坑，溅出一圈圆圆的水花。','One small jump into a puddle makes a ring of round splashes.',({pet,a,v})=>`<ellipse cx="320" cy="570" rx="219" ry="23" fill="${mint}" fill-opacity=".5"/>`+pet()+[0,1,2,3,4].map(i=>v(a(at(circle(0,0,9-i*.8,mint),160+i*79,557),[[0,t()],[40,t()],[64,t((i-2)*26,-74+(i%2)*17)],[90,t((i-2)*39,4)]]),39,84)).join(''));
add('balloon','气球旅行','Balloon trip','抓住气球绳，四只小爪子慢慢离开地面。','Hold the balloon string and float up with dangling feet.',({pet})=>pet({held:[{art:line('M0 0Q-75-70-60-151',cream,3)+at(balloon,-60,-195)}]}));
add('popcorn','爆米花雨','Popcorn shower','等着爆米花出锅，第一颗把自己吓了一小跳。','Waiting for popcorn, the first pop prompts a tiny startled hop.',({pet,a})=>pet()+at(p('M-50-40H50L38 48H-38Z',red)+line('M-22-35-17 44M0-35V44M22-35 17 44',cream,12),122,517)+[0,1,2,3,4].map(i=>a(at(circle(-9,0,12,gold)+circle(8,0,12,gold)+circle(0,-10,12,cream),109+(i%2)*28,477),[[0,t()+opacity(0)],[20+i*6,t()+opacity(0)],[39+i*5,t((i-2)*29,-103-i*14)+opacity(1)],[76+i*3,t((i-2)*45,70)+opacity(0)],[100,opacity(0)]])).join(''));
add('butterfly','追蝴蝶','Butterfly chase','蹑手蹑脚追蝴蝶，蝴蝶又停到鼻尖附近。','Quiet little steps follow a butterfly that returns for a closer look.',({pet,a})=>pet()+at(a(butterfly,[[0,t(0,0,-14,1)],[13,t(0,0,4,.35,1)],[26,t(0,0,14,1)],[39,t(0,0,4,.35,1)],[52,t(0,0,-14,1)],[65,t(0,0,4,.35,1)],[78,t(0,0,14,1)],[91,t(0,0,4,.35,1)]]),106,351,.8)+a(at(butterfly,84,265,.47),[[0,t()],[30,t(79,-24)],[65,t(-8,79)],[100,t()]]));
add('paper-boat','纸船远航','Paper boat','折好的纸船从脚边出发，挥挥爪祝它一路顺风。','A folded paper boat sets sail past a waving paw.',({pet,a})=>line('M54 583Q103 567 152 583T348 583T568 583',mint,6)+pet()+a(at(p('M-68 0H68L39 34H-39ZM-41 0 0-52 42 0Z',cream)+p('M0-52V0H42Z',blue),129,555),[[0,t(-23)],[40,t(61,-5,3)],[70,t(270,0,-3)],[94,t(397,0)+opacity(0)],[100,t(-23)+opacity(0)]],'129px 555px'));
add('stretch','四爪伸展','Full stretch','前爪往前，后爪蹬稳，把自己拉成一小段桥。','Front paws reach forward while the back feet hold a full stretch.',({pet})=>pet());
add('sneak','悄悄靠近','Sneaking up','压低身子，放轻每一步，偷偷靠近一块小点心。','Stay low, place each foot carefully, and sneak toward a treat.',({pet})=>pet()+at(rect(-25,-18,50,36,gold,9)+circle(-9,-5,3,ink)+circle(10,7,3,ink),87,558));
add('dance','方块舞步','Cube shuffle','左右换重心，再用前爪打两个拍子。','Shift weight left and right, then tap out a little paw rhythm.',({pet,glints})=>pet()+glints(103,340)+glints(532,425));
add('portal','方块任意门','Cube portal','从发光的小门后探头，再一小步跨出来。','Peek through a glowing little doorway and step out.',({pet,a})=>rect(145,210,350,369,violet,92)+rect(158,223,324,343,ink,81)+a(pet({scale:.58,y:500}),[[0,t(0,32,0,.8)],[26,t(0,32,0,.8)],[60,t(0,4,0,1.1)],[84,t(0,4,0,1.1)],[100,t(0,32,0,.8)]],'320px 550px')+line('M173 462V299Q173 238 230 238',cream,6));
add('moon-hug','抱月亮晚安','Goodnight moon','抱住一弯月亮，闭上眼睛慢慢睡着。','Hug a crescent moon and drift gently into sleep.',s=>s.pet({carried:at(moon,-55,-40,1.8,-12)})+s.float(at(star(),0,0,.5),103,317,7)+zzz(s,494,323));
add('cube-pop','魔方 POP 了','Cube POP','刚转两下，棱块突然弹出！愣一下，伸爪接回去，再害羞地看你一眼。','Two quick turns eject an edge! Pause in surprise, catch it back into place, then share a sheepish look.',({pet,a})=>pet()+at(turningCube(a,150,{moves:['U',"U'"],beats:[[12,26],[30,42]],pop:[46,60,84],popVector:[-103,-20]}),314,508),.60);

if (scenes.length !== 51 || new Set(scenes.map(s => s.id)).size !== 51) throw Error('Exactly 51 distinct animations are required');
const xml = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const files = new Map();
const manifest = scenes.map(({id,zh,en,description,descriptionEn,draw,duration,poster},i) => {
  const { art, css } = stage(i + 1, duration, draw, id);
  const file = `${String(i+1).padStart(2,'0')}-${id}.svg`;
  const svg = `<!-- Generated by scripts/deskpet-rootbeast/build-rootbeast.mjs. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="320" height="320" role="img" aria-labelledby="rb-title rb-desc" data-rootbeast="${id}" data-duration="${duration}">
<title id="rb-title">${xml(zh+' / '+en)}</title><desc id="rb-desc">${xml(description+' '+descriptionEn)}</desc>
<defs>${defs}</defs>
<style>.rb-tail-outline use{stroke:${cream};stroke-width:10;stroke-linejoin:round;paint-order:stroke fill}
#rb-paw{overflow:visible}#rb-paw path:first-child{stroke:color-mix(in srgb, ${blue} 55%, ${ink});stroke-width:9;stroke-linejoin:round;paint-order:stroke fill}
${css}
@media(prefers-reduced-motion:reduce){g{animation-play-state:paused!important;animation-delay:-${poster*duration}s!important}}
</style>
<ellipse cx="320" cy="557" rx="194" ry="17" fill="${ink}" opacity=".12"/>
${art}</svg>\n`;
  files.set(file, svg);
  return {id,file,zh,en,description,descriptionEn,duration,poster};
});
files.set('manifest.json',JSON.stringify(manifest,null,2)+'\n');
if (process.argv.includes('--check')) {
  const stale = [...files].filter(([name,content])=>{try{return readFileSync(join(OUT,name),'utf8')!==content;}catch{return true;}}).map(([name])=>name);
  const extra = readdirSync(OUT).filter(name=>!files.has(name));
  if(stale.length || extra.length) throw Error(`Root Beast asset drift: ${[...stale,...extra].join(', ')}`);
  console.log('51 Root Beast animations and manifest are current.');
} else {
  mkdirSync(OUT,{recursive:true});
  for(const [name,content] of files) writeFileSync(join(OUT,name),content);
  console.log(`Built ${scenes.length} Root Beast animations (${[...files.values()].reduce((n,s)=>n+Buffer.byteLength(s),0)} bytes).`);
}
