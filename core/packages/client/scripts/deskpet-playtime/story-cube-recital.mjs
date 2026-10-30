// A small CubeRoot recital. The cube is projected from real cubie sticker
// geometry; each move is followed by its inverse before the next move begins.
export function registerCubeRecital({ add, r, p, l, at, t, o, star, cream, ink }) {
  add('cube-recital', '魔方小剧场', 'Cube recital',
    '挥动指挥棒，悬空的三阶随节拍转动。两组转层各自归位，最后亮起一圈掌声般的小光点。',
    'With a wave of the baton, a floating cube turns to the beat. Two turns find their way home, followed by a gentle circle of applause.',
    ({ a, crab }) => {
      const brass = '#BC955C', bright = '#EBD4A0', teal = '#648F92';
      const defs = '<defs><linearGradient id="pt50-brass" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#98734A"/><stop offset=".35" stop-color="#E6CF99"/><stop offset=".64" stop-color="#B89660"/><stop offset="1" stop-color="#806449"/></linearGradient><linearGradient id="pt50-pedestal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#95B9B6"/><stop offset="1" stop-color="#526F79"/></linearGradient></defs>';
      const ellipse = (cx,cy,rx,ry,fill,extra='') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
      const plinth = ellipse(18,15.9,7.4,.6,'#23353A','opacity=".16"')
        + p('M11.8 14.4h12.4v1.1H11.8z', '#405F68')
        + r(12.1,13.9,11.8,.65,'url(#pt50-pedestal)')
        + l('M12.7 14.15h10.5',bright,.17)
        + r(16.2,12.5,3.6,1.4,teal) + r(17.15,8.2,1.7,4.5,'url(#pt50-brass)')
        + r(16.6,8.2,2.8,.55,bright) + r(16.6,12.1,2.8,.55,brass)
        + ellipse(18,7.9,5.2,1.05,'#46646F')
        + ellipse(18,7.58,5.35,.93,'url(#pt50-brass)')
        + ellipse(18,7.53,4.35,.58,'#779F9F')
        + ellipse(18,7.53,3.9,.42,'none',`stroke="${bright}" stroke-width=".12"`);
      let pedestalLight = '';
      for (let i=0;i<7;i++) {
        const x=14.5+i*1.17;
        pedestalLight += a(r(x,14.2,.3,.32,cream), [[0,o(.3)],[64+i,o(.3)],[68+i,o(.9)],[74+i,o(.9)],[86+i,o(.3)],[100,o(.3)]]);
      }

      const ease = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
      const pulse = (s,start,peak,end) => s<start || s>end ? 0 : s<peak ? ease((s-start)/(peak-start)) : 1-ease((s-peak)/(end-peak));
      const rot = (v, axis, angle) => {
        const c=Math.cos(angle),s=Math.sin(angle),[x,y,z]=v;
        return axis===0 ? [x,y*c-z*s,y*s+z*c] : axis===1 ? [x*c+z*s,y,-x*s+z*c] : [x*c-y*s,x*s+y*c,z];
      };
      const dot = (x,y) => x.reduce((n,v,i)=>n+v*y[i],0);
      const camera=[.577350269,.577350269,.577350269];
      const directions=[
        {n:[1,0,0],u:[0,1,0],v:[0,0,1],color:'#83B7A3'},
        {n:[-1,0,0],u:[0,1,0],v:[0,0,-1],color:'#87A6CB'},
        {n:[0,1,0],u:[1,0,0],v:[0,0,-1],color:'#F5E7C6'},
        {n:[0,-1,0],u:[1,0,0],v:[0,0,1],color:'#E1BB66'},
        {n:[0,0,1],u:[1,0,0],v:[0,1,0],color:'#D99383'},
        {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],color:'#DEAB6B'},
      ];
      const stickers=[];
      for(const face of directions) for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) {
        const center=face.n.map((n,k)=>n*1.507+face.u[k]*i+face.v[k]*j);
        const cubie=face.n.map((n,k)=>n+face.u[k]*i+face.v[k]*j);
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>center.map((x,k)=>x+.445*(u*face.u[k]+v*face.v[k])));
        stickers.push({center,cubie,corners,normal:face.n,color:face.color});
      }
      function cubeFrame(seconds) {
        let axis=0,angle=0;
        if(seconds<3.5) angle=Math.PI/2*pulse(seconds,.8,1.85,3.15);
        else {axis=2;angle=-Math.PI/2*pulse(seconds,3.55,4.65,5.85);}
        const yaw=.055*Math.sin(seconds*Math.PI/4);
        const lift=.23*(1-Math.cos(seconds*Math.PI/4));
        const transform = (v,moving) => rot(moving?rot(v,axis,angle):v,1,yaw);
        const project = ([x,y,z]) => [18+2.35*.70710678*(x-z),-1.6-lift+2.35*(.40824829*x-.81649658*y+.40824829*z)];
        const surfaces=[];
        function addSurface(corners,normal,color,moving,tiles) {
          const n=transform(normal,moving);
          if(dot(n,camera)<.00001) return;
          const vertices=corners.map(v=>transform(v,moving));
          const center=vertices.reduce((c,v)=>c.map((x,k)=>x+v[k]/vertices.length),[0,0,0]);
          surfaces.push({vertices,depth:dot(center,camera),color,
            tiles:tiles.map(tile=>({color:tile.color,vertices:tile.corners.map(v=>transform(v,moving))}))});
        }
        function box(min,max,moving) {
          for(const f of directions) {
            const ax=f.n.findIndex(v=>v!==0), sign=f.n[ax];
            const c=min.map((v,k)=>(v+max[k])/2);c[ax]=sign>0?max[ax]:min[ax];
            const hu=dot(f.u.map(Math.abs),max.map((x,k)=>(x-min[k])/2));
            const hv=dot(f.v.map(Math.abs),max.map((x,k)=>(x-min[k])/2));
            const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>c.map((x,k)=>x+u*hu*f.u[k]+v*hv*f.v[k]));
            const tiles=stickers.filter(s=>s.normal.every((v,k)=>v===f.n[k]) && (s.cubie[axis]>.5)===moving);
            addSurface(corners,f.n,'#36434A',moving,tiles);
          }
        }
        const restMin=[-1.5,-1.5,-1.5],restMax=[1.5,1.5,1.5];restMax[axis]=.485;
        const turnMin=[-1.5,-1.5,-1.5],turnMax=[1.5,1.5,1.5];turnMin[axis]=.515;
        box(restMin,restMax,false);box(turnMin,turnMax,true);
        // Paint stickers with their supporting plane. Sorting individual tiles
        // by their centroids would incorrectly hide distant rows behind the
        // same plane's larger body polygon.
        surfaces.sort((a,b)=>a.depth-b.depth);
        return surfaces.map(s=>{
          const points=s.vertices.map(project).map(([x,y])=>`${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
          return `<polygon points="${points}" fill="${s.color}"/>`+s.tiles.map(tile=>{
            const q=tile.vertices.map(project).map(([x,y])=>`${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
            return `<polygon points="${q}" fill="${tile.color}" stroke="#36434A" stroke-width=".025" stroke-linejoin="round"/>`;
          }).join('');
        }).join('');
      }
      // Twenty vector samples per second preserve the perspective during turns.
      // Visibility keys use near-discrete changes with no crossfade.
      const fps=20,frameCount=160,raw=Array.from({length:frameCount},(_,i)=>cubeFrame(i/fps));
      let cube='';
      for(let i=0;i<raw.length;i++) {
        const start=Number((i*100/frameCount).toFixed(5)),end=Number(((i+1)*100/frameCount).toFixed(5));
        const frames=i===0?[[0,o(1)],[end-.001,o(1)],[end,o(0)],[99.999,o(0)],[100,o(1)]]
          : [[0,o(0)],[start-.001,o(0)],[start,o(1)],[end-.001,o(1)],[end,o(0)]];
        cube += a(raw[i],frames,'0px 0px','linear');
      }
      const flourish=a(ellipse(18,6.15,4.1,.67,'none',`stroke="${bright}" stroke-width=".16"`),
        [[0,t()+o(.2)],[61,t()+o(.2)],[70,t(0,-.45,0,1.18,.9)+o(.8)],[78,t(0,-.8,0,1.45,.8)+o(0)],[90,t()+o(0)],[100,t()+o(.2)]],'18px 6.15px');
      let applause='';
      for(let i=0;i<7;i++) {
        const theta=(i/6)*Math.PI, x=18+Math.cos(theta)*6.5, y=-3.5-Math.sin(theta)*7.4;
        applause+=a(at(star(i%2?bright:'#98CBC5'),x,y,.24),[[0,t()+o(0)],[70+i,t(0,.6,0,.5)+o(0)],[73+i,t()+o(.85)],[79+i,t(0,-.45,20,.75)+o(.7)],[88+i,t(0,-.8,30,.3)+o(0)],[100,t()+o(0)]]);
      }
      const gesture=[[0,t()],[7,t(0,0,-15)],[12,t(0,0,-32)],[20,t(0,0,-32)],[33,t()],[43,t(0,0,-18)],[49,t(0,0,-36)],[58,t(0,0,-36)],[66,t()],[74,t(0,0,-18)],[84,t(0,0,-18)],[94,t()],[100,t()]];
      const pointer=l('M14 9.8l3.6-5.5',bright,.27)+ellipse(17.6,4.3,.24,.24,cream);
      const bow=p('M6.4 11.4l-1.4-.7v1.6l1.4-.6m1.1-.3l1.4-.7v1.6l-1.4-.6', '#587E88')+r(6.35,11.3,1.1,.55,bright);
      const actor=at(crab([[0,t()],[10,t(0,-.15,-3)],[23,t(0,0,-3)],[32,t()],[48,t(0,-.1,-4)],[59,t(0,0,-4)],[68,t()],[74,t(0,.32,4)],[83,t()],[100,t()]],
        bow+a(pointer,gesture,'13px 10px'),{
          right:gesture,left:[[0,t()],[68,t()],[75,t(0,0,27)],[84,t(0,0,27)],[94,t()],[100,t()]],
          eyes:[[0,t(.45,-.3)],[12,t(.6,-.6)],[30,t(.45,-.3)],[48,t(.6,-.6)],[67,t(.45,-.3)],[92,t(.45,-.3)],[100,t(.45,-.3)]],
          mood:'happy',moodAt:72,moodEnd:88,
        }),0,0);
      const plaque=r(-6.2,14.9,5.4,.45,teal)+l('M-5.5 13h.6l.7 1.1 1.1-3h1.2',brass,.32);
      return defs+plinth+pedestalLight+flourish+cube+applause+actor+plaque;
    }, .81);
}
