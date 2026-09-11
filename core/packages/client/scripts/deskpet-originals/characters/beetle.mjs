import {C,p,r,face} from './art.mjs';
const dark='#172B43';
export default {id:'beetle',number:25,zh:'转翼甲虫',en:'Turnwing Beetle',pixel:true,locomotion:'walk',gesture:'wing',render({joint:j}){
 const feet=[[78,166,'footLeft'],[105,176,'footRight'],[137,177,'footLeft'],[171,161,'footRight']].map(([x,y,n])=>j(n,p(`M${x} ${y}h10v9h9v13h-7v7h-14v-9h-6v-13h8Z`,dark)+r(x+1,y+15,11,10,C.gold),[x+5,y+3])).join('');
 const abdomen=p('M89 85h12V73h25v-6h32v8h20v12h15v18h10v42h-7v15h-17v12h-50v-7h-20v-14H91v-23h-9v-29h7Z',dark);
 const left=j('left',p('M98 88h13V77h19v-5h11v87h-13v-9h-15v-18h-12v-25h-3Z',C.blue)+p('M101 103h39v35h-20v-9h-12v-15h-7Z',C.gold)+p('M119 142h21v22h-9v-7h-12Z',C.coral)+r(111,88,10,4,C.cream),[143,84]);
 const right=j('right',p('M146 74h14v8h18v12h12v18h8v31h-8v17h-17v9h-26Z',C.coral)+p('M147 103h41v15h10v22h-30v-8h-21Z',C.cream)+p('M168 141h29v11h-9v12h-20Z',C.blue)+p('M147 137h18v27h-18Z',C.gold),[144,84]);
 const eyes=j('blink',r(77,145,14,16,C.cream)+r(107,145,14,16,C.cream)+j('gaze',r(81,149,8,10,C.ink)+r(111,149,8,10,C.ink)+r(82,149,3,3,C.cream)+r(112,149,3,3,C.cream),[99,153]),[99,153]);
 const head=p('M72 139h12v-9h28v8h15v12h6v25h-9v8H81v-6H68v-13h-5v-18h9Z',dark)+p('M77 143h12v-9h20v9h14v12h6v17h-10v7H85v-7H72v-19h5Z',C.navy)+eyes+j('mouth',p('M94 165h3v3h4v-3h3v6H94Z',C.cream),[99,168])+r(76,165,5,4,C.coral)+r(118,165,5,4,C.coral)+j('antennaLeft',p('M83 139h-5v-12h-7v-12h-7v-8h8v7h6v11h5Z',dark)+r(62,102,11,10,C.gold),[83,140])+j('antennaRight',p('M109 138v-16h7v-16h8v10h-4v10h-6v12Z',dark)+r(117,101,11,10,C.gold),[109,139]);
 return j('body',feet+abdomen+left+right+j('head',head,[100,165]),[129,145]);
}};
