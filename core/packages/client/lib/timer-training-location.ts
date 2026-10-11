const TRAINING_PREFIX = 'train.';
const ASSIGNMENT_KEYS = new Set(['trainingOrg', 'trainingAssignment']);

type SearchInput = string | { toString(): string };

/** Assignment attribution is shared with the surrounding timer; all other state is scoped. */
export function trainingQueryKey(key: string, hosted = true): string {
  return hosted && !ASSIGNMENT_KEYS.has(key) ? `${TRAINING_PREFIX}${key}` : key;
}

/** Present the trainer with its own query string, never the timer's room or solve share. */
export function trainingSearchParams(search: SearchInput, hosted = true): URLSearchParams {
  const original = new URLSearchParams(search.toString());
  if (!hosted) return original;
  const scoped = new URLSearchParams();
  for (const [key, value] of original) {
    if (key.startsWith(TRAINING_PREFIX)) scoped.append(key.slice(TRAINING_PREFIX.length), value);
  }
  for (const key of ASSIGNMENT_KEYS) {
    if (original.has(key)) {
      scoped.delete(key);
      for (const value of original.getAll(key)) scoped.append(key, value);
    }
  }
  return scoped;
}

function clearTrainingQuery(search: SearchInput): URLSearchParams {
  const params = new URLSearchParams(search.toString());
  for (const key of [...params.keys()]) {
    if (key === 'training' || key.startsWith(TRAINING_PREFIX)) params.delete(key);
  }
  return params;
}

function joinLocation(pathname: string, params: URLSearchParams, hash = ''): string {
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hash}`;
}

export interface TimerTrainingHrefOptions {
  timerPathname: string;
  currentSearch: SearchInput;
  currentTrainingPath?: string;
  acceptsPath(pathname: string): boolean;
}

/** Map only supported local trainer routes. External and unrelated links stay untouched. */
export function timerTrainingHref(href: string, options: TimerTrainingHrefOptions): string {
  let target = href;
  if (target.startsWith('?') && options.currentTrainingPath) target = `${options.currentTrainingPath}${target}`;
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\r\n\t]/.test(target)) return href;

  const url = new URL(target, 'https://training.invalid');
  const pathname = url.pathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
  if (!options.acceptsPath(pathname)) return href;

  const params = clearTrainingQuery(options.currentSearch);
  params.set('training', pathname);
  for (const key of ASSIGNMENT_KEYS) {
    if (url.searchParams.has(key)) params.delete(key);
  }
  for (const [key, value] of url.searchParams) params.append(trainingQueryKey(key), value);
  return joinLocation(options.timerPathname, params, url.hash);
}

/** Return to the timer with its pre-existing event, room, share and player settings intact. */
export function timerTrainingExitHref(timerPathname: string, currentSearch: SearchInput): string {
  return joinLocation(timerPathname, clearTrainingQuery(currentSearch));
}
