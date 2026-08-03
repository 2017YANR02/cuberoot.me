'use client';

/**
 * 社区题的编辑器 —— /quiz/new(出题、改自己的题)和 /quiz/manage(管理员补译、修错)共用。
 *
 * 双语两栏并排而不是「先选语言再写」:投稿只要求写一种语言,但管理员补译时必须同时看得见
 * 原文和译文,选语言的写法会把原文藏起来。用户只写一栏、另一栏留空,是被允许的常态。
 *
 * 校验用 @cuberoot/shared/quiz 的 validateQuizDraft —— 和服务端同一个函数。这里实时跑一遍
 * 只是为了把错误提前说清楚,真正的把关在服务端。
 */

import { Check, Plus, Trash2 } from 'lucide-react';
import {
  QUIZ_LIMITS, filledLangs, validateQuizDraft,
  type QuizDraft, type QuizDraftError,
} from '@cuberoot/shared/quiz';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';
import type { CommunityQuestionRow } from '@/lib/quiz-api';
import { CATEGORIES } from '../_data';

/** 空白草稿。默认选择题、简单档、三个选项 —— 最常见的形状,少点几下。 */
export function emptyDraft(): QuizDraft {
  return {
    cat: 'history',
    level: 'easy',
    type: 'choice',
    qZh: '', qEn: '',
    whyZh: '', whyEn: '',
    options: [{ zh: '', en: '' }, { zh: '', en: '' }, { zh: '', en: '' }],
    answerIdx: 0,
    answerZh: '', answerEn: '',
    accept: [],
  };
}

/** 已有的题 → 草稿(编辑用)。 */
export function draftFromRow(row: CommunityQuestionRow): QuizDraft {
  return {
    cat: row.cat,
    level: row.level,
    type: row.type,
    qZh: row.qZh, qEn: row.qEn,
    whyZh: row.whyZh, whyEn: row.whyEn,
    options: row.options.length > 0 ? row.options.map((o) => ({ ...o })) : emptyDraft().options,
    answerIdx: row.answerIdx,
    answerZh: row.answerZh, answerEn: row.answerEn,
    accept: [...row.accept],
  };
}

/** 校验错误码 → 人话。服务端返回同样的码(见 routes/quiz.ts 的 code 字段)。 */
export function errorText(code: QuizDraftError | 'daily_cap' | string): string {
  switch (code) {
    case 'cat': return tr({ zh: '请选一个分类', en: 'Pick a topic' });
    case 'level': return tr({ zh: '请选一个难度档', en: 'Pick a difficulty' });
    case 'type': return tr({ zh: '请选题型', en: 'Pick a question type' });
    case 'question': return tr({
      zh: '至少要把一种语言写完整:题面 + 该题型的答案部分',
      en: 'Fill one language completely — the question plus its answer',
    });
    case 'question_long': return tr({
      zh: `题面不能超过 ${QUIZ_LIMITS.question} 字`,
      en: `The question must be under ${QUIZ_LIMITS.question} characters`,
    });
    case 'why_long': return tr({
      zh: `解析不能超过 ${QUIZ_LIMITS.why} 字`,
      en: `The note must be under ${QUIZ_LIMITS.why} characters`,
    });
    case 'options_count': return tr({
      zh: `选择题要 ${QUIZ_LIMITS.minOptions}-${QUIZ_LIMITS.maxOptions} 个选项`,
      en: `A multiple-choice question needs ${QUIZ_LIMITS.minOptions}-${QUIZ_LIMITS.maxOptions} options`,
    });
    case 'option_dup': return tr({ zh: '同一语言下选项文案不能重复', en: 'Two options read the same in one language' });
    case 'option_long': return tr({
      zh: `单个选项不能超过 ${QUIZ_LIMITS.option} 字`,
      en: `Each option must be under ${QUIZ_LIMITS.option} characters`,
    });
    case 'answer_idx': return tr({ zh: '请标出哪个选项是正确的', en: 'Mark which option is correct' });
    case 'answer_long': return tr({
      zh: `参考答案不能超过 ${QUIZ_LIMITS.answer} 字`,
      en: `The answer must be under ${QUIZ_LIMITS.answer} characters`,
    });
    case 'accept_empty': return tr({
      zh: `问答题要写 1-${QUIZ_LIMITS.maxAccept} 个判对关键词`,
      en: `A short-answer question needs 1-${QUIZ_LIMITS.maxAccept} accepted keywords`,
    });
    case 'accept_long': return tr({
      zh: `单个关键词不能超过 ${QUIZ_LIMITS.acceptWord} 字`,
      en: `Each keyword must be under ${QUIZ_LIMITS.acceptWord} characters`,
    });
    case 'accept_unmatched': return tr({
      zh: '你自己的参考答案都判不对 —— 关键词里至少要有一个能在参考答案里找到',
      en: 'Your own reference answer would be marked wrong — at least one keyword must appear in it',
    });
    case 'daily_cap': return tr({ zh: '今天出的题已达上限,明天再来', en: 'You have hit today’s limit — come back tomorrow' });
    default: return code;
  }
}

