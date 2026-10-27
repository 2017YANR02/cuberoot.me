/** Shared offline evaluation contracts. Importing this module never calls a model. */
import { z } from 'zod';
import { SITE_ASSISTANT_QUESTION_MAX_LENGTH } from '@cuberoot/shared/site-assistant';
import { chunkKnowledge, knowledgeGeneration, type KnowledgeIndex } from '../src/utils/site_assistant_knowledge.js';

const caseSchema = z.object({
  id: z.string().regex(/^[GSNDCF]\d{2}$/), category: z.enum(['general', 'site', 'navigation', 'data', 'current', 'followup']),
  split: z.enum(['development', 'holdout']), question: z.string().min(1).max(SITE_ASSISTANT_QUESTION_MAX_LENGTH), expected: z.string().min(1),
  lang: z.enum(['zh', 'en']).default('zh'), toolPolicy: z.enum(['none', 'pages', 'navigation', 'data', 'current', 'context']),
  expectedRoutes: z.array(z.string().startsWith('/')).default([]), requiredTerms: z.array(z.string()).default([]),
  sourceRoutes: z.array(z.string().startsWith('/')).default([]),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).max(10).optional(),
});
export type EvaluationCase = z.infer<typeof caseSchema>;

/** Matching models and corpora alone do not establish a controlled comparison. */
export function compareBenchmarkMetadata(a: Record<string, unknown>, b: Record<string, unknown>) {
  const required = ['model', 'providerOrigin', 'corpusGeneration', 'codeFingerprint', 'casesFingerprint', 'configurationFingerprint'];
  const mismatches = required.filter(key => !a[key] || !b[key] || a[key] !== b[key]);
  return { comparable: mismatches.length === 0, mismatches };
}
export function parseEvaluationCases(input: unknown) {
  const { cases } = z.object({ version: z.literal(1), cases: z.array(caseSchema).min(1).max(100) }).parse(input);
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Duplicate evaluation case');
  return cases;
}

/** This is coverage evidence, not an automatic judgment of factual correctness. */
export async function auditKnowledge(index: KnowledgeIndex, cases: EvaluationCase[]) {
  const chunks = await chunkKnowledge(index);
  const sourceCounts = new Map<string, number>();
  for (const chunk of chunks) sourceCounts.set(chunk.documentId, (sourceCounts.get(chunk.documentId) ?? 0) + 1);
  const gaps = cases.filter(c => c.toolPolicy === 'pages' || c.requiredTerms.length).flatMap(c => (c.sourceRoutes.length ? c.sourceRoutes : c.expectedRoutes).map(href => {
    const page = index.pages.find(p => p.lang === c.lang && p.href === href);
    const missingTerms = c.requiredTerms.filter(term => !page?.text.toLowerCase().includes(term.toLowerCase()));
    return { id: c.id, lang: c.lang, href, status: !page ? 'missing_page' : !page.text.trim() ? 'navigation_only' : missingTerms.length ? 'missing_terms' : 'covered', missingTerms };
  }));
  return {
    generation: knowledgeGeneration(index), generatedAt: index.updated,
    freshnessNote: 'Index generation time is not each source publication or last-review time.',
    pages: index.pages.length, passages: chunks.length,
    navigationOnly: index.pages.filter(p => !p.text.trim()).length,
    byLanguage: (['zh', 'en'] as const).map(lang => ({ lang, pages: index.pages.filter(p => p.lang === lang).length, passages: chunks.filter(p => p.lang === lang).length })),
    largestSources: [...sourceCounts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([documentId, passages]) => ({ documentId, passages })),
    coverage: gaps,
  };
}

export function evaluateStructure(item: EvaluationCase, status: number, result: any, tools: string[]) {
  const failures: string[] = [];
  if (status !== 200 || typeof result?.answer !== 'string' || !result.answer.trim()) failures.push('request_failed');
  if (item.toolPolicy === 'none' && tools.length) failures.push('unnecessary_tool');
  if (item.toolPolicy === 'pages' && !tools.includes('pages')) failures.push('missing_content_read');
  if (item.toolPolicy === 'data' && !tools.some(t => /^(person|competition|statistics|analysis_)/.test(t))) failures.push('missing_data_read');
  if (item.toolPolicy === 'current' && !tools.some(t => ['web_search', 'news', 'competitions', 'person', 'statistics', 'records'].includes(t))) failures.push('missing_current_source');
  const destinations = [...(result?.sources ?? []), ...(result?.actions ?? [])].map(s => s.href as string);
  if (item.expectedRoutes.length && !item.expectedRoutes.some(route => destinations.some(href => href === route || href?.startsWith(route + '?') || href?.startsWith(route + '#')))) failures.push('missing_expected_destination');
  return { failures, semanticVerdict: 'pending_review', rubric: item.expected };
}
