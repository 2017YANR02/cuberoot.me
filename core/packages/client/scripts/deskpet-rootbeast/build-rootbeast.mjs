// node scripts/deskpet-rootbeast/build-rootbeast.mjs [--check]
// Source of the loops and their bilingual runtime/gallery manifest.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  puddle:2.6, balloon:3.6, popcorn:5.4, butterfly:2.8, 'paper-boat':3.2,
  stretch:3.6, sneak:3.2, dance:2.4, portal:3.2, 'moon-hug':4,
  'cube-pop':3.4,
};
const scenes = [];
const add = (id, zh, en, description, descriptionEn, draw, poster = .45) => {
  const duration = durations[id];
  if (!Number.isFinite(duration) || duration < 1 || duration > 6) throw Error(`Invalid duration for ${id}`);
  scenes.push({ id, zh, en, description, descriptionEn, draw, duration, poster });
};
const zzz = ({a}, x = 496, y = 339) => [0,1,2].map(i => at(a(`<text fill="${cream}" font-family="system-ui,sans-serif" font-size="${23+i*6}" font-weight="700">z</text>`, [[0,t(0,0)+opacity(0)],[12+i*14,t(0,0)+opacity(0)],[23+i*14,t(0,-20)+opacity(1)],[60+i*10,t(14,-68)+opacity(0)],[100,t(14,-68)+opacity(0)]]),x+i*21,y-i*13)).join('');

