import { duplicateAware } from './alg_duplicates';
/**
 * Admin-only API for editing the canonical alg case database.
 * Replaces what used to be `data/alg_*.json` static files. Only ADMIN_WCA_IDS
 * users can call PUT/POST/DELETE; the server enforces.
 */
import type { AlgCase } from '@cuberoot/shared';
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi as handle } from './admin-api';
import { sourceAlgCase, sourceCaseEntry, commonCaseSetup, alignAlgFile, caseAlgIssue } from './alg_case_alignment';
import { caseViewSetup, type CaseViewAngle } from './alg_display';
import { cubeThumbParams, supportsCaseViewAngle } from './alg_thumb_plan';
import { isMergedOhCmllEntry, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';

const API_BASE = API_ORIGIN + '/v1/alg/sets';

export interface AlgSetSummary {
  puzzle: string;
  setSlug: string;
  source: string | null;
  scrapedAt: string | null;
  updatedAt: string;
  count: number;
}

export async function listAlgSets(fresh = false): Promise<AlgSetSummary[]> {
  const r = await fetch(API_BASE, fresh ? { cache: 'no-cache' } : undefined);
  return handle<AlgSetSummary[]>(r);
}

export interface AlgCaseInput {
  caseName: string;
  subgroup: string;
  setup: string;
  standard: string | null;
  sticker: unknown;
  algs: unknown;
  oriNames?: string[] | null;
  trainerKey?: string | null;
}

export async function createCase(puzzle: string, set: string, body: AlgCaseInput): Promise<AlgCase> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases`,
    { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) },
  );
  return duplicateAware(handle<AlgCase>(r));
}

export async function updateCase(puzzle: string, set: string, id: number, body: AlgCaseInput): Promise<AlgCase> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases/${id}`,
    { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) },
  );
  return duplicateAware(handle<AlgCase>(r));
}

/** Store a new public U-layer phase; source algorithms and their notation stay intact. */
export async function rotateCaseClockwise(file: AlgFile, c: AlgCase, viewAngle: CaseViewAngle = 'default'): Promise<AlgFile> {
  const puzzle = file.puzzle as AlgPuzzle;
  if (c.id == null || !['2x2', '3x3', '4x4', '5x5'].includes(puzzle)
    || !supportsCaseViewAngle(cubeThumbParams(puzzle, file.set, c.sticker))) {
    throw new Error('This case does not support a 90° top-layer rotation');
  }
  const source = sourceAlgCase(c);
  const rotated: AlgCase = { ...source,
    setup: caseViewSetup(caseViewSetup(commonCaseSetup(puzzle, file.set, c), viewAngle), 'u'),
    algs: c.algs.map((entries, oi) => {
      const originals = entries.map(sourceCaseEntry);
      // Reapply tags from imported duplicates folded out of the combined view.
      // Keep the current order and leave the separate OH collection untouched.
      return [...originals, ...source.algs[oi].filter(entry => isMergedOhCmllEntry(entry) && !originals.includes(entry))];
    }),
  };
  // Validate the complete candidate before saving. Existing mismatched rows
  // remain visible; a rotation must never introduce another failure or drop a row.
  const prepared = await alignAlgFile({ ...file, cases: file.cases.map(x => x.id === c.id ? rotated : x) });
  const next = prepared.cases.find(x => x.id === c.id)!;
  for (const [oi, entries] of next.algs.entries()) for (const entry of entries) {
    const previous = c.algs[oi].find(old => sourceCaseEntry(old) === sourceCaseEntry(entry));
    if ((!previous || !caseAlgIssue(previous)) && caseAlgIssue(entry)) {
      throw new Error('The rotated case could not be aligned with every solution');
    }
  }
  // Read the actual DB row for the write payload. Runtime CMLL includes imported
  // OH alternatives; saving that merged presentation would duplicate formulas.
  const fresh = await handle<AlgFile>(await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(file.set)}?_=${Date.now()}`,
    { cache: 'no-cache' },
  ));
  const stored = fresh.cases.find(x => x.id === c.id);
  if (!stored) throw new Error('Case not found');
  await updateCase(puzzle, file.set, c.id, {
    caseName: stored.name, subgroup: stored.subgroup ?? '', setup: rotated.setup,
    standard: stored.standard ?? null, sticker: stored.sticker, algs: stored.algs,
    oriNames: stored.oriNames ?? null, trainerKey: stored.trainerKey ?? null,
  });
  return prepared;
}

/**
 * 一个 case 内部的**公式顺序**(第一条是主推解法,顺序有意义)。
 *
 * 没有专门的端点,也不需要:PUT case 的 UPDATE 只写 name/subgroup/setup/standard/
 * sticker/algs/ori_names/trainer_key —— `meta` / `number` / `position` 它不碰,
 * 拿整条 case 回写不会顺手抹掉别的字段。
 */
export async function reorderCaseAlgs(
  puzzle: string,
  set: string,
  c: AlgCase,
  algs: AlgCase['algs'],
): Promise<AlgCase> {
  if (c.id == null) throw new Error('case has no id');
  const source = sourceAlgCase(c);
  return updateCase(puzzle, set, c.id, {
    caseName: c.name,
    subgroup: c.subgroup ?? '',
    setup: source.setup ?? '',
    standard: c.standard ?? null,
    sticker: c.sticker,
    algs: algs.map(entries => entries.map(sourceCaseEntry)),
    oriNames: c.oriNames ?? null,
    trainerKey: c.trainerKey ?? null,
  });
}

export async function reorderCases(puzzle: string, set: string, ids: number[]): Promise<{ ok: boolean }> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/reorder`,
    { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ids }) },
  );
  return handle<{ ok: boolean }>(r);
}

export async function getAlgCatalogOrder(puzzle: string, fresh = false): Promise<string[]> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/order`,
    fresh ? { cache: 'no-cache' } : undefined,
  );
  return (await handle<{ slugs: string[] }>(r)).slugs;
}

export async function reorderAlgCatalog(puzzle: string, slugs: string[]): Promise<{ ok: boolean }> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/order`,
    { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ slugs }) },
  );
  return handle<{ ok: boolean }>(r);
}

export async function deleteCase(puzzle: string, set: string, id: number): Promise<{ ok: boolean }> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases/${id}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return handle<{ ok: boolean }>(r);
}
