const col=(col:string)=>({col}), value=(value:string|number)=>({value});
const eq=(name:string,literal:string|number)=>({op:'=',args:[col(name),value(literal)]});
export const championPredicates=[eq('r.event_id','333'),eq('r.pos',1),{op:'in',args:[col('r.round_type_id'),value('f'),value('c')]},
  {op:'<=',args:[col('c.start_date'),value('2024-03-03')]},{op:'>=',args:[col('c.end_date'),value('2024-03-02')]}];
export const championQuery={from:{dataset:'results',as:'r'},joins:[
  {dataset:'competitions',as:'c',type:'inner',on:{op:'=',args:[col('r.comp_id'),col('c.id')]}},
  {dataset:'persons',as:'p',type:'inner',on:{op:'=',args:[col('p.wca_id'),col('r.wca_id')]}},
],select:[{as:'competition',label:'任意标题',expr:col('c.name')},{as:'winner',label:'任意标题',expr:col('p.name')},
  {as:'average',label:'平均(秒)',expr:{op:'/',args:[col('r.average'),value(100)]}}],where:{op:'and',args:championPredicates},limit:100};
