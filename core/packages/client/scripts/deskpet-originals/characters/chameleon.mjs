import {C,p,e,line,face} from './art.mjs';
const green='#98B96E', ink='#4F593C';
export default {id:'chameleon',number:27,zh:'回旋变色龙',en:'Spiraltail Chameleon',pixel:false,locomotion:'walk',gesture:'paw',render({joint:j}){
 const tail=j('tail',p('M152 163Q199 162 199 126Q199 99 180 97Q161 94 157 116Q156 131 173 136Q187 136 188 124Q187 112 177 113Q167 115 173 121Q175 118 178 121Q181 127 174 127Q164 124 166 117Q170 105 180 108Q193 112 189 131Q185 151 150 146Z',green,ink)+p('M187 103Q196 110 196 122L185 120Q184 111 177 111L180 98Z',C.gold)+p('M195 131Q191 147 178 153L172 140Q182 135 185 127Z',C.teal),[152,154]);
 const farFeet=j('footRight',p('M145 163l17 15l-2 13h-16l4-12l-12-6Z',green,ink),[143,166])+j('footLeft',p('M94 160l-1 23l-9 5l2 5h19l3-32Z',green,ink),[101,167]);
 const body=p('M102 124Q145 108 166 145Q174 169 151 177Q125 183 101 165Z',green,ink)+p('M119 122Q133 119 146 128L128 150L112 144Z',C.gold)+p('M147 129Q162 137 166 151L147 160L130 151Z',C.teal)+p('M111 145L129 153L119 176L103 165Z',C.teal)+p('M130 153L146 162L140 178L121 176Z',C.coral);
 const hands=j('left',p('M106 148Q97 151 101 166L98 186Q106 192 117 188L112 183L115 158Z',green,ink)+line('M104 184v5m6-5v5',ink,1.2),[108,151])+j('right',p('M147 155Q159 157 154 171L162 185Q167 193 151 191L143 180L141 163Z',green,ink),[148,157]);
 const head=p('M66 116L83 80Q98 75 105 91Q127 99 121 129Q107 152 78 145L60 135Z',green,ink)+p('M81 82L94 87L101 98L108 91L98 78Z',C.gold)+p('M61 127Q91 147 116 127Q109 146 81 146L66 138Z',C.cream)+p('M108 100L118 111L117 129L107 136L100 126Z',C.coral)+e(73,119,12,15,C.gold,ink)+e(104,118,15,18,C.gold,ink)+face(j,{x:88.5,y:118,gap:15.5,size:8,color:ink,smile:false})+j('mouth',line('M65 136Q91 145 106 135',ink,1.5),[87,138])+e(61,127,1.2,1.8,ink);
 return j('body',tail+farFeet+body+hands+j('head',head,[102,139]),[124,156]);
}};
