import { ALG_CATALOG, getAlgSetMeta, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import { assistantAlgorithmSelection } from '@cuberoot/shared/site-assistant-algorithms';
import { algCaseHref } from '@cuberoot/shared/recon/alg-case-link';
import type { AssistantAlgorithms } from '@cuberoot/shared/site-assistant';

export interface AlgorithmSelection {
  puzzle: string; set: string; query?: string; caseId?: number;
  offset?: number; limit?: number; alternative?: number; display?: 'both' | 'image' | 'text';
}
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/(?:\s*-\s*)?\bperm(?:utation)?\b/g, '').replace(/[\s_()（）]/g, '');

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
  return selection.caseId !== undefined ? data.cases.filter(c => c.id === selection.caseId)
    : term ? exact.length ? exact : data.cases.filter(c => normalized(c.name).includes(term) || normalized(c.subgroup).includes(term)) : data.cases;
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
