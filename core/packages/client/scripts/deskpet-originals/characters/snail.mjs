import { C, p, e, line, r, face } from './art.mjs';
export default { id:'snail', number:18, zh:'格格蜗', en:'Patchshell Snail', pixel:false, locomotion:'slide', gesture:'paw', render({joint:j}) {
  const shell = p('M120 105Q134 90 171 99Q193 104 194 133L193 163Q180 181 143 178L114 161Z','#71844E','#53683D',2) + [[125,108,C.cream],[145,106,C.cream],[166,108,C.cream],[124,129,C.blue],[145,129,C.blue],[166,131,C.blue],[126,150,C.orange],[147,151,C.orange],[168,152,C.orange]].map(([x,y,c])=>r(x,y,18,18,c,5)).join('') + p('M188 114l7 9v32l-9 11Z','#4C653C');
  const body=p('M80 120Q92 110 105 119Q116 128 113 155Q128 175 182 177Q195 177 201 185Q185 198 127 193L90 190Q70 184 71 157Z',C.green,'#5F784A',1.6)+p('M79 136Q91 132 102 139L100 172Q111 185 155 188L97 186Q78 179 79 160Z',C.cream);
  const stalk=(x,lean,name)=>j(name,line(`M${x} 125Q${x+lean} 101 ${x+lean} 86`,C.green,9)+e(x+lean,84,11,12,C.cream,'#9FAB78',1.3)+j('blink',j('gaze',e(x+lean,84,5.3,7,C.brown)+e(x+lean-1.4,81,1.5,2,C.cream),[x+lean,84]),[x+lean,84]),[x,123]);
  const head=j('left',stalk(80,-4,'antennaLeft'),[80,123])+j('right',stalk(102,5,'antennaRight'),[102,123])+e(90,132,24,25,C.green)+e(89,138,18,19,C.cream)+e(75,141,4,3,'#EBB18C')+e(103,141,4,3,'#EBB18C')+j('mouth',line('M84 140q5 6 10 0',C.brown,1.8),[89,142]);
  return j('body',body+shell+j('head',head,[92,154]),[123,170]);
} };
