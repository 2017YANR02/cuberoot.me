import {C,p,e,line,face} from './art.mjs';
const red='#E85D38',light='#F89860',ink='#21384B';
export default {id:'lobster',number:60,zh:'小尖钳',en:'Sharpclaw Lobster',pixel:false,locomotion:'walk',gesture:'claw',render({joint:j}){
 const tail=j('tail',p('M139 101Q159 86 166 65L181 59Q184 87 157 114Z',red,ink,2)+line('M155 87l18 7m-12-20l17 6m-12-17l15 5',C.cream,1.5)+p('M168 65Q151 62 151 51Q159 43 170 52Q174 36 184 41Q193 44 188 56Q203 48 208 57Q207 67 184 71Z',red,ink,2)+line('M171 52l4 12m12-12l-5 13',C.cream,1.4),[147,102]);
 const feet=[[111,119,75,116,67,139,'footLeft'],[111,134,77,141,70,161,'footRight'],[116,148,93,164,91,183,'footLeft'],[145,113,180,118,189,140,'footRight'],[147,131,184,142,188,164,'footLeft'],[146,148,169,166,166,184,'footRight']].map(([sx,sy,kx,ky,tx,ty,n])=>j(n,line(`M${sx} ${sy}L${kx} ${ky}L${tx} ${ty}`,ink,5)+line(`M${kx} ${ky}l-2 5`,red,3),[sx,sy])).join('');
 const shell=p('M117 100Q147 78 161 106Q170 134 142 155L124 166L118 155Q95 143 99 123Z',red,ink,2.2)+p('M131 98Q148 91 155 105Q159 128 138 147L125 159L119 151Q142 132 139 113Z','#ED7245')+line('M136 102Q130 123 123 143L124 156',C.cream,1.5);
 const claw=(left)=>{
   const arm=left?p('M111 146L89 148L74 162L66 154L82 137L105 137Z',red,ink,2):p('M146 145L165 153L172 170L161 174L152 159L140 155Z',red,ink,2);
   const fixed=left?p('M72 148Q48 142 36 161Q26 184 45 197Q58 204 67 197L50 185L49 171L60 173L69 166Z',red,ink,2)+line('M39 166Q43 154 57 156',C.cream,1.5):p('M166 158Q187 155 197 173Q208 192 190 200L175 195L189 186L187 173L176 176Z',red,ink,2);
   const finger=left?p('M69 161Q90 176 79 192L60 178L65 169Z',red,ink,2):p('M174 170Q157 180 164 196L180 184L181 175Z',red,ink,2);
   return arm+fixed+j(left?'clawLeft':'clawRight',finger,left?[67,165]:[177,174]);
 };
 const head=face(j,{x:127,y:145,gap:10,size:4.1,smile:false})+p('M122 144L126 168L135 146Z',red,ink,1.5)+j('antennaLeft',line('M119 151Q93 73 53 49Q41 41 32 51',red,2),[119,150])+j('antennaRight',line('M139 147Q175 72 204 76Q214 78 214 88',red,2),[139,149])+j('mouth',line('M127 162l-4 12m10-15l6 12',ink,1.3),[129,162]);
 return j('body',tail+feet+j('left',claw(true),[107,143])+j('right',claw(false),[144,148])+shell+j('head',head,[128,145]),[132,130]);
}};
