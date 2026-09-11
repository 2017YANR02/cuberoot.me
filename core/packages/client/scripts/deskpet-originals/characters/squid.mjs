import {C,p,e,line,face} from './art.mjs';
export default {id:'squid',number:38,zh:'星梭鱿',en:'Starfin Squid',pixel:false,locomotion:'swim',gesture:'tentacle',render({joint:j}){
 const fin=j('earLeft',p('M100 68Q75 70 58 85L91 112Z',C.blue),[98,86])+j('earRight',p('M143 68Q166 74 182 93L150 115Z',C.blue),[145,88]);
 const tentacles=j('footLeft',p('M103 143Q89 164 102 178Q106 182 101 188Q88 190 91 178Q80 162 94 141Z',C.blue),[99,145])+j('footRight',p('M134 143Q150 160 144 181Q146 188 140 191Q127 191 135 179Q138 162 125 146Z',C.blue),[130,145])+j('tail',p('M114 144Q116 170 111 180Q105 193 113 196Q125 192 122 180L124 145Z',C.lightBlue)+p('M123 146Q124 167 129 184Q137 196 127 200Q116 201 123 185Q115 167 116 146Z',C.cream),[120,146]);
 const arms=j('left',p('M102 140Q85 160 70 153Q59 148 59 133Q56 120 46 128Q38 138 48 146Q59 176 83 169Q99 165 110 145Z',C.lightBlue),[103,143])+j('right',p('M136 142Q153 157 159 173Q163 190 177 189Q188 190 188 182Q187 172 174 176Q167 151 143 137Z',C.lightBlue)+p('M174 176Q187 172 188 182Q188 190 177 189Q168 190 164 181Z',C.coral),[138,143]);
 const mantle=p('M122 37Q145 54 156 91Q164 127 142 145Q122 155 99 144Q76 128 85 95Q94 61 122 37Z',C.blue)+p('M122 37Q138 50 147 71L126 84L111 59Z',C.lightBlue)+p('M110 60L126 84L90 91Q97 69 110 60Z',C.cream)+p('M126 84L147 72L156 101L136 111Z',C.coral)+p('M90 91L126 84L136 111L85 119Z',C.cream)+p('M136 111L157 102Q160 124 146 140L128 128Z',C.lightBlue)+p('M85 119L128 128L146 140Q120 159 98 143Z',C.cream);
 const seamlessMantle=mantle.replace(/fill="([^"]+)" stroke="none"/g,'fill="$1" stroke="$1"').replace(/stroke-width="1.8"/g,'stroke-width="0.6"');
 return j('body',fin+tentacles+arms+seamlessMantle+j('head',face(j,{x:119,y:132,gap:15,size:5.5}),[120,139]),[120,117]);
}};
