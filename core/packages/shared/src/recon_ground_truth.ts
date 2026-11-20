import { normalizeLines } from './recon_normalize';

export { normalize, normalizeLines, outerTurnSequence, type NormalizeOptions } from './recon_normalize';

const CROSS_RE = /\b(?:p?s?x*)?cross\b/i;
const MOVE_RE = /[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g;
// Delimiter-separated candidates keep whitespace/number matching linear.
function stripTimingComments(comment: string): string {
  let result = '';
  let cursor = 0;
  let open = -1;
  for (let i = 0; i < comment.length; i++) {
    if (comment[i] === '(') open = i;
    else if (comment[i] === ')' && open >= 0) {
      const body = comment.slice(open + 1, i).trim().replace(/h\*$/i, '').trimEnd();
      if (body.split('+').every(part => /^\d+(?:\.\d+)?$/.test(part.trim()))) {
        result += comment.slice(cursor, open);
        cursor = i + 1;
      }
      open = -1;
    }
  }
  return result + comment.slice(cursor);
}
const COMMENT_NOISE_RE = /(?:\.{3,}|…+|[→←↔⇄⇆⇋⇌⇔]+)/g;

function tokenizeReconMoves(input: string): string[] {
  return input.match(MOVE_RE) ?? [];
}

function splitAlgComment(line: string): { alg: string; comment: string } {
  const idx = line.indexOf('//');
  if (idx < 0) return { alg: line, comment: '' };
  return { alg: line.slice(0, idx), comment: line.slice(idx + 2) };
}

export function findCrossLineIndex(solution: string): number {
  if (!solution) return -1;
  const lines = solution.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const { comment } = splitAlgComment(lines[i]);
    if (comment && CROSS_RE.test(comment)) return i;
  }
  return -1;
}

/** 十字段里的转体、宽层和中层都应收进观察阶段的朝向。 */
export function hasNormalizableCrossMove(solution: string): boolean {
  const idx = findCrossLineIndex(solution);
  if (idx < 0) return false;
  const lines = solution.split(/\r?\n/);
  for (let i = 0; i <= idx; i++) {
    const { alg } = splitAlgComment(lines[i]);
    for (const tok of tokenizeReconMoves(alg)) {
      const c = tok[0];
      if (i === idx && 'xyz'.includes(c)) return true;
      if (tok.length > 1 && tok[1] === 'w' && c >= 'A' && c <= 'Z') return true;
      if ('rludfb'.includes(c)) return true;
      if ('MES'.includes(c) && (tok.length === 1 || tok[1] !== 'w')) return true;
    }
  }
  return false;
}

/**
 * 把开头到 cross 行统一改写成「必要前缀转体 + 单层转动」。cross 后原样保留，
 * 因为整段改写前后是同一个空间置换。
 */
export function buildNormalizedSolution(solution: string): string | null {
  if (!solution) return null;
  const lines = solution.split(/\r?\n/);
  const crossLineIdx = findCrossLineIndex(solution);
  if (crossLineIdx < 0) return null;

  const lineAlgs: string[] = [];
  const lineComments: string[] = [];
  const lineTokens: string[][] = [];
  for (let i = 0; i <= crossLineIdx; i++) {
    const { alg, comment } = splitAlgComment(lines[i]);
    lineAlgs.push(alg);
    lineComments.push(comment.trim());
    lineTokens.push(tokenizeReconMoves(alg));
  }
  if (!lineTokens.some((tokens) => tokens.length > 0)) return null;

  let result: ReturnType<typeof normalizeLines>;
  try {
    result = normalizeLines(lineTokens, { expandSlices: true, preserveHalfTurnPrime: true });
  } catch {
    return null;
  }

  let prefixLine = lineComments.findIndex(comment => /^(?:insp(?:ection)?|观察)$/i.test(comment));
  if (prefixLine < 0) prefixLine = lineAlgs.findIndex((alg) => alg.trim().length > 0);
  if (prefixLine < 0) prefixLine = crossLineIdx;
  const out = [...lines];
  for (let i = 0; i <= crossLineIdx; i++) {
    let alg = result.perLine[i].join(' ');
    if (i === prefixLine && result.prefix.length > 0) {
      alg = alg ? `${result.prefix.join(' ')} ${alg}` : result.prefix.join(' ');
    }
    out[i] = [alg, lineComments[i] ? `// ${lineComments[i]}` : ''].filter(Boolean).join(' ');
  }
  return out.join('\n');
}

