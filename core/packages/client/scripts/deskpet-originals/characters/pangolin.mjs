import {C,p,e,line,face,paper} from './art.mjs';
const scale=(x,y,w,h,c,rot=0)=>`<g transform="rotate(${rot} ${x+w/2} ${y})">${paper(`M${x+3} ${y}Q${x+w/2} ${y-4} ${x+w-3} ${y}Q${x+w+1} ${y+3} ${x+w-2} ${y+h-6}Q${x+w/2} ${y+h+5} ${x+2} ${y+h-6}Q${x-1} ${y+3} ${x+3} ${y}Z`,c,'#AE8060')}</g>`;
export default {id:'pangolin',number:23,zh:'卷卷穿山甲',en:'Curlscale Pangolin',pixel:false,locomotion:'walk',gesture:'paw',render({joint:j}) {
 const tail=j('tail',p('M88 132Q65 135 63 159Q61 190 96 198Q142 210 172 179Q183 167 177 147Q174 165 154 168Q140 190 111 182Q86 179 92 158Z',C.orange)+scale(65,151,31,26,C.blue,-18)+scale(70,173,30,26,C.cream,-49)+scale(94,185,30,24,C.orange,-77)+scale(120,185,28,24,C.blue,-107)+scale(146,176,27,24,C.cream,-133)+scale(164,162,22,20,C.orange,-154),[84,146]);
 const feet=j('footLeft',p('M115 171q-6 13 1 20h14v-5l-9-2l7-9Z',C.brown),[120,173])+j('footRight',p('M143 168q6 10 14 12l7-7l-7-7Z',C.brown),[145,171]);
 const body=p('M95 98Q124 91 144 120L148 166Q128 186 100 169Q78 147 95 98Z',C.cream)+p('M111 132Q133 127 139 150Q132 173 111 165Z','#E6CAA0');
 const armor=p('M71 151Q65 119 90 94Q112 81 136 96L119 137L99 165Z',C.blue)+scale(72,114,34,29,C.blue,-10)+scale(69,137,33,29,C.blue,-22)+scale(86,93,34,27,C.orange,0)+scale(111,89,31,25,C.orange,15)+scale(130,100,25,21,C.orange,23);
 const hands=j('left',p('M113 135Q100 140 107 150L117 155L122 148Z',C.cream)+p('M111 147l-1 9l4-5l1 8l3-7l3 6l1-9Z',C.brown),[114,136])+j('right',p('M140 131Q157 137 151 145L142 151L136 143Z',C.cream)+p('M145 142l8 2l-4 10l-2-5l-5 8l1-9Z',C.brown),[140,134]);
 const head=p('M112 98Q137 89 153 111L171 123Q174 132 164 133L141 129Q111 136 104 117Z',C.cream)+scale(117,91,27,21,C.orange,20)+p('M141 100l18 21l-15-6Z',C.orange)+face(j,{x:143,y:116,gap:9,size:4.2,smile:false})+e(168,128,5,4,C.brown)+j('mouth',line('M150 128q5 2 10 0',C.brown,1.4),[155,128]);
 return j('body',tail+feet+body+armor+hands+j('head',head,[126,126]),[117,150]);
}};
