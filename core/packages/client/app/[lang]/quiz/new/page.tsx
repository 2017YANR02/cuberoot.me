'use client';

/**
 * /quiz/new —— 登录用户出题。?edit=<id> 时是改自己已发布的那道题(同一套表单)。
 *
 * 出的题直接上线,没有前置审核队列 —— 所以这页的责任是把话说清楚:发出去别人马上答得到,
 * 出错会被举报。校验与服务端共用 shared/quiz,提交前就把问题指出来,不让人白提交一次。
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsInteger } from 'nuqs';
import { Key } from 'lucide-react';
import type { QuizDraft } from '@cuberoot/shared/quiz';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import Link from '@/components/AppLink';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { createQuestion, fetchMyQuestions, updateQuestion } from '@/lib/quiz-api';
import QuestionEditor, { draftFromRow, draftProblem, emptyDraft, errorText } from '../_components/QuestionEditor';
import '../quiz.css';

export default function QuizNewPage() {
  const router = useRouter();
  const lang = useLang();
  const user = useAuthUser();
  const [editId] = useQueryState('edit', parseAsInteger);

  const [draft, setDraft] = useState<QuizDraft>(emptyDraft);
  // 编辑模式要先把原题读回来 —— 读到之前不能让人改,否则一提交就把原题覆盖成空的。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId === null || !user) return;
    let cancelled = false;
    setLoading(true);
    fetchMyQuestions()
      .then((rows) => {
        if (cancelled) return;
        const row = rows.find((r) => r.id === editId);
        if (row) setDraft(draftFromRow(row));
        else setError(tr({ zh: '找不到这道题,或者它不是你出的', en: 'No such question, or it is not yours' }));
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [editId, user]);

  const problem = draftProblem(draft);

  const submit = async () => {
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      if (editId === null) await createQuestion(draft);
      else await updateQuestion(editId, draft);
      router.push(`${lang === 'zh' ? '/zh' : ''}/quiz/mine`);
    } catch (e) {
      // 服务端把校验错误码放在 message 里(`Invalid question: <code>`),翻成人话再显示。
      const raw = (e as Error).message;
      const code = raw.startsWith('Invalid question: ') ? raw.slice('Invalid question: '.length) : raw;
      setError(errorText(code));
      setSaving(false);
    }
  };

  return (
    <div className="quiz-page">
      <div className="quiz-head">
        <BackHome />
        <HeaderToggles />
      </div>

      <div className="quiz-hub quiz-form-page">
        <h1>{editId === null
          ? tr({ zh: '出一道题', en: 'Write a question' })
          : tr({ zh: '改这道题', en: 'Edit your question' })}</h1>
        <p className="quiz-intro">
          {tr({
            zh: '发布后立刻进入对应分类,别人答题时会和内置题一起抽到。答案写准一点 —— 答错的人会举报。',
            en: 'Once published it joins that topic straight away and shows up alongside the built-in questions. Get the answer right — players can report a question that is wrong.',
          })}
        </p>

        {!user ? (
          <button
            type="button"
            className="quiz-btn is-primary quiz-login"
            onClick={() => useAuthStore.getState().login()}
          >
            <Key size={15} aria-hidden />
            {tr({ zh: '登录后出题', en: 'Log in to write a question' })}
          </button>
        ) : loading ? (
          <div className="quiz-stage" aria-busy="true" />
        ) : (
          <>
            <QuestionEditor draft={draft} onChange={setDraft} />

            {error && <p className="quiz-form-error">{error}</p>}

            <div className="quiz-actions">
              <button
                type="button"
                className="quiz-btn is-primary"
                disabled={saving || problem !== null}
                onClick={() => { void submit(); }}
              >
                {editId === null
                  ? tr({ zh: '发布', en: 'Publish' })
                  : tr({ zh: '保存', en: 'Save' })}
              </button>
              <Link href="/quiz/mine" className="quiz-btn">
                {tr({ zh: '我出的题', en: 'My questions' })}
              </Link>
            </div>
            {problem && <p className="quiz-form-hint">{problem}</p>}
          </>
        )}
      </div>
    </div>
  );
}