/** 旧编辑页用：取 inspection 到 cross 的规范化片段。 */
export function extractAndNormalizeCross(solution: string): { alg: string; lineIndex: number } | null {
  const full = buildNormalizedSolution(solution);
  if (!full) return null;
  const lineIndex = findCrossLineIndex(full);
  if (lineIndex < 0) return null;
  return { alg: full.split(/\r?\n/).slice(0, lineIndex + 1).join('\n'), lineIndex };
}

/**
 * Ground truth 的展示口径：动作区只保留真转动并重新空格分词；注释保留阶段语义，
 * 但删除形如 `(2.960)` / `(0.22+0.80)` / `(18h*)` 的时间标注。
 * 这样不会把 `...`、动作括号、箭头、regrip 标点写进测试期望，同时保留 `(BO)`。
 */
export function canonicalizeReconSolution(solution: string): string {
  return solution.split(/\r?\n/).map((line) => {
    const { alg, comment } = splitAlgComment(line);
    const moves = tokenizeReconMoves(alg).join(' ');
    const cleanComment = stripTimingComments(comment)
      .replace(COMMENT_NOISE_RE, '')
      .replace(/\s+/g, ' ')
      .trim();
    return [moves, cleanComment ? `// ${cleanComment}` : ''].filter(Boolean).join(' ');
  }).filter((line) => line.length > 0).join('\n');
}

/** 仅取复盘动作区的真转动，供播放器与“是否完整复原”校验共用。 */
export function reconAlgMoves(solution: string): string {
  return solution.split(/\r?\n/)
    .flatMap((line) => tokenizeReconMoves(splitAlgComment(line).alg))
    .join(' ');
}

export interface ReconGroundTruthText {
  truth: string;
  normalizedSolution: string;
  crossNormalized: boolean;
}

/** 站内 ground-truth 唯一文本生成入口。 */
export function buildReconGroundTruth(scramble: string, solution: string): ReconGroundTruthText {
  const normalized = buildNormalizedSolution(solution);
  const normalizedSolution = canonicalizeReconSolution(normalized ?? solution);
  return {
    truth: `${scramble.trim()}\n${normalizedSolution}`.replace(/\r\n?/g, '\n').trim(),
    normalizedSolution,
    crossNormalized: normalized !== null && normalized !== solution,
  };
}

export interface ReconCandidateMetadata {
  scramble: string;
  solution: string;
  value: string;
  rawTime: number | string | null;
}

/**
 * ground-truth 候选池的同步入口校验。这里仅判断数据库元数据；魔方状态是否完整复原
 * 仍由服务端 cubing.js 校验后追加 `source_not_solved`。
 */
