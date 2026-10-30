// Three small workshops: wet clay, amber honey, and a sea under glass.
// All motion remains in SVG user coordinates; the canonical Clawd is unchanged.
export function registerPotteryHoneyBottle({ add, r, p, l, at, t, o, star, skin, ink, cream, gold }) {
  const n = x => Math.abs(x) < .00001 ? 0 : +x.toFixed(4);
  const smooth = u => u*u*(3-2*u);
  const value = (keys, percent) => {
    if (percent <= keys[0][0]) return keys[0][1];
    for (let i=1;i<keys.length;i++) {
      if (percent <= keys[i][0]) {
        const [a,x]=keys[i-1], [b,y]=keys[i], u=smooth((percent-a)/(b-a));
        return x+(y-x)*u;
      }
    }
    return keys.at(-1)[1];
  };
  const every = fn => Array.from({length:51},(_,i)=>[i*2,fn(i*2)]);

  add('pottery-studio', '陶艺小工坊', 'Pottery studio',
    '两只小爪扶住旋转的陶泥，慢慢拉高，再捏开一只蓝釉小碗。欣赏一下，轻轻压回泥团，重新开始。',
    'Two careful claws draw up spinning clay and open a little blue bowl, admire it, then gently press it down to begin again.',
    ({a,v,crab})=>{
      const defs='<defs><linearGradient id="pt47-clay" x1="0" y1="0" x2="1" y2=".2"><stop stop-color="#B97F64"/><stop offset=".35" stop-color="#E0B195"/><stop offset=".68" stop-color="#D69E7B"/><stop offset="1" stop-color="#A86E55"/></linearGradient><linearGradient id="pt47-glaze" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#6A8D9E"/><stop offset=".34" stop-color="#B1D6DA"/><stop offset=".64" stop-color="#83B9C6"/><stop offset="1" stop-color="#4D7C93"/></linearGradient><linearGradient id="pt47-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#A9A592"/><stop offset=".5" stop-color="#D5C9AB"/><stop offset="1" stop-color="#77796E"/></linearGradient></defs>';
      const profile='M3.6 10.5Q3.9 12.85 6.2 13.3H8.8Q11.1 12.85 11.4 10.5Z';
      const form=[[0,t(0,0,0,.66,.61)],[10,t(0,0,0,.66,.61)],[30,t(0,0,0,.59,1.18)],
        [48,t()],[77,t()],[87,t(0,0,0,1.12,.4)],[96,t(0,0,0,.66,.61)],[100,t(0,0,0,.66,.61)]];
      const glaze=a(p(profile,'url(#pt47-glaze)'),[[0,o(0)],[47,o(0)],[60,o(1)],[77,o(1)],[83,o(0)],[100,o(0)]]);
      const ceramic = p(profile,'url(#pt47-clay)')+glaze
        + '<ellipse cx="7.5" cy="10.5" rx="3.9" ry=".65" fill="#825D4F"/>'
        + '<ellipse cx="7.5" cy="10.6" rx="3.32" ry=".37" fill="#D4A586"/>'
        + a('<ellipse cx="7.5" cy="10.5" rx="3.9" ry=".65" fill="#AACFD1"/><ellipse cx="7.5" cy="10.55" rx="3.3" ry=".38" fill="#5C859A"/><ellipse cx="7.5" cy="10.67" rx="2.5" ry=".2" fill="#6A9BAD"/>',[[0,o(0)],[47,o(0)],[60,o(1)],[77,o(1)],[83,o(0)],[100,o(0)]])
        + l('M4.2 11.1Q7.5 12.1 10.8 11.1','#E5B89B',.13)
        + a(l('M4.4 11.45Q7.5 12.35 10.6 11.45','#E0EFE3',.17)+l('M5 12.2Q7.5 12.8 10 12.2','#D1E4D9',.11),[[0,o(0)],[50,o(0)],[62,o(.9)],[76,o(.9)],[83,o(0)],[100,o(0)]])
        + r(6.3,13.17,2.4,.24,'#B18A68');
      const wheel = p('M3 14.8h9v.7h-1.2v2.1h-1v-2.1H5.2v2.1h-1v-2.1H3z','#9F7958')
        + r(4.2,16.9,1,.25,'#D2AE80')+r(9.8,16.9,1,.25,'#D2AE80')
        + r(6.75,14.7,1.5,1.05,'#7B8072')
        + '<ellipse cx="7.5" cy="14.3" rx="5.25" ry="1.03" fill="#8D8C7C"/>'
        + '<ellipse cx="7.5" cy="13.98" rx="5.25" ry=".97" fill="url(#pt47-rim)"/>'
        + '<ellipse cx="7.5" cy="13.92" rx="4.75" ry=".7" fill="#D2C5A7"/>'
        + '<ellipse cx="7.5" cy="13.92" rx="3.95" ry=".52" fill="none" stroke="#AAA38E" stroke-width=".13"/>';
      let spin='';
      for(let i=0;i<6;i++) {
        const phase=i*Math.PI/3;
        const track=every(percent=>{
          const travel=value([[0,0],[9,0],[52,Math.PI*8],[74,Math.PI*10],[89,Math.PI*12],[100,Math.PI*12]],percent);
          const theta=phase+travel;
          return t(n(7.5+4.45*Math.cos(theta)),n(13.92+.62*Math.sin(theta)))+o(n(.45+.35*(Math.sin(theta)+1)/2));
        });
        spin+=a(r(-.24,-.075,.48,.15,i%2?'#F1E3C7':'#94856E'),track,'0px 0px','linear');
      }
      const cloth=p('M15.5 14.1h7.2l-.5 2h-7.1z','#CAD5CF')+l('M16.3 14.8h5.1m-4.5.5h4.4','#A5BAB5',.18)
        + p('M17.2 11h4v3.2q-2 .8-4 0z','#8FAEB2')
        + '<ellipse cx="19.2" cy="11" rx="2" ry=".45" fill="#C9D9D4"/>'
        + '<ellipse cx="19.2" cy="11.03" rx="1.6" ry=".25" fill="#6C909B"/>'
        + l('M18.6 11.1l.5-4.6','#B58B61',.32)+l('M19.1 6.5l.1-1.2','#E4D8BC',.55)
        + l('M20 11.1l1.6-3.5','#725D4D',.3)+p('M21.2 7.6l.7-1 .45.3-.65 1.1z','#D2B18B');
      const water=p('M-5.8 12h3.9v2.8q-1.95.9-3.9 0z','#B3C8C3')
        + '<ellipse cx="-3.85" cy="12" rx="1.95" ry=".45" fill="#D8E3D8"/>'
        + '<ellipse cx="-3.85" cy="12.05" rx="1.55" ry=".25" fill="#8AB8BF"/>'
        + l('M-5.1 13.1v1.1','#DCE8DA',.22);
      const left=[[0,t(3.5,2,22)],[10,t(3.5,2,22)],[30,t(4.15,1.65,10)],
        [48,t(2.5,2.1,29)],[60,t(2.5,2.1,29)],[66,t(.4,0,-20)],[76,t(.4,0,-20)],
        [85,t(3.6,2.4,30)],[96,t(3.5,2,22)],[100,t(3.5,2,22)]];
      const right=left.map(([k,s])=>[k,s.replace(/translate\(([-.\d]+)px,/,(_,x)=>`translate(${-Number(x)}px,`).replace(/rotate\(([-.\d]+)deg\)/,(_,x)=>`rotate(${-Number(x)}deg)`)]);
      const apron=p('M4.6 11.25h5.8v2.15H4.6z','#B8C8B8')+l('M5.6 11.35v1m3.8-1v1','#D9E1CF',.13);
      const actor=crab([[0,t()]],apron,{left,right,eyes:[[0,t(0,.35)],[27,t(0,.2)],[34,t(0,0,0,1,.1)],[36,t(0,.2)],[61,t()],[88,t(0,.35)],[100,t(0,.35)]],mood:'happy',moodAt:64,moodEnd:80});
      // Wet fingertips sit in front of the vessel, so the original rectangular
      // claws remain visible while shaping clay against the same coral torso.
      const palms=a(`<rect x="0" y="9" width="2" height="2" fill="${skin}" stroke="#C77B62" stroke-width=".12"/>`+l('M.1 10.85h1.8','#EEB394',.16)+r(.15,10.5,.5,.3,'#C69A7C'),left,'2px 10px')
        +a(`<rect x="13" y="9" width="2" height="2" fill="${skin}" stroke="#C77B62" stroke-width=".12"/>`+l('M13.1 10.85h1.8','#EEB394',.16)+r(14.35,10.5,.5,.3,'#C69A7C'),right,'13px 10px');
      let glints='';
      for(const [x,y,start] of [[4.35,9.9,59],[11.65,10.2,64]])glints+=a(at(star('#D6E5D5'),x,y,.23),[[0,t()+o(0)],[start,t(0,0,0,.4)+o(0)],[start+4,t()+o(.85)],[start+11,t(0,-.5,20,.4)+o(0)],[100,t()+o(0)]],`${x}px ${y}px`);
      return defs+cloth+water+actor+wheel+spin+a(ceramic,form,'7.5px 13.3px')+palms+glints;
    }, .72);

  add('honey-counter', '蜂蜜小铺', 'Honey counter',
    '木勺拉起一缕琥珀色的蜜，小蜜蜂带着花来拜访。留下一朵花，尝一滴蜜，小螃蟹轻轻挥手道别。',
    'A wooden dipper lifts an amber ribbon of honey. A bee arrives with a flower and tastes one sweet drop as Clawd waves goodbye.',
    ({a,v,crab})=>{
      const defs='<defs><linearGradient id="pt48-jar" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ADC7BE" stop-opacity=".65"/><stop offset=".2" stop-color="#ECF0D8" stop-opacity=".2"/><stop offset=".75" stop-color="#F6E0A5" stop-opacity=".12"/><stop offset="1" stop-color="#869C8E" stop-opacity=".58"/></linearGradient><linearGradient id="pt48-honey" x1="0" y1="0" x2="1" y2=".2"><stop stop-color="#B87930"/><stop offset=".28" stop-color="#EDBC62"/><stop offset=".6" stop-color="#DAA13D"/><stop offset="1" stop-color="#A96526"/></linearGradient><linearGradient id="pt48-wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#DFECE0" stop-opacity=".95"/><stop offset="1" stop-color="#A4C5C0" stop-opacity=".45"/></linearGradient></defs>';
      const jarPath='M16.5 7.8h6v1.2l1.1 1.1v4.3q-4.1 1.5-8.2 0v-4.3l1.1-1.1z';
      const stand=p('M14.2 15.1h10.4v.9H14.2z','#B58B60')+r(15,16,1,1.4,'#95714F')+r(22.8,16,1,1.4,'#95714F')+l('M15 15.35h8.8','#D4B183',.16);
      const jarBack=p(jarPath,'url(#pt48-jar)')
        + p('M15.65 10.7q3.85.75 7.7 0v3.4q-3.85 1.25-7.7 0z','url(#pt48-honey)')
        + '<ellipse cx="19.5" cy="10.7" rx="3.85" ry=".62" fill="#E4B75D"/>'
        + '<ellipse cx="19.5" cy="10.74" rx="2.7" ry=".35" fill="#D9A444"/>';
      const lid=at(r(-1.6,-.35,3.2,.7,'#BC965C')+l('M-1.3-.1h2.6','#E5C58B',.12),25.25,14.6,.8,-22);
      const label=p('M17.55 11.25h3.9v2.85h-3.9z','#EDDFB7')
        + p('M19.5 11.75l.92.52v1.05l-.92.5-.92-.5v-1.05z','#BD914D')
        + p('M19.5 12l.67.39v.77l-.67.37-.67-.37v-.77z','#E5BC6C');
      const shine=l('M16.15 10.2v3.3m.35-4.8h1.2','#F2EBD0',.24)
        + l('M22.95 10.45v3.4','#F4D894',.15)
        + '<ellipse cx="19.5" cy="7.9" rx="3" ry=".4" fill="none" stroke="#C7D6C3" stroke-width=".32"/>';
      const liftKeys=[[0,0],[10,0],[31,-38],[58,-38],[68,-24],[76,-24],[93,0],[100,0]];
      const lift=every(percent=>t(0,0,n(value(liftKeys,percent))));
      const tip=percent=>{
        const theta=value(liftKeys,percent)*Math.PI/180,dx=10.6,dy=1.15;
        return [n(9+dx*Math.cos(theta)-dy*Math.sin(theta)),n(10+dx*Math.sin(theta)+dy*Math.cos(theta))];
      };
      const dipper=l('M14 10L23.5 10.6','#A77C4B',.46)+l('M14.2 9.9L22.4 10.38','#D3B07A',.12)
        + '<ellipse cx="23.5" cy="10.6" rx="1.03" ry=".7" fill="#A77A46"/>'
        + '<ellipse cx="23.7" cy="10.6" rx=".84" ry=".58" fill="#D6AD66"/>'
        + l('M22.95 10.12v.95m.48-1.04v1.15m.48-1.1v.98','#97703E',.17)
        + '<ellipse cx="23.6" cy="11.15" rx=".56" ry=".2" fill="#E7B454"/>';
      // Six connected segments share the same sampled dipper-tip trajectory.
      // The falling ribbon narrows and breaks before the bee comes to sip.
      let ribbon='';
      for(let i=0;i<6;i++) {
        const strand=every(percent=>{
          const [x,y]=tip(percent),start=[x,y],end=[19.5,10.75];
          const point=u=>[start[0]+(end[0]-start[0])*u+.55*Math.sin(Math.PI*u),start[1]+(end[1]-start[1])*u];
          const q=point(i/6),z=point((i+1)/6),dx=z[0]-q[0],dy=z[1]-q[1],len=Math.hypot(dx,dy);
          const visible=value([[0,0],[14,0],[19,.8],[35,.8],[43,0],[100,0]],percent);
          return t(n(q[0]),n(q[1]),n(-Math.atan2(dx,dy)*180/Math.PI),1,n(len))+o(n(visible));
        });
        ribbon+=a(l('M0 0v1','#D9A244',.21-i*.017),strand,'0px 0px','linear');
      }
      const apron=p('M5.2 10.9h4.7v2.1H5.2z','#D3C6A4')+r(6.1,11.6,2.8,.75,'#E2D7B6');
      const actor=crab([[0,t(-4)]],apron+a(dipper,lift,'13px 10px','linear'),{right:lift,left:[[0,t()],[49,t()],[60,t(0,0,58)],[69,t(0,0,40)],[77,t(0,0,58)],[86,t()],[100,t()]],eyes:[[0,t(.4,.2)],[27,t(.5,-.5)],[51,t(.5,-.7)],[68,t(.5,-.4)],[90,t(.4,.2)],[100,t(.4,.2)]],mood:'happy',moodAt:60,moodEnd:83});
      const beeKeysX=[[0,24.5],[10,24.5],[27,24],[37,22.8],[46,20],[58,17.4],[66,17.5],[77,22],[93,24.5],[100,24.5]];
      const beeKeysY=[[0,-8],[10,-8],[27,3],[37,6.1],[46,1.5],[58,3.2],[66,3.2],[77,-2],[93,-8],[100,-8]];
      const beeMove=every(percent=>t(n(value(beeKeysX,percent)),n(value(beeKeysY,percent)),n(value([[0,-12],[27,10],[45,-12],[64,5],[78,-15],[100,-12]],percent)))+o(n(value([[0,0],[8,0],[15,1],[84,1],[93,0],[100,0]],percent))));
      const wingShape=p('M0 0C-1-3.1-3.7-3.7-3.2-1.2Q-2.4 .5 0 0z','url(#pt48-wing)')+l('M-.4-.3L-2.6-2.2','#C9D9CF',.09);
      const flap=Array.from({length:41},(_,i)=>[i*2.5,t(0,0,0,1,i%2?.28:1)]);
      const wings=a(wingShape,flap,'0px 0px','linear')+a(at(wingShape,.45,.1,1,80),flap,'0px 0px','linear');
      const bee=wings+p('M-1.1-.45h1.6l.6.6-.3 1.1h-1.6l-.65-.65z','#E5BC62')
        + r(-.62,-.42,.33,1.55,'#715C43')+r(.16,-.42,.31,1.55,'#715C43')
        + '<circle cx="-.97" cy=".05" r=".62" fill="#655A46"/>'
        + '<circle cx="-1.17" cy="-.08" r=".1" fill="#F3E9C8"/>'
        + l('M-1.2-.45l-.3-.7m.65.35l.1-.65','#7C704F',.12)
        + l('M-.5 1.05l-.3.55m.85-.5l.15.5','#766348',.12);
      const blossom=p('M0-1.1Q.75-1.8 .95-.7Q2-.5 1.05.25Q1.3 1.4.2 1Q-.65 1.75-.9.6Q-2 .3-1.1-.5Q-1.1-1.6 0-1.1z','#E4B2BA')+'<circle cx="0" cy="0" r=".4" fill="#EAC677"/>'+l('M.15.9l.3 1.6','#93AB7D',.16);
      const flower=every(percent=>{
        const deposit=value([[0,0],[33,0],[39,1],[91,1],[96,0],[100,0]],percent);
        const x=value(beeKeysX,percent)*(1-deposit)+22.85*deposit;
        const y=(value(beeKeysY,percent)+1.7)*(1-deposit)+8.1*deposit;
        const opacity=value([[0,0],[8,0],[15,1],[87,1],[93,0],[100,0]],percent);
        return t(n(x),n(y),n(-18*deposit),.56)+o(n(opacity));
      });
      const taste=a('<path d="M0-.7Q.65.05 0 .5Q-.65.05 0-.7z" fill="#EDBF69"/>',every(percent=>{
        const [x,y]=tip(percent);return t(x,n(y+.2))+o(n(value([[0,0],[37,0],[46,1],[58,1],[64,0],[100,0]],percent)));
      }),'0px 0px','linear');
      const joy=a(at(star('#E9D6A0'),14.5,-.5,.27),[[0,t()+o(0)],[60,t(0,.4,0,.4)+o(0)],[66,t()+o(.8)],[73,t(0,-.8,15,.4)+o(0)],[100,t()+o(0)]],'14.5px -.5px');
      return defs+stand+jarBack+lid+ribbon+actor+label+shine+a(blossom,flower,'0px 0px','linear')+a(bee,beeMove,'0px 0px','linear')+taste+joy;
    }, .64);

  add('ship-in-a-bottle', '瓶中帆船', 'Ship in a bottle',
    '轻轻拔开软木塞，瓶里的小帆船展开白帆。海浪在玻璃里起伏，扣好塞子，把一小片海收藏起来。',
    'A gentle pull of the cork wakes a tiny sailing ship. White sails unfold over little waves before a pocket of sea is safely corked again.',
    ({a,v,crab})=>{
      const bottle='M10.8 7.7h3.1l1.7-2.2Q16.2 4.65 17.4 4.6h6.2q2.7 0 2.7 2.7v5.2q0 2.25-2.6 2.25h-6.5q-1.3-.1-1.8-1.1l-1.5-2.95h-3.1z';
      const interior='M14.7 7.8l1.5-1.85q.4-.65 1.25-.65h6q2.05 0 2.05 2.2v4.7q0 1.8-1.9 1.8h-6q-.9-.1-1.3-.85l-1.6-3.25z';
      const defs=`<defs><linearGradient id="pt49-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#B8DBD4" stop-opacity=".22"/><stop offset=".42" stop-color="#BCDAD1" stop-opacity=".05"/><stop offset="1" stop-color="#78ABA9" stop-opacity=".32"/></linearGradient><linearGradient id="pt49-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#CDA16D"/><stop offset=".6" stop-color="#A97E57"/><stop offset="1" stop-color="#765B47"/></linearGradient><linearGradient id="pt49-sail" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#F4E8C6"/><stop offset=".5" stop-color="#E0D6BA"/><stop offset="1" stop-color="#BFB99F"/></linearGradient><clipPath id="pt49-interior"><path d="${interior}"/></clipPath></defs>`;
      const stand=p('M13.8 16.05h12.1v.5H13.8z','#ACBDB8')
        + p('M14.8 13.9h1.25l.55 1.25h.8v.85h-3.1v-.85h.6z','url(#pt49-wood)')
        + p('M23.1 13.9h1.25l.55 1.25h.8v.85h-3.1v-.85h.6z','url(#pt49-wood)')
        + l('M14.65 15.5h2.5m6-0h2.15','#D8B484',.12);
      const corkPose=[[0,t()],[10,t()],[23,t(-1,-3,-25)],[73,t(-1,-3,-25)],[84,t(.1,-.15,4)],[88,t()],[100,t()]];
      const cork=r(13.9,7.98,2.2,2.65,'#A9875E')+r(13.9,7.98,.43,2.65,'#D1B17F')+r(15.85,8.15,.25,2.3,'#866A4B')
        + r(14.45,8.43,.28,.12,'#7F6B4E')+r(15.3,9.28,.23,.17,'#7F6B4E')+r(14.6,10,.25,.12,'#D9BD8C');
      const actor=crab([[0,t(-3)]],a(cork,corkPose,'13px 10px'),{right:corkPose,left:[[0,t()],[19,t(0,0,12)],[35,t()],[60,t(0,0,35)],[74,t(0,0,35)],[87,t()],[100,t()]],eyes:[[0,t(.65,0)],[25,t(.65,-.45)],[48,t(.65,-.6)],[74,t(.65,-.6)],[90,t(.65,0)],[100,t(.65,0)]],mood:'happy',moodAt:52,moodEnd:77});
      const mastPose=[[0,t(0,0,-62)],[22,t(0,0,-62)],[40,t(0,0,3)],[46,t()],[77,t()],[94,t(0,0,-62)],[100,t(0,0,-62)]];
      const cloth=p('M.2-5.5L3-1.15H.2Z','url(#pt49-sail)')+l('M.45-4.7L2.55-1.4H.45','#F3EDD7',.1)+l('M.7-3.7l1.4 2.3','#C1BEA8',.1);
      const foresail=p('M-.22-4.5l-2.2 3.55h2.2z','#E7DABD')+l('M-.55-3.55l-1.6 2.35h1.6','#F5EACF',.1);
      const mainSail=a(cloth,[[0,t(0,0,0,.06,1)],[31,t(0,0,0,.06,1)],[44,t(0,0,0,1.06,1)],[49,t()],[75,t()],[88,t(0,0,0,.06,1)],[100,t(0,0,0,.06,1)]],'0px 0px');
      const foreSail=a(foresail,[[0,t(0,0,0,.05,1)],[36,t(0,0,0,.05,1)],[48,t(0,0,0,1.04,1)],[53,t()],[74,t()],[86,t(0,0,0,.05,1)],[100,t(0,0,0,.05,1)]],'0px 0px');
      const pennant=a(p('M0-5.8h1.8l-.35.45.35.4H0z','#C8816D'),[[0,t()],[24,t()],[39,t(0,0,0,1,.6)],[47,t()],[55,t(0,0,0,1,.7)],[64,t()],[72,t(0,0,0,1,.65)],[84,t()],[100,t()]],'0px -5.4px');
      const rig=a(l('M0-5.5L-2.8 0M0-5.5L3.2 0','#BDB998',.12),[[0,o(.2)],[32,o(.2)],[45,o(.8)],[76,o(.8)],[89,o(.2)],[100,o(.2)]]);
      const mast=l('M0 .2v-6','#A78254',.25)+l('M-.15-1h3.2','#A78254',.18)+mainSail+foreSail+pennant+rig;
      const hull=p('M-3.6-.1H3.7L2.3 1.35H-2.3Z','url(#pt49-wood)')
        + l('M-3.2 .2h6.35','#E0C397',.18)+l('M-2.6 .7h5.15','#7E674F',.1)
        + r(-2.2,-.63,4.6,.5,'#CBB38A')+r(-1.1,-.9,1.9,.3,'#DBC79F')
        + '<circle cx="-1.75" cy=".55" r=".12" fill="#524E42"/><circle cx=".1" cy=".55" r=".12" fill="#524E42"/><circle cx="1.8" cy=".55" r=".12" fill="#524E42"/>';
      const ship=at(a(a(mast,mastPose,'0px 0px')+hull,[[0,t()],[26,t()],[40,t(0,-.12,-2)],[53,t(0,0,2)],[66,t(0,-.15,-2)],[77,t(0,0,1.5)],[91,t()],[100,t()]],'0px 1px'),20.25,11.8);
      let sea='';
      for(let i=0;i<3;i++) {
        const y=12.65+i*.38;
        sea+=a(l(`M15.3 ${y}q1-.55 2 0t2 0t2 0t2 0t2 0`,['#79AAA9','#A8C8BD','#6E989C'][i],.22),[[0,t()],[24,t()],[41,t(.45,0)],[58,t(-.35,0)],[75,t(.3,0)],[92,t()],[100,t()]]);
      }
      const water=p('M15.1 12.6q1-.3 2 0t2 0t2 0t2 0t2 0v2.2H15.1z','#91B7B0');
      const glassFront='<path d="'+bottle+'" fill="none" stroke="#8FB6AF" stroke-width=".4"/>'
        + l('M16.65 5.7q.5-.35 1.05-.35h5.2M25.3 8.4v3.2','#DFEADC',.28)
        + l('M17.3 14.05h5.6','#C1D8CB',.19)
        + l('M11.15 7.85v2.55m.65-2.55v2.55','#ACCCC2',.32)
        + a(p('M17.3 5.6h1.2l3.45 8.15h-1.2z','#EFF3DD'),[[0,o(.08)],[37,o(.08)],[57,o(.2)],[75,o(.08)],[100,o(.08)]]);
      const breath=a(l('M8.9 6.7q1-.7 2.1-.2m-1.4-1q1-.35 1.7-.05','#B7CFC3',.17),[[0,t()+o(0)],[24,t()+o(0)],[31,t(.7,-.1)+o(.7)],[40,t(1.9,-.2)+o(0)],[100,t()+o(0)]]);
      const glint=a(at(star('#D7E5D1'),24.8,3.2,.26),[[0,t()+o(0)],[46,t(0,.4,0,.5)+o(0)],[54,t()+o(.8)],[64,t(0,-.4,12,.4)+o(0)],[100,t()+o(0)]],'24.8px 3.2px');
      return defs+stand+p(bottle,'url(#pt49-glass)')+`<g clip-path="url(#pt49-interior)">${water+ship+sea}</g>`+actor+glassFront+breath+glint;
    }, .64);
}
