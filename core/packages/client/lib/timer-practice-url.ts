import { ALG_CATALOG } from '@cuberoot/shared/alg';
import { TIMER_333_SCRAMBLE_TYPES, isScramble222Type, timerEventIdFromSelector } from '@cuberoot/shared/timer';
import { PUZZLE_EVENT, resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { canonicalZbllSubgroupSlug } from './alg_zbll_subgroups';

type Search = string | { toString(): string };

// Public URL vocabulary. Engine routes/session IDs remain private to the adapter:
// changing a bookmark must not rename saved selections, results or progress.
const PUBLIC_KEYS = ['content', 'source', 'method', 'view', 'draw', 'group', 'round', 'flippedEdges'];
const ALIASES = {
  'train.room': 'trainingRoom',
  'train.share': 'trainingShare',
  'train.split': 'split',
  'train.multi': 'multi',
  'train.drill': 'selection',
  'train.sets': 'sets',
  'train.case': 'case',
} as const;
const randomContents = new Map<string, string>(TIMER_333_SCRAMBLE_TYPES
  .filter(item => item.event !== '333')
  .map(item => [item.event === 'll' ? '1lll' : item.event, item.event]));

function puzzleForEvent(event: string) {
  if (['333oh', '333fm', '333ni'].includes(event) || [...randomContents.values()].includes(event)) return '3x3' as const;
  if (event === 'eg1' || event === 'eg2') return '2x2' as const;
  return resolveAlgPuzzle(event === 'mega' ? 'minx' : event === 'pyra' ? 'pyram' : event);
}

function copyKey(params: URLSearchParams, from: string, to: string) {
  if (!params.has(from)) return;
  const values = params.getAll(from);
  params.delete(from);
  params.delete(to);
  for (const value of values) params.append(to, value);
}

function formulaRoute(path: string) {
  const match = /^\/alg\/([^/]+)\/([^/]+)\/(run|select)$/.exec(path);
  const puzzle = match && resolveAlgPuzzle(match[1]);
  if (!match || !puzzle) return null;
  const set = match[2];
  if (set !== 'mix' && !(puzzle === '3x3' && set === 'lsll') && !ALG_CATALOG[puzzle].some(item => item.slug === set)) return null;
  return { puzzle, set, view: match[3] };
}

/** Read both generations of links into the existing engine contract. No data loading. */
export function decodeTimerPracticeSearch(search: Search): URLSearchParams {
  const params = new URLSearchParams(search.toString());
  // Old links are accepted verbatim; canonicalization is a separate write step.
  if (params.has('training')) return params;
  const content = params.get('content');
  const source = params.get('source');
  const method = params.get('method');
  const view = params.get('view');
  const event = params.get('event') || '333';
  const puzzle = puzzleForEvent(event);
  const hosted = source === 'cases' || method === 'recall' || method === 'recognition';
  if (content && hosted) {
    const base = `/alg/${puzzle ?? event}/${content}`;
    const path = method === 'recognition'
      ? `/recognize/${content}${view === 'guide' ? '/guide' : ''}`
      : content === 'lsll' && view === 'select'
        ? `/alg/lsll${params.get('group') ? `/${params.get('group')}` : ''}`
        : `${base}/${view === 'select' ? 'select' : 'run'}`;
    params.set('training', path);
    const mode = method === 'recall' ? 'memo' : params.get('draw') === 'random' ? 'train' : 'recap';
    params.set('train.mode', mode);
    if (mode === 'memo') params.set('train.draw', params.get('draw') === 'random' ? 'train' : 'recap');
    if (content === 'lsll') {
      const group = params.get('group');
      const edges = params.get('flippedEdges');
      if (view === 'select') {
        if (edges !== null) params.set('train.eo', edges);
      } else {
        const round = params.get('round');
        // The default legacy session is "lsll", not "lsll:zbls".
        if (group) params.set('train.scope', `${group}${edges !== null ? `-eo${edges}` : ''}`);
        else if (round) params.set('train.scope', round === '1' ? 'zbls' : `zbls-r${round}`);
      }
    } else if (params.has('group')) params.set('train.scope', params.get('group')!);
    for (const [engine, publicKey] of Object.entries(ALIASES)) copyKey(params, publicKey, engine);
    if (params.get('train.drill') === 'stored') params.set('train.drill', '1');
  } else if (content && !hosted) {
    const type222 = content === 'tcll-plus' ? 'tcllp' : content === 'tcll-minus' ? 'tclln' : content;
    const subtype = event === '333' ? randomContents.get(content)
      : event === '222' && (content === 'eg1' || content === 'eg2') ? content : null;
    if (subtype) params.set('event', subtype);
    else if (event === '222' && isScramble222Type(type222)) params.set('scramble222', type222);
    else if (content !== 'full') {
      // Unsupported contents must not silently become ordinary 3x3 timing.
      params.set('training', '/unsupported-practice');
      return params;
    }
  }
  for (const key of PUBLIC_KEYS) {
    // Manual/random source is also read by the Solo view, independently of its generator.
    if (key !== 'source' || hosted) params.delete(key);
  }
  if (!params.has('event')) params.set('event', '333');
  if (!hosted && event === '222' && !content) params.set('scramble222', 'full');
  return params;
}

/** Serialize one canonical address from engine state; defaults never lengthen a link. */
export function encodeTimerPracticeSearch(search: Search): URLSearchParams {
  const params = new URLSearchParams(search.toString());
  const path = params.get('training')?.replace(/^\/(?:en|zh)(?=\/)/, '').replace(/\/+$/, '') ?? '';
  const formula = formulaRoute(path);
  const lsllSelect = /^\/alg\/lsll(?:\/([^/]+))?$/.exec(path);
  const isLsllSelect = !!lsllSelect && !['case', 'route'].includes(lsllSelect[1]);
  const recognition = /^\/recognize\/([^/]+)(\/guide)?$/.exec(path);
  const handled = formula || isLsllSelect || recognition;
  if (handled) {
    const content = formula?.set ?? (isLsllSelect ? 'lsll' : recognition![1]);
    const puzzle = formula?.puzzle ?? '3x3';
    const oldEvent = params.get('event') ?? '333';
    const event = puzzleForEvent(oldEvent) === puzzle && ![...randomContents.values(), 'eg1', 'eg2'].includes(oldEvent)
      ? oldEvent : timerEventIdFromSelector(PUZZLE_EVENT[puzzle]) ?? PUZZLE_EVENT[puzzle];
    params.set('event', event);
    params.delete('training');
    for (const key of PUBLIC_KEYS) params.delete(key);
    params.set('content', content);
    params.set('source', 'cases');
    if (formula?.view === 'select' || isLsllSelect) params.set('view', 'select');
    if (recognition?.[2]) params.set('view', 'guide');
    const mode = params.get('train.mode');
    if (recognition) params.set('method', 'recognition');
    else if (mode === 'memo') params.set('method', 'recall');
    if (mode === 'train' || (mode === 'memo' && params.get('train.draw') === 'train')) params.set('draw', 'random');
    const scope = params.get('train.scope')?.trim().toLowerCase();
    if (content === 'lsll') {
      const covered = scope && /^zbls(?:-r(\d+))?$/.exec(scope);
      const category = scope && /^([a-z]+)(?:-eo(\d+))?$/.exec(scope);
      if (isLsllSelect) {
        if (lsllSelect![1]) params.set('group', lsllSelect![1]);
        if (params.has('train.eo')) params.set('flippedEdges', params.get('train.eo')!);
        params.delete('train.eo');
      } else if (covered) {
        // Explicit round 1 retains the existing lsll:zbls session.
        params.set('round', covered[1] ?? '1');
      } else if (category) {
        params.set('group', category[1]);
        if (category[2]) params.set('flippedEdges', category[2]);
      }
    } else if (scope) params.set('group', canonicalZbllSubgroupSlug(content, scope.trim().toLowerCase())!);
    for (const key of ['train.mode', 'train.draw', 'train.timing', 'train.scope']) params.delete(key);
    for (const [engine, publicKey] of Object.entries(ALIASES)) copyKey(params, engine, publicKey);
    if (params.get('selection') === '1') params.set('selection', 'stored');
  } else if (!path) {
    const event = params.get('event') ?? '333';
    const content = [...randomContents].find(([, value]) => value === event)?.[0];
    if (content) {
      params.set('event', '333');
      params.set('content', content);
    } else if (event === 'eg1' || event === 'eg2') {
      params.set('event', '222');
      params.set('content', event);
    } else if (event === '222') {
      const subtype = params.get('scramble222');
      if (subtype && subtype !== 'full' && isScramble222Type(subtype)) {
        params.set('content', subtype === 'tcllp' ? 'tcll-plus' : subtype === 'tclln' ? 'tcll-minus' : subtype);
      }
    }
  }
  params.delete('scramble222');
  if (params.get('event') === '333') params.delete('event');
  if (params.get('players') === '1') params.delete('players');
  if (params.get('source') === 'random') params.delete('source');
  // Stable order makes equivalent entry points produce byte-identical links.
  const ordered = new URLSearchParams();
  for (const key of ['event', ...PUBLIC_KEYS, ...Object.values(ALIASES)]) {
    for (const value of params.getAll(key)) ordered.append(key, value);
    params.delete(key);
  }
  for (const [key, value] of params) ordered.append(key, value);
  return ordered;
}

export function canonicalTimerPracticeSearch(search: Search): URLSearchParams {
  return encodeTimerPracticeSearch(decodeTimerPracticeSearch(search));
}
