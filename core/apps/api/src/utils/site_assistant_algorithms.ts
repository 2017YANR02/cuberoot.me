import { AllFaces, CubeData, Face, parseAlgorithm, parseCase } from '@cuberoot/visualcube';
import { ALG_CATALOG, getAlgSetMeta, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import { assistantAlgorithmSelection } from '@cuberoot/shared/site-assistant-algorithms';
import { algCaseHref } from '@cuberoot/shared/recon/alg-case-link';
import { PLL_RENAME } from '@cuberoot/shared/recon/alg-case-display';
import type { AssistantAlgorithms } from '@cuberoot/shared/site-assistant';

export interface AlgorithmSelection {
  puzzle: string; set: string; query?: string; caseId?: number;
  offset?: number; limit?: number; alternative?: number; display?: 'both' | 'image' | 'text';
}
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/(?:\s*-\s*)?\bperm(?:utation)?\b/g, '').replace(/[\s_()（）]/g, '');

/** Only supplement names missing from the current public PLL catalog. */
export function algorithmCaseAliases(data: AlgFile, name: string): string[] {
  if(data.puzzle!=='3x3' || data.set!=='pll')return [];
  return Object.entries(PLL_RENAME)
    .filter(([alias,current])=>current.toLowerCase()===normalized(name) && !data.cases.some(c=>normalized(c.name)===normalized(alias)))
    .map(([alias])=>alias);
}

/** Only a complete, unambiguous display request can skip planning. Explanations,
 * navigation, named cases and mixed requests still use the ordinary tools. */
export function explicitAlgorithmDisplay(question: string): AlgorithmSelection | undefined {
  let target=question.trim().replace(/[。.!！?？]+$/,'');
  if(!/^(?:(?:请|帮我|麻烦|please)\s*)?(?:展示|显示|列出|show\b|display\b|list\b)/i.test(target))return;
  target=target.replace(/^(?:(?:请|帮我|麻烦|please)\s*)?(?:展示|显示|列出|show\b|display\b|list\b)\s*(?:所有|全部|全套|all\b\s*(?:the\b)?)?\s*/i,'');
  target=target.replace(/\s*(?:的)?(?:公式(?:卡片)?|algorithms?|cases?)\s*$/i,'').trim();
  const prefix=target.match(/^([2-7])\s*[x×]\s*\1\s*/i);
  const puzzle=(prefix ? `${prefix[1]}x${prefix[1]}` : '3x3') as AlgPuzzle;
  if(prefix)target=target.slice(prefix[0].length);
  const matches=(ALG_CATALOG[puzzle] ?? []).filter(meta=>[meta.slug,meta.short,meta.zh,meta.en].some(name=>name && normalized(name)===normalized(target)));
  if(matches.length!==1)return;
  return {puzzle,set:matches[0].slug,display:'both',limit:24};
}

export function algorithmDisplaySummary(result: AssistantAlgorithms, lang: 'zh'|'en'): string {
  if(!result.cards.length)return {zh:'未找到符合条件的公式。',en:'No matching algorithm was found.'}[lang];
  const content={both:{zh:'状态图和公式',en:'diagrams and algorithms'},image:{zh:'状态图',en:'diagrams'},text:{zh:'公式',en:'algorithms'}}[result.display];
  return result.nextOffset===undefined
    ? {zh:`已列出 ${result.cards.length} 个 case 的${content.zh}。`,en:`Showing ${content.en} for ${result.cards.length} cases.`}[lang]
    : {zh:`共 ${result.total} 个 case，展示第 ${result.offset+1}–${result.offset+result.cards.length} 个；可加载其余公式。`,en:`There are ${result.total} cases. Showing cases ${result.offset+1}–${result.offset+result.cards.length}; load more to see the rest.`}[lang];
}

export function matchingAlgorithmCases(data: AlgFile, selection: AlgorithmSelection) {
  const set=selection.set;
  const query = selection.query?.trim();
  const term = query ? normalized(query) : '';
  const exact = term ? data.cases.filter(c => normalized(c.name) === term || normalized(c.name).replace(new RegExp(`^${set.replace(/[^a-z0-9-]/gi, '')}`), '') === term) : [];
  if(selection.caseId!==undefined)return data.cases.filter(c=>c.id===selection.caseId);
  if(!term)return data.cases;
  if(exact.length)return exact;
  const aliases=data.cases.filter(c=>algorithmCaseAliases(data,c.name).some(alias=>normalized(alias)===term));
  return aliases.length ? aliases : data.cases.filter(c=>normalized(c.name).includes(term) || normalized(c.subgroup).includes(term));
}

