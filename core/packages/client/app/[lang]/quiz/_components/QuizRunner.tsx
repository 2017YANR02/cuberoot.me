'use client';

/**
 * 一局问答的全过程:出题 → 作答 → 判卷 → 结算。
 *
 * 选择题点一下即锁定并立刻给出对错和解析;问答题输入后提交,按关键词判(见
 * _lib/deck.ts 的 gradeOpen),判得不准可以自己改判 —— 关键词表不可能穷尽所有
 * 说法,把最终裁量权交回用户比死判更合理。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, RotateCcw, ArrowRight, Flag } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { reportQuestion } from '@/lib/quiz-api';
import type { Level, Question, QuizCat, QuizCategory } from '../_data';
import { buildDeck, gradeChoice, gradeOpen, rebuildDeck, type DeckItem } from '../_lib/deck';

const BEST_KEY = 'cuberoot-quiz.best.v1';

/** 读/写各分类的最好成绩(正确率百分数,0-100)。存不下就当没有,不影响答题。 */
function loadBest(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : null;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function saveBest(key: string, pct: number): void {
  const all = loadBest();
  if ((all[key] ?? -1) >= pct) return;
  all[key] = pct;
  persistItem(BEST_KEY, JSON.stringify(all));
}

interface Verdict { q: Question; correct: boolean }

interface Props {
  level: Level;
  /** null = 混合模式。 */
  cat: QuizCat | null;
  category: QuizCategory | undefined;
  /** 社区题(运行时拉的);还没拉到就是空数组,这一局只出内置题。 */
  community: readonly Question[];
}

export default function QuizRunner({ level, cat, category, community }: Props) {
  // 出题要用 Math.random,SSR 首帧不能有牌 —— 挂载后再发,避免 hydration 错配。
  const [deck, setDeck] = useState<DeckItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  // 当前题的作答状态。picked 是选择题的显示位置;typed 是问答题的输入。
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);
  // 举报社区题。入口只在答完之后露出 —— 先看到题面、答案和解析,才谈得上判断它有没有问题。
  const user = useAuthUser();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const resetReport = useCallback(() => {
    setReportOpen(false);
    setReportText('');
    setReportState('idle');
  }, []);

  const sendReport = useCallback(async (dbId: number) => {
    const reason = reportText.trim();
    if (!reason) return;
    setReportState('sending');
    try {
      await reportQuestion(dbId, reason);
      setReportState('done');
      setReportOpen(false);
    } catch {
      setReportState('error');
    }
  }, [reportText]);

  const start = useCallback((items: DeckItem[]) => {
    setDeck(items);
    setIdx(0);
    setVerdicts([]);
    setPicked(null);
    setTyped('');
    setRevealed(false);
    setCorrect(false);
  }, []);

  // 社区题走 ref 而不是进 effect 依赖:这批题是 fetch 来的,数组身份会在答题过程中变
  // (父组件重渲、后台刷新)。进依赖的话一变就重出一局,用户答到一半的进度被抹掉。
  const communityRef = useRef(community);
  communityRef.current = community;
  const deal = useCallback(
    (c: QuizCat | null) => buildDeck(level, c, Math.random, communityRef.current),
    [level],
  );

  useEffect(() => { start(deal(cat)); }, [cat, deal, start]);

  const item = deck && idx < deck.length ? deck[idx] : null;
  const finished = deck !== null && idx >= deck.length;

  const answer = useCallback((isCorrect: boolean) => {
    setCorrect(isCorrect);
    setRevealed(true);
  }, []);

  const submitOpen = useCallback(() => {
    if (!item || item.q.type !== 'open' || revealed) return;
    answer(gradeOpen(typed, item.q.accept));
  }, [answer, item, revealed, typed]);

  const next = useCallback(() => {
    if (!item || !revealed) return;
    setVerdicts((v) => [...v, { q: item.q, correct }]);
    setIdx((i) => i + 1);
    setPicked(null);
    setTyped('');
    setRevealed(false);
    setCorrect(false);
    resetReport();
  }, [correct, item, resetReport, revealed]);

  const pick = useCallback((displayIndex: number) => {
    if (!item || item.q.type !== 'choice' || revealed) return;
    setPicked(displayIndex);
    answer(gradeChoice(item, displayIndex));
  }, [answer, item, revealed]);

  // 键盘:1-9 选项,Enter/空格 下一题(问答题的 Enter 归输入框自己处理)。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';
      // 输入框里的按键一概不管 —— 问答题的 Enter 由 input 自己的 onKeyDown 处理。
      // 这里再接一次会「提交 + 下一题」连跳两步:submitOpen 把 revealed 翻成 true 后
      // React 同步 flush 重挂了本 effect,而事件还没冒泡到 window,新监听照样会被调用。
      if (typing) return;
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
        return;
      }
      if (revealed || !item || item.q.type !== 'choice') return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= item.q.options.length) {
        e.preventDefault();
        pick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, next, pick, revealed]);

  // 当前题已判出对错但还没点「下一题」时也计进去,否则刚看到「答对了」计分却还是旧数。
  // 结算时 revealed 已复位,verdicts 里也已经有这一题,不会重复计。
  const score = verdicts.filter((v) => v.correct).length + (revealed && correct ? 1 : 0);
  const wrong = useMemo(() => verdicts.filter((v) => !v.correct).map((v) => v.q), [verdicts]);
  const total = deck?.length ?? 0;

  // 结算时记一次最好成绩,两个难度档各记一份。
  useEffect(() => {
    if (!finished || total === 0) return;
    saveBest(`${level}:${cat ?? 'mixed'}`, Math.round((score / total) * 100));
  }, [cat, finished, level, score, total]);

  const heading = category
    ? tr(category.name)
    : tr({ zh: '随机混合', en: 'Mixed round' });

  if (deck === null) {
    return <div className="quiz-stage" aria-busy="true" />;
  }

  if (finished) {
    const pct = total === 0 ? 0 : Math.round((score / total) * 100);
    return (
      <div className="quiz-stage">
        <div className="quiz-result">
          <div className="quiz-result-score">
            <strong>{score}</strong>
            <span>/ {total}</span>
          </div>
          <p className="quiz-result-line">
            {pct === 100
              ? tr({ zh: '全对,这一类你已经很熟了。', en: 'All correct — you know this one cold.' })
              : pct >= 60
                ? tr({ zh: `正确率 ${pct}%,错的那几道看看解析就补上了。`, en: `${pct}% correct — read the notes on the misses and you're set.` })
                : tr({ zh: `正确率 ${pct}%,再来一局吧。`, en: `${pct}% correct — worth another round.` })}
          </p>

          {wrong.length > 0 && (
            <div className="quiz-wrong">
              <h2>{tr({ zh: '答错的题', en: 'What you missed' })}</h2>
              <ul>
                {wrong.map((q) => (
                  <li key={q.id}>
                    <span className="quiz-wrong-q">{tr(q.q)}</span>
                    <span className="quiz-wrong-a">
                      {q.type === 'choice' ? tr(q.options[q.answer]) : tr(q.answer)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="quiz-actions">
            <button type="button" className="quiz-btn is-primary" onClick={() => start(deal(cat))}>
              <RotateCcw size={15} aria-hidden />
              {tr({ zh: '再来一局', en: 'Play again' })}
            </button>
            {wrong.length > 0 && (
              <button type="button" className="quiz-btn" onClick={() => start(rebuildDeck(wrong))}>
                {tr({ zh: '只做错题', en: 'Just the misses' })}
              </button>
            )}
            <Link href={`/quiz?level=${level}`} className="quiz-btn">
              {tr({ zh: '换一类', en: 'Pick another topic' })}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!item) return <div className="quiz-stage" />;

  const q = item.q;

  return (
    <div className="quiz-stage">
      <div className="quiz-bar">
        <span className="quiz-bar-cat">{heading}</span>
        {level === 'hard' && (
          <span className="quiz-bar-level">{tr({ zh: '进阶', en: 'Advanced' })}</span>
        )}
        <span className="quiz-bar-pos">{idx + 1} / {total}</span>
        <span className="quiz-bar-score">
          {tr({ zh: `答对 ${score}`, en: `${score} right` })}
        </span>
      </div>
      <div className="quiz-progress" aria-hidden>
        <i style={{ width: `${(idx / total) * 100}%` }} />
      </div>

      <h1 className="quiz-q">{tr(q.q)}</h1>

      {q.type === 'choice' ? (
        <ul className="quiz-options">
          {item.order.map((original, display) => {
            const isAnswer = original === q.answer;
            const isPicked = picked === display;
            const cls = [
              'quiz-option',
              revealed && isAnswer ? 'is-right' : '',
              revealed && isPicked && !isAnswer ? 'is-wrong' : '',
            ].filter(Boolean).join(' ');
            return (
              <li key={original}>
                <button type="button" className={cls} onClick={() => pick(display)} disabled={revealed}>
                  <span className="quiz-option-key" aria-hidden>{display + 1}</span>
                  <span className="quiz-option-text">{tr(q.options[original])}</span>
                  {revealed && isAnswer && <Check size={16} aria-hidden />}
                  {revealed && isPicked && !isAnswer && <X size={16} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="quiz-open">
          <input
            className="quiz-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (revealed) next(); else submitOpen();
            }}
            placeholder={tr({ zh: '写下你的答案', en: 'Type your answer' })}
            disabled={revealed}
            aria-label={tr({ zh: '你的答案', en: 'Your answer' })}
          />
          {!revealed && (
            <div className="quiz-open-actions">
              <button type="button" className="quiz-btn is-primary" onClick={submitOpen} disabled={!typed.trim()}>
                {tr({ zh: '提交', en: 'Submit' })}
              </button>
              <button type="button" className="quiz-btn" onClick={() => answer(false)}>
                {tr({ zh: '不知道,看答案', en: 'Show me the answer' })}
              </button>
            </div>
          )}
          {revealed && (
            <div className="quiz-open-answer">
              <span className="quiz-open-label">{tr({ zh: '参考答案', en: 'Answer' })}</span>
              <strong>{tr(q.answer)}</strong>
            </div>
          )}
        </div>
      )}

      {revealed && (
        <div className={`quiz-feedback ${correct ? 'is-right' : 'is-wrong'}`}>
          <div className="quiz-feedback-head">
            {correct ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
            <span>{correct ? tr({ zh: '答对了', en: 'Correct' }) : tr({ zh: '答错了', en: 'Not quite' })}</span>
            {q.type === 'open' && (
              <button type="button" className="quiz-flip" onClick={() => setCorrect((c) => !c)}>
                {correct
                  ? tr({ zh: '其实我答错了', en: 'Actually, I was wrong' })
                  : tr({ zh: '其实我答对了', en: 'Actually, I had it' })}
              </button>
            )}
          </div>
          {q.why && <p className="quiz-why">{tr(q.why)}</p>}

          {q.by && (
            <div className="quiz-by">
              <span className="quiz-by-who">
                {tr({
                  zh: `出题人:${q.by.authorName || '一位用户'}`,
                  en: `Contributed by ${q.by.authorName || 'a member'}`,
                })}
              </span>
              {q.by.onlyLang && (
                <span className="quiz-by-lang">
                  {q.by.onlyLang === 'zh'
                    ? tr({ zh: '仅中文', en: 'Chinese only' })
                    : tr({ zh: '仅英文', en: 'English only' })}
                </span>
              )}
              {reportState === 'done' ? (
                <span className="quiz-by-note">
                  {tr({ zh: '已举报,管理员会看到', en: 'Reported — an admin will see it' })}
                </span>
              ) : (
                <button
                  type="button"
                  className="quiz-flip"
                  onClick={() => {
                    if (!user) { useAuthStore.getState().login(); return; }
                    setReportOpen((o) => !o);
                  }}
                >
                  <Flag size={12} aria-hidden />
                  {tr({ zh: '这题有问题', en: 'Something’s wrong' })}
                </button>
              )}
            </div>
          )}

          {q.by && reportOpen && (
            <div className="quiz-report">
              <input
                className="quiz-input"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                maxLength={500}
                placeholder={tr({ zh: '哪里不对?例如:参考答案是错的', en: 'What’s wrong? e.g. the answer is incorrect' })}
                aria-label={tr({ zh: '举报理由', en: 'Reason' })}
              />
              <button
                type="button"
                className="quiz-btn is-primary"
                disabled={!reportText.trim() || reportState === 'sending'}
                onClick={() => { void sendReport(q.by!.dbId); }}
              >
                {tr({ zh: '提交', en: 'Send' })}
              </button>
              <button type="button" className="quiz-btn" onClick={resetReport}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
              {reportState === 'error' && (
                <span className="quiz-by-note is-error">
                  {tr({ zh: '提交失败,稍后再试', en: 'Could not send — try again later' })}
                </span>
              )}
            </div>
          )}

          <button type="button" className="quiz-btn is-primary quiz-next" onClick={next}>
            {idx + 1 === total ? tr({ zh: '看结果', en: 'See results' }) : tr({ zh: '下一题', en: 'Next' })}
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
