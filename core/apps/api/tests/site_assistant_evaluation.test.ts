import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEvaluationCases, auditKnowledge, evaluateStructure, compareBenchmarkMetadata } from '../scripts/assistant-evaluation.js';
import { selectEvaluationCases } from '../scripts/benchmark-site-assistant.js';
const cases = parseEvaluationCases(JSON.parse(readFileSync(new URL('../../../../docs/benchmarks/assistant-phase1-cases.json', import.meta.url), 'utf8')));
describe('assistant evaluation boundaries', () => {
  it('rejects comparisons between different local code, cases or missing provenance', () => {
    const meta = { model: 'model', providerOrigin: 'https://provider.example', corpusGeneration: 'corpus', codeFingerprint: 'code', casesFingerprint: 'cases', configurationFingerprint: 'config' };
    expect(compareBenchmarkMetadata(meta, { ...meta })).toEqual({ comparable: true, mismatches: [] });
    expect(compareBenchmarkMetadata(meta, { ...meta, codeFingerprint: 'new-code' })).toEqual({ comparable: false, mismatches: ['codeFingerprint'] });
    expect(compareBenchmarkMetadata(meta, { ...meta, casesFingerprint: undefined }).comparable).toBe(false);
    expect(compareBenchmarkMetadata({}, {}).comparable).toBe(false);
  });
  it('keeps 20 held-out cases separate from 40 development cases', () => {
    expect(cases).toHaveLength(60);
    expect(selectEvaluationCases(cases)).toHaveLength(40);
    expect(selectEvaluationCases(cases, 'holdout')).toHaveLength(20);
    expect(() => selectEvaluationCases(cases, 'development', 'G10')).toThrow();
    expect(() => selectEvaluationCases(cases, 'all')).toThrow();
  });
  it('distinguishes missing, navigation-only and insufficient content', async () => {
    const report = await auditKnowledge({ updated: '2026-10-26T00:00:00.000Z', pages: [{ lang: 'zh', href: '/timer', title: 'Timer', text: '' }] }, cases);
    expect(report.navigationOnly).toBe(1);
    expect(report.passages).toBe(0);
    expect(report.coverage.find(c => c.id === 'S01')?.status).toBe('navigation_only');
    expect(report.coverage.find(c => c.id === 'S06')?.status).toBe('missing_page');
  });
  it('never calls a response semantically correct just because HTTP and links succeeded', () => {
    const item = cases.find(c => c.id === 'S01')!;
    expect(evaluateStructure(item, 200, { answer: 'invented instructions', sources: [{ href: '/timer' }] }, ['navigation'])).toMatchObject({ failures: ['missing_content_read'], semanticVerdict: 'pending_review' });
    expect(evaluateStructure(cases[0], 200, { answer: 'hello' }, ['pages']).failures).toEqual(['unnecessary_tool']);
  });
});
