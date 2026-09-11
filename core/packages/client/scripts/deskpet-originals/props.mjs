// Props reuse the existing pet artwork. Books face the animal, never the viewer.
import {at,p,line,rect,circle,star,heart,moon,butterfly,book,umbrella,gold,cream,ink,pink,mint,blue,violet} from '../deskpet-rootbeast/rig.mjs';
import {track,transform} from './motion.mjs';
export function props(character,scene,a,{plan={},pivots={}}={}){
  const [fx,fy]=character.anchors.face;
  const [,footY]=character.anchors.feet;
  const ground=Math.min(207,footY+5);
  const side=fx<120?175:68;
  const noHands=character.id==='snail'||character.id==='ray';
  const hand=character.anchors.right[1]>character.anchors.left[1]?'right':'left';
  const [hx,hy]=character.anchors[hand];
  const show=(html,start=13,end=88)=>a(html,[[0,'opacity:0;'],[start-1,'opacity:0;'],[start,'opacity:1;'],[end,'opacity:1;'],[end+1,'opacity:0;'],[100,'opacity:0;']]);
  const moving=(html,keys,origin='0px 0px')=>a(html,track(...keys),origin);
  const sparkle=(x,y,start=48)=>show(at(moving(star(gold),[[start,0,0,0,.3],[start+12,0,-5,40,1],[start+24,0,-8,65,.2]]),x,y,.22),start,start+25);
  const dot=(x,y,r=2,color=cream)=>circle(x,y,r,color);
  // A visible support makes low objects readable as things the pet uses, rather
  // than stickers hovering over its belly. The legs always meet its ground plane.
  const support=(x,y,width=44)=>at(line(`M${-width/2+5} 1V${ground-y}M${width/2-5} 1V${ground-y}`,ink,2)+rect(-width/2,-2,width,4,mint,2),x,y);
  const attached=(html,joint)=>{
    html=`<g data-prop-attached="${joint}">${html}</g>`;
    for(const name of [joint,'body'])if(plan[name]&&pivots[name])html=a(html,plan[name],`${pivots[name][0]}px ${pivots[name][1]}px`,character.pixel?'steps(10,end)':'cubic-bezier(.4,0,.25,1)');
    return html;
  };
  const leaf=p('M-15 8Q-14-13 15-13 17 11-15 8Z',mint)+line('M-13 7 10-8','#387C70',1.3);
  const flower=line('M0 0Q-4 12 0 28','#3D826F',2)+at(leaf,-6,18,.4)+[0,60,120,180,240,300].map(r=>at(circle(0,-7,5,pink),0,0,1,r)).join('')+circle(0,0,4,gold);
  const bowl=p('M-20-3H20Q18 10 0 11-17 10-20-3Z',cream)+p('M-17-3H17Q0 3-17-3Z',blue);
  const ball=circle(0,0,12,gold)+p('M0-12Q-8 0 0 12 8 0 0-12Z',cream);
  let back='',front='';
  switch(scene.id){
    case 'heart':front=show(at(moving(heart,[[27,0,7,0,.3],[44,0,-3,0,.7],[67,0,-16,0,.85],[86,0,-22,0,.3]]),side,fy,.52),25,86);break;
    case 'surprised':front=show(at(line('M0-11V0M0 6V7',gold,3),side,fy-16),24,60);break;
    case 'sneeze':front=show(at(line('M0 0 10-7M2 5H16M0 10 10 17',cream,2),fx+20,fy+10),43,52);break;
    case 'sleep':case 'doze':back=show(at(moving(moon,[[28,0,-3],[70,0,2]]),side,63,.25),15,90);break;
    case 'read':{
      const x=fx,y=ground-16;
      front=show(at(book,x,y,.25),12,91);
      front+=show(at(a(p('M0-25Q18-37 58-31L58-24Q22-22 0-17Z',cream),[[0,transform([0,0,0,.04,1])],[46,transform([0,0,0,.04,1])],[56,transform([0,0,-3,1,1])],[65,transform([0,0,-4,.04,1])],[100,transform([0,0,-4,.04,1])]],'0px -22px'),x,y,.25),46,67);break;
    }
    case 'letter':{
      const x=fx,y=ground-9;
      front=show(at(`<g transform="scale(1 .5)">${rect(-22,-11,44,28,cream,2)+line('M-21-10 0 5 21-10',pink,1.4)+a(p('M-22-11 0 5 22-11Z',pink),[[0,transform()],[31,transform()],[45,transform([0,0,0,1,-1])],[80,transform([0,0,0,1,-1])],[100,transform()]],'0px -11px')}</g>`,x,y),13,88);break;
    }
    case 'draw':{
      const x=noHands?fx:Math.max(43,Math.min(197,hx)),y=noHands?ground-9:Math.min(ground-16,hy+18);
      front=show((noHands?'':support(x,y+12,58))+at(p('M-29-10 20-15 29 12-20 16Z',cream)+show(line('M-13 2Q-8-10 0 0T15 0',mint,2),44,90),x,y),13,89);
      if(noHands){
        // Snails leave a trail; a ray paints with a fin. Neither gets an invented hand.
        front+=show(at(circle(-17,1,4,mint)+circle(-10,4,2,mint),x,y),25,89);
      }else{
        const tipX=9,tipY=y-hy;
        front+=show(attached(at(line(`M0 0 ${tipX} ${tipY}`,gold,4)+line(`M${tipX*.8} ${tipY*.8} ${tipX} ${tipY}`,ink,2),hx,hy),hand),13,89);
      }
      break;
    }
    case 'music':{
      back=show(at(rect(-15,-20,30,40,violet,5)+circle(0,7,8,ink)+circle(0,-10,4,ink),side,ground-17),12,91);
      front=show(at(moving(line('M0 10V-8L13-11V5',pink,2)+circle(-3,10,4,pink)+circle(10,5,4,pink),[[25,0,-4,-7],[53,0,3,7],[80,0,-7,-4]]),side,fy-25),16,87);break;
    }
    case 'drum':{
      const x=noHands?fx:Math.max(40,Math.min(200,hx)),y=noHands?ground-14:Math.min(ground-14,hy+24);
      front=show(support(x,y+14,38)+at(rect(-22,-13,44,27,blue,3)+p('M-22-13H22L17-19H-17Z',cream)+line('M-20-10-7 11 6-10 20 11',gold,2),x,y),12,88);
      for(const beat of [26,42,66])front+=show(at(line('M-13-5-16-9M13-5 16-9',gold,1.5),x,y-20),beat,beat+5);
      break;
    }
    case 'ball':front=show(moving(at(ball,fx+27,ground-8),[[25,0,0],[39,24,-3,65],[54,33,0,125],[68,15,-2,65],[78,0,0]],`${fx+27}px ${ground-8}px`),12,88);break;
    case 'bubbles':{
      for(let i=0;i<3;i++){const x=side+(i-1)*14,y=fy+18;front+=show(moving(`<circle cx="${x}" cy="${y}" r="${6+i*2}" fill="none" stroke="${cream}" stroke-width="1.5"/>`+line(`M${x-3} ${y-3}q1-3 4-3`,cream,1),[[15+i*8,0,0],[44+i*8,(i-1)*10,-28],[64+i*7,(i-1)*15,-48]]),15+i*8,66+i*7);}
      front+=sparkle(side,fy-28,62);break;
    }
    case 'butterfly':front=show(moving(at(a(butterfly,[[0,transform()],[50,transform([0,0,0,.25,1])],[100,transform()]],'0px 0px','steps(8)'),side,fy-25,.24),[[20,-14,4],[36,21,-8],[56,-10,-23],[77,25,-6]]),12,89);break;
    case 'leaf':front=show(at(moving(leaf,[[18,0,0,-20],[34,22,15,18],[49,13,37,-16],[63,28,52,12],[76,31,53,0]]),fx-30,fy-44),12,88);break;
    case 'flower':{
      const x=Math.min(204,fx+39),y=Math.min(fy+19,ground-40);
      front=show(at(flower,x,y)+line(`M${x} ${y+27}V${ground-9}`,mint,2)+at(p('M-9-10H9L6 0H-6Z',violet)+rect(-10,-12,20,4,cream,1),x,ground),12,90);break;
    }
    case 'water':front=show(at(p('M-25 0Q-14-8 10-4 34 0 18 7-6 13-25 0Z',blue),fx+27,ground),12,87)+show(at(moving(line('M-12 0-17-9M0-1V-16M12 0 20-11',blue,2),[[37,0,0,0,.4],[44,0,-2,0,1],[52,0,3,0,.2]]),fx+27,ground-5),36,53);break;
    case 'rain':{
      back=show(at(umbrella,109,73,.52),12,92);
      for(let i=0;i<5;i++) back+=show(moving(line(`M${31+i*43} 36l-3 9M${24+i*43} 101l-3 9`,blue,1.7),[[20,0,0],[73,-7,50]]),14,83);break;
    }
    case 'wind':front=show(at(moving(leaf,[[22,4,2,-12],[40,-25,5,60],[63,-70,16,120],[78,-135,24,230]]),214,fy),17,79)+show(line('M194 63q-22-8-47 0M214 85q-18-7-31-1',cream,1.5),24,60);break;
    case 'star':back=show(at(moving(star(gold),[[25,0,-2,15,.8],[57,0,-5,-10,1],[79,0,-1,8,.8]]),side,58,.45),12,91);break;
    case 'lantern':{
      back=show(at(moving(line('M0-27V-15',ink,1.4)+rect(-11,-15,22,26,pink,5)+line('M-7-12V8M0-12V8M7-12V8',gold,1.2)+line('M0 12V22',gold,2),[[22,0,0,-12],[44,0,0,12],[65,0,0,-8],[84,0,0,0]],'0px -27px'),side,70),12,92);break;
    }
    case 'gift':front=show(at(rect(-20,-12,40,27,violet,3)+rect(-3,-12,6,27,gold,0)+moving(rect(-22,-17,44,7,pink,2)+line('M-4-17Q-13-27-15-21-10-15-4-17M4-17Q13-27 15-21 10-15 4-17',gold,1.5),[[26,0,0],[43,48,8,12],[68,48,8,12],[84,0,0]]),fx,ground-15),12,90)+sparkle(fx+44,ground-31,54);break;
    case 'snack':{
      const x=fx+9,y=Math.min(ground-17,fy+25);
      front=show(support(x,y+12,34)+at(p('M-17 0Q0-6 17 0 0 8-17 0Z',cream),x,y+10),12,88)+show(at(circle(0,0,9,gold)+dot(-3,-3,1.2,ink)+dot(3,3,1.2,ink),x,y),12,43)+show(at(p('M0-9A9 9 0 1 0 8 4Q2 5 4-1-2 1 0-9Z',gold)+dot(-3,-3,1.2,ink),x,y),44,88);break;
    }
    case 'tea':{
      const y=Math.min(ground-17,fy+25);
      front=show(support(fx,y+11)+at(bowl,fx,y),12,91);
      front+=show(at(moving(line('M-6 0q-4-5 0-10M6 1q4-5 0-9',cream,1.3),[[20,0,0],[43,0,-4],[66,0,-8]]),fx,y-5),15,33);break;
    }
    case 'balance':back=show(at(p('M-37 0Q-27-17 0-12 29-18 37 0Z',mint)+line('M-27-1 28-1','#387C70',1.5),120,ground),12,88);break;
    case 'peek':case 'hide':front=at(leaf,103,156,4.2,scene.id==='peek'?-28:15);break;
    case 'chase':front=show(at(moving(line('M0 0Q15-14 28-4T49-6',pink,4),[[18,-17,0,-8],[40,5,-4,12],[55,15,-15,-9],[76,28,-2,8]]),155,fy+5),12,87);break;
    case 'goodnight':back=show(at(moon,side,60,.25),12,93);front=show(at(rect(-27,-7,54,16,violet,7)+line('M-21-3Q0-8 21-3',cream,1.2),fx,ground-4),45,93);break;
    case 'celebrate':{
      for(let i=0;i<9;i++){const x=36+i*21;front+=show(at(moving(rect(-2,-4,4,8,[pink,gold,mint][i%3],1),[[15+i*2,0,0],[42+i*2,(i%2?1:-1)*8,43,80],[68+i*2,(i%2?1:-1)*12,104,170]]),x,48),15+i*2,70+i*2);}break;
    }
  }
  return {back,front};
}
