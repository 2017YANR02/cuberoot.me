import {C,p,r,face} from './art.mjs';
const orange='#EE8944',dark='#9D4329';
export default {id:'hermit-crab',number:11,zh:'方壳寄居蟹',en:'Boxshell Hermit Crab',pixel:true,locomotion:'walk',gesture:'claw',render({joint:j}){
 const shell=p('M110 80h12V68h56v8h20v12h12v16h8v62h-10v14h-80v-12h-18Z',C.navy)+p('M122 80h54v8h16v74h-62v-12h-8Z',C.cream)+r(134,89,16,17,C.orange)+r(156,89,16,17,C.blue)+r(178,97,10,17,C.blue)+r(134,112,16,17,C.blue)+r(156,112,16,17,C.orange)+r(178,119,10,17,C.cream)+r(134,135,16,17,C.cream)+r(156,135,16,17,C.blue)+r(178,141,10,17,C.orange)+p('M199 101h7v54h-7v13h-9v-7h4v-53h5Z',C.blue);
 const legs=[[87,165,'footLeft'],[113,168,'footRight'],[146,170,'footLeft'],[170,168,'footRight']].map(([x,y,n])=>j(n,p(`M${x} ${y}h10v8h8v12h-6v9h-6v-14h-6Z`,dark)+p(`M${x+3} ${y+2}h5v8h8v12h-4v-9h-9Z`,orange),[x+5,y])).join('');
 const body=p('M79 134h11v-8h32v8h13v10h8v25h-9v9H91v-7H78v-13h-7v-15h8Z',dark)+p('M84 136h13v-6h22v8h12v10h7v17h-9v10H92v-9H81v-15h-5v-7h8Z',orange)+p('M94 154h24v9h7v8H98v-7h-4Z',C.cream);
 const eyestalk=(x,y)=>p(`M${x} ${y+18}h5v27h-5Z`,dark)+p(`M${x-6} ${y}h17v6h5v17h-5v5h-17v-6h-4v-17h4Z`,orange)+j('blink',j('gaze',r(x-2,y+5,12,16,C.ink)+r(x,y+5,5,6,C.cream),[x+4,y+12]),[x+4,y+12]);
 const head=j('antennaLeft',eyestalk(87,100),[89,140])+j('antennaRight',eyestalk(116,103),[119,143])+j('mouth',p('M98 148h16v5h-5v6h-6v-6h-5Z',dark),[106,151]);
 const left=j('left',p('M83 148H70v-8H58v-7H43v-11h-7v-18h7v-9h17v8h10v11h-5v8h-7v10h16v8h9Z',dark)+p('M44 103h13v8h8v10h-8v8H45v-10h-5v-11h4Z',orange)+r(45,104,6,11,'#F6B577'),[83,146]);
 const right=j('right',p('M132 153h13v-7h19v8h7v24h-6v11h-18v-7h-8v-15h-7Z',dark)+p('M146 152h13v8h7v16h-6v9h-10v-7h-7v-15h3Z',orange)+r(148,155,5,11,'#F6B577'),[134,154]);
 return j('body',shell+legs+body+left+right+j('head',head,[107,142]),[122,154]);
}};
