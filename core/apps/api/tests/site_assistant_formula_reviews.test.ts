import { describe, expect, it, vi } from 'vitest';
import type { QueryRunner } from '../src/db/connection.js';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { formulaReviewCall, personalFormulaReviewRequest, readMyFormulaReviews } from '../src/utils/site_assistant_formula_reviews.js';
import { toolCallSchema } from '../src/utils/site_assistant_tools.js';

vi.mock('../src/db/connection.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/db/connection.js')>(), query: vi.fn(),
}));

import { query } from '../src/db/connection.js';

const config = { key: 'fixture-key', baseUrl: 'https://model.example/v1', model: 'fixture-model' };
const sample = { set_slug: 'pll', id: '4309', name: 'Ga', is_due: true, lapses: 1, streak: 0 };
const lesson = {
  course_id: '00000000-0000-4000-8000-000000000001', course_zh: '三阶进阶', course_en: 'Advanced 3×3',
  lesson_id: '00000000-0000-4000-8000-000000000002', lesson_zh: 'F2L 配对', lesson_en: 'F2L pairing',
  status: 'in_progress', progress_bps: 4200, position_seconds: 91, completed: 2, available: 5,
};

describe('personal formula reviews', () => {
  it('only accepts bounded OLL, PLL and F2L selectors and rejects caller-supplied identity', () => {
    expect(toolCallSchema.safeParse({ tool: 'my_formula_reviews', set: 'pll', limit: 3 }).success).toBe(true);
    expect(toolCallSchema.safeParse({ tool: 'my_formula_reviews', set: 'f2l' }).success).toBe(true);
    for (const extra of [{ wcaId: '2012PARK03' }, { set: 'zbll' }, { limit: 20 }]) {
      expect(toolCallSchema.safeParse({ tool: 'my_formula_reviews', ...extra }).success).toBe(false);
    }
  });

  it('does not treat settings, write requests or another person’s practice as consent to read', () => {
    for (const question of ['如何关闭我的公式复习提醒？', '请清空我的 PLL 复习记录', '我朋友的 PLL 哪些已经到期？', 'Which of my friend’s cases are due for review?', '翻译：我的 PLL 复习清单里有哪些到期的？']) {
      expect(personalFormulaReviewRequest(question)).toBeUndefined();
    }
  });

  it('does not query any records without a linked account', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const db = vi.mocked(query);
    db.mockClear();
    const answer = await answerSiteQuestion('我今天该复习哪些 PLL？', 'zh', config, AbortSignal.timeout(3000), fetcher);
    expect(db).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(answer.answer).toContain('绑定 WCA ID');
  });

  it('reads only the authenticated viewer and sends the matched case to single-case recall', async () => {
    const db = vi.mocked(query);
    db.mockReset().mockResolvedValueOnce([sample]);
    const fetcher = vi.fn<typeof fetch>();
    const answer = await answerSiteQuestion('我今天该复习哪些 PLL？', 'zh', config, AbortSignal.timeout(3000), fetcher, [], '2017YANR02');
    expect(db).toHaveBeenCalledOnce();
    const [sql, values] = db.mock.calls[0];
    expect(sql).toContain('WHERE r.wca_id = ?');
    expect(sql).toContain('HAVING COUNT(*) = 1');
    expect(values?.slice(1, 4)).toEqual(['2017YANR02', 'pll', 'pll']);
    expect(fetcher).not.toHaveBeenCalled();
    expect(answer.answer).toContain('Ga · 已到期');
    expect(answer.actions).toContainEqual({ id: 'my-formula-review:pll:4309', title: 'PLL · Ga',
      href: '/timer?content=pll&source=cases&method=recall&draw=random&train.cases=4309' });
  });

  it('distinguishes no available recommendations from a retrieval failure', async () => {
    const reader = vi.fn<QueryRunner>().mockResolvedValue([]);
    const result = await readMyFormulaReviews(formulaReviewCall.parse({ tool: 'my_formula_reviews' }), '2017YANR02', 'en', 1000, reader);
    expect(result.outcome?.state).toBe('empty');
    expect(result.factualSummary).toContain('no synced 3×3 OLL / PLL reviews to recommend');
    vi.mocked(query).mockReset().mockRejectedValueOnce(new Error('query unavailable'));
    const answer = await answerSiteQuestion('Which of my PLL cases are due?', 'en', config, AbortSignal.timeout(3000), vi.fn<typeof fetch>(), [], '2017YANR02');
    expect(answer.answer).toContain('could not be read');
    expect(answer.sources).toEqual([]);
  });
});

describe('personal course and training follow-through', () => {
  const question = '我 F2L 哪些公式常忘？按我的课程进度，下一课学什么？';
  it('answers both questions with the authenticated viewer’s own records and usable destinations', async () => {
    const db = vi.mocked(query).mockReset().mockImplementation(async sql => sql.includes('platform_lesson_progress')
      ? [lesson] : [{ ...sample, id: '81', set_slug: 'f2l', name: 'Case 8', lapses: 3 }] as never[]);
    const fetcher = vi.fn<typeof fetch>();
    const answer = await answerSiteQuestion(question, 'zh', null, AbortSignal.timeout(3000), fetcher,
      [], '2017YANR02', undefined, 'UTC', [], 'auto', { viewerUserId: 123 });
    const courseCall = db.mock.calls.find(([sql]) => sql.includes('platform_lesson_progress'));
    expect(courseCall?.[1]).toEqual([123]);
    expect(courseCall?.[0]).toContain('grant_entry.lesson_ids');
    expect(courseCall?.[0]).toContain('p.user_id = $1');
    expect(db.mock.calls.find(([sql]) => sql.includes('alg_case_srs'))?.[1]?.slice(1, 4)).toEqual(['2017YANR02', 'f2l', 'f2l']);
    expect(answer.answer).toContain('曾忘记 3 次');
    expect(answer.answer).toContain('相同局面和计分方式再测 5 次');
    expect(answer.answer).toContain('已记录进度 42%');
    expect(answer.actions?.map(action => action.href)).toEqual(expect.arrayContaining([
      '/timer?content=f2l&source=cases&method=recall&draw=random&train.cases=81',
      `/platform/courses/${lesson.course_id}/learn/${lesson.lesson_id}?t=91`,
    ]));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the lesson when review records time out and never derives a course user from a WCA ID', async () => {
    const db = vi.mocked(query).mockReset().mockImplementation(async sql => {
      if (sql.includes('platform_lesson_progress')) return [lesson] as never[];
      throw new Error('reviews unavailable');
    });
    const answer = await answerSiteQuestion(question, 'zh', null, AbortSignal.timeout(3000), vi.fn(),
      [], '2017YANR02', undefined, 'UTC', [], 'auto', { viewerUserId: 123 });
    expect(answer.answer).toContain('暂时读不到这个账号的公式复习记录');
    expect(answer.answer).toContain('继续「F2L 配对」');
    db.mockClear();
    const unauthenticated = await answerSiteQuestion('按我的课程进度，下一课学什么？', 'zh', null, AbortSignal.timeout(3000), vi.fn(), [], '2017YANR02');
    expect(unauthenticated.answer).toContain('登录后');
    expect(db).not.toHaveBeenCalled();
  });
});