export function reconCandidateMetadataBlockers(source: ReconCandidateMetadata): string[] {
  const scramble = source.scramble.trim();
  const solution = source.solution.trim();
  const result = source.value.trim();
  const blockers: string[] = [];

  if (!scramble) blockers.push('missing_scramble');
  else if (scramble.split(/\s+/).length < 10) blockers.push('short_scramble');
  if (!solution) blockers.push('missing_solution');

  const normalizedResult = result.toUpperCase();
  if (/^(?:DNF|DNS)(?:\b|\()/.test(normalizedResult)) blockers.push('dnf_or_dns');
  if (/^FAIL(?:ED|URE)?\b/.test(normalizedResult) || /\bfail(?:ed|ure)?\b/i.test(solution)) {
    blockers.push('fail_marker');
  }

  const rawTime = source.rawTime == null ? Number.NaN : Number(source.rawTime);
  if (!result || !Number.isFinite(rawTime) || rawTime <= 0) blockers.push('missing_result');
  return [...new Set(blockers)];
}
export type ReconTestStatus = 'running' | 'passed' | 'failed' | 'not-run' | 'interrupted';
export interface ReconTestRow { moves: string; label: string; colors: (string | null)[]; hrefs: (string | null)[]; diagrams: (string | null)[] }
export interface ReconTestCase {
  id: string; source: string; issue: string;
  /** Snapshot of explicit user approval at run time; old reports do not imply approval. */
  approved?: boolean;
  expected: ReconTestRow[]; actual?: ReconTestRow[];
  status: ReconTestStatus; durationMs?: number; errors: string[];
}
export interface ReconTestRun {
  version: 1; id: string; startedAt: string; finishedAt?: string;
  status: ReconTestStatus; trigger: string; commit: string; dirty: boolean;
  fingerprint: string; pid: number; cases: ReconTestCase[];
  passed: number; failed: number; skipped?: number; total: number; errors: string[];
}
export interface ReconTestHistory { runs: ReconTestRun[]; currentFingerprint?: string; scope: 'local' | 'cloud' }

/** Only bounded, complete reports may enter the shared administrator history. */
export function isReconTestRun(value: unknown): value is ReconTestRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as ReconTestRun;
  const strings = (items: unknown) => Array.isArray(items) && items.length <= 500 && items.every(item => typeof item === 'string' && item.length <= 20000);
  const cells = (items: unknown) => Array.isArray(items) && items.length <= 100 && items.every(item => item === null || (typeof item === 'string' && item.length <= 2000));
  const rows = (items: unknown) => Array.isArray(items) && items.length <= 100 && items.every(row => row && typeof row.moves === 'string' && row.moves.length < 10000 && typeof row.label === 'string' && row.label.length < 1000 && cells(row.colors) && cells(row.hrefs) && cells(row.diagrams));
  return run.version === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(run.id) && Number.isFinite(Date.parse(run.startedAt))
    && typeof run.finishedAt === 'string' && Number.isFinite(Date.parse(run.finishedAt))
    && ['passed', 'failed', 'interrupted'].includes(run.status)
    && typeof run.commit === 'string' && /^[0-9a-f]{0,64}$/.test(run.commit)
    && typeof run.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(run.fingerprint)
    && typeof run.dirty === 'boolean' && ['manual', 'commit', 'ci'].includes(run.trigger)
    && [run.passed, run.failed, run.skipped ?? 0, run.total].every(n => Number.isSafeInteger(n) && n >= 0)
    && run.passed + run.failed + (run.skipped ?? 0) <= run.total
    && strings(run.errors) && Array.isArray(run.cases) && run.cases.length <= 200
    && new Set(run.cases.map(sample => sample?.id)).size === run.cases.length
    && (run.status !== 'passed' || (run.failed === 0 && run.errors.length === 0 && run.passed + (run.skipped ?? 0) === run.total && run.cases.every(sample => sample && (sample.approved === false
      ? sample.status === 'not-run' && sample.actual === undefined && sample.errors.length === 0
      : sample.status === 'passed' && sample.actual !== undefined))))
    && run.cases.every(sample => sample && /^[A-Za-z0-9_-]{1,80}$/.test(sample.id) && typeof sample.issue === 'string'
      && sample.issue.length < 2000 && typeof sample.source === 'string' && sample.source.length < 1000
      && (sample.approved === undefined || typeof sample.approved === 'boolean')
      && ['passed', 'failed', 'not-run', 'interrupted'].includes(sample.status) && strings(sample.errors)
      && rows(sample.expected) && (sample.actual === undefined || rows(sample.actual)));
}
export * from './recon_intake';