add('idle','待机','Idle','眨眨眼，看看四周，安静地陪着你。','Blink, look around, and keep you company.',({pet})=>pet());
add('hello','打招呼','Hello','挥挥爪，眨眨眼，跟你打个招呼。','Wave a paw and wink hello.',({pet,glints})=>pet()+glints(104,350));
add('walk','散步','A little walk','迈着小步走一走，偶尔回头看看你。','Take a little walk and glance back at you.',({pet})=>pet());
add('double-jump','翻跟头','Somersault','蹲一下，翻个跟头，落地后开心地举起爪子。','Crouch, turn a somersault, and raise the paws after landing.',({pet,v})=>pet()+v(at(star(),98,290),18,55));
add('drag','被拎起来','Picked up','突然被拎起来，晃晃爪子，看看是谁在捣乱。','Dangle the paws and look around to see who picked me up.',({pet})=>pet());
add('annoyed','不高兴了','Not amused','气鼓鼓地晃两下，瞪你一眼，过一会儿就消气了。','Give an indignant wiggle and a little glare, then calm down.',({pet,v})=>pet()+v(at(line('M-14-14V0H0M14 14V0H0',red,8),109,328),15,48));
add('thinking','想一想','Thinking','歪着脑袋想一想，忽然有了主意。','Tilt the head in thought, then perk up with an idea.',({pet,float})=>pet()+float(circle(0,0,8),132,283,5)+float(circle(0,0,14),107,246,8)+float(at(cloud,0,0,.67)+at(tile(red,36),0,-5),83,195));
add('typing','打字','Typing','两只爪子轮流敲键盘，写完了，抬头歇一会儿。','Tap the keyboard with both paws, then look up for a break.',({pet})=>pet()+at(laptop,313,524));
add('building','搭积木','Building blocks','一块一块叠起来，扶稳了，再满意地看看你。','Stack the blocks, steady them, and give you a pleased look.',({pet,a,grip})=>{
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
add('headphones','听音乐','Music time','戴上耳机，点点头，跟着音乐轻轻晃。','Put on headphones and sway along to the music.',({pet,float})=>pet({extra:line('M-239-161Q-254-305-89-309 87-315 99-175',ink,22)+rect(-257,-196,39,87,ink,15)+rect(81,-191,39,87,ink,15)})+float(at(`<text fill="${gold}" font-size="57" font-family="serif">♪</text>`,0,0),90,265)+float(at(`<text fill="${pink}" font-size="47" font-family="serif">♫</text>`,0,0),520,390));
add('juggling','抛接积木','Juggling blocks','三块积木轮流抛起来，眼睛紧紧盯着，可别掉了。','Toss three blocks and watch closely so none of them fall.',({pet,a,grip})=>pet()+[red,blue,gold].map((color,i)=>{
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
add('sweeping','打扫','Sweeping up','拿起小扫帚，把面前的灰尘扫干净。','Pick up a little broom and sweep away the dust.',({pet,v})=>pet({held:[{art:v(line('M0-65V170',cream,9)+at(p('M-21 7H21L36 54H-36Z',gold)+line('M-10 19-16 45M0 19V46M10 19 17 45',ink,3),0,160),0,73)}]})+v(at(star(),91,563,.55),55,90));
add('carrying','搬东西','Heavy lifting','抱紧大方块，小心挪过去，再稳稳放下。','Hold the big block close, shuffle over, and set it down.',({pet})=>pet({carried:at(tile(red,161),-42,-34)}));
add('debugger','找虫子','Bug hunt','拿着放大镜找一找，小虫子躲到哪里去了？','Look through the magnifier. Where did that little bug go?',({pet,a})=>pet()+a(at(bug,87,551,.55),[[0,t(-25)],[35,t(18)],[60,t(-15)],[100,t(-25)]])+a(at(magnifier,99,459,.78),[[0,t(-15,0,-8)],[40,t(22,25,8)],[70,t(-12,0,-8)]],'99px 459px'));
add('wizard','变魔术','A little magic','挥一挥魔杖，变出几颗闪亮的星星。','Wave a wand and conjure a few twinkling stars.',({pet,v,glints})=>pet({held:[{art:line('M0 20 0-94',cream,9)+at(star(),0,-99),angle:-25}]})+v(glints(514,203)+glints(571,298),25,78));
add('deep-thought','冥想','Meditating','闭上眼静一静，让脑袋里的想法慢慢理清。','Close the eyes for a quiet moment and let the thoughts settle.',({pet,a})=>pet()+a(at(line('M-87 0 0-60 80 7 0 50Z',mint,3)+at(tile(blue,28),-87,0)+at(tile(red,28),0,-60)+at(tile(gold,28),80,7)+at(tile(mint,28),0,50),327,122),[[0,t(0,0,-5)],[50,t(0,0,10)]],'327px 122px'));
add('boss','上班了','At work','戴上墨镜，敲敲键盘，今天也很有干劲。','Put on sunglasses and get to work at the keyboard.',({pet,a})=>pet({extra:rect(-228,-165,82,54,ink,14)+rect(9,-167,93,57,ink,14)+line('M-144-143H9',ink,11)+line('M-210-157-191-135M33-158 53-137',cream,4)})+at(laptop,313,524)+a(at(star(gold),114,274),[[0,t(0,0,0,.7)],[50,t(0,0,40,1.1)]],'114px 274px'));
add('happy','好开心','So happy','高兴得跳起来，彩纸纷纷落下。','Jump for joy as the confetti falls.',({pet,a})=>pet()+[0,1,2,3,4,5,6,7].map(i=>a(at(rect(-5,-11,10,22,[red,blue,gold,pink][i%4],3),75+i*69,202+(i%3)*33),[[0,t(0,-30,i*17)+opacity(0)],[20,t(0,-30,i*17)+opacity(1)],[74,t(15,230,i*17+180)+opacity(1)],[90,t(20,260,i*17+220)+opacity(0)]],`${75+i*69}px ${202+(i%3)*33}px`)).join(''));
add('error','出错了','Oops','吓了一跳，委屈一会儿，擦擦眼泪再试试。','Get startled, have a little cry, then dry the tears and try again.',({pet,a})=>pet()+at(a(p('M-32-32H3L-9-8 6 6-9 32H-32Z',red),[[0,t()],[28,t(-12,0,-12)],[58,t(-12,0,-12)],[80,t()]])+a(p('M9-32H32V32H-2L13 6-2-8Z',blue),[[0,t()],[28,t(12,0,12)],[58,t(12,0,12)],[80,t()]]),114,301));
add('notification','来消息了','New message','铃铛响了，赶紧抬头看看。','A bell rings. Look up and see what is new.',({pet,a})=>pet()+at(a(p('M-27 16Q-20 1-20-14Q-20-42 0-42 21-42 21-14Q21 0 29 16Z',gold)+circle(0,26,8,gold)+line('M-44-19Q-55-4-43 11M45-19Q55-4 44 11',cream,5),[[0,t()],[17,t(0,0,-17)],[25,t(0,0,17)],[33,t(0,0,-17)],[41,t(0,0,17)],[55,t()]]),103,285));
add('reading','看书','Reading','低头看书，轻轻翻过一页，看到有趣的地方笑了起来。','Read, turn a page, and smile at a good part.',({pet,a,grip})=>{
  const left=grip(0), right=grip(0,'R');
  const x=(left[0]+right[0])/2, y=(left[1]+right[1])/2-27;
  // The page rises behind the covers and folds around the spine toward the pet.
  const page=a(p('M0-14Q42-42 82-22L83-10Q43-26 0-3Z',cream)+line('M9-15Q43-31 73-20',mint,2),[[0,opacity(0)],[30,t()+opacity(0)],[33,t()+opacity(1)],[48,t(0,0,0,.06,2.2)+opacity(1)],[63,t(0,0,0,-1,1)+opacity(1)],[76,t(0,0,0,-1,1)+opacity(0)],[100,t()+opacity(0)]]);
  return pet()+at(page+book,x,y);
});
add('bubble','吹泡泡','Blowing bubbles','吹出几个泡泡，抬头看着它们飘远。','Blow a few bubbles and watch them drift away.',({pet,a})=>pet()+[0,1,2].map(i=>a(at(`<circle r="${22+i*9}" fill="${mint}" fill-opacity=".24" stroke="${cream}" stroke-width="4"/>`+line('M-12-7Q-10-17 0-18',cream,3),118-i*24,438-i*49),[[0,t(15,25)+opacity(.15)],[40,t(-15,-25)+opacity(1)],[80,t(4,-90)+opacity(0)],[100,t(15,25)+opacity(.15)]])).join(''));
add('yawning','打哈欠','Yawning','眼睛快睁不开了，打个大大的哈欠。','Struggle to keep the eyes open, then let out a big yawn.',({pet})=>pet());
add('dozing','打盹','Nodding off','脑袋一点一点，差点睡着，又赶紧坐好。','Nod off for a moment, then catch yourself and sit up.',({pet})=>pet());
add('sleeping','睡着了','Fast asleep','收好爪子，安安稳稳地睡一觉。','Tuck in the paws and settle into a peaceful sleep.',s=>s.pet()+zzz(s));
add('waking','睡醒了','Waking up','睡眼惺忪地伸个懒腰，再眯一小会儿。','Wake up with a sleepy stretch, then doze a little longer.',({pet,glints,v})=>pet()+v(glints(125,274),30,78));
add('inspection','琢磨魔方','Studying a cube','转两下魔方，仔细看看颜色是怎么变的。','Turn the cube a little and study how the colors move.',({pet,a})=>pet()+at(turningCube(a,143,{alg:"R U F",beats:[[20,36],[53,69]]}),310,502));
add('cubing','练魔方','Cube practice','认真拧几下，复原了，开心地举起爪子。','Make a few careful turns and celebrate a solved cube.',({pet,a,v,glints})=>{
  return pet()+at(turningCube(a,143,{alg:'U2',moves:["U'","U'"],beats:[[14,32],[40,58]]}),310,508)+v(glints(124,450),65,94);
});
add('timer','计时','On the timer','放好双爪，抬爪开始计时，拍下停表，再看看成绩。','Paws down, lift to start, tap to stop, then check the time.',({pet,a,v})=>{
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
  return pet()+at(rect(-160,-17,320,36,ink,18)+rect(-61,-11,122,23,cream,5)+circle(-116,0,10,blue)+circle(116,0,10,blue)+`<g data-prop-facing="pet" transform="rotate(180)">${display}</g>`+v(circle(0,-33,8,mint),35,72),310,574);
});
add('personal-best','破纪录了','A new personal best','拿到奖牌了，忍不住开心地跳一下。','Get a medal and celebrate with a happy little hop.',({pet,a,glints})=>pet()+at(a(p('M-33-84H-2L9-32-12-21Z',blue)+p('M7-84H36L13-18-10-34Z',red)+circle(0,0,38,gold)+at(star(cream),0,0,.85),[[0,t()],[26,t(0,-25,12)],[44,t(0,0,-8)],[70,t()]]),116,456)+glints(102,333));
add('pop','接住零件','Catch that piece','棱块飞出去了，赶紧扑过去接住。','An edge piece pops out. Quick, catch it!',({pet,a})=>pet()+at(turningCube(a,113,{alg:'R',moves:['U'],beats:[[5,18]],pop:[21,39,80],popVector:[-151,-188]}),294,511));
add('teaching','教你拧魔方','A cube lesson','拿起小教棒，指着魔方教你转一转。','Use a little pointer to show you a cube move.',({pet,a})=>pet({held:[{art:line('M0 15 0-107',cream,8),angle:-24}]})+at(turningCube(a,121,{alg:"R U R'",beats:[[20,36],[52,68]]}),111,270)+at(line('M-26 0H26M12-13 26 0 12 13',gold,5),111,183));
add('bubblegum','吹泡泡糖','Bubblegum','泡泡越吹越大，突然破了，自己也吓了一跳。','Blow a bigger and bigger bubble, then jump when it pops.',({pet,a,v})=>pet({extra:at(a(circle(0,0,100,pink)+line('M-50-28Q-39-60-12-67',cream,8),[[0,t(0,0,0,.04)+opacity(1)],[20,t(0,0,0,.4)+opacity(1)],[50,t(0,0,0,1.2)+opacity(1)],[56,t(0,0,0,1.25)+opacity(1)],[57,opacity(0)],[100,opacity(0)]]),-74,-112)})+v(at(heart,181,444,.6)+at(heart,314,452,.4),58,78));
add('fishing','钓鱼','Gone fishing','耐心等了一会儿，提竿一看，怎么钓到一只小虫？','Wait patiently and lift the rod. How did a bug get on the line?',({pet})=>pet({held:[{art:line('M0 16-28-165',gold,9)+line('M-28-165Q-124-170-113-29',ink,4)+at(bug,-113,-10,.5)}]}));
add('skateboard','玩滑板','Skateboarding','踩稳滑板，张开前爪，晃晃身子保持平衡。','Stand on the skateboard and spread the front paws for balance.',({pet,a})=>a(pet({y:484})+at(board,320,546),[[0,t(-38)],[50,t(38)],[100,t(-38)]]) );
add('box','躲猫猫','Peekaboo','躲进纸箱，悄悄探出脑袋看看你。','Hide in a box and peek out at you.',({pet,a})=>pet({scale:.58,y:469})+rect(162,427,317,142,gold,10)+p('M162 427 125 391H284L314 427ZM314 427 347 390H516L479 427Z',cream)+rect(295,427,33,142,cream,0)+a(at(heart,319,492,.8),[[0,t(0,0,0,.85)],[50,t(0,0,0,1.05)]],'319px 492px'));
add('soda','喝汽水','Soda break','喝一口汽水，突然打了个嗝，不好意思地笑了。','Sip some soda, hiccup, and give an embarrassed smile.',({pet,a,v})=>pet({held:[{art:a(cup,[[0,t()],[22,t(0,-15,-12)],[40,t(0,-15,-12)],[53,t()]])}]})+v(at(circle(0,0,9,mint),160,380)+at(circle(0,0,6,mint),177,348),49,74));
add('paper-plane','放纸飞机','Paper plane','放飞纸飞机，转过身，看它飞到哪里去。','Launch a paper plane and turn to watch where it goes.',({pet,a})=>pet()+a(at(p('M-45 10 47-29 13 32-1 8Z',cream)+p('M-1 8 47-29-16 20Z',mint),102,407),[[0,t()],[20,t()],[40,t(185,-285,9)],[62,t(426,-99,56)],[83,t(68,-50,-20)],[100,t()]],'102px 407px'));
add('catch-star','接星星','Catch a star','发现一颗落下的星星，伸爪接住，开心地抱好。','Spot a falling star, catch it, and hold it close.',({pet,a,glints,v,grip})=>{
  // The world-space fall meets the left paw at 50%, then stays attached as
  // the character brings the star in for a hug. Reset after it is hidden.
  const catchOffset = [0,-44], landing = grip(50,'L',catchOffset);
  const falling = a(at(star(gold),130,151,1.5),[[0,t(0,0,-15)],[10,t(0,-5,-8)],[18,t(0,0,-15),'ease-in'],[50,t(landing[0]-130,landing[1]-151,0)],[96,t(0,0,-15)],[100,t(0,0,-15)]],'130px 151px');
  const visibleFall = a(falling,[[0,opacity(1)],[49.999,opacity(1)],[50,opacity(0)],[96,opacity(0)],[100,opacity(1)]]);
  const held = a(at(star(gold),...catchOffset,1.5/.73),[[0,opacity(0)],[49.999,opacity(0)],[50,opacity(1)],[90,opacity(1)],[96,opacity(0)],[100,opacity(0)]]);
    return pet({held:[{art:held,inFront:true}]})+visibleFall+v(glints(83,361),50,69);
});
add('umbrella','撑伞','Under an umbrella','撑好小伞，听着雨声，慢慢放松下来。','Hold up an umbrella and relax to the sound of rain.',({pet,a})=>pet({held:[{art:at(umbrella,-32,-176,1.2)}]})+[0,1,2,3,4,5].map(i=>a(at(line('M0 0-6 19',mint,5),76+i*92,117+(i%2)*38),[[0,t()+opacity(0)],[15,t()+opacity(.8)],[80,t(-18,115)+opacity(0)],[100,t()+opacity(0)]])).join(''));
add('puddle','踩水坑','Puddle splash','往水坑里一跳，水花溅得到处都是。','Jump into a puddle and send the water splashing.',({pet,a,v})=>`<ellipse cx="320" cy="570" rx="219" ry="23" fill="${mint}" fill-opacity=".5"/>`+pet()+[0,1,2,3,4].map(i=>v(a(at(circle(0,0,9-i*.8,mint),160+i*79,557),[[0,t()],[40,t()],[64,t((i-2)*26,-74+(i%2)*17)],[90,t((i-2)*39,4)]]),39,84)).join(''));
add('balloon','抓住气球','Balloon ride','抓紧气球绳，飘起来了，低头看看地面。','Hold the balloon string, float up, and look down at the ground.',({pet})=>pet({held:[{art:line('M0 0Q-75-70-60-151',cream,3)+at(balloon,-60,-195)}]}));
add('popcorn','吃点心','Snack time','拿起饼干，一口一口吃掉，嚼一嚼，满足地咽下。','Pick up a biscuit, eat it bite by bite, chew, and swallow happily.',({pet,a,v})=>{
  // All three silhouettes share the same paw attachment. Bite marks replace
  // actual cookie geometry at mouth contact; the food never fades in midair.
  const biscuit = circle(0,-20,27,gold) + circle(-3,-23,22,cream)
    + circle(-3,-21,20,gold)
    + [[-11,-29],[8,-32],[-1,-15],[13,-16],[-12,-10]].map(([x,y])=>circle(x,y,3.4,ink)).join('');
  const masks = `<defs>
    <mask id="rb-biscuit-bite-1" maskUnits="userSpaceOnUse" x="-30" y="-50" width="60" height="65"><path fill="white" d="M-30-50H30V15H-30Z"/><path fill="black" d="M-30-50H30V-35Q22-25 14-29Q7-17 0-24Q-10-16-16-29Q-24-24-30-35Z"/></mask>
    <mask id="rb-biscuit-bite-2" maskUnits="userSpaceOnUse" x="-30" y="-50" width="60" height="65"><path fill="white" d="M-30-50H30V15H-30Z"/><path fill="black" d="M-30-50H30V-13Q19-4 12-10Q4 0-3-7Q-14 1-20-10L-30-8Z"/></mask>
  </defs>`;
  const portion = (art,start,end) => a(art,[[0,opacity(start===0?1:0)],...(start?[[start,opacity(1)]]:[]),[end,opacity(0)],[100,opacity(0)]],undefined,'steps(1,end)');
  const food = masks + portion(`<g data-food-portion="whole">${biscuit}</g>`,0,27)
    + portion(`<g data-food-portion="bitten" mask="url(#rb-biscuit-bite-1)">${biscuit}</g>`,27,54)
    + portion(`<g data-food-portion="last-bite" mask="url(#rb-biscuit-bite-2)">${biscuit}</g>`,54,78);
  const crumbs = [27,54,78].map((beat,i)=>at(a(circle(-5,0,2.5,gold)+circle(5,3,2,cream),[
    [0,opacity(0)],[beat-.01,t()+opacity(0)],[beat, t()+opacity(1)],[beat+5,t(-5+i*4,13,25)+opacity(1)],[beat+9,t(-8+i*5,23,40)+opacity(0)],[100,opacity(0)]]),293,452)).join('');
  // A bitten morsel travels down inside the mouth's own projection and is
  // occluded by its lower lip. It cannot float across the shell or the cheeks.
  const swallowed = `<defs><clipPath id="rb-food-mouth"><ellipse cx="0" cy="0" rx="22" ry="16"/></clipPath></defs>`
    + at(`<g clip-path="url(#rb-food-mouth)">${[27,54,78].map(beat=>a(
      `<g data-food-swallow="${beat}">${circle(-5,0,7,gold)+circle(4,-2,8,cream)+circle(2,1,5,gold)}</g>`,
      [[0,opacity(0)],[beat-.01,t(0,-5)+opacity(0)],[beat,t(0,-5)+opacity(1)],[beat+3,t(0,19,8,.6)+opacity(1)],
       [beat+3.1,t(0,23,8,.4)+opacity(0)],[100,opacity(0)]],undefined,'linear')).join('')}</g>`,-74,-112);
  return pet({extra:swallowed,held:[{bone:'L',art:food,inFront:true}]}) + crumbs
    + v(at(heart,425,326,.42),94,98);
},.24);
add('butterfly','追蝴蝶','Butterfly chase','跟着蝴蝶转来转去，怎么又飞到那边去了？','Follow a fluttering butterfly. Where is it going now?',({pet,a})=>pet()+at(a(butterfly,[[0,t(0,0,-14,1)],[13,t(0,0,4,.35,1)],[26,t(0,0,14,1)],[39,t(0,0,4,.35,1)],[52,t(0,0,-14,1)],[65,t(0,0,4,.35,1)],[78,t(0,0,14,1)],[91,t(0,0,4,.35,1)]]),106,351,.8)+a(at(butterfly,84,265,.47),[[0,t()],[30,t(79,-24)],[65,t(-8,79)],[100,t()]]));
add('paper-boat','放纸船','Paper boat','轻轻把纸船推下水，挥挥爪，看它慢慢漂远。','Push a paper boat onto the water and wave as it drifts away.',({pet,a})=>line('M54 583Q103 567 152 583T348 583T568 583',mint,6)+pet()+a(at(p('M-68 0H68L39 34H-39ZM-41 0 0-52 42 0Z',cream)+p('M0-52V0H42Z',blue),129,555),[[0,t(-23)],[40,t(61,-5,3)],[70,t(270,0,-3)],[94,t(397,0)+opacity(0)],[100,t(-23)+opacity(0)]],'129px 555px'));
add('stretch','伸懒腰','A good stretch','往前舒舒服服地伸一伸，再慢慢收好爪子。','Lean forward for a good stretch, then settle back down.',({pet})=>pet());
add('sneak','偷偷靠近','Sneaking up','悄悄靠近小点心，发现你在看，又装作没事。','Sneak toward a treat, notice you watching, and act innocent.',({pet})=>pet()+at(rect(-25,-18,50,36,gold,9)+circle(-9,-5,3,ink)+circle(10,7,3,ink),87,558));
add('dance','跳舞','A little dance','左右晃晃，踩着拍子，开心地跳支舞。','Sway from side to side and dance to the beat.',({pet,glints})=>pet()+glints(103,340)+glints(532,425));
add('portal','穿过小门','Through the doorway','从小门后探出头，好奇地看看，再走出来。','Peek through a little doorway, look around, and step outside.',({pet,a})=>rect(145,210,350,369,violet,92)+rect(158,223,324,343,ink,81)+a(pet({scale:.58,y:500}),[[0,t(0,32,0,.8)],[26,t(0,32,0,.8)],[60,t(0,4,0,1.1)],[84,t(0,4,0,1.1)],[100,t(0,32,0,.8)]],'320px 550px')+line('M173 462V299Q173 238 230 238',cream,6));
add('moon-hug','抱着月亮睡','Goodnight, moon','抱好月亮，闭上眼睛，慢慢睡着了。','Cuddle the moon, close the eyes, and drift off to sleep.',s=>s.pet({carried:at(moon,-55,-40,1.8,-12)})+s.float(at(star(),0,0,.5),103,317,7)+zzz(s,494,323));
add('cube-pop','魔方飞棱','Cube pop','刚拧两下，棱块就弹出来了，接回去后不好意思地看看你。','An edge pops out after two turns. Catch it and give you a sheepish look.',({pet,a})=>pet()+at(turningCube(a,150,{moves:['U',"U'"],beats:[[12,26],[30,42]],pop:[46,60,84],popVector:[-103,-20]}),314,508),.60);

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
