// A small lantern, a much larger imagination. Geometry remains native SVG;
// the canonical crab is supplied by the story builder, never redrawn here.
export function registerLanternKoi({ add, r, p, l, at, t, o, star, ink, cream, gold, pink }) {
  add(
    'lantern-koi', '锦鲤灯', 'Lantern koi',
    '提起红金小灯，锦鲤游出一圈，轻点额头，再把暖光带回灯里。',
    'A little koi swims out of a red-and-gold lantern, kisses a forehead, and carries its light home.',
    ({ a, v, crab }) => {
      // These are illustration pigments, not application surface tokens.
      const red = '#D95550', deepRed = '#9E3D46', orange = '#F29B61';
      const pale = '#FFF4D9', brass = '#A76B43', glint = '#FFE4A1';
      const defs = `<defs>
<linearGradient id="pt35-paper" x1="0" x2="1"><stop stop-color="#B44045"/><stop offset=".27" stop-color="#ED7860"/><stop offset=".55" stop-color="#F4A574"/><stop offset="1" stop-color="#BD464B"/></linearGradient>
<linearGradient id="pt35-koi" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFF7E3"/><stop offset=".55" stop-color="#FFE9B8"/><stop offset="1" stop-color="#E9B886"/></linearGradient>
<linearGradient id="pt35-fin" x1="1" y1=".5" x2="0" y2=".5"><stop stop-color="#FAD697"/><stop offset=".5" stop-color="#F08E6D"/><stop offset="1" stop-color="#D95A68" stop-opacity=".45"/></linearGradient>
<radialGradient id="pt35-lamplight"><stop stop-color="#FFD986" stop-opacity=".25"/><stop offset=".5" stop-color="#FFD986" stop-opacity=".12"/><stop offset="1" stop-color="#FFD986" stop-opacity="0"/></radialGradient>
</defs>`;

      // The rod and the right claw share this exact hinge animation. The
      // lantern's second pendulum pivots from the end of the rod.
      const holding = [[0,t()],[10,t(0,-.2,-3)],[20,t(0,-.2,-3)],
        [30,t()],[76,t()],[88,t(0,-.1,-1)],[100,t()]];
      const pendulum = [[0,t()],[10,t(0,0,4)],[20,t(0,0,-3)],
        [29,t(0,0,2)],[39,t(0,0,-1)],[49,t()],
        [78,t()],[84,t(0,0,-3)],[90,t(0,0,2)],[100,t()]];
      const lanternRibs = l('M18.2 1.5L17.7 3v3.3l.5 1.2M19.1 1.4l-.25 1.7v3l.25 1.5M20.9 1.4l.25 1.7v3l-.25 1.5M21.8 1.5l.5 1.5v3.3l-.5 1.2', deepRed, .19);
      const lanternBody =
        p('M18.1 1.1h3.8v.5h.8v1h.5v3.7h-.5v1h-.8v.5h-3.8v-.5h-.8v-1h-.5V2.6h.5v-1h.8z','url(#pt35-paper)') +
        lanternRibs +
        r(18,1,4,.55,brass) + r(18,1,4,.22,glint) +
        r(18,7.35,4,.55,brass) + r(18,7.35,4,.22,gold) +
        p('M20 2.8l1.35 1.6L20 6l-1.35-1.6z',gold) +
        p('M20 3.35l.8 1.05L20 5.45l-.8-1.05z',deepRed) +
        r(19.83,3.8,.34,1.1,glint) +
        r(17.25,2.9,.3,2.6,glint) +
        a(l('M20 7.9v1.4',gold,.26) + r(19.5,9.2,1,.5,brass) +
          p('M19.55 9.6h.9l.4 1.8h-1.7z',red) +
          l('M19.85 9.8v1.2m.35-1.2v1.2',glint,.15),
          [[0,t()],[12,t(0,0,-8)],[25,t(0,0,7)],[36,t(0,0,-4)],
            [49,t()],[79,t()],[86,t(0,0,8)],[93,t(0,0,-4)],[100,t()]],'20px 7.9px');
      const glow = a('<circle cx="20" cy="4.5" r="7.5" fill="url(#pt35-lamplight)"/>',
        [[0,o(.65)],[15,o(1)],[25,o(.32)],[74,o(.32)],[83,o(1)],[91,o(.75)],[100,o(.65)]]);
      const lamp = a(l('M20-2.3V1',brass,.23) + glow + lanternBody,pendulum,'20px -2.3px');
      const rod = l('M14 10L20-2.3',brass,.52) +
        l('M14.1 9.8L19.95-2',glint,.16) +
        l('M15.4 6.8l.55.28m1.1-3.5l.55.28m1.1-3.5l.55.28',deepRed,.22);

      // The koi has a rigid cream-and-vermilion body, two separate ribbon
      // tail lobes, and independently beating pectoral and dorsal fins.
      // Subtle pigment gradients keep its stepped silhouette readable small.
      const tailBeat = [[0,t(0,0,-8)]];
      const finBeat = [[0,t(0,0,12)]];
      for(let n=4;n<100;n+=4) {
        tailBeat.push([n,t(0,0,n%8===0?-8:10,1,n%8===0?.9:1.05)]);
        finBeat.push([n,t(0,0,n%8===0?12:-20,1,n%8===0?1:.82)]);
      }
      tailBeat.push([100,t(0,0,-8)]);
      finBeat.push([100,t(0,0,12)]);
      const tail = a(
        p('M-3.2-.55L-4.7-1.8-6.6-2.5-7-2l1.2 1.6L-4 .1z','url(#pt35-fin)') +
        p('M-3.2.5L-4.4 1.5-6.5 2.6-7.3 2.2-6.1.9-4-.1z','url(#pt35-fin)') +
        l('M-3.8-.1L-6.25-1.85M-3.8.2L-6.3 1.8',glint,.17),
        tailBeat,'-3.2px 0px');
      const dorsal = a(p('M-1.9-1.35l.7-1.6h.6l1.7 1.3z',red) +
        l('M-1.3-1.4l.2-.9m.55.9l-.15-.75',glint,.17),
        finBeat,'-.8px -1.3px');
      const scales = l('M-2.25-.65l.35.28.35-.28m-.25.9l.35.28.35-.28m.25-1l.35.28.35-.28m-.2.95l.35.28.35-.28m.15-1l.35.28.35-.28', '#E6B174', .13);
      const body =
        p('M-3.6-.55l.85-.85h1.1v-.45h2.7v.45h1.4l1.4 1v.85l-1.25.95H1.35v.45H-1.4V1.4h-1.2l-1-1z','url(#pt35-koi)') +
        p('M-2.85-.9h1.15l.55.7-.5.75h-1.6l-.35-.75z',red) +
        p('M-.5-1.8h1.5v.45h.6v.55H.2v.45H-.7v-.8z',orange) +
        p('M1.8-.95h.6l.8.65v.55h-.85l-.55-.5z',red) +
        scales + l('M-2.5-1.38h1m.6-.42H.9',pale,.2) +
        r(2.22,-.28,.43,.43,ink) + r(2.27,-.24,.13,.13,pale) +
        l('M1.55.1l-.25.45.25.45',brass,.14) +
        l('M3.3.4l.6-.1m-.6.1l.4.55',glint,.14);
      const frontFin = a(p('M-.1.55l1.3.35L.3 2.25l-1.15-.3.15-.65z','url(#pt35-fin)') +
        l('M.3.9l-.4 1.05m.8-.85l-.4.9',glint,.15),finBeat,'.3px .7px');
      const fish = tail + dorsal + body + frontFin;

      // Sample cubic paths into continuous linear keyframes rather than
      // easing to a complete stop at every waypoint. Angles are unwrapped so
      // the koi cannot accidentally spin a full turn at the leftmost point.
      let lastAngle=-105;
      const unwrap=(deg)=>{
        while(deg-lastAngle>180) deg-=360;
        while(deg-lastAngle< -180) deg+=360;
        lastAngle=deg; return deg;
      };
      const pose=(x,y,angle,scale=1,opacity=1)=>t(x,y,angle,scale)+o(opacity);
      const fishFrames=[[0,pose(20,4.5,-105,.05,0)],
        [17,pose(20,4.5,-105,.05,0)],[19,pose(19.8,2.8,-105,.4,.85)],
        [22,pose(19,-1,-105,.85,1)]];
      const track=[];
      function curve(start,end,P0,P1,P2,P3,count=8,startScale=1,endScale=1) {
        for(let i=1;i<=count;i++) {
          const q=i/count,s=1-q;
          const x=s*s*s*P0[0]+3*s*s*q*P1[0]+3*s*q*q*P2[0]+q*q*q*P3[0];
          const y=s*s*s*P0[1]+3*s*s*q*P1[1]+3*s*q*q*P2[1]+q*q*q*P3[1];
          const dx=3*s*s*(P1[0]-P0[0])+6*s*q*(P2[0]-P1[0])+3*q*q*(P3[0]-P2[0]);
          const dy=3*s*s*(P1[1]-P0[1])+6*s*q*(P2[1]-P1[1])+3*q*q*(P3[1]-P2[1]);
          const percent=start+(end-start)*q,angle=unwrap(Math.atan2(dy,dx)*180/Math.PI);
          fishFrames.push([percent,pose(x,y,angle,startScale+(endScale-startScale)*q)]);
          track.push({percent,x,y,angle});
        }
      }
      curve(22,36,[19,-1],[18,-8],[13,-13],[7,-13],8,.85,1);
      curve(36,49,[7,-13],[-2,-13],[-7,-6],[-4,-1],9);
      curve(49,61,[-4,-1],[-2,3],[2,2.3],[5.3,4.2],8);
      fishFrames.push([63,pose(5.45,4.3,lastAngle)],
        [65,pose(5.25,4.05,lastAngle-12)],[68,pose(5.6,3.5,unwrap(-47))]);
      curve(68,80,[5.6,3.5],[10,-1],[20,-3],[20,4.5],8,1,.45);
      fishFrames.push([82,pose(20,4.5,lastAngle,.05,0)],
        [100,pose(20,4.5,-105,.05,0)]);

      // A quiet trail of separate square glints follows the upper arc, with
      // staggered lifetimes; it never creates a circular backdrop behind it.
      const trail=track.filter(({percent})=>percent>25&&percent<57).filter((_,i)=>i%3===0)
        .map(({percent,x,y},i)=>a(at(star(i%2?glint:gold),x,y,.22),
          [[0,t()+o(0)],[percent,t(0,0,0,.3)+o(0)],
            [percent+2,t(0,0,0,1)+o(.7)],
            [percent+8,t(0,.9,0,.55)+o(.3)],
            [percent+12,t(0,1.4,0,.2)+o(0)],[100,t()+o(0)]],
          `${x}px ${y}px`)).join('');
      const warmCheeks=v(`<g opacity=".45">${r(2.7,10.5,1.7,.45,pink)}${r(10.6,10.5,1.7,.45,pink)}</g>`,62,77);
      const right=a(rod+lamp,holding,'13px 10px');
      const character=crab(
        [[0,t()],[10,t(0,.15,0,1.01,.985)],[20,t(0,0,-2)],
          [35,t(0,-.15,-3)],[48,t(0,-.1,2)],[58,t()],
          [63,t(0,.2,0,1.02,.97)],[69,t(0,-.1,0,.99,1.01)],
          [80,t()],[90,t(0,.1,0,1.005,.99)],[100,t()]],
        right+warmCheeks,
        {right:holding,
          left:[[0,t()],[40,t()],[49,t(0,-.5,15)],
            [57,t(2.3,-4.5,62)],[64,t(2.3,-4.5,62)],
            [71,t(1,-2,35)],[80,t()],[100,t()]],
          eyes:[[0,t(.35)],[14,t(.5,-.25)],[25,t(.7,-.7)],
            [36,t(0,-.9)],[46,t(-.7,-.7)],[56,t(-.25,-.65)],
            [60,t(0,-.6)],[63,t(0,-.3,0,1,.3)],
            [68,t(0,-.4)],[78,t(.6,-.3)],[85,t(.4)],
            [92,t(0,0,0,1,.12)],[94,t()],[100,t(.35)]],
          mood:'happy',moodAt:64,moodEnd:76});
      const kiss=v(a(at(star(glint),8.25,5.1,.35),
        [[0,t(0,0,0,.2)+o(0)],[61,t(0,0,0,.2)+o(0)],
          [63,t(0,0,0,1.1)+o(1)],[66,t(0,-.6,0,.6)+o(.7)],
          [69,t(0,-1,0,.2)+o(0)],[100,t(0,0,0,.2)+o(0)]],
        '8.25px 5.1px'),60,70);
      return defs + trail + character + a(fish,fishFrames,'0px 0px','linear') + kiss;
    }, .55,
  );
}