/** The tool, never the model, supplies case IDs, move strings and drawing inputs. */
export function algorithmCards(data: AlgFile, selection: AlgorithmSelection, lang: 'zh' | 'en'): AssistantAlgorithms {
  const puzzle = selection.puzzle as AlgPuzzle, set = selection.set;
  if (!getAlgSetMeta(puzzle, set) || !Array.isArray(data.cases)) throw new Error('Unknown algorithm set');
  const query=selection.query?.trim(),matches=matchingAlgorithmCases(data,selection);
  const offset = selection.offset ?? 0, limit = selection.limit ?? 24;
  const cards = matches.slice(offset, offset + limit).flatMap(c => {
    const selected = assistantAlgorithmSelection(c, puzzle, set, selection.alternative ?? 0);
    if (!selected) return [];
    return [{caseId:c.id, name:c.name, href:algCaseHref(puzzle, set, c), puzzle, set,
      ...selected}];
  });
  const meta = getAlgSetMeta(puzzle, set)!;
  return {kind:'algorithms', version:1, title:`${puzzle} ${meta[lang]}`, display:selection.display ?? 'both',
    puzzle, set, query, caseId:selection.caseId, offset, total:matches.length,
    ...(offset + limit < matches.length ? {nextOffset:offset + limit} : {}), cards};
}

/** Describe the diagram's actual holding angle, including asymmetric U perms. */
export function pllRecognition(result: AssistantAlgorithms, lang: 'zh'|'en'): string | undefined {
  if (result.puzzle !== '3x3' || result.set !== 'pll' || !result.cards.length) return;
  if (result.cards.length>1) {
    const cues=result.cards.map(card=>pllRecognition({...result,cards:[card]},lang));
    return cues.every(Boolean)?cues.join('\n\n'):undefined;
  }
  const [card] = result.cards;
  // CaseThumb renders the selected setup, or the inverse of this alternative.
  // Legacy sticker rows can use a different AUF, so use the renderer's simulator.
  const turns = card.setup ? parseAlgorithm(card.setup) : parseCase(card.alg);
  if (!turns.length || turns.length>256) return;
  const cube = new CubeData(3,Object.fromEntries(AllFaces.map(face=>[face,Array(9).fill(face)])));
  for (const turn of turns) cube.turn(turn);
  const rows:number[][] = [Face.F,Face.R,Face.B,Face.L].map(face=>cube.faces[face]);
  if (![Face.U,Face.D].every(face=>cube.faces[face].every(colour=>colour===cube.faces[face][4])) ||
      !rows.every(row=>row.slice(3).every(colour=>colour===row[4]))) return;
  const centres = rows.map(row=>row[4]);
  const faces = {zh:['前','右','后','左'],en:['front','right','back','left']}[lang];
  const edges = rows.map(row => centres.indexOf(row[1]));
  // Each side is seen face-on. Its right corner meets the next side's left corner.
  const corners = rows.map((row,i) => centres.findIndex((colour,j) =>
    row[2] === colour && rows[(i+1)%4][0] === centres[(j+1)%4]));
  if ([edges,corners].some(p => p.includes(-1) || new Set(p).size !== 4)) return;
  const describe = (home: number[], names: string[]) => {
    const seen = new Set<number>(), cycles: string[] = [];
    for (let i=0;i<4;i++) {
      if (seen.has(i) || home[i] === i) continue;
      const cycle: string[] = [];
      for (let j=i;!seen.has(j);j=home[j]) { seen.add(j); cycle.push(names[j]); }
      cycles.push(cycle.length === 2 ? cycle.join(' ↔ ') : [...cycle,cycle[0]].join(' → '));
    }
    return cycles.join(' / ') || {zh:'已归位',en:'already solved'}[lang];
  };
  const cornerNames = {zh:['右前','右后','左后','左前'],en:['front-right','back-right','back-left','front-left']}[lang];
  const bars = faces.filter((_,i) => rows[i][0] === rows[i][2]);
  if ([edges,corners].every(p=>p.every((home,i)=>home===i))) return;
  const solid = faces.filter((_,i)=>rows[i][0]===rows[i][1] && rows[i][1]===rows[i][2]);
  const block = solid.length ? {zh:'同色三连块在'+solid.join('、')+'面。',en:'Solid three-sticker bar: '+solid.join(', ')+'. '}[lang] : {zh:'四个侧面都没有同色三连块。',en:'No side has a solid three-sticker bar. '}[lang];
  const cues = bars.length ? {zh:'同侧两角颜色相同的面：'+bars.join('、')+'。',en:'Matching corner stickers (“headlights”): '+bars.join(', ')+'.'}[lang] : '';
  return {zh:'按第 '+(card.alternative+1)+' 条公式的卡图持方，顶面朝上，对照侧面中心识别 '+card.name+'。'+block+cues+'顶层棱的位置变化：'+describe(edges,faces)+'；顶层角的位置变化：'+describe(corners,cornerNames)+'。箭头从当前位置指向归位位置。',
    en:'Hold the cube as pictured for algorithm '+(card.alternative+1)+', last layer up, and compare each side with its centre to recognize '+card.name+'. '+block+cues+' Top edges: '+describe(edges,faces)+'. Top corners: '+describe(corners,cornerNames)+'. Arrows go from the current position to its home.'}[lang];
}
