// Three quiet performances built from the canonical Clawd stage. All colours
// below are illustration pigments, not application interface surfaces.
export function registerVinylCampFan({ add, r, p, l, at, t, o, star, skin, ink, cream, gold }) {
  const ellipse = (x,y,rx,ry,c,opacity=1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${opacity}"/>`;
  const circle = (x,y,radius,c,opacity=1) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${c}" opacity="${opacity}"/>`;

  add('vinyl-afternoon', '唱片时光', 'Vinyl afternoon',
    '轻拨开关，唱针落在黑胶上。黄铜喇叭送出慢拍子，小脚也跟着轻轻点起来。',
    'A gentle switch, a needle on vinyl, and a brass horn playing a slow little rhythm for tapping feet.',
    ({ a, v, crab }) => {
      const brass='#B48951', light='#ECD49B', wood='#8F6551', mint='#8FAFA4', plum='#B1A2C4';
      const defs='<defs><linearGradient id="pt44-brass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FAE6AF"/><stop offset=".45" stop-color="#D9B36A"/><stop offset="1" stop-color="#A67945"/></linearGradient><linearGradient id="pt44-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#B38B6C"/><stop offset="1" stop-color="#775543"/></linearGradient><linearGradient id="pt44-horn" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6E5943"/><stop offset=".65" stop-color="#A37B4B"/><stop offset="1" stop-color="#D5B572"/></linearGradient></defs>';
      const base = r(16.8,10.3,9.1,4.3,'url(#pt44-wood)')
        + r(16.45,10.1,9.8,.6,'#C0A17A') + r(17.15,14.55,1.05,.95,wood) + r(24.6,14.55,1.05,.95,wood)
        + r(17.4,11.05,7.9,2.8,mint) + l('M18 11.6h6.7v1.7H18z','#D0D8BD',.17)
        + r(20.35,11.9,2,.95,'#C5C6A1') + r(20.85,12.2,1,.17,brass)
        + r(17.35,10.6,8,.15,'#D8BE92') + r(16.95,13.95,8.8,.2,'#6E4E41')
        + l('M15.1 10.1h2',wood,.52)
        + circle(15.05,10.1,.49,brass) + circle(15.05,10.1,.23,light);
      const disc = circle(0,0,4.25,'#303E43')
        + [3.72,3.28,2.86,2.42,1.98].map(rad=>`<circle cx="0" cy="0" r="${rad}" fill="none" stroke="#677577" stroke-width=".07"/>`).join('')
        + p('M-3.74-1.9A4.2 4.2 0 0 1-2.5-3.4L-.8-.9z','#66777B')
        + p('M3.74 1.9A4.2 4.2 0 0 1 2.5 3.4L.8.9z','#536569')
        + circle(0,0,1.32,'#D8B892') + circle(0,0,1.02,'#B57872')
        + l('M-.6-.2h1.2m-1 .35h.8',cream,.15) + circle(0,0,.17,light);
      // Rotate in the record's horizontal plane, then project that plane as
      // an ellipse. Whole turns reset at the identical visible orientation.
      const spin = [[0,t()],[18,t()],[25,t(0,0,40)],[36,t(0,0,220)],
        [49,t(0,0,440)],[62,t(0,0,660)],[75,t(0,0,885)],[86,t(0,0,1080)],
        [91,t(0,0,1080)],[91.001,t()],[100,t()]];
      const record = `<g transform="translate(21.25 9.95) scale(1 .29)">${a(disc,spin,'0px 0px','linear')}</g>`
        + l('M21.25 9.5v.55',light,.2);
      const arm = l('M25.1 8.65V7.25H22.4','#CFD6C5',.32)
        + l('M25.1 8.65V7.25H22.4',brass,.12)
        + p('M22.05 6.95h.8v.7h-.8z',wood) + r(22.25,7.58,.13,.31,ink);
      const tonearm=a(arm,[[0,t()],[10,t()],[19,t(0,0,-55)],[82,t(0,0,-55)],[92,t()],[100,t()]],'25.1px 8.65px');
      const horn = p('M23.6 10.2V7.4q0-2.1-1.9-3.6l-3.4-3.2 1.2-1.3 3.3 3.2q2.4 2 2.4 4.9v2.8z','url(#pt44-brass)')
        + l('M24 9.8V7.35q0-2.2-2.2-3.95',light,.2)
        + p('M22 3.1L18.4-1 15.7-6.6l-5.9 4.9 5.5 3 5 3.1z','url(#pt44-brass)')
        + p('M21.5 3.45L15.8-.1 10-1.7l5.3 3 5 3.1z','#BD945C')
        + l('M20.65 2.1L16.5-2.2M20.9 3.25L13.2-.55',light,.17)
        + p('M15.7-6.6C13-7.3 9.3-4.1 9.8-1.7c.7 2.5 5 .1 7-1.8 1.3-1.3.5-2.7-1.1-3.1z',brass)
        + p('M15.4-6.08C13.2-6.5 10-3.8 10.36-1.9c.6 1.75 4.15-.12 5.93-1.92 1.03-1.04.38-2.07-.89-2.26z','url(#pt44-horn)')
        + l('M11.1-2.7q.4-1.4 2.2-2.35',light,.21);
      const note = (color) => ellipse(0,0,.6,.38,color)+l('M.48 0v-2.65l1.25.4',color,.3);
      let music='';
      for(const [begin,x,y,dx,color] of [[26,12,-4,-8,mint],[38,14,-3,-2,plum],[50,11.5,-3.6,-7,light],[63,13,-3,-1,mint]]) {
        music += a(at(note(color),x,y,.67),[[0,t()+o(0)],[begin,t()+o(0)],
          [begin+4,t(-.7,-1.4,-7)+o(.85)],[begin+14,t(dx*.6,-5.5,8)+o(.8)],
          [begin+23,t(dx,-8.5,-12)+o(0)],[100,t()+o(0)]],`${x}px ${y}px`);
      }
      const waves=a(l('M8.2-3.5q-1.5 1.4-1.2 3M6.2-4.7q-2.3 2-1.8 4.5',mint,.23),
        [[0,o(0)],[22,o(0)],[30,o(.55)],[39,o(.13)],[48,o(.55)],[57,o(.13)],[66,o(.55)],[77,o(.15)],[88,o(0)],[100,o(0)]]);
      const dance=[[0,t()],[17,t()],[28,t(0,-.1,-4)],[36,t(0,.2,4)],
        [44,t(0,-.1,-4)],[52,t(0,.2,4)],[60,t(0,-.1,-4)],[68,t(0,.2,4)],[76,t(0,-.1,-3)],[88,t()],[100,t()]];
      const actor=crab(dance,'',{
        right:[[0,t()],[9,t(0,0,11)],[16,t(0,0,-15)],[22,t()],[33,t(0,0,-18)],[44,t(0,0,8)],[56,t(0,0,-18)],[68,t(0,0,8)],[83,t()],[100,t()]],
        left:[[0,t()],[23,t()],[34,t(0,0,28)],[44,t(0,0,-12)],[56,t(0,0,28)],[68,t(0,0,-12)],[83,t()],[100,t()]],
        eyes:[[0,t(.5,0)],[20,t(.5,0)],[30,t(.3,-.45)],[80,t(.3,-.45)],[92,t(.5,0)],[100,t(.5,0)]],
        mood:'happy',moodAt:47,moodEnd:78,
      });
      return defs+base+record+tonearm+circle(25.1,8.65,.35,brass)+horn+waves+music+actor;
    }, .64);

  add('campfire-treat', '篝火棉花糖', 'Campfire treat',
    '守着小篝火，把棉花糖烤出金边。举起来吹凉，尝一口，再把下一颗移到火边。',
    'Toast a marshmallow to a golden edge, lift it to cool, take a tiny bite, then slide the next one toward the fire.',
    ({ a, v, crab }) => {
      const cedar='#8D6B50', twig='#BB9564', mint='#86A99A', amber='#E7AD61', pale='#F5E8C9';
      const defs='<defs><linearGradient id="pt45-canvas" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#B7C4A3"/><stop offset="1" stop-color="#72928B"/></linearGradient><linearGradient id="pt45-toast" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFF0CD"/><stop offset=".55" stop-color="#EDD2A0"/><stop offset="1" stop-color="#C58D52"/></linearGradient><radialGradient id="pt45-warm"><stop stop-color="#EFC684" stop-opacity=".24"/><stop offset="1" stop-color="#EFC684" stop-opacity="0"/></radialGradient></defs>';
      const tent = p('M-11.6 14.4L-6.5 4.5-.5 14.4z','url(#pt45-canvas)')
        + p('M-6.5 4.5L-1.45 14.4H1.1L-3.45 5.15z','#A8B99B')
        + p('M-6.5 5.65L-9.9 14.4h7z','#426C69')
        + p('M-6.5 5.65v8.75H-3z','#3C5E5A')
        + l('M-6.5 4.45v9.95M-11.6 14.45H1.1',pale,.18)
        + l('M-10 14.1l-1.1 1.2M-.6 14l1.5 1.3',cedar,.16)
        + r(-11.3,15.1,.5,.45,cedar)+r(.6,15.15,.5,.4,cedar)
        + r(-8.8,14.5,5.8,.35,'#5D7C70');
      const rolledBlanket = r(-8.8,13.6,4.7,1.1,'#C6AF92')+ellipse(-8.8,14.15,.57,.55,'#B3947A')
        + ellipse(-8.8,14.15,.33,.32,'#DEC8A3')+l('M-7.1 13.6v1.1m1.7-1.1v1.1',cedar,.24);
      const rocks = [-3,-1.6,0,1.6,3].map((x,i)=>at(p('M-.75 0l.3-.7 1.05-.15.55.7-.35.55H-.6z',['#78918B','#A5B5A1','#8CA298'][i%3]),20+x,15.5+(i%2)*.25)).join('');
      const logs = at(r(-3.1,-.35,6.2,.7,cedar)+l('M-2.5-.1h5',twig,.14)+ellipse(3.1,0,.4,.36,twig)+ellipse(3.1,0,.22,.2,cedar),20,14.9,1,16)
        + at(r(-2.7,-.35,5.4,.7,'#745847')+l('M-2.4-.1h4.7','#B28C61',.13)+ellipse(2.7,0,.4,.36,twig),20,14.9,1,-18);
      const fireShape='M0 0C-3-.4-2.1-2.9-1.1-3.6c-.5 1.1.2 1.6.55 1.5C.8-2.8-.2-4.35.75-5.15c-.25 1.4 2.5 2.5 2.2 4C2.75-.15 1.1.2 0 0z';
      const fireA=a(at(p(fireShape,'#DA9763'),19.8,14.8),[[0,t()],[9,t(.05,0,3,1.03,.91)],[19,t(-.1,0,-3,.92,1.04)],[30,t(.1,0,3,1.05,.94)],[43,t(-.08,0,-2,.94,1.05)],[56,t(.12,0,2,1.04,.92)],[69,t(-.08,0,-3,.96,1.02)],[82,t(.05,0,3,1.02,.94)],[100,t()]],'20px 14.8px');
      const fireB=a(at(p('M0 0C-1.8-.2-1.5-2.2-.55-3.2c-.15 1.1.8 1.2.8.7.7.8 1.5 1.1 1.3 1.7C1.45-.15.8.1 0 0z','#F1BF72'),20.2,14.7),[[0,t()],[13,t(-.1,0,-3,.95,1.08)],[26,t(.1,0,3,1.03,.92)],[39,t(-.1,0,-3,.95,1.05)],[52,t(.1,0,3,1.04,.95)],[67,t(-.1,0,-2,.96,1.06)],[83,t(.1,0,2,1.02,.93)],[100,t()]],'20px 14.7px');
      const glow=a(ellipse(20,12.7,5.5,4.2,'url(#pt45-warm)'),[[0,o(.65)],[20,o(.88)],[40,o(.64)],[60,o(.86)],[80,o(.66)],[100,o(.65)]]);
      let sparks='';
      for(let i=0;i<4;i++) {
        const begin=7+i*19,x=19.5+(i%2)*1.1;
        sparks+=a(r(x,11.8,.18,.32,amber),[[0,t()+o(0)],[begin,t()+o(0)],[begin+3,t(.15,-.3)+o(.65)],[begin+10,t(i%2?.9:-.7,-2.7,25)+o(.55)],[begin+17,t(i%2?1.4:-1.1,-4.8,55)+o(0)],[100,t()+o(0)]],`${x}px 11.8px`);
      }
      const handKeys=[[0,0],[35,0],[44,-18],[53,-30],[61,-105],[68,-190],[75,-190],[87,-24],[94,0],[100,0]];
      const hand=handKeys.map(([n,angle])=>[n,t(0,0,angle)]);
      const sweetShape='M-1.05-1.05h2.1l.3.35v1.4l-.3.35h-2.1l-.3-.35v-1.4z';
      const marshmallow=p(sweetShape,pale)+l('M-.75-.78H.75',cream,.18)+p('M-.98.65h1.96l-.18.35h-1.6z','#D8C7A4');
      const golden=p(sweetShape,'url(#pt45-toast)')+l('M-.75-.78H.7',cream,.18)
        + r(-.8,.3,.21,.18,'#B9824D')+r(.3,.55,.22,.14,'#B9824D');
      const toasted=a(golden,[[0,o(0)],[12,o(0)],[34,o(1)],[70,o(1)],[72,o(0)],[100,o(0)]]);
      const front=a(at(marshmallow+toasted,19,10),[[0,t()+o(1)],[68,t()+o(1)],[71,t(-.1,0,0,.85)+o(1)],
        [73,t(-.2,0,0,.1)+o(0)],[93.99,t()+o(0)],[94,t()+o(1)],[100,t()+o(1)]],'19px 10px');
      // A second marshmallow moves along the same skewer after the bite;
      // its handoff to the next cycle happens at identical position/colour.
      const spare=a(at(marshmallow,16.1,10),[[0,t()+o(0)],[5,t(-1.3,0,0,.7)+o(0)],[12,t()+o(1)],
        [76,t()+o(1)],[91,t(2.9,0)+o(1)],[93.99,t(2.9,0)+o(1)],[94,t(2.9,0)+o(0)],[100,t()+o(0)]],'16.1px 10px');
      const skewer = l('M13.5 10H20.4',twig,.23)+l('M13.5 9.97H19.6',pale,.07)+front+spare;
      const blow=a(l('M12.6 8.2q1.3-1 2.4-.9m-2.9 2.2q1.45-.7 2.5-.5','#B4C3B7',.17),
        [[0,t()+o(0)],[45,t()+o(0)],[49,t(.2,-.1)+o(.6)],[54,t(.7,-.4)+o(.4)],[58,t(1.1,-.6)+o(0)],[100,t()+o(0)]]);
      const mouth=v(r(7.05,10.9,.9,.42,ink),67,75);
      const crumbs=v(a(r(7.2,11.2,.2,.2,amber)+r(8,11.1,.17,.17,pale),[[0,t()+o(0)],[71,t()+o(1)],[76,t(.2,2)+o(0)],[100,t()+o(0)]]),71,77);
      const actor=crab([[0,t()],[31,t(0,.1)],[43,t()],[53,t(.2,0,2)],[61,t()],[77,t(0,-.15)],[88,t()],[100,t()]],
        a(skewer,hand,'13px 10px')+blow+mouth+crumbs,{
          right:hand,
          left:[[0,t()],[36,t(0,0,6)],[47,t(0,0,24)],[60,t()],[75,t(0,0,28)],[86,t()],[100,t()]],
          eyes:[[0,t(.5,.3)],[35,t(.5,.3)],[52,t(.6,-.5)],[61,t(.2,-.8)],[68,t(0,.4)],[76,t()],[91,t(.5,.3)],[100,t(.5,.3)]],
          mood:'happy',moodAt:76,moodEnd:87,
        });
      return defs+tent+rolledBlanket+glow+rocks+logs+fireA+fireB+sparks+actor;
    }, .50);

  add('springtime-fan', '春风折扇', 'Springtime fan',
    '把樱花折扇一片片打开，扇来一阵轻风。花瓣停在头顶，再随下一阵风轻轻飞走。',
    'A blossom fan opens rib by rib. A petal settles on the head, then drifts away on the next gentle breeze.',
    ({ a, v, crab }) => {
      const cedar='#936B56', bamboo='#BA9866', rose='#DEA8AD', blush='#E9C4BF', sage='#92AAA0';
      const defs='<defs><linearGradient id="pt46-paper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#E9BFC0"/><stop offset=".43" stop-color="#F4DFD1"/><stop offset="1" stop-color="#E9D4B0"/></linearGradient></defs>';
      const flower=(color=blush)=>p('M0-.35C-1.15-2.35-2.2-.95-1.05.05c-2.05.25-1.85 1.8-.25 1.35.1 1.95 1.6 1.95 1.55.1 1.7.75 2.25-.7.55-1.25 1.5-1.2.4-2.35-.8-.6z',color)+circle(0,.35,.22,'#D5AF6D');
      const branch=l('M-10 14Q-9 6-6-1T1-10M-6.5.3Q-7-5-8.5-7.7M-4.5-3.5Q.5-5.3 5.8-4.6M-2.5-6.4Q1-8 6.4-9.5',cedar,.55)
        + l('M-9.65 13.6Q-8.55 6.4-5.8-.65T1.1-9.7','#BC9577',.17)
        + [[-8.3,-7.6,.7],[-7,-4.3,.5],[-2.4,-6.6,.8],[.7,-10,.7],[3.6,-8.7,.55],[6.25,-9.4,.7],[5.8,-4.65,.65],[1.4,-4.8,.48]].map(([x,y,s])=>at(flower(),x,y,s)).join('')
        + p('M-4.8-3.6q-1.3-1.7-2.2-1.2.15 1.7 2.2 1.2M2.9-8.4q1.7-1.2 2.1-.5-.6 1.4-2.1.5',sage);
      const sway=a(branch,[[0,t(0,0,-.6)],[25,t(0,0,.8)],[50,t(0,0,-.6)],[74,t(0,0,.8)],[100,t(0,0,-.6)]],'-10px 14px');
      const waveKeys=[[0,-8],[14,-12],[36,-10],[44,4],[52,-14],[60,4],[68,-10],[78,-6],[91,-8],[100,-8]];
      // Lift the grip two units along the torso edge. The complete fan and
      // the canonical arm share this pose, keeping the paper above the eyes.
      const wave=waveKeys.map(([n,angle])=>[n,t(0,-2,angle)]);
      let leaves='';
      for(let j=0;j<9;j++) {
        const target=-48+j*12, folded=6+j*.42;
        const sector=p('M-.18-1.4L-1.14-8.18Q0-8.35 1.14-8.18L.18-1.4z','url(#pt46-paper)')
          + l('M-1.12-8.18Q0-8.34 1.12-8.18','#BC9A72',.14)
          + l('M0-.3V-8.35',bamboo,.14)
          + (j%2===0?at(flower(j%4===0?'#CF919D':'#DCAEB2'),.14,-5.8,.31):l('M-.12-4.8q.5-1.25.2-1.9m-.1 1.3l-.4-.4',rose,.11));
        leaves+=a(sector,[[0,t(0,0,folded)],[17+j*.7,t(0,0,folded)],
          [34+j*.7,t(0,0,target)],[80+j*.18,t(0,0,target)],[96+j*.18,t(0,0,folded)],[100,t(0,0,folded)]],'0px 0px');
      }
      const fan=at(leaves+circle(0,0,.29,bamboo)+circle(0,0,.12,cream),14.25,9.9)
        + l('M13.8 10L14.25 9.9',bamboo,.28);
      const tassel=a(l('M14.25 10.2q.3 1.5.05 2.8',cedar,.14)
        + circle(14.3,12.9,.23,bamboo)+p('M14.1 13.1h.4l.36 1.5h-1.1z',rose)
        + l('M14.16 13.3v1m.3-1v1','#F0CFC3',.1),
        [[0,t(0,0,2)],[23,t(0,0,-4)],[38,t(0,0,9)],[47,t(0,0,-10)],[56,t(0,0,9)],[66,t(0,0,-8)],[79,t(0,0,5)],[92,t(0,0,-3)],[100,t(0,0,2)]],'14.25px 10.2px');
      const petal = p('M0-.65C1.35-.95 1.5.5 0 1.1-.8.2-.55-.4 0-.65z',rose)
        + l('M0-.25L.18.55','#F5DAD0',.12);
      const landingPetal=a(petal,[[0,t(5.8,-5,0,.7)+o(0)],[22,t(5.8,-5,0,.7)+o(0)],
        [27,t(6.5,-4.8,-20,.7)+o(.95)],[38,t(12,-2.6,45,.7)+o(.95)],
        [49,t(9,1.8,-35,.7)+o(.95)],[60,t(7.9,5.25,68,.7)+o(.95)],
        [74,t(7.9,5.25,68,.7)+o(.95)],[82,t(15.2,-.6,130,.7)+o(.85)],
        [92,t(23,-6.8,195,.65)+o(0)],[100,t(5.8,-5,0,.7)+o(0)]]);
      let drifting='';
      for(const [begin,x,y,dx] of [[29,-7.8,-7.5,6],[42,1,-9.7,11],[53,-2.6,-6.8,-2]]) {
        drifting+=a(petal,[[0,t(x,y,0,.45)+o(0)],[begin,t(x,y,0,.45)+o(0)],
          [begin+3,t(x+.5,y+.3,20,.45)+o(.75)],[begin+14,t(x+dx*.5,y+5,90,.4)+o(.75)],
          [begin+27,t(x+dx,y+12,165,.45)+o(0)],[100,t(x,y,0,.45)+o(0)]]);
      }
      const breeze=a(l('M17.3-1.2q4.7-.5 7.8-2.3M18.8.5q3.1-.25 5.6-1.2',sage,.17),
        [[0,o(0)],[35,o(0)],[43,o(.5)],[51,o(.12)],[60,o(.5)],[70,o(.05)],[78,o(.4)],[86,o(0)],[100,o(0)]]);
      const actor=crab([[0,t()]],a(fan+tassel,wave,'13px 10px'),{
        right:wave,
        left:[[0,t()],[52,t()],[61,t(0,0,20)],[69,t(0,0,34)],[78,t(0,0,14)],[90,t()],[100,t()]],
        eyes:[[0,t(.35,-.55)],[38,t(.35,-.55)],[51,t(.15,-.8)],[75,t(.15,-.8)],[87,t(.55,-.6)],[100,t(.35,-.55)]],
        mood:'happy',moodAt:64,moodEnd:79,
      });
      return defs+sway+drifting+breeze+actor+landingPetal;
    }, .68);
}
