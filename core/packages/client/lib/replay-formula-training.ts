import type { AlgFile } from '@cuberoot/shared/alg';
import { algCaseDetailHref, buildCaseSlugMap } from '@cuberoot/shared/recon/alg-case-link';
import { pllCommentName, primaryCaseName } from '@cuberoot/shared/recon/alg-case-display';
import { assistantAlgorithmSelection } from '@cuberoot/shared/site-assistant-algorithms';
import type { CfopFormulaFocus, CfopFormulaTarget } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import { findPreferredAlg, preferredAlgSlot } from './alg-preferred-algs';

function pllKey(name: string) {
  return pllCommentName(name.trim().replace(/^PLL[ -]+/i, '')).toLowerCase();
}

export function replayFormulaCard(data: AlgFile, target: CfopFormulaTarget, preferences: Readonly<Record<string, string>>) {
  const { set } = target;
  if (data.puzzle !== '3x3' || data.set !== set) return;
  const matches = data.cases.filter(item => set === 'oll'
    ? item.name.trim() === target.caseName
    : [item.name, item.meta?.ollcp].some(name => name && pllKey(name) === pllKey(target.caseName)));
  if (matches.length !== 1) return;
  const [item] = matches;
  const caseId = item.id;
  if (caseId === undefined || !Number.isSafeInteger(caseId) || caseId < 1) return;
  const slug = buildCaseSlugMap(data.cases, set).byId.get(caseId);
  if (!slug) return;
  const entries = item.algs[0]?.filter(entry => entry.alg.trim()) ?? [];
  const preferred = findPreferredAlg(entries, preferences[preferredAlgSlot(item)]);
  const formula = assistantAlgorithmSelection(item, '3x3', set, preferred ? entries.indexOf(preferred) : 0);
  if (!formula) return;
  return {
    ...formula, caseId, puzzle: '3x3' as const, set, name: primaryCaseName('3x3', set, item),
    href: algCaseDetailHref('3x3', set, slug),
  };
}

export function replayFormulaTrainingHref(set: CfopFormulaTarget['set'], caseId: number, focus: CfopFormulaFocus) {
  const query = new URLSearchParams({ cases: String(caseId), mode: focus === 'recognition' ? 'memo' : 'train' });
  if (focus === 'recognition') query.set('draw', 'train');
  return `/alg/3x3/${set}/run?${query}`;
}
