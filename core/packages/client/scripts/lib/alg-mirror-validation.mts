import type { AlgCase, AlgEntry } from '@cuberoot/shared/alg';
import { algHtmlMatchesText, canonicalizeInitialU2 } from '@cuberoot/shared/alg-html';
import { alignCaseEntry, caseAlgIssue } from '../../lib/alg_case_alignment';
import { validateStoredAlgCase } from '../../lib/alg_validation';

/** Reuse public-case alignment and validation when explicitly adding a mirror. */
export async function validatedMirrorEntry(set: string, target: AlgCase, mirrored: AlgEntry, ori: number): Promise<AlgEntry> {
  const aligned = canonicalizeInitialU2(await alignCaseEntry('3x3', set, target, mirrored, ori));
  const issue = caseAlgIssue(aligned);
  if (issue) throw new Error(`case ${target.id}: ${issue}: ${mirrored.alg}`);
  const validation = await validateStoredAlgCase(aligned.setup ?? target.setup, aligned.alg, target.sticker, '3x3', set, { fixedOrientation: true });
  if (!validation.ok || !algHtmlMatchesText(aligned.alg, aligned.algHtml)) throw new Error(`case ${target.id}: invalid mirrored entry`);
  return { alg: aligned.alg, algHtml: aligned.algHtml };
}
