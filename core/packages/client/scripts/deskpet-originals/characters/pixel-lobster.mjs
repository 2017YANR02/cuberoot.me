import {C,p,r,face} from './art.mjs';
const red='#E34432',shade='#A72831',dark='#672536',light='#FA7650';
const antenna=(x,y,dir)=>Array.from({length:12},(_,i)=>r(x+dir*Math.floor(i*.7)*4,y-i*5,5,6,red)).join('');
export default {id:'pixel-lobster',number:61,zh:'像素钳',en:'Pixel Lobster',pixel:true,locomotion:'walk',gesture:'claw',render({joint:j}){
 const tail=j('tail',p('M147 137h12v8h12v8h12v9h14v-7h15v8h8v12h-7v10h-18v-7h-12v-5h-17v-9h-12Z',dark)+p('M153 142h7v9h13v8h11v10h-17v-9h-10Z',red)+p('M192 162h14v7h8v8h-13v-6h-8Z',red)+p('M188 174h13v9h-10v-4h-10v-7h7Z',light),[150,143]);
 const feet=[[102,154,-20,'footLeft'],[116,163,-12,'footRight'],[132,165,5,'footLeft'],[149,161,13,'footRight']].map(([x,y,dx,n])=>j(n,p(`M${x} ${y}h5v9h${dx}v17h-4v8h-4v-10h3v-11h${-dx}Z`,dark)+r(x,y,5,10,red),[x,y])).join('');
 const body=p('M101 107h18v-6h16v7h13v9h13v17h7v20h-9v13h-28v-8h-14v-9h-12v-15h-9v-16h5Z',dark)+p('M106 111h14v-5h13v7h13v9h10v14h7v15h-9v10h-20v-9h-16v-12h-11v-16h-6v-9h5Z',red)+p('M129 112h12v10h11v16h-7v8h-14v-9h-10v-12h-8v-10h9v7h7Z',light)+p('M118 142h14v12h21v7h-20v-7h-15Z',shade);
 const left=j('left',p('M107 126h-14v-11H82V96H66V85H47v8h-9v17h5v17h11v11h21v-10h20v9h12Z',dark)+p('M91 119H78v-16H65V90H50v9h-8v10h6v14h11v10h12v-10h20Z',red)+p('M48 91V76h8V65h9V55h10v11h-6v12h-5v19Z',dark)+p('M52 92V78h8V67h9V60h3v7h-6v12h-5v17Z',red)+j('clawLeft',p('M65 103h15v-8h5V78h-6V67h-8v8h5v18h-6v5h-5Z',red,dark,1),[68,102]),[104,129]);
 const right=j('right',p('M133 117h17v-12h15V90h9V77h12v14h-5v18h-10v6h-16v11h-22Z',dark)+p('M139 120h13v-12h16V94h10V82h5v10h-5v14h-11v6h-14v11h-14Z',red)+j('clawRight',p('M167 105h-9V94h-5V79h7v9h5v13h5Z',red,dark,1),[170,106]),[136,123]);
 const head=j('antennaLeft',antenna(108,109,-1),[108,110])+j('antennaRight',antenna(119,109,1),[119,110])+p('M100 115v-11h-4V93h8v12h3v10Zm15 0v-9h5V96h8v12h-5v7Z',dark)+j('blink',j('gaze',r(94,91,10,11,C.ink)+r(97,92,3,3,C.cream)+r(120,94,10,11,C.ink)+r(123,95,3,3,C.cream),[112,99]),[112,99])+j('mouth',p('M107 118h3v4h7v-4h3v7h-13Z',dark),[114,122]);
 return j('body',tail+feet+left+right+body+j('head',head,[114,116]),[131,139]);
}};
