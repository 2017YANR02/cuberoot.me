// Two miniature performances, drawn with the canonical Clawd stage. These
// pigments belong to the illustration, not to application surfaces.
export function registerBakeryKite({ add, r, p, l, at, t, o, star, skin, ink, cream, gold }) {
  add('nebula-bakery', '星云烘焙', 'Nebula bakery',
    '小烤炉把星星烤得蓬松，稳稳托出一盘蓝莓星云，香气也变成了星屑。',
    'A tiny oven puffs up a star, which is lifted out with blueberry icing and a fragrant trail of stardust.',
    ({ a, v, crab }) => {
      const brass = '#AA794D', brassLight = '#EDCA87', enamel = '#5E858E';
      const rim = '#BDD6CC', warm = '#F4BF6C', plum = '#8A7FB2';
      const defs = '<defs><linearGradient id="pt38-enamel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#B9DAD4"/><stop offset=".45" stop-color="#7CA8AA"/><stop offset="1" stop-color="#4D7783"/></linearGradient><linearGradient id="pt38-bread" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFE6A5"/><stop offset=".5" stop-color="#EDBD72"/><stop offset="1" stop-color="#B97A48"/></linearGradient><linearGradient id="pt38-icing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#CFCAE9"/><stop offset=".48" stop-color="#ABA8DE"/><stop offset="1" stop-color="#7773AA"/></linearGradient><radialGradient id="pt38-heat"><stop stop-color="#FFDC86" stop-opacity=".7"/><stop offset="1" stop-color="#D9914C" stop-opacity=".12"/></radialGradient></defs>';

      // A freestanding enamel oven: stepped feet, brass screws, individual
      // arch tiles, inset window and a separate lower door hinge.
      const arch = 'M17.15 14.4V7.2h.4V5.4h.75V4.2h1.1V3.5h3.2v.7h1.1v1.2h.75v1.8h.4v7.2z';
      const oven = p(arch, 'url(#pt38-enamel)')
        + r(17.15, 13.25, 7.7, 1.15, enamel)
        + r(17.4, 14.4, 1.05, .85, brass) + r(23.55, 14.4, 1.05, .85, brass)
        + l('M17.7 7.3V5.8h.75V4.6h1.1v-.6h2.9v.6h1.1v1.2h.75v1.5', rim, .24)
        + l('M19.2 4.7l.42.7m1.37-1.24v.9m1.37-.37l-.4.7', brassLight, .17)
        + p('M18.15 11.65V7.25h.45V6.2h.85v-.65h3.1v.65h.85v1.05h.45v4.4z', '#3D4C54')
        + p('M18.55 11.3V7.4h.4v-.85h4.1v.85h.4v3.9z', 'url(#pt38-heat)')
        + l('M18.35 10.9h5.3m-5.3.48h5.3', brass, .16)
        + r(18.3, 12.4, 3.1, .24, rim)
        + r(18.3, 12.9, 2.1, .17, '#456B76')
        + '<circle cx="23" cy="12.8" r=".74" fill="#E3C48C"/>'
        + '<circle cx="23" cy="12.8" r=".52" fill="#496B78"/>'
        + a(l('M23 12.8l-.05-.4', cream, .18), [[0,t()],[9,t()],[31,t(0,0,245)],[34,t(0,0,260)],[36,t(0,0,245)],[91,t(0,0,245)],[100,t()]], '23px 12.8px')
        + [17.65,24.35].map(x=>r(x,13.6,.2,.2,brassLight)).join('');

      const doorPose = [[0,t()],[34,t()],[43,t(0,0,0,1,-.47)],[91,t(0,0,0,1,-.47)],[100,t()]];
      const windowHole='M18.7 11.12V7.4h.48v-.75h3.64v.75h.48v3.72z';
      const door = p('M18 11.8V7.2h.5V6.05h.8v-.65h3.4v.65h.8V7.2h.5v4.6z'+windowHole, brass).replace('/>',' fill-rule="evenodd"/>')
        + p('M18.35 11.45V7.3h.5V6.4h.8v-.65h2.7v.65h.8v.9h.5v4.15z'+windowHole, '#C8C5A1').replace('/>',' fill-rule="evenodd"/>')
        + `<path d="${windowHole}" fill="#526B72" opacity=".32"/>`
        + l('M19.03 7.55v1.2m.45-1.55v.65', '#E3E2C5', .16)
        + r(18.85, 10.83, 4.3, .27, '#E7CA90')
        + r(19.45, 11.55, 3.1, .42, brassLight)
        + r(19.75, 11.65, 2.5, .2, brass);

      const pastryOutline = 'M0-2.7l.92 1.7 1.93.25-1.38 1.48.3 2.02L0 1.8l-1.77.95.3-2.02-1.38-1.48L-.92-1z';
      const pastry = at(p(pastryOutline, '#A97245'), 0, .3)
        + p(pastryOutline, 'url(#pt38-bread)')
        + at(p(pastryOutline, 'url(#pt38-icing)'), 0, -.28, .71)
        + l('M-1.35-.65l.38-.06M.15-1.6l.28.5m.65 1.9l.35.2', '#F2E9C6', .19)
        + r(-.46,-.53,.25,.25,cream) + r(.6,.15,.22,.22,gold)
        + r(-.72,.7,.2,.2,'#F4BEAA')
        + '<circle cx=".58" cy="-.78" r=".24" fill="#6F648E"/>'
        + '<circle cx=".54" cy="-.84" r=".07" fill="#C9CBEC"/>';
      const rising = a(pastry, [[0,t(0,2,0,.4,.25)],[10,t(0,2,0,.4,.25)],
        [28,t(0,1.25,0,.58,.58)],[44,t(0,1.25,0,.58,.58)],
        [59,t(0,-.06,0,1.02,1.04)],[64,t()],[87,t()],
        [95,t(0,1.25,0,.58,.58)],[99,t(0,2,0,.4,.25)],[100,t(0,2,0,.4,.25)]]);
      const liftAngles = [[0,0],[44,0],[49,-12],[59,-65],[63,-62],[79,-62],[86,-57],[95,0],[100,0]];
      const lifting = liftAngles.map(([n,angle])=>[n,t(0,0,angle)]);
      const level = liftAngles.map(([n,angle])=>[n,t(0,0,-angle)]);
      const peelHandle = l('M14 10H21', brass, .52) + l('M15.25 9.85H20.2', brassLight, .15)
        + r(14,9.68,1.45,.64,'#986C50') + r(14.2,9.66,.16,.66,'#D5AC79');
      const tray = p('M17.6 9.85h6.8v.55h-.5v.5h-5.8v-.5h-.5z', '#7D8B94')
        + r(17.6,9.8,6.8,.25,'#D2DBCF') + r(18.2,10.42,5.6,.16,'#A7B9B7');

      let aroma = '';
      for (let i=0;i<4;i++) {
        const begin=57+i*5.4, x=20.2+(i%2)*1.6;
        aroma += a(at(l('M0 0C-1-1.2 1-1.8.2-3S-.4-4.8.3-5.5', '#D6BA92', .25)
          + l('M0 0C-1-1.2 1-1.8.2-3S-.4-4.8.3-5.5', cream, .1),x,6.1),
          [[0,t()+o(0)],[begin,t(0,0,0,.7,.5)+o(0)],[begin+3,t(0,-.2,0,.85,.7)+o(.85)],
            [begin+8,t((i%2?1:-1)*.6,-1.9,0,1,1)+o(.48)],
            [begin+14,t((i%2?1:-1),-3.7,0,1.1,1.1)+o(0)],[100,t()+o(0)]], `${x}px 6.1px`);
      }
      let sugar = '';
      for (const [x,y,begin,scale] of [[18.6,6.4,61,.25],[23.8,5.6,65,.27],[21.4,3.6,70,.22]]) {
        sugar += a(at(star(cream),x,y,scale), [[0,t()+o(0)],[begin,t(0,.5,0,.4)+o(0)],
          [begin+2,t()+o(.95)],[begin+7,t(0,-1.3,20,.6)+o(.5)],[begin+11,t(0,-2,30,.2)+o(0)],[100,t()+o(0)]], `${x}px ${y}px`);
      }
      const peel = a(peelHandle + a(tray+at(rising,21,7)+aroma+sugar, level, '21px 10px'), lifting, '13px 10px');
      const done = v(a(l('M24.6 1.7l.65-.8m.2 2.2h1.1',brassLight,.25),
        [[0,o(0)],[32,o(0)],[34,o(1)],[39,o(0)],[100,o(0)]]),32,40);
      const cap = p('M4.5 5.9V4.7H3.7V3.5h.8V2.6h1.6v.45h1.1v-.8h1.7v.8H10V2.6h1.4v.9h.7v1.2h-.8v1.2z', '#F2E5C7')
        + r(4.5,5.3,6.8,.6,'#D7C4A1') + l('M5.6 3.3v1.2m2-1.6v1.6m2.1-1.2v1.2', '#D7C4A1', .16);
      const actor = crab([[0,t()],[18,t(0,.15)],[33,t()],[44,t()],[57,t(0,-.15)],
        [64,t()],[80,t()],[95,t()],[100,t()]], cap + peel, {
        right: lifting,
        left:[[0,t()],[34,t(0,0,10)],[45,t()],[63,t(0,0,24)],[78,t(0,0,24)],[92,t()],[100,t()]],
        eyes:[[0,t(.55,.2)],[28,t(.55,.2)],[35,t(.6,-.1)],[57,t(.7,-.7)],[82,t(.7,-.7)],[95,t(.55,.2)],[100,t(.55,.2)]],
        mood:'happy',moodAt:64,moodEnd:82,
      });
      // The glass sits in front of the oven contents. The level tray counter-
      // rotates inside the same peel hinge, so the pastry stays on its plate.
      return defs + oven + actor + a(door,doorPose,'21px 11.8px') + done;
    }, .72);

  add('aurora-kite', '极光风筝', 'Aurora kite',
    '一阵风把小风筝拉向极光，踉跄一下，收稳线轮，尾带在头顶慢慢展开。',
    'A gust tugs a silk kite toward the aurora. A little stumble, a steady reel, and ribbons unfurl overhead.',
    ({ a, v, crab }) => {
      const mint='#95D8C2', deep='#4E8D91', lilac='#AAA1D9', goldLine='#D8B579';
      const defs='<defs><linearGradient id="pt39-silk" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#DCF1D2"/><stop offset=".46" stop-color="#91D4C5"/><stop offset="1" stop-color="#5CA6B0"/></linearGradient><linearGradient id="pt39-violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#C7CEE9"/><stop offset="1" stop-color="#8B8EC6"/></linearGradient><linearGradient id="pt39-aurora" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#8CCDB9" stop-opacity="0"/><stop offset=".25" stop-color="#9EDDC3" stop-opacity=".65"/><stop offset=".64" stop-color="#A4ACE4" stop-opacity=".5"/><stop offset="1" stop-color="#A4ACE4" stop-opacity="0"/></linearGradient></defs>';

      // Motion is sampled from shared curves. The line is transformed from
      // its actual reel centre to the kite's bridle at every sample; there is
      // no independent rope motion which could detach from either endpoint.
      const bodyKeys=[[0,0,0,0],[20,0,0,-2],[28,.2,.15,0],[37,1.6,-.75,7],
        [44,1.25,.35,4],[54,-1.1,-.2,-7],[61,-1.1,0,-5],[72,0,0,0],[88,0,.1,1],[100,0,0,0]];
      const kiteKeys=[[0,15,-8,-10],[12,17,-10,-5],[25,13,-12,8],[37,20,-13,-14],
        [44,22,-10,12],[54,14,-13,-12],[63,9,-14,8],[74,12,-12,-4],[85,17,-11,7],[100,15,-8,-10]];
      const smooth=q=>q*q*(3-2*q), round=n=>Number(n.toFixed(5));
      const sample=(keys,n)=>{
        if(n===100)return keys.at(-1).slice(1);
        let j=0;while(keys[j+1][0]<=n)j++;
        const lo=keys[j],hi=keys[j+1],s=smooth((n-lo[0])/(hi[0]-lo[0]));
        return lo.slice(1).map((x,i)=>x+(hi[i+1]-x)*s);
      };
      const bodyFrames=[],kiteFrames=[],ropeFrames=[];
      for(let n=0;n<=100;n++) {
        const [bx,by,ba]=sample(bodyKeys,n),[kx,ky,ka]=sample(kiteKeys,n);
        const rad=ba*Math.PI/180,dx=14.4-7.5,dy=8.5-15;
        const hx=7.5+dx*Math.cos(rad)-dy*Math.sin(rad)+bx;
        const hy=15+dx*Math.sin(rad)+dy*Math.cos(rad)+by;
        const angle=Math.atan2(ky-hy,kx-hx)*180/Math.PI,length=Math.hypot(kx-hx,ky-hy);
        bodyFrames.push([n,t(round(bx),round(by),round(ba))]);
        kiteFrames.push([n,t(round(kx),round(ky),round(ka))]);
        ropeFrames.push([n,t(round(hx),round(hy),round(angle),round(length),1)]);
      }
      const aurora=a(p('M-10-11C-3-18 4-7 12-14S24-13 28-16v1.8c-5 5-9-1.3-16 2.7S-3-15.5-10-9.5z','url(#pt39-aurora)')
        + p('M-9-15C-2-19 5-11 13-17s12 0 15-1v.8c-6 3-9-3.2-15 1.8S-1-16.5-9-13.8z','url(#pt39-aurora)'),
        [[0,t()+o(.2)],[20,t(.3,-.3)+o(.42)],[39,t(-.45,.4)+o(.85)],[60,t(.4,-.25)+o(.6)],[82,t(-.2,.1)+o(.4)],[100,t()+o(.2)]]);
      const rope=a((l('M0 0H1',deep,.22)+l('M0 0H1',cream,.1)).replaceAll('stroke-linecap="square"','stroke-linecap="butt"'),ropeFrames,'0px 0px','linear');
      const bow=(x,y,color)=>at(p('M0 0l-1-.55v1.1zm0 0l1-.55v1.1z',color)+r(-.16,-.15,.32,.3,goldLine),x,y);
      const tailOne=[[0,t(0,0,-5)],[12,t(0,0,9)],[24,t(0,0,-8)],[37,t(0,0,15)],[47,t(0,0,-12)],[62,t(0,0,9)],[76,t(0,0,-7)],[90,t(0,0,6)],[100,t(0,0,-5)]];
      const tailTwo=[[0,t(0,0,8)],[15,t(0,0,-10)],[28,t(0,0,13)],[41,t(0,0,-15)],[53,t(0,0,12)],[67,t(0,0,-9)],[82,t(0,0,9)],[94,t(0,0,-4)],[100,t(0,0,8)]];
      const tailThree=[[0,t(0,0,-11)],[18,t(0,0,13)],[31,t(0,0,-15)],[44,t(0,0,17)],[57,t(0,0,-12)],[71,t(0,0,10)],[86,t(0,0,-7)],[100,t(0,0,-11)]];
      const endRibbon=a(l('M0 9.35Q.65 10.6-.05 11.65',mint,.28)+bow(.1,10.15,lilac),tailThree,'0px 9.35px');
      const middleRibbon=a(l('M0 6.9Q-.65 8.2 0 9.35',lilac,.29)+bow(-.15,8.05,mint)+endRibbon,tailTwo,'0px 6.9px');
      const ribbon=a(l('M0 4.35Q.65 5.65 0 6.9',mint,.29)+bow(.15,5.45,lilac)+middleRibbon,tailOne,'0px 4.35px');
      const kite = ribbon
        + p('M0-4.6L3.45-.65 0 4.4-3.45-.65z','url(#pt39-silk)')
        + p('M0-4.6L3.45-.65 0 0z','url(#pt39-violet)')
        + p('M-3.45-.65L0 0v4.4z','url(#pt39-violet)')
        + l('M0-4.6L3.45-.65 0 4.4-3.45-.65z',deep,.18)
        + l('M0-4.55v8.9M-3.4-.65L0 0l3.4-.65',goldLine,.15)
        + l('M-.4-3.3L-2.5-.8M.4 1.15v1.8',cream,.13)
        + p('M0-.58l.54.58L0 .58-.54 0z',cream)
        + r(-.14,-.14,.28,.28,goldLine);
      const reelBody='<circle cx="14.4" cy="8.5" r="1.12" fill="#98704C"/>'
        + '<circle cx="14.4" cy="8.5" r=".87" fill="#E5C58A"/>'
        + '<circle cx="14.4" cy="8.5" r=".58" fill="#A9CBC0"/>'
        + l('M13.64 8.5h1.52m-.76-.76v1.52', '#F0DCA7', .18)
        + '<circle cx="14.4" cy="8.5" r=".19" fill="#85634A"/>';
      const reel=a(reelBody,[[0,t()],[23,t()],[39,t(0,0,-120)],[50,t(0,0,-235)],
        [67,t(0,0,-170)],[86,t(0,0,-75)],[100,t()]],'14.4px 8.5px');
      const actor=crab([[0,t()]],l('M13.9 8.65L14.4 8.5',goldLine,.3)+reel,{
        right:[[0,t(0,-1,-22)]],
        left:[[0,t()],[25,t()],[36,t(0,-.6,42)],[43,t(0,-.4,20)],[54,t(0,-.4,-20)],
          [64,t(0,-.4,25)],[79,t()],[100,t()]],
        eyes:[[0,t(.5,-.65)],[25,t(.3,-.7)],[40,t(.8,-.7)],[54,t(.35,-.8)],
          [63,t(-.2,-.8)],[79,t(.4,-.7)],[91,t(.5,-.65)],[100,t(.5,-.65)]],
        mood:'happy',moodAt:66,moodEnd:81,
      });
      const gust=v(a(l('M-8 1q5-2.6 9-.8M-6 3q3.7-1.4 6.8-.4M18-4q3-1.5 5.7-.8',mint,.24),
        [[0,t()+o(0)],[26,t(-1,0)+o(0)],[31,t()+o(.8)],[40,t(1,-.2)+o(.7)],[46,t(2,-.4)+o(0)],[100,t()+o(0)]]),26,47);
      const sparkle=a(at(star(cream),-3.2,-9.7,.28),[[0,t()+o(.1)],[18,t()+o(.1)],[29,t(0,-.2)+o(.8)],
        [42,t(0,-.4)+o(.1)],[60,t(0,-.2)+o(.8)],[78,t()+o(.1)],[100,t()+o(.1)]],'-3.2px -9.7px');
      return defs+aurora+sparkle+gust+rope+a(actor,bodyFrames,'7.5px 15px','linear')+a(kite,kiteFrames,'0px 0px','linear');
    }, .69);
}
