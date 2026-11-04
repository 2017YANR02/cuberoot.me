import { describe, expect, it } from 'vitest';
import { championListPresentation } from '../src/utils/site_assistant_presentation.js';
import { championQuery, championPredicates as predicates } from './fixtures/site_assistant_champions.js';

const col=(col:string)=>({col}), value=(value:string|number)=>({value});
const eq=(name:string,literal:string|number)=>({op:'=',args:[col(name),value(literal)]});
const base={question:'上周末谁拿了冠军？',lang:'zh' as const,hasHistory:false,periods:[{phrase:'上周末',start:'2024-03-02',end:'2024-03-03'}],query:championQuery,sourceId:'analysis:winners',truncated:false,rowCount:2};

describe('verified champion-list presentation',()=>{
  it('derives an introduction from predicates, without counts, names or generated explanations',()=>{
    expect(championListPresentation(base)).toBe('2024-03-02~03 期间举办的比赛，三阶决赛冠军如下：[[analysis:winners]]');
    const twoByTwo={...championQuery,where:{op:'and',args:[eq('r.event_id','222'),...predicates.slice(1)]}};
    expect(championListPresentation({...base,query:twoByTwo,question:'List the 2x2 winners last weekend.',lang:'en',periods:[{...base.periods[0],phrase:'last weekend'}]}))
      .toBe('2×2 final winners at competitions held during 2024-03-02~03: [[analysis:winners]]');
  });
  it('recognizes equivalent final-round OR and reversed date comparisons',()=>{
    const query={...championQuery,where:{op:'and',args:[...predicates.slice(0,2),
      {op:'or',args:[eq('r.round_type_id','f'),eq('r.round_type_id','c')]},
      {op:'>=',args:[value('2024-03-03'),col('c.start_date')]},{op:'<=',args:[value('2024-03-02'),col('c.end_date')]}]}};
    expect(championListPresentation({...base,query})).toBe(championListPresentation(base));
  });
  it.each([
    ['non-final round', [...predicates.slice(0,2),eq('r.round_type_id','1'),...predicates.slice(3)]],
    ['only one final type', [...predicates.slice(0,2),eq('r.round_type_id','f'),...predicates.slice(3)]],
    ['runner-up', [predicates[0],eq('r.pos',2),...predicates.slice(2)]],
    ['unbounded dates', predicates.slice(0,3)],
    ['start-date-only range', [...predicates.slice(0,4),{op:'>=',args:[col('c.start_date'),value('2024-03-02')]}]],
    ['extra country restriction', [...predicates,eq('c.country_iso2','CN')]],
    ['multiple events', [{op:'in',args:[col('r.event_id'),value('333'),value('222')]},...predicates.slice(1)]],
  ])('does not infer a complete scope from %s',(_name,args)=>{
    expect(championListPresentation({...base,query:{...championQuery,where:{op:'and',args}}})).toBeUndefined();
  });
  it('rejects an OR across scope filters, misleading labels, bad joins and aggregate/window output',()=>{
    const variants=[
      {...championQuery,where:{op:'or',args:predicates}},
      {...championQuery,select:championQuery.select.map(item=>({...item,expr:col('r.comp_id')}))},
      {...championQuery,joins:championQuery.joins.map(join=>({...join,type:'left'}))},
      {...championQuery,select:[...championQuery.select,{as:'rank',label:'Rank',expr:{fn:'rank',args:[],over:{orderBy:[{expr:col('r.average'),direction:'asc'}]}}}]},
      {...championQuery,steps:[{name:'other',query:{from:{dataset:'results',as:'r'},select:[{as:'n',expr:{fn:'count',args:[]}}]}}]},
    ];
    for(const query of variants)expect(championListPresentation({...base,query})).toBeUndefined();
  });
  it.each(['谁拿了冠军，谁最快？','列出冠军并比较他们的平均成绩。','冠军有哪些，解释比赛规则。','List the winners and explain their results.','谁拿了冠军？统计有多少场。','上周末谁拿了冠军？再写一句祝贺文案。','列出上周末冠军，并给我 PLL 训练入口。','List last weekend winners and write a congratulation message.'])('preserves the ordinary answer for a mixed question: %s',question=>{
    expect(championListPresentation({...base,question})).toBeUndefined();
  });
  it('leaves missing, truncated and ambiguous historical scope with the ordinary review',()=>{
    for(const fields of [{rowCount:0},{truncated:true},{truncated:undefined},{hasHistory:true},{question:'上周末二阶冠军有哪些？'},{periods:[]},{periods:[{...base.periods[0],start:'2024-02-24',end:'2024-02-25'}]}])
      expect(championListPresentation({...base,...fields})).toBeUndefined();
    expect(championListPresentation({...base,hasHistory:true,question:'列出上周末三阶冠军。'})).toBeDefined();
  });
});
