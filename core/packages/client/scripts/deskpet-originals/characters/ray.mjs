import { C,p,e,line,face } from './art.mjs';
export default { id:'ray',number:19,zh:'方尾鳐',en:'Ribbon Ray',pixel:false,locomotion:'swim',gesture:'fin',render({joint:j}) {
 const tail=j('tail',p('M137 122Q183 91 185 59Q190 87 169 114L145 137Z',C.blue),[140,127]);
 const left=j('left',p('M98 120Q64 119 30 105Q27 146 80 169L108 161Z',C.blue)+p('M30 105Q54 120 80 145L95 166Q51 157 30 105Z',C.lightBlue),[97,138]);
 const right=j('right',p('M141 119Q174 120 211 110Q208 151 158 170L133 158Z',C.blue)+p('M211 110Q185 120 161 145L151 167Q194 156 211 110Z',C.lightBlue),[141,139]);
 const body=p('M75 132Q98 97 122 90Q145 98 167 134L161 158Q121 193 80 158Z',C.blue)+p('M77 145Q120 171 165 145Q157 178 122 180Q87 176 77 145Z',C.cream)+line('M91 157l3 6m4-5l3 6m40-5l-3 6m10-9l-3 6',C.lightBlue,2.8);
 const feet=j('footLeft',p('M104 172Q96 181 94 185Q106 186 114 177Z',C.lightBlue),[108,176])+j('footRight',p('M134 175Q143 184 152 183L143 172Z',C.lightBlue),[139,176]);
 return j('body',tail+feet+left+right+body+j('head',face(j,{x:121,y:141,gap:19,size:5.5}),[121,141]),[122,145]);
}};