interface Props {
  draft: QuizDraft;
  onChange: (next: QuizDraft) => void;
}

export default function QuestionEditor({ draft, onChange }: Props) {
  const set = (patch: Partial<QuizDraft>) => onChange({ ...draft, ...patch });
  const choice = draft.type === 'choice';
  const langs = filledLangs(draft);

  const setOption = (i: number, patch: Partial<{ zh: string; en: string }>) => {
    set({ options: draft.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  };

  const removeOption = (i: number) => {
    const options = draft.options.filter((_, j) => j !== i);
    // 删掉的是正确项或它前面的项时,下标要跟着挪 —— 否则「正确答案」会悄悄指到另一个选项。
    const answerIdx = i === draft.answerIdx ? 0 : i < draft.answerIdx ? draft.answerIdx - 1 : draft.answerIdx;
    set({ options, answerIdx: Math.min(answerIdx, Math.max(0, options.length - 1)) });
  };

  return (
    <div className="quiz-editor">
      <div className="quiz-editor-row">
        <label className="quiz-field is-inline">
          <span className="quiz-field-label">{tr({ zh: '分类', en: 'Topic' })}</span>
          <select
            className="quiz-select"
            value={draft.cat}
            onChange={(e) => set({ cat: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{tr(c.name)}</option>
            ))}
          </select>
        </label>

        <div className="quiz-field is-inline">
          <span className="quiz-field-label">{tr({ zh: '难度', en: 'Difficulty' })}</span>
          <PillToggle
            value={draft.level === 'hard'}
            onChange={(on) => set({ level: on ? 'hard' : 'easy' })}
            offLabel={tr({ zh: '简单', en: 'Easy' })}
            onLabel={tr({ zh: '进阶', en: 'Advanced' })}
            ariaLabel={tr({ zh: '难度', en: 'Difficulty' })}
          />
        </div>

        <div className="quiz-field is-inline">
          <span className="quiz-field-label">{tr({ zh: '题型', en: 'Type' })}</span>
          <PillToggle
            value={!choice}
            onChange={(on) => set({ type: on ? 'open' : 'choice' })}
            offLabel={tr({ zh: '选择题', en: 'Multiple choice' })}
            onLabel={tr({ zh: '问答题', en: 'Short answer' })}
            ariaLabel={tr({ zh: '题型', en: 'Question type' })}
          />
        </div>
      </div>

      <div className="quiz-field">
        <span className="quiz-field-label">{tr({ zh: '题面', en: 'Question' })}</span>
        <div className="quiz-bilingual">
          <label className="quiz-lang-box">
            <span className="quiz-lang-tag">中文</span>
            <textarea
              className="quiz-textarea"
              rows={2}
              maxLength={QUIZ_LIMITS.question}
              value={draft.qZh}
              onChange={(e) => set({ qZh: e.target.value })}
              placeholder={tr({ zh: '例如:一局比赛的观察时间是多少秒?', en: 'e.g. 一局比赛的观察时间是多少秒?' })}
            />
          </label>
          <label className="quiz-lang-box">
            <span className="quiz-lang-tag">English</span>
            <textarea
              className="quiz-textarea"
              rows={2}
              maxLength={QUIZ_LIMITS.question}
              value={draft.qEn}
              onChange={(e) => set({ qEn: e.target.value })}
              placeholder={tr({ zh: 'e.g. How long is inspection?', en: 'e.g. How long is inspection?' })}
            />
          </label>
        </div>
      </div>

      {choice ? (
        <div className="quiz-field">
          <span className="quiz-field-label">
            {tr({ zh: '选项(点左边的勾标出正确答案)', en: 'Options — tick the correct one' })}
          </span>
          <ul className="quiz-opt-list">
            {draft.options.map((o, i) => (
              <li key={i} className={`quiz-opt-row${i === draft.answerIdx ? ' is-answer' : ''}`}>
                <button
                  type="button"
                  className="quiz-opt-mark"
                  aria-pressed={i === draft.answerIdx}
                  aria-label={tr({ zh: `把第 ${i + 1} 项设为正确答案`, en: `Mark option ${i + 1} as correct` })}
                  onClick={() => set({ answerIdx: i })}
                >
                  <Check size={14} aria-hidden />
                </button>
                <input
                  className="quiz-input"
                  maxLength={QUIZ_LIMITS.option}
                  value={o.zh}
                  onChange={(e) => setOption(i, { zh: e.target.value })}
                  placeholder={tr({ zh: `选项 ${i + 1}(中文)`, en: `Option ${i + 1} (Chinese)` })}
                />
                <input
                  className="quiz-input"
                  maxLength={QUIZ_LIMITS.option}
                  value={o.en}
                  onChange={(e) => setOption(i, { en: e.target.value })}
                  placeholder={tr({ zh: `选项 ${i + 1}(English)`, en: `Option ${i + 1} (English)` })}
                />
                <button
                  type="button"
                  className="quiz-opt-del"
                  disabled={draft.options.length <= QUIZ_LIMITS.minOptions}
                  aria-label={tr({ zh: `删除第 ${i + 1} 项`, en: `Remove option ${i + 1}` })}
                  onClick={() => removeOption(i)}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {draft.options.length < QUIZ_LIMITS.maxOptions && (
            <button
              type="button"
              className="quiz-btn quiz-opt-add"
              onClick={() => set({ options: [...draft.options, { zh: '', en: '' }] })}
            >
              <Plus size={14} aria-hidden />
              {tr({ zh: '加一个选项', en: 'Add an option' })}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="quiz-field">
            <span className="quiz-field-label">{tr({ zh: '参考答案', en: 'Reference answer' })}</span>
            <div className="quiz-bilingual">
              <label className="quiz-lang-box">
                <span className="quiz-lang-tag">中文</span>
                <input
                  className="quiz-input"
                  maxLength={QUIZ_LIMITS.answer}
                  value={draft.answerZh}
                  onChange={(e) => set({ answerZh: e.target.value })}
                />
              </label>
              <label className="quiz-lang-box">
                <span className="quiz-lang-tag">English</span>
                <input
                  className="quiz-input"
                  maxLength={QUIZ_LIMITS.answer}
                  value={draft.answerEn}
                  onChange={(e) => set({ answerEn: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="quiz-field">
            <span className="quiz-field-label">{tr({ zh: '判对关键词', en: 'Accepted keywords' })}</span>
            <input
              className="quiz-input"
              value={draft.accept.join(', ')}
              onChange={(e) => set({ accept: e.target.value.split(',').map((k) => k.trim()) })}
              placeholder={tr({ zh: '逗号分隔,例如:鲁比克, rubik', en: 'Comma separated, e.g. 鲁比克, rubik' })}
            />
            <span className="quiz-field-hint">
              {tr({
                zh: '作答里出现任意一个就算对(不分大小写、忽略空格标点)。宁可写松一点 —— 判错了答题人还能自己改判。',
                en: 'Any one of these appearing in the answer counts as correct (case, spacing and punctuation ignored). Err on the generous side — the player can still override a wrong verdict.',
              })}
            </span>
            {draft.accept.filter(Boolean).length === 0 && (draft.answerZh.trim() || draft.answerEn.trim()) && (
              <button
                type="button"
                className="quiz-btn quiz-accept-fill"
                onClick={() => set({
                  accept: [draft.answerZh.trim(), draft.answerEn.trim()].filter(Boolean),
                })}
              >
                {tr({ zh: '用参考答案填', en: 'Use the reference answer' })}
              </button>
            )}
          </div>
        </>
      )}

      <div className="quiz-field">
        <span className="quiz-field-label">
          {tr({ zh: '解析(可选,答完显示)', en: 'Note (optional, shown after answering)' })}
        </span>
        <div className="quiz-bilingual">
          <label className="quiz-lang-box">
            <span className="quiz-lang-tag">中文</span>
            <textarea
              className="quiz-textarea"
              rows={2}
              maxLength={QUIZ_LIMITS.why}
              value={draft.whyZh}
              onChange={(e) => set({ whyZh: e.target.value })}
            />
          </label>
          <label className="quiz-lang-box">
            <span className="quiz-lang-tag">English</span>
            <textarea
              className="quiz-textarea"
              rows={2}
              maxLength={QUIZ_LIMITS.why}
              value={draft.whyEn}
              onChange={(e) => set({ whyEn: e.target.value })}
            />
          </label>
        </div>
      </div>

      {/* 一种语言都没写完时不出这一行 —— 那句话由提交按钮下方的提示统一说,不重复两遍。 */}
      {langs.length > 0 && (
        <p className="quiz-editor-lang">
          {langs.length === 2
            ? tr({ zh: '中英都写全了,两种语言下都会照原文出题。', en: 'Both languages complete — the question shows as written in either.' })
            : tr({
              zh: `目前只有${langs[0] === 'zh' ? '中文' : '英文'}是完整的:另一种语言下会照原文显示并标注,之后可以由管理员补译。`,
              en: `Only the ${langs[0] === 'zh' ? 'Chinese' : 'English'} side is complete: the other language shows the original text with a note, and an admin can translate it later.`,
            })}
        </p>
      )}
    </div>
  );
}

/** 当前草稿的第一个问题(没问题返回 null)。页面拿它决定提交按钮能不能点。 */
export function draftProblem(draft: QuizDraft): string | null {
  const code = validateQuizDraft(draft);
  return code ? errorText(code) : null;
}
