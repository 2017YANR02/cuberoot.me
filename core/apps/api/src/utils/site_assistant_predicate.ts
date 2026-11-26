// Compare what a WHERE clause guarantees, independently of labels or operand order.
import type { AnalysisExpr } from './site_assistant_analysis.js';

type Literal = string | number | boolean | null;
const reverse:Record<string,string> = {'=':'=', '<':'>', '<=':'>=', '>':'<', '>=':'<='};

export function comparison(expr:AnalysisExpr, column:string, op:string, value:Literal) {
  if (!('op' in expr) || expr.args.length!==2) return false;
  const [left,right] = expr.args;
  return (expr.op===op && 'col' in left && left.col===column && 'value' in right && right.value===value)
    || (expr.op===reverse[op] && 'col' in right && right.col===column && 'value' in left && left.value===value);
}

function includedValues(expr:AnalysisExpr,column:string):Literal[]|undefined {
  if (!('op' in expr)) return;
  const [first,...rest] = expr.args;
  if (expr.op==='or') {
    const branches=expr.args.map(arg=>includedValues(arg,column));
    if (branches.every(branch=>branch!==undefined)) return branches.flat();
  }
  if (expr.op==='=' && rest.length===1 && 'value' in first && 'col' in rest[0] && rest[0].col===column) return [first.value];
  if ((expr.op==='=' || expr.op==='in') && 'col' in first && first.col===column && rest.every(arg=>'value' in arg)) return rest.map(arg=>arg.value);
}

export function exactSelection(predicates:AnalysisExpr[],column:string,expected:readonly Literal[]) {
  const required=new Set(expected);
  const restrictions=predicates.map(expr=>includedValues(expr,column)).filter(values=>values!==undefined);
  if (!required.size || !restrictions.length)return false;
  const intersection=new Set(restrictions[0]);
  for(const values of restrictions.slice(1)) {
    const allowed=new Set(values);
    for(const value of intersection)if(!allowed.has(value))intersection.delete(value);
  }
  return intersection.size===required.size && [...intersection].every(value=>required.has(value));
}

// Equivalent bounds apply only to DATE columns, where a day is the smallest unit.
export function dateRangeProven(predicates:AnalysisExpr[],column:string,from:string,before:string) {
  const previousDay=(date:string)=>new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  const fullYear=from.endsWith('-01-01') && before===(Number(from.slice(0,4))+1)+'-01-01';
  if (fullYear && predicates.some(expr=>{
    if (!('op' in expr) || expr.op!=='=' || expr.args.length!==2)return false;
    return expr.args.some(arg=>'fn' in arg && arg.fn==='year' && arg.args.length===1 && 'col' in arg.args[0] && arg.args[0].col===column)
      && expr.args.some(arg=>'value' in arg && String(arg.value)===from.slice(0,4));
  })) return true;
  if(!Number.isFinite(Date.parse(from+'T00:00:00Z')) || !Number.isFinite(Date.parse(before+'T00:00:00Z')))return false;
  const last=previousDay(before), previous=previousDay(from);
  return predicates.some(p=>comparison(p,column,'>=',from) || comparison(p,column,'>',previous))
    && predicates.some(p=>comparison(p,column,'<',before) || comparison(p,column,'<=',last));
}
