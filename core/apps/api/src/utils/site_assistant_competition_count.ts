import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';
import type { PublicCountRequest } from './site_assistant_competition_scope.js';
import { assistantStage } from './site_assistant_diagnostics.js';
import { runAnalysisQuery } from './site_assistant_analysis_db.js';
import type { AnalysisExpr, AnalysisGoal } from './site_assistant_analysis.js';

export async function publicCountAnswer(scope:PublicCountRequest, lang:'zh'|'en', signal:AbortSignal, context:{question:string;normalizedQuestion:string}):Promise<AssistantAnswer> {
  const {region,metric,from,before}=scope;
  const measure={
    competitions:{column:'c.id',zh:'WCA 比赛场数',en:'WCA competitions',unit:'场'},
    persons:{column:'r.wca_id',zh:'不同参赛选手数',en:'distinct competitors',unit:'人'},
    cities:{column:'c.city',zh:'不同举办城市名称数',en:'distinct host city names',unit:'个'},
    countries:{column:'c.country_id',zh:'可识别的不同举办国家或地区数',en:'distinct host countries or regions',unit:'个'},
  }[metric];
  const heading=measure[lang];
  const title=lang==='zh' ? scope.zh+region.zh+' '+measure.zh : measure.en+' in '+region.en+' in '+scope.en;
  const location:AnalysisGoal['location']=region.kind==='world' ? undefined : region.kind==='continent'
    ? {basis:'host',continentIds:[region.id]} : {basis:'host',countryIds:[region.id]};
  const goal:AnalysisGoal={metric,subject:'all',personIds:[],grain:'total',outputs:[heading],time:{basis:'competition_start',from,before},location};
  const filters:AnalysisExpr[]=[
    {op:'>=',args:[{col:'c.start_date'},{value:from}]},
    {op:'<',args:[{col:'c.start_date'},{value:before}]},
  ];
  if (location) filters.push({op:'=',args:[{col:region.kind==='continent'?'h.continent_id':'c.country_iso2'},{value:region.id}]});
  if (metric==='cities') filters.push({op:'!=',args:[{col:'c.city'},{value:''}]});
  if (metric==='countries') filters.push({op:'not',args:[{op:'like',args:[{col:'h.name'},{value:'Multiple Countries%'}]}]});
  const joins=[];
  if (region.kind==='continent' || metric==='countries') joins.push({dataset:'countries',as:'h',type:'inner',on:{op:'=',args:[{col:'c.country_id'},{col:'h.id'}]}});
  if (metric==='persons') joins.push({dataset:'results',as:'r',type:'inner',on:{op:'=',args:[{col:'r.comp_id'},{col:'c.id'}]}});
  const query={from:{dataset:'competitions',as:'c'},joins,where:{op:'and',args:filters},
    select:[{as:'count',label:heading,expr:{fn:'count',distinct:true,args:[{col:measure.column}]}}]};
  const result = await assistantStage('tool',()=>runAnalysisQuery({goal, query, title, description:title},lang,signal,new Set(),undefined,context),0,'analysis_query');
  const table = result.artifacts.find(a=>a.kind==='table');
  const count = table?.rows[0]?.[0];
  const evidence = result.evidence as {
    importedAt?:string; truncated?:boolean; columns?:Array<{countMeasure?:string}>;
    validation?:{status:string;notes:string[]};
  };
  const source = result.sources[0];
  const verified=evidence.validation?.status==='program_checks_passed' && !evidence.validation.notes.length
    && evidence.columns?.length===1 && evidence.columns[0].countMeasure===metric && evidence.truncated===false;
  if (!verified || !source || !evidence.importedAt || table?.rows.length!==1 || !/^\d+$/.test(count ?? '')) {
    return {answer:lang==='zh'?'暂时无法核实该范围的统计结果，请稍后重试。':'The count is temporarily unavailable. Please try again later.',sources:[],artifacts:[]};
  }
  const date = evidence.importedAt.slice(0,10);
  const zh=metric==='competitions' ? `${scope.zh}${region.zh}收录的 WCA 比赛共有 ${count} 场` : `${scope.zh}${region.zh} WCA 比赛的${measure.zh}为 ${count} ${measure.unit}`;
  const statusNote=metric==='persons' ? (lang==='zh'?'选手按有成绩记录的 WCA ID 去重。':' Competitors are counted by distinct WCA IDs in published round results.')
    : (lang==='zh'?'统计口径为已收录的赛程，当前数据未区分取消状态。':' This counts listed competitions. Cancellation status is unavailable in this projection.');
  const countryNote=metric==='countries' ? (lang==='zh'?'多国联合举办且未列明国家的记录不计入。':' Multi-country entries without named hosts are excluded.') : '';
  const unit=count==='1' ? measure.en.replace(/competitions$/,'competition').replace(/competitors$/,'competitor').replace(/names$/,'name').replace('countries or regions','country or region') : measure.en;
  const answer = lang==='zh' ? `按比赛开始日期统计，${zh}（数据导入于 ${date}）。`
    : `The WCA data imported on ${date} lists ${count} ${unit}${metric==='competitions' ? '' : ' at WCA competitions'} starting in ${region.en} during ${scope.en}.`;
  return {answer:answer+statusNote+countryNote+' [['+source.id+']]',sources:[source],artifacts:[]};
}
