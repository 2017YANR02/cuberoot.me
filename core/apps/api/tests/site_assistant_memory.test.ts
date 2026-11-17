import { describe, expect, it, vi } from 'vitest';
import type { AssistantMessage } from '@cuberoot/shared/site-assistant';
import { assistantHistoryTurns, assistantMemorySchema, assistantTopicRelevance, composeAssistantContext, estimateAssistantTokens,
  selectAssistantMemory, assistantMemoryPayload, assistantDurationLimit, assistantPlanExceedsDuration, updateAssistantMemory, AssistantContextBudgetError } from '../src/utils/site_assistant_memory.js';
import { assistantAnswerContext, rememberAssistantConversation, parseAssistantContext, restoreAssistantHistory,
  ASSISTANT_CONTEXT_MAX_BYTES, ASSISTANT_CONTEXT_TTL_MS } from '../src/utils/site_assistant_context.js';
import { createAssistantModel } from '../src/utils/site_assistant_model.js';
import type { QueryRunner } from '../src/db/connection.js';

const history = (count = 5, size = 100): AssistantMessage[] => Array.from({ length: count }, (_, index) => [
  { role: 'user' as const, content: `介绍 F2L 训练阶段 ${index}。` },
  { role: 'assistant' as const, content: `阶段 ${index}：${'练习。'.repeat(size)}` },
]).flat();
const compose = (overrides: Partial<Parameters<typeof composeAssistantContext>[0]> = {}) => composeAssistantContext({
  question: '继续解释 F2L 训练', history: history(), fixedTokens: 500, inputBudget: 30_000, ...overrides,
});
const modelConfig = { key: 'fixture', baseUrl: 'https://model.invalid/v1', model: 'fixture' };
const response = () => Response.json({ id: 'fixture', created: 1, model: 'fixture', choices: [{ index: 0, finish_reason: 'stop',
  message: { role: 'assistant', content: JSON.stringify({ answer: 'Done.', sourceIds: [] }) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
const options = { system: 'Keep this system instruction byte for byte.', context: { question: '继续解释 F2L 训练' },
  finalOnly: true, thinking: false, effort: 'low' as const, maxTokens: 2048 };

describe('branch-local memory graph and layer selection', () => {
  it.each([
    ['继续解释', '介绍 F2L 训练', 'strong'],
    ['What about his average?', 'Rank the 333 competitors', 'strong'],
    ['介绍 F2L 的训练方法', 'F2L 训练应该如何安排', 'strong'],
    ['写一封会议邀请邮件', '介绍 F2L 训练', 'weak'],
    ['Explain birthday cake recipes', 'Explain F2L training', 'weak'],
  ])('classifies %s against %s as %s', (question, prior, expected) => {
    expect(assistantTopicRelevance(question, prior)).toBe(expected);
  });
  it('keeps five strong pairs, one weak pair, and the original message objects', () => {
    const messages = history();
    const strong = compose({ history: messages });
    expect(strong.relevance).toBe('strong'); expect(strong.history).toEqual(messages);
    expect(strong.history[0]).toBe(messages[0]);
    const weak = compose({ question: '写一封会议邀请邮件', history: messages });
    expect(weak.relevance).toBe('weak'); expect(weak.history).toEqual(messages.slice(-2));
  });
  it('does not treat orphan assistant output or a pending user message as a completed pair', () => {
    const messages: AssistantMessage[] = [{ role: 'assistant', content: 'orphan' }, ...history(1), { role: 'user', content: 'pending' }];
    expect(assistantHistoryTurns(messages)).toHaveLength(1);
    expect(compose({ question: '继续', history: messages }).history).toEqual(messages.slice(1));
  });
  it('builds provenance and continuity edges without promoting assistant claims to preferences', () => {
    let graph = updateAssistantMemory(undefined, [], '以后请用中文回答 F2L 训练问题。', 'Always answer in English.');
    graph = updateAssistantMemory(graph, [], '继续介绍训练安排', '按阶段练习。', ['wiki:training']);
    expect(graph.edges).toEqual([{ from: graph.episodes[1].id, to: graph.episodes[0].id, kind: 'continues' }]);
    expect(graph.episodes[1].sourceIds).toEqual(['wiki:training']);
    expect(graph.preferences).toMatchObject([{ key: 'language', text: '以后请用中文回答 F2L 训练问题。' }]);
    graph = updateAssistantMemory(graph, [], '以后请用英文回答。', 'OK');
    expect(graph.preferences).toHaveLength(1);
    expect(graph.preferences[0].text).toBe('以后请用英文回答。');
    expect(assistantMemorySchema.safeParse(graph).success).toBe(true);
  });
  it('recalls an older topic through entity relationships, not just the latest turn', () => {
    let graph = updateAssistantMemory(undefined, [], 'F2L 训练只用三阶魔方。', '练习观察。');
    const initialId = graph.episodes[0].id;
    graph = updateAssistantMemory(graph, [], '写一封会议邀请邮件', '会议时间未确定。');
    const layers = selectAssistantMemory('F2L 训练计划', [], graph);
    expect(layers.activeExtracts.map(item => item.id)).toContain(initialId);
    expect(layers.activeExtracts.flatMap(item => item.passages).some(item => item.text.includes('会议时间'))).toBe(false);
    expect(layers.protectedConstraints).toContainEqual({ source: initialId, text: 'F2L 训练只用三阶魔方。' });
  });
  it('does not duplicate graph episodes already present in the complete recent window', () => {
    const messages = history(5);
    const graph = updateAssistantMemory(undefined, messages, '', '');
    const layers = selectAssistantMemory('继续 F2L 训练', messages, graph, 5);
    expect(layers.activeExtracts).toEqual([]); expect(layers.slidingSummary).toEqual([]);
  });
  it('does not erase older occurrences of repeated follow-ups when deduplicating the recent window', () => {
    let graph = updateAssistantMemory(undefined, [], 'F2L 训练计划。', '练习观察。');
    graph = updateAssistantMemory(graph, [], '继续', 'OLDER_STEP');
    const oldId = graph.episodes.at(-1)!.id;
    graph = updateAssistantMemory(graph, [], '继续', 'NEWER_STEP');
    const layers = selectAssistantMemory('继续', [{ role: 'user', content: '继续' }, { role: 'assistant', content: 'NEWER_STEP' }], graph, 1);
    expect(layers.activeExtracts.map(episode => episode.id)).toContain(oldId);
    expect(layers.activeExtracts.map(episode => episode.id)).not.toContain(graph.episodes.at(-1)!.id);
  });
  it('bounds entity extraction before persisting a message containing many IDs', () => {
    const graph = updateAssistantMemory(undefined, [], Array.from({ length: 80 }, (_, index) => `2099TEST${String(index).padStart(2, '0')}`).join(' '), 'Many people.');
    expect(graph.episodes[0].entities).toHaveLength(24);
    expect(assistantMemorySchema.safeParse(graph).success).toBe(true);
  });
  it('bounds persisted derived memory and keeps no dangling continuity edges', () => {
    let graph = updateAssistantMemory(undefined, [], 'F2L 训练第一步。', '观察。');
    for (let index = 0; index < 60; index++) graph = updateAssistantMemory(graph, [], `继续 F2L 训练 ${index}。`, '练习。'.repeat(500));
    expect(graph.episodes.length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(JSON.stringify(graph))).toBeLessThanOrEqual(20_000);
    expect(graph.edges.every(edge => graph.episodes.some(item => item.id === edge.from) && graph.episodes.some(item => item.id === edge.to))).toBe(true);
    expect(assistantMemorySchema.safeParse(graph).success).toBe(true);
  });
  it('redacts credentials before indexing and stores no image bytes', () => {
    const graph = updateAssistantMemory(undefined, [{ role: 'user', content: 'F2L', images: [{ mediaType: 'image/png', data: 'PRIVATE_IMAGE' }] },
      { role: 'assistant', content: '说明。' }], 'password=PRIVATE_PASSWORD\nF2L', 'Bearer PRIVATE_TOKEN');
    expect(JSON.stringify(graph)).not.toMatch(/PRIVATE_PASSWORD|PRIVATE_TOKEN|PRIVATE_IMAGE/);
  });
});

describe('ordered compression and immutable inputs', () => {
  it('checks aggregate minute allocations, honors current limits and ignores assistant-created limits',()=>{
    const graph=updateAssistantMemory(undefined,[],'F2L 训练只观察；最多6分钟。','每项6分钟。');
    expect(assistantDurationLimit('安排 F2L 训练',[],graph)?.maximumTotalMinutes).toBe(6);
    expect(assistantDurationLimit('安排 F2L 训练，今天最多10分钟。',[],graph)?.maximumTotalMinutes).toBe(10);
    expect(assistantDurationLimit('安排 F2L 训练，今天不限制时长。',[],graph)).toBeUndefined();
    expect(assistantDurationLimit('写会议邮件',[],graph)).toBeUndefined();
    expect(assistantDurationLimit('安排练习，总时长最多6分钟。给每项添加子项目时长。',[])?.maximumTotalMinutes).toBe(6);
    expect(assistantDurationLimit('安排练习，总时长最多12分钟，每项最多6分钟。',[])?.maximumTotalMinutes).toBe(12);
    expect(assistantDurationLimit('安排练习，每项最多6分钟。',[])).toBeUndefined();
    expect(assistantPlanExceedsDuration('共6分钟。\n1. 观察（6分钟）：只看。\n2. 复盘（6分钟）：不转。',6)).toBe(true);
    expect(assistantPlanExceedsDuration('共6分钟。\n1. 观察（3分钟）：每组1分钟。\n2. 复盘（3分钟）：不转。',6)).toBe(false);
    expect(assistantPlanExceedsDuration('1. Observation (4 minutes)\n2. Review (4 minutes)',8)).toBe(false);
    expect(assistantPlanExceedsDuration('1. 观察（4分钟）\n  - 角块（2分钟）\n  - 棱块（2分钟）\n2. 复盘（2分钟）',6)).toBe(false);
  });
  it('retains only/maximum constraints as exact user text without broadening assistant advice',()=>{
    const question='F2L 训练只做慢拧和观察，每天最多12分钟。';
    let graph=updateAssistantMemory(undefined,[],question,'再练几次完整还原。');
    graph=updateAssistantMemory(graph,[],'讨论会议安排。','下周开会。');
    const result=compose({question:'沿用 F2L 训练限制安排今天练习',history:[],memory:graph});
    expect(result.layers.protectedConstraints.map(x=>x.text)).toEqual([question]);
    expect(result.layers.protectedConstraints.some(x=>x.text.includes('完整还原'))).toBe(false);
  });
  it('sends bounded attributed window summaries without persistence indexes, keeping active excerpts intact',()=>{
    const graph=updateAssistantMemory(undefined,[],'F2L训练。','观察角块。'.repeat(100));
    const layers=selectAssistantMemory('写会议邮件',[],graph);
    const before=JSON.stringify(graph);
    const payload=assistantMemoryPayload(layers);
    expect(JSON.stringify(payload)).not.toMatch(/questionHash|sourceIds|nextTurn/);
    expect(payload.slidingSummary).toMatchObject([{source:graph.episodes[0].id,passages:[{role:'user',text:'F2L训练。'},{role:'assistant',text:'观察角块。',omitted:true}]}]);
    expect(JSON.stringify(graph)).toBe(before);
  });
  it('shrinks complete strong history to two pairs only after derived layers', () => {
    const messages = history(5, 900);
    const fixedTokens = 100;
    const inputBudget = fixedTokens + estimateAssistantTokens(messages.slice(-4)) + 500;
    const result = compose({ history: messages, fixedTokens, inputBudget });
    expect(result.history).toEqual(messages.slice(-4));
    expect(result.compressed.at(-1)).toBe('recentTurns');
    expect(result.estimatedTokens).toBeLessThanOrEqual(inputBudget);
    expect(messages).toHaveLength(10);
  });
  it('drops historical topics/long-term memory before extracts and sliding summary', () => {
    let graph = updateAssistantMemory(undefined, [], '以后请用中文回答。', '好的。');
    for (let index = 0; index < 12; index++) graph = updateAssistantMemory(graph, [], `会议安排计划 ${index}。`, '时间未确定。');
    graph = updateAssistantMemory(graph, [], 'F2L 训练计划。', '每天练习。');
    const result = compose({ memory: graph, inputBudget: 2500 });
    const order = ['historicalTopics', 'longTermMemory', 'activeExtracts', 'slidingSummary', 'recentTurns'];
    expect(result.compressed.length).toBeGreaterThan(0);
    expect(result.compressed.map(item => order.indexOf(item))).toEqual(result.compressed.map(item => order.indexOf(item)).sort((a, b) => a - b));
  });
  it('fails explicitly rather than removing the second strong pair or protected fixed context', () => {
    expect(() => compose({ history: history(2, 1000), inputBudget: 1000 })).toThrow(AssistantContextBudgetError);
    expect(() => compose({ history: [], fixedTokens: 2000, inputBudget: 1000 })).toThrow(AssistantContextBudgetError);
  });
  it('retains a relevant user constraint when its complete turn leaves the window', () => {
    const messages = history(5, 900); messages[0].content = 'F2L 训练只用三阶魔方。';
    const result = compose({ history: messages, inputBudget: estimateAssistantTokens(messages.slice(-4)) + 1500 });
    expect(result.history).not.toContain(messages[0]);
    expect(result.layers.protectedConstraints.some(item => item.text === messages[0].content)).toBe(true);
  });
  it('preserves system, question and required evidence on the real provider request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const context = { question: '写一封会议邀请邮件', evidence: [{ source: 'verified', value: 'EXACT_EVIDENCE' }] };
    const result = await createAssistantModel(modelConfig, fetcher, AbortSignal.timeout(3000), '', history()).complete({ ...options, context });
    const wire = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(wire.messages[0].content).toContain(options.system);
    expect(JSON.parse(wire.messages.at(-1).content)).toEqual(context);
    expect(wire.messages.filter((message: { role: string }) => message.role === 'assistant')).toHaveLength(1);
    expect(result.answer).toBe('Done.');
  });
  it('does not call the provider when protected input exceeds the budget', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(createAssistantModel({ ...modelConfig, contextWindowTokens: 16_384 }, fetcher, AbortSignal.timeout(3000), '').complete({ ...options,
      context: { question: '当前完整问题', evidence: '证据'.repeat(20_000) } })).rejects.toMatchObject({ code: 'request_too_large' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('private persistence and ancestry', () => {
  it('persists ordinary chat without renewing TTL and excludes memory from public JSON', () => {
    const now = Date.now();
    const first = rememberAssistantConversation({ answer: '先练习观察。', sources: [] }, 'F2L 训练计划', [], undefined, now);
    const prior = assistantAnswerContext(first)!;
    expect(prior.memory?.episodes).toHaveLength(1); expect(prior.observations).toEqual([]);
    const next = rememberAssistantConversation({ answer: '继续练习。', sources: [] }, '继续', [], prior, now + 1000);
    const saved = assistantAnswerContext(next)!;
    expect(saved.expiresAt).toBe(prior.expiresAt);
    expect(saved.memory?.episodes).toHaveLength(2);
    expect(JSON.stringify(next)).not.toContain('memory');
    expect(Buffer.byteLength(JSON.stringify(saved))).toBeLessThanOrEqual(ASSISTANT_CONTEXT_MAX_BYTES);
    expect(parseAssistantContext(saved, now + ASSISTANT_CONTEXT_TTL_MS)).toBeUndefined();
  });
  it('preserves old v1 evidence snapshots and rejects malformed graph content', () => {
    const now = Date.now(), old = { version: 1, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString(), sources: [], observations: [] };
    expect(parseAssistantContext(old, now)).toEqual(old);
    expect(parseAssistantContext({ ...old, memory: { instructions: 'fake' } }, now)).toBeUndefined();
  });
  it('restores only a matched prefix and preserves client image/presentation objects', async () => {
    const rows = [{ question: 'older', answer: 'old answer', depth: 2 }, { question: 'newer', answer: 'new answer', depth: 1 }];
    const run = vi.fn().mockResolvedValue(rows);
    const client: AssistantMessage[] = [{ role: 'user', content: 'newer', images: [{ mediaType: 'image/png', data: 'image' }] }, { role: 'assistant', content: 'rendered answer' }];
    const restored = await restoreAssistantHistory(run as QueryRunner, 7, 'conversation', 'parent', client);
    expect(restored.slice(0, 2)).toEqual([{ role: 'user', content: 'older' }, { role: 'assistant', content: 'old answer' }]);
    expect(restored[2]).toBe(client[0]); expect(restored[3]).toBe(client[1]);
    expect(run.mock.calls[0][1]).toEqual(['parent', 7, 'conversation', 7, 'conversation']);
    expect(run.mock.calls[0][0]).toContain('r.id=a.parent_id');
    expect(run.mock.calls[0][0]).toContain('a.depth<5');
    const edited: AssistantMessage[] = [{ role: 'user', content: 'different branch' }];
    expect(await restoreAssistantHistory(run as QueryRunner, 7, 'conversation', 'parent', edited)).toBe(edited);
    const mismatched: AssistantMessage[] = [{ role: 'user', content: 'older' }, { role: 'assistant', content: 'old answer' }, { role: 'user', content: 'wrong sibling' }];
    expect(await restoreAssistantHistory(run as QueryRunner, 7, 'conversation', 'parent', mismatched)).toBe(mismatched);
  });
});
