import { z } from 'zod';
import { query, type QueryRunner } from '../db/connection.js';
import type { ToolResult } from './site_assistant_tools.js';

export const formulaReviewCall = z.object({
  tool: z.literal('my_formula_reviews'),
  set: z.enum(['oll', 'pll', 'f2l']).optional(),
  limit: z.number().int().min(1).max(5).default(3),
}).strict();

type Lang = 'zh' | 'en';

export function personalFormulaReviewRequest(question: string) {
  if (!/我的|我(?:今天|现在)?(?:该|要|想|应)|我\s*F2L|\bmy\b|\bshould I (?:review|practi[cs]e)\b/i.test(question)
    || !/公式|\b(?:algorithms?|cases?|OLL|PLL|F2L)\b/i.test(question)
    || !/复习|到期|常错|常忘|容易忘|\b(?:review|due|lapses?|keep forgetting)\b/i.test(question)
    || !/哪些|复习什么|复习(?:记录|清单|进度)|到期|常错|常忘|容易忘|\b(?:which|due|review (?:progress|records?|list)|keep forgetting)\b/i.test(question)
    || /删除|清空|重置|关闭|提醒|修改|导出|翻译|举例|二阶|四阶|五阶|盲拧|他[的人]|她的|别人|我的(?:朋友|同学|队友)|\b(?:delete|clear|reset|turn off|reminders?|edit|export|translate|quote|example|ZBLL|EG1|CMLL|someone else's|his|her|their|my (?:friend|teammate))\b/i.test(question)) return;
  const oll = /\boll\b/i.test(question);
  const pll = /\bpll\b/i.test(question);
  const f2l = /\bf2l\b/i.test(question);
  if (f2l && (oll || pll)) return;
  const set = f2l ? 'f2l' as const : oll === pll ? undefined : oll ? 'oll' as const : 'pll' as const;
  const standalone = !/[;；\n]|并且|顺便|然后|以及|比较|分析|原因|计划|最近|近[几\d]+|分钟|\b(?:also|then|compare|analy[sz]e|plan|why|minutes?|last)\b/i.test(question);
  return { set, standalone };
}

interface ReviewRow {
  set_slug: 'oll' | 'pll' | 'f2l';
  id: string | number;
  name: string;
  is_due: boolean;
  lapses: number;
  streak: number;
}

/** Rows are scoped to the authenticated viewer. No tool argument can name an account. */
export async function readMyFormulaReviews(call: z.output<typeof formulaReviewCall>, viewerWcaId: string | undefined,
  lang: Lang, now = Date.now(), queryDb: QueryRunner = query): Promise<ToolResult> {
  if (!viewerWcaId) return { evidence: { notEvidence: true }, sources: [], artifacts: [], factualSummary: {
    zh: '绑定 WCA ID 后即可查看这个账号已同步的公式复习记录。',
    en: 'Link a WCA ID to view the formula reviews synced to this account.',
  }[lang] };

  // A case key is the trainer's subgroup|name. Skip stale or ambiguous keys
  // instead of opening a differently named case or the entire training set.
  const rows = await queryDb<ReviewRow>(`
    SELECT r.set_slug, c.id, c.name, r.due <= ? AS is_due, r.lapses, r.streak
      FROM alg_case_srs r
      JOIN LATERAL (
        SELECT MIN(id) AS id, MIN(name) AS name
          FROM alg_cases
         WHERE puzzle = r.puzzle AND set_slug = r.set_slug
           AND subgroup || '|' || name = r.case_key
        HAVING COUNT(*) = 1
      ) c ON TRUE
     WHERE r.wca_id = ? AND r.puzzle = '3x3'
       AND (r.set_slug = ?::text OR (?::text IS NULL AND r.set_slug IN ('oll', 'pll')))
       AND (r.due <= ? OR (r.lapses > 0 AND r.streak < 2))
     ORDER BY is_due DESC, CASE WHEN r.due <= ? THEN r.due END ASC,
              r.lapses DESC, r.reviewed_at DESC, r.set_slug, c.id
     LIMIT ?`, [now, viewerWcaId, call.set ?? null, call.set ?? null, now, now, call.limit]);

  const scope = call.set?.toUpperCase() ?? 'OLL / PLL';
  const progress = { id: 'my-formula-reviews', title: { zh: '公式学习进度', en: 'Algorithm Progress' }[lang], href: '/alg/progress', read: true };
  const cases = rows.map(row => ({
    name: row.name, set: row.set_slug.toUpperCase(), due: row.is_due,
    lapses: row.lapses, streak: row.streak,
    source: { id: `my-formula-review:${row.set_slug}:${row.id}`,
      title: `${row.set_slug.toUpperCase()} · ${row.name}`,
      href: `/timer?content=${row.set_slug}&source=cases&method=recall&draw=random&train.cases=${row.id}`, read: false },
  }));
  const factualSummary = cases.length ? [
    { zh: `三阶 ${scope} 已同步记录里，可以先复习这些局面。`, en: `Start with these cases from your synced 3×3 ${scope} reviews.` }[lang],
    ...cases.map(({ source, due, lapses, streak }) => `- ${source.title} · ${due
      ? { zh: '已到期', en: 'Due' }[lang]
      : { zh: '优先复习', en: 'Prioritize for review' }[lang]}${lapses ? {
        zh: `，曾忘记 ${lapses} 次，已连续记得 ${streak} 次`,
        en: `, forgotten ${lapses} time(s), currently ${streak} correct recalls in a row`,
      }[lang] : ''} [[${source.id}]]`),
    ...(call.set === 'f2l' ? [{
      zh: '先看局面做 5 次回忆，记下看答案前就能完成的次数。核对并练习后，用相同局面和计分方式再测 5 次。',
      en: 'First attempt five recalls from the same set of positions. Count how many you complete without seeing the answer. Check and practise, then retest five times with the same positions and scoring.',
    }[lang]] : []),
  ].join('\n') : { zh: `三阶 ${scope} 暂无可推荐的已同步复习记录。`, en: `There are no synced 3×3 ${scope} reviews to recommend yet.` }[lang];
  return {
    evidence: { scope, cases: cases.map(({ source, ...item }) => ({ ...item, sourceId: source.id })),
      instruction: 'Only the stated scope of synced review records was read for the authenticated viewer. Due dates and memory grades do not measure recognition or execution speed. An empty result does not mean every case is mastered. Cite the individual source IDs for training links.' },
    sources: [progress, ...cases.map(item => item.source)], artifacts: [], factualSummary,
    outcome: { state: cases.length ? 'success' : 'empty' },
  };
}
