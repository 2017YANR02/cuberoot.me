// Three miniature stories built from the canonical Clawd geometry.
// Fixed pigments are illustration colours, independent of application surfaces.
export function registerCoralClockDandelion({ add, r, p, l, at, t, o, star, skin, ink, cream, gold }) {
  const brass = '#B98753', brassLight = '#E5C28A', brassDark = '#775A42';
  const mint = '#A2D8CD', teal = '#5D9B9F', tealDark = '#3E727D';
  const paper = '#F6EDD4', sage = '#8CA484', sageDark = '#5E836E';

  add('coral-diver', '珊瑚潜水员', 'Coral diver',
    '戴好铜边潜水头盔，俯身看看缓缓打开的贝壳。珍珠升起一圈柔光，气泡带着惊喜向上飘去。',
    'A copper-rimmed diving helmet, a curious bow, and a shell opening slowly. A pearl rises in soft light as bubbles carry the surprise upward.',
    ({ a, v, crab }) => {
      const defs = '<defs><linearGradient id="pt41-copper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E8CAA0"/><stop offset=".36" stop-color="#C59562"/><stop offset="1" stop-color="#8B674A"/></linearGradient><linearGradient id="pt41-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#AEE0D9" stop-opacity=".12"/><stop offset=".55" stop-color="#B9E7E0" stop-opacity=".02"/><stop offset="1" stop-color="#6AABBD" stop-opacity=".12"/></linearGradient><linearGradient id="pt41-shell" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#E3D9F1"/><stop offset=".45" stop-color="#BEAED2"/><stop offset="1" stop-color="#827DAD"/></linearGradient><radialGradient id="pt41-pearl" cx=".32" cy=".26"><stop stop-color="#FFF9E6"/><stop offset=".48" stop-color="#F3E6DF"/><stop offset=".8" stop-color="#C9D9E6"/><stop offset="1" stop-color="#A3BFC7"/></radialGradient><radialGradient id="pt41-halo"><stop stop-color="#ECEAD4" stop-opacity=".3"/><stop offset="1" stop-color="#C2E4D9" stop-opacity="0"/></radialGradient></defs>';
      const sand = p('M-8.2 15.8l3.2-.8 3.5.4 4.1-.25 5 .3 5.3-.1 5.7.4 4.9-.1 1.3.8-2.5.65H-6.5z', '#D1CEC0')
        + l('M-6.3 16h2.3m2.2.4H1m15.5.1h2.2m1.4-.4h2.1', '#ECE7CF', .18)
        + r(-4.5,15.2,.4,.25,'#B5B59F') + r(13.4,15.6,.5,.26,'#B5B59F');
      const coral = p('M-6.2 15.6v-5.3h-.9V7.6h.7v2h.9v-4h.7v3.2h.9V7.2h.7v2.3h-1.6v2.4h1.1V9.8h.7v3h-1.8v2.8z', '#D39891')
        + l('M-5.4 15V10m-.6.1v-2m.8 1.3h1.2', '#F0C0AA', .18);
      const weedShape = p('M0 0C-1.5-2.7 1-4.4-.5-7.5 2-6.4 2.2-4 .7-2.7 1.4-1.2.7-.6 0 0z', teal)
        + l('M.1-.3Q1-3.2-.25-6.4', mint, .13);
      const seaweed = a(at(weedShape,-9.2,15.7,1), [[0,t()],[25,t(0,0,6)],[50,t(0,0,-5)],[75,t(0,0,4)],[100,t()]], '-9.2px 15.7px')
        + a(at(weedShape,-7.4,15.6,.65,-18), [[0,t()],[29,t(0,0,-8)],[58,t(0,0,6)],[82,t(0,0,-4)],[100,t()]], '-7.4px 15.6px');

      const helmetShape = 'M.25 10.6V6.1C.25 1.8 2.7-.3 7.5-.3s7.25 2.1 7.25 6.4v4.5';
      const helmet = p('M.75 10.3V6.1C.75 2.1 3-.05 7.5-.05s6.75 2.15 6.75 6.15v4.2z','url(#pt41-glass)')
        + l(helmetShape,brassDark,.65) + l(helmetShape,'url(#pt41-copper)',.4)
        + l('M1.65 5.2C1.9 2.1 4.1 1 6.15.8', '#E2F1E6', .3)
        + l('M2.05 5.75v1.5', '#D1E7DF', .2)
        + p('M.35 11.6h14.3v1.2H.35z',brassDark)
        + r(.35,11.55,14.3,.58,'url(#pt41-copper)')
        + r(1.2,12.2,12.6,.2,brassLight)
        + [-.1,3.7,7.5,11.3,15.1].map(x=>`<circle cx="${x}" cy="11.55" r=".32" fill="${brassDark}"/><circle cx="${x-.06}" cy="11.48" r=".12" fill="${brassLight}"/>`).join('')
        + r(-1.45,6.6,1.55,2.55,brassDark) + r(-1.45,6.6,.62,2.55,brass)
        + l('M-1.15 7.1v1.5', brassLight,.18)
        + r(14.8,6.8,1.05,1.8,brassDark) + r(15.45,7.25,.65,.85,tealDark);
      const diverMotion = [[0,t()],[9,t(-.15,.1)],[20,t(.55,.25,4)],
        [34,t(1,.3,8)],[45,t(.8,0,6)],[53,t(.25,-.45,-3)],
        [64,t(0,-.25,-2)],[76,t(.25,0,2)],[89,t()],[100,t()]];
      const diver = crab(diverMotion,helmet,{
        right:[[0,t()],[18,t(.25,0,-8)],[32,t(.7,.15,12)],[43,t(.7,.15,12)],
          [54,t(-.1,-.65,-24)],[72,t(-.1,-.65,-24)],[87,t()],[100,t()]],
        left:[[0,t()],[24,t(-.2,.2,12)],[44,t(-.2,.2,12)],[56,t(-.2,-.1,20)],[75,t()],[100,t()]],
        eyes:[[0,t(.3,0)],[27,t(.7,.6)],[39,t(.7,.6)],[49,t(.8,-.25)],[65,t(.65,-.7)],
          [77,t(.55,-.2)],[90,t(.3,0)],[95,t(.3,0,0,1,.15)],[97,t(.3,0)],[100,t(.3,0)]],
        mood:'happy',moodAt:60,moodEnd:78,
      });

      const shellFan = p('M15.75 13.4Q15.1 10.9 16.6 9.7q.8-1.3 2.1-.75 1.3-1.35 2.7-.2 1.35-.75 2.3.8 1.7.6 1.35 3.85L20.2 14z','url(#pt41-shell)')
        + p('M16.2 13.3Q15.8 11.2 17 10.2q.65-.8 1.8-.4 1.2-1.1 2.5-.15 1.3-.4 2 .7 1.15.65.9 2.9L20.2 13.8z','#E2CFE2')
        + l('M20.2 13.7l-3.3-3.3m3.3 3.3-1.6-4.1m1.6 4.1.2-4.2m-.2 4.2 2.25-3.6m-2.25 3.6 3.6-2.5','#B49ABF',.17)
        + l('M16.15 11.7q.05-1 .85-1.5m1.15-.35 1-.55m2.2.2.9.2',paper,.2);
      const shellLid = a(shellFan,[[0,t(0,0,0,1,.13)],[25,t(0,0,0,1,.13)],
        [31,t(0,0,-2,1,.26)],[39,t(0,0,1,1,.78)],[46,t(0,0,0,1,1)],
        [80,t(0,0,0,1,1)],[92,t(0,0,0,1,.13)],[100,t(0,0,0,1,.13)]],'20.2px 13.7px');
      const pearl = '<circle cx="20.2" cy="12.5" r="1.32" fill="url(#pt41-pearl)"/>'
        + '<circle cx="19.81" cy="12.08" r=".28" fill="#FFFAE9"/>'
        + l('M19.65 13.38q.6.35 1.15.05','#97BBC5',.14);
      const pearlTrack = [[0,t()+o(0)],[34,t()+o(0)],[40,t()+o(1)],
        [56,t(-.25,-6.3)+o(1)],[65,t(.3,-6.7)+o(1)],[75,t(-.15,-6.35)+o(1)],
        [85,t(0,-.7)+o(1)],[89,t()+o(0)],[100,t()+o(0)]];
      const pearlHalo = a('<circle cx="20.2" cy="12.5" r="4.6" fill="url(#pt41-halo)"/>',pearlTrack);
      const pearlLift = a(pearl,pearlTrack);
      const shellBottom = p('M15.7 13.7q.8 2.4 4.5 2.65 3.6-.25 4.55-2.65-4.2 1.55-9.05 0z','#9283AF')
        + p('M15.8 13.6q4.5-1.5 8.9 0-4.2 1.7-8.9 0z','#E9D8E5')
        + l('M17.05 14.65l.5.9m1.25-.6.2 1m1.25-.85v.95m1.3-1-.2.9m1.4-1.2-.45.95','#C7B4D3',.2);
      const glints = [[17.35,4.7,55],[23.15,7.2,60],[20,-.2,65]].map(([x,y,beat],i)=>
        a(at(star(i%2?paper:mint),x,y,.23),[[0,o(0)],[beat,o(0)],[beat+3,o(.9)],
          [beat+10,o(.1)],[beat+13,o(0)],[100,o(0)]])).join('');
      let bubbles = '';
      // Each bubble is released at an authored body keyframe. Rotate its
      // launch point with the same helmet pose, then let it drift freely.
      for (const [i,[beat,dx,dy,angle]] of [[9,-.15,.1,0],[20,.55,.25,4],
        [34,1,.3,8],[53,.25,-.45,-3],[64,0,-.25,-2]].entries()) {
        const theta=angle*Math.PI/180;
        const x=7.5+dx-9*Math.cos(theta)+7.5*Math.sin(theta);
        const y=15+dy-9*Math.sin(theta)-7.5*Math.cos(theta),scale=.65+(i%3)*.14;
        const bubble='<circle cx="0" cy="0" r=".72" fill="#BFE8E1" fill-opacity=".11" stroke="#8CBEC4" stroke-width=".17"/>'+l('M-.3-.35l.18-.13','#E4F5E7',.16);
        bubbles+=a(at(bubble,x,y,scale),[[0,t()+o(0)],[beat,t()+o(0)],
          [beat+2,t(-.4,-.8)+o(.9)],[beat+10,t(-1.2,-5.2,12,1.12)+o(.85)],
          [beat+20,t(-.7,-12.7,-8,1.32)+o(.6)],[beat+30,t(-2,-21,4,1.45)+o(0)],
          [100,t()+o(0)]],`${x}px ${y}px`,'linear');
      }
      return defs+sand+seaweed+coral+pearlHalo+shellLid+diver+pearlLift+shellBottom+glints+bubbles;
    },.65);

  add('clockwork-keeper', '发条时钟匠', 'Clockwork keeper',
    '轻轻上好发条，黄铜齿轮与摆锤一齐动起来。报时小鸟探出门，和认真守时的小螃蟹打个招呼。',
    'A gentle turn of the key wakes the brass gears and pendulum. The little clock bird peeks out to greet its very attentive keeper.',
    ({a,v,crab})=>{
      const wood='#946E52',woodDark='#604D40',woodLight='#BD9870';
      const defs='<defs><linearGradient id="pt42-wood" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#AE8964"/><stop offset=".35" stop-color="#997451"/><stop offset="1" stop-color="#72583F"/></linearGradient><radialGradient id="pt42-dial" cx=".36" cy=".3"><stop stop-color="#FCF0CC"/><stop offset="1" stop-color="#D5BD8E"/></radialGradient><linearGradient id="pt42-brass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F1D29A"/><stop offset=".46" stop-color="#C69A5F"/><stop offset="1" stop-color="#8A6745"/></linearGradient></defs>';
      const caseShape='M16.7 14.8V-.8h.7v-2.3h1.4v-1.6h1.35v-1.1h2.7v1.1h1.35v1.6h1.4V-.8h.7v15.6z';
      const caseBody=p(caseShape,woodDark)
        + p('M17.3 14.3V-.6h.7v-2h1.4v-1.6h1.35v-.85h1.5v.85h1.35v1.6H25v2h.7v14.9z','url(#pt42-wood)')
        + l('M17.75 13.8V-.1h.6v-2h1.45v-1.6h.9',woodLight,.22)
        + r(16.15,14.25,10.5,.65,woodLight)+r(16.45,14.9,9.9,.65,woodDark)
        + r(17.1,15.5,1.4,.45,wood)+r(24.35,15.5,1.4,.45,wood)
        + r(17.95,7.45,7.05,5.8,woodDark)
        + r(18.3,7.8,6.35,5.1,'#516A66')
        + l('M18.55 8.1v4.3M24.4 8.1v4.3','#809586',.14)
        + l('M18 13.7h6.9',brassLight,.2)
        + l('M17.55 9.2v2m7.8-5.8v2.5m-6.4-10.8v1.2',woodLight,.14);
      const gear=(x,y,radius,phase,direction=1)=>{
        const pts=[];for(let i=0;i<48;i++){const angle=i*Math.PI/24;const rr=radius*(i%4<2?1:.76);pts.push(`${x+Math.cos(angle)*rr},${y+Math.sin(angle)*rr}`);}
        const art=`<polygon points="${pts.join(' ')}" fill="url(#pt42-brass)"/>`
          + `<circle cx="${x}" cy="${y}" r="${radius*.47}" fill="#516A66"/>`
          + l(`M${x-radius*.55} ${y}h${radius*1.1}M${x} ${y-radius*.55}v${radius*1.1}`,brassLight,.15)
          + `<circle cx="${x}" cy="${y}" r=".17" fill="${brassDark}"/>`;
        return a(art,[[0,t(0,0,phase)],[12,t(0,0,phase)],
          [28,t(0,0,phase+direction*55/radius)],[43,t(0,0,phase+direction*105/radius)],
          [67,t(0,0,phase+direction*135/radius)],[86,t(0,0,phase+direction*90/radius)],
          [100,t(0,0,phase)]],`${x}px ${y}px`);
      };
      const gears=gear(19.6,9.2,.95,0)+gear(21.2,8.7,.8,9,-1)+gear(23,9.5,1.12,-10);
      const pendulum=l('M21.4 8.35v3.5',brassLight,.22)
        + '<circle cx="21.4" cy="12.05" r=".86" fill="url(#pt42-brass)"/>'
        + '<circle cx="21.2" cy="11.85" r=".31" fill="#E9CD96"/>';
      const swings=[[0,t()],[12,t()]];for(let n=18;n<=90;n+=6)swings.push([n,t(0,0,n%12===6?15:-15)]);swings.push([100,t()]);
      const pendulumMotion=a(pendulum,swings,'21.4px 8.35px');
      const glass=p('M18.4 7.9h6.1v4.8h-6.1z','#B4D7BE').replace('/>',' fill-opacity=".07"/>')
        + l('M18.65 8.15l1.6 2.1m3.45.5.5.65','#D8E8CF',.15);
      const dial='<circle cx="21.4" cy="3.7" r="3.46" fill="#5C4E3F"/>'
        + '<circle cx="21.4" cy="3.7" r="3.2" fill="url(#pt42-brass)"/>'
        + '<circle cx="21.4" cy="3.7" r="2.88" fill="url(#pt42-dial)"/>'
        + Array.from({length:12},(_,i)=>{const angle=i*Math.PI/6;return l(`M${21.4+Math.sin(angle)*2.42} ${3.7-Math.cos(angle)*2.42}l${Math.sin(angle)*.28} ${-Math.cos(angle)*.28}`,woodDark,i%3===0?.22:.13);}).join('')
        + a(l('M21.4 3.7V1.65',woodDark,.25),[[0,t()],[12,t()],[44,t(0,0,45)],
          [64,t(0,0,61)],[78,t(0,0,71)],[100,t()]],'21.4px 3.7px')
        + a(l('M21.4 3.7l-1.2.7',woodDark,.32),[[0,t()],[44,t(0,0,3.75)],[78,t(0,0,5.9)],[100,t()]],'21.4px 3.7px')
        + '<circle cx="21.4" cy="3.7" r=".27" fill="#B5824E"/>'
        + '<circle cx="21.32" cy="3.61" r=".08" fill="#F9E6BC"/>';
      const hatchBack=p('M19.95-.8v-1.6q0-1.45 1.45-1.45t1.45 1.45V-.8z',woodDark);
      const doorHalf=p('M19.95-.8v-1.6q0-1.45 1.45-1.45V-.8z',wood)
        + l('M20.25-1.1v-1.2q0-.9.8-1',woodLight,.16);
      const doorPose=[[0,t()],[45,t()],[50,t(0,0,0,-.35,1)],[73,t(0,0,0,-.35,1)],[79,t()],[100,t()]];
      const hatchDoors=a(doorHalf,doorPose,'19.95px -1.5px')
        + a(at(doorHalf,42.8,0,-1).replace('scale(-1)','scale(-1 1)'),doorPose,'22.85px -1.5px');
      const birdArt=p('M-.9.1V-.9l.5-.7h1.15l.55.65v1.7H.4v.35H-.8V.8h-.7V.3z',teal)
        + p('M-.85.35l-1.1-.55.2 1.1.9.25z',tealDark)
        + r(.65,-.95,.23,.3,ink)+p('M1.2-.6l.7.3-.7.3z',brassLight)
        + a(p('M-.7-.05l1.1.4-.5.65-.8-.3z',mint),[[0,t()],[53,t()],[56,t(0,0,-30)],[59,t()],[63,t(0,0,-30)],[66,t()],[100,t()]],'-.5px .2px')
        + l('M-.25 1v.4m.7-.4v.4',brassDark,.15);
      const bird=a(at(birdArt,21.4,-1.9,.68),[[0,t(0,.4,0,.2)+o(0)],[49,t(0,.4,0,.2)+o(0)],
        [53,t(0,-.25,0,1)+o(1)],[57,t(-.1,-.55,-8)+o(1)],
        [60,t(0,-.25,0,1)+o(1)],[65,t(.1,-.4,7)+o(1)],
        [70,t(0,-.25,0,1)+o(1)],[75,t(0,.4,0,.2)+o(0)],[100,t(0,.4,0,.2)+o(0)]],'21.4px -1.9px');
      const key=r(15.2,9.75,2.6,.5,brassDark)+r(15.2,9.8,2.6,.19,brassLight)
        + '<path d="M15.3 10c-1.5-.3-1.9-1.45-.95-1.55.7-.1.9.8.95 1.55zm0 0c-1.5.3-1.9 1.45-.95 1.55.7.1.9-.8.95-1.55z" fill="none" stroke="url(#pt42-brass)" stroke-width=".35"/>'
        + '<circle cx="15.3" cy="10" r=".28" fill="#BD925C"/>';
      const winding=[[0,t()],[11,t()],[15,t(0,0,0,1,.15)],[19,t()],
        [23,t(0,0,0,1,.15)],[27,t()],[31,t(0,0,0,1,.15)],[35,t()],
        [40,t()],[100,t()]];
      const actor=crab([[0,t()],[9,t(.1,0,1)],[34,t(.1,0,1)],
        [42,t()],[51,t(-.2,-.4,-3)],[57,t()],[73,t()],[100,t()]],'',{
        right:[[0,t()],[9,t(.6,0)],[14,t(.65,-.3,-10)],[18,t(.6,.2,10)],
          [22,t(.65,-.3,-10)],[26,t(.6,.2,10)],[30,t(.65,-.3,-10)],[35,t(.6,0)],
          [42,t()],[58,t(-.2,-.3,-25)],[70,t(-.2,-.3,-25)],[82,t()],[100,t()]],
        left:[[0,t()],[13,t(0,0,6)],[35,t()],[56,t(0,0,18)],[74,t()],[100,t()]],
        eyes:[[0,t(.5,0)],[14,t(.65,.2)],[35,t(.65,.2)],[46,t(.6,-.6)],
          [51,t(.5,-.8)],[55,t(.5,-.8,0,1,.15)],[57,t(.5,-.8)],[73,t(.4,-.2)],[100,t(.5,0)]],
        mood:'happy',moodAt:61,moodEnd:75,
      });
      const note=l('M0 0v-1.8l1 .25',brassLight,.18)+'<ellipse cx="-.35" cy=".05" rx=".42" ry=".29" fill="#CBAA71"/>';
      const notes=[[24.15,-3.5,54,.85],[17.85,-4.6,60,.7],[24,-7.2,65,.6]].map(([x,y,beat,sz])=>
        a(at(note,x,y,sz),[[0,t()+o(0)],[beat,t()+o(0)],[beat+2,t(0,-.25)+o(1)],
          [beat+11,t(-.4,-2.1,-10)+o(.6)],[beat+16,t(-.7,-3.3,-14)+o(0)],[100,t()+o(0)]],`${x}px ${y}px`)).join('');
      const softChime=a(l('M18.2-1.7l-1-.5m7.1-.4 1-.5',brassLight,.24),
        [[0,o(0)],[52,o(0)],[54,o(.8)],[58,o(0)],[62,o(0)],[64,o(.8)],[68,o(0)],[100,o(0)]]);
      return defs+caseBody+gears+pendulumMotion+glass+dial+hatchBack+bird+hatchDoors+actor+a(key,winding,'15.3px 10px')+notes+softChime;
    },.665);

  add('dandelion-wishes', '蒲公英心愿', 'Dandelion wishes',
    '鼓起脸颊轻轻一吹，蒲公英的小伞沿着不同的风路飘开。一粒落在爪尖，停一会儿，再随愿望飞走。',
    'One soft puff sends the dandelion parachutes along different breezes. A single seed rests on a claw, waits a moment, and drifts away with a wish.',
    ({a,v,crab})=>{
      const defs='<defs><radialGradient id="pt43-pollen"><stop stop-color="#F3E2AB" stop-opacity=".28"/><stop offset="1" stop-color="#E4E5C7" stop-opacity="0"/></radialGradient></defs>';
      const bank=p('M-8 16.1l3.5-.75 4 .4 5.8-.25 5.3.35 6.4-.35 4 .5-1.8.6H-6.4z','#BBC7A7')
        + l('M-6.7 16.1h2.2m2.1.25h2.3m12.8-.15h3.1','#DCE0BC',.18);
      const grass=l('M-6.5 15.8q-.8-2.6-2-3.5m2 3.5q-.1-3 1.2-4.3m-1.2 4.3q1-1.6 2-2.1',sageDark,.25)
        + p('M-6.6 14.7q-2.4-.2-2.2-1.8 1.7.2 2.2 1.8z',sage)
        + p('M-5.9 13.3q-.3-1.9 1.3-2.4.25 1.65-1.3 2.4z','#A6BC8E');
      const flowerStem=l('M14.25 10Q16.3 8.1 17.65 3.2',sageDark,.34)
        + l('M14.4 9.9Q16.25 8 17.7 3.3','#B2BF89',.12)
        + p('M15.3 8.6q1.9-.1 2.15-1.55-1.75-.25-2.15 1.55z',sage)
        + l('M15.3 8.6l1.55-1.05',sageDark,.12)
        + '<circle cx="17.65" cy="3.2" r=".58" fill="#B4A772"/>'
        + '<circle cx="17.5" cy="3" r=".25" fill="#D3C38D"/>';
      const seedShape=l('M0 0v1.05','#9D956D',.15)
        + p('M-.13.84l.26-.05.03.52-.2.12z','#B6A474')
        + l('M0 0l-.8-.55m.8.55-.5-.92M0 0v-1M0 0l.5-.92M0 0l.8-.55M0 0h.85M0 0h-.85','#C4D0B5',.17)
        + l('M-.8-.55l-.13-.18M-.5-.92l-.05-.18M.5-.92l.05-.18M.8-.55l.13-.18',paper,.13);
      const seedStarts=Array.from({length:10},(_,i)=>{
        const angle=(-100+i*36)*Math.PI/180;return {x:17.65+Math.cos(angle)*2.25,y:3.2+Math.sin(angle)*2.25,angle:-100+i*36+90};
      });
      let seeds='';
      for(let i=0;i<10;i++){
        const start=seedStarts[i],pose=t(start.x,start.y,start.angle,.68),beat=30+i*.85;
        const endX=[22.5,23.7,19.3,13.9,7.4,1.7,-5.8,-8.2,-3.1,8.3][i];
        const endY=[-5.8,-9.4,-13.5,-16.7,-14.9,-12.3,-8.9,-4.6,-1.9,-7.6][i];
        if(i===6){
          seeds+=a(seedShape,[[0,pose],[beat,pose],[43,t(12,-7,-20,.76)],
            [53,t(4.7,-3.5,-15,.8)],[62,t(.85,6.68,0,.8)],[74,t(.85,6.68,0,.8)],
            [80,t(-2.1,1.2,-12,.75)],[88,t(4.4,-6.2,22,.68)+o(.6)],
            [93,t(14.5,-1.2,40,.5)+o(0)],[94,pose+o(0)],[99,pose+o(1)],[100,pose+o(1)]],'0px 0px');
        }else{
          seeds+=a(seedShape,[[0,pose],[beat,pose],
            [beat+11,t(start.x+(endX-start.x)*.4,start.y+(endY-start.y)*.5,-22+i*4,.73)],
            [59+i*.85,t(endX,endY,10-i*4,.8)],
            [76+i*.7,t(endX+(i%2?-1.3:1.2),endY+2.3,-15+i*3,.76)+o(.85)],
            [90,t(endX+2,endY+4.2,-8+i*3,.66)+o(0)],
            [94,pose+o(0)],[99,pose+o(1)],[100,pose+o(1)]],'0px 0px');
        }
      }
      const catchPose=t(-.6,-.3,75);
      const cheeks=v(r(11.7,10.1,1.15,.65,'#F0AE93')+r(3.1,10.1,1.05,.65,'#F0AE93'),21,38);
      const puff=v('<circle cx="12.15" cy="9.6" r=".24" fill="#9A574A"/>',26,37);
      const actor=crab([[0,t()],[12,t()],[22,t(0,.15,0,1.035,.985)],
        [29,t(0,-.05,0,1.025,1)],[37,t()],[58,t()],[76,t()],[82,t(0,-.18)],[88,t()],[100,t()]],
        cheeks+puff+flowerStem,{
          right:[[0,t()],[19,t(0,0,-4)],[35,t()],[53,t()],[67,t(0,0,-2)],[82,t()],[100,t()]],
          left:[[0,t()],[42,t()],[53,t(-.3,-.15,35)],[61,catchPose],[75,catchPose],
            [82,t(-.3,-.1,25)],[89,t()],[100,t()]],
          eyes:[[0,t(.5,-.2)],[20,t(.6,-.3)],[27,t(.6,-.3,0,1,.55)],
            [36,t(.6,-.3)],[45,t(0,-.8)],[55,t(-.65,-.2)],[67,t(-.65,.2)],
            [76,t(-.6,-.1)],[84,t(0,-.7)],[94,t(.5,-.2)],[100,t(.5,-.2)]],
          mood:'happy',moodAt:65,moodEnd:76,
        });
      const breath=a(l('M13 9.3q1.5-.8 2.25-2.55m-1.75 3q2.2-.75 2.8-3.05','#BECCB4',.19),
        [[0,o(0)],[27,o(0)],[30,o(.65)],[34,o(.4)],[39,o(0)],[100,o(0)]]);
      const breeze=a(l('M20-6q3-1.4 4.4.1M-7-3q1.2-1.6 3.8-1.45','#B9C9B1',.16),
        [[0,t()+o(0)],[41,t()+o(0)],[49,t(.2,-.3)+o(.6)],
          [63,t(1.1,-.7)+o(0)],[100,t()+o(0)]]);
      const glow=a('<circle cx="17.65" cy="3.2" r="4" fill="url(#pt43-pollen)"/>',
        [[0,o(0)],[25,o(0)],[32,o(.7)],[45,o(0)],[100,o(0)]]);
      const wishes=[[-2,-9,52],[10.4,-13.6,58],[21,-12.2,64]].map(([x,y,beat])=>
        a(at(star(brassLight),x,y,.17),[[0,o(0)],[beat,o(0)],[beat+3,o(.6)],[beat+9,o(0)],[100,o(0)]])).join('');
      return defs+bank+a(grass,[[0,t()],[35,t(0,0,4)],[63,t(0,0,-3)],[100,t()]],'-6.5px 15.8px')
        +glow+actor+seeds+breath+breeze+wishes;
    },.69);
}
