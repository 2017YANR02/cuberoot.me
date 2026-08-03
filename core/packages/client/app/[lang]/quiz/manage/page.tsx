'use client';

/**
 * /quiz/manage —— 管理员看板。社区题直接上线,没有前置审核队列,所以这页管三件事:
 *   1. 处理举报(答案错了 / 灌水);
 *   2. 补译 —— 投稿只要求写一种语言,缺的一侧在答题页会标「仅中文 / English only」;
 *   3. 下架 / 恢复 / 删除。
 * 下架会通知作者并附上理由(见 server/routes/quiz.ts)。
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Languages, Trash2 } from 'lucide-react';
import type { QuizDraft } from '@cuberoot/shared/quiz';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { tr, useLang } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import {
  deleteQuestion, fetchAllQuestions, fetchQuizReports, resolveQuizReport, updateQuestion,
  type CommunityQuestionRow, type QuizReportRow,
} from '@/lib/quiz-api';
import QuestionEditor, { draftFromRow, draftProblem } from '../_components/QuestionEditor';
import '../quiz.css';

export default function QuizManagePage() {
  const isAdmin = useIsAdmin();
  const zh = useLang() === 'zh';
  const [reports, setReports] = useState<QuizReportRow[] | null>(null);
  const [questions, setQuestions] = useState<CommunityQuestionRow[] | null>(null);
  const [error, setError] = useState('');
  // 展开编辑的那道题:null = 都没展开。补译就在展开的编辑器里做。
  const [editing, setEditing] = useState<{ id: number; draft: QuizDraft } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchQuizReports().then(setReports).catch((e) => setError((e as Error).message));
    fetchAllQuestions().then(setQuestions).catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const applyRow = (row: CommunityQuestionRow) => {
    setQuestions((qs) => (qs ? qs.map((q) => (q.id === row.id ? row : q)) : qs));
  };

  const save = async (row: CommunityQuestionRow, patch: Partial<QuizDraft & { status: string; hiddenNote: string }>) => {
    setBusy(true);
    setError('');
    try {
      const base = editing && editing.id === row.id ? editing.draft : draftFromRow(row);
      applyRow(await updateQuestion(row.id, { ...base, ...patch }));
      setEditing(null);
      setNote('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    try {
      await deleteQuestion(id);
      setQuestions((qs) => (qs ? qs.filter((q) => q.id !== id) : qs));
      setReports((rs) => (rs ? rs.filter((r) => r.questionId !== id) : rs));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id: number) => {
    try {
      await resolveQuizReport(id);
      setReports((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="quiz-page">
        <div className="quiz-head"><BackHome /><HeaderToggles /></div>
        <div className="quiz-hub">
          <p className="quiz-intro">{tr({ zh: '这个页面只对管理员开放。', en: 'Admins only.' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-head"><BackHome /><HeaderToggles /></div>

      <div className="quiz-hub quiz-form-page">
        <h1>{tr({ zh: '社区题管理', en: 'Community questions' })}</h1>
        {error && <p className="quiz-form-error">{error}</p>}

        <h2 className="quiz-manage-h2">
          {tr({ zh: '待处理举报', en: 'Open reports' })}
        </h2>
        {reports === null ? (
          <div className="quiz-stage" aria-busy="true" />
        ) : reports.length === 0 ? (
          <p className="quiz-intro">{tr({ zh: '没有待处理的举报。', en: 'Nothing to handle.' })}</p>
        ) : (
          <ul className="quiz-mine-list">
            {reports.map((r) => (
              <li key={r.id} className="quiz-mine-item">
                <div className="quiz-mine-q">{zh ? (r.qZh || r.qEn) : (r.qEn || r.qZh)}</div>
                <p className="quiz-mine-note">
                  {tr({ zh: '举报理由:', en: 'Reason: ' })}{r.reason}
                </p>
                <div className="quiz-mine-meta">
                  <span>{tr({ zh: `出题人 ${r.authorName}`, en: `by ${r.authorName}` })}</span>
                  <span>{tr({ zh: `举报人 ${r.reporterName}`, en: `reported by ${r.reporterName}` })}</span>
                  {r.questionStatus === 'hidden' && (
                    <span className="quiz-mine-flag">{tr({ zh: '题已下架', en: 'already down' })}</span>
                  )}
                </div>
                <div className="quiz-mine-actions">
                  <button type="button" className="quiz-btn" onClick={() => { void resolve(r.id); }}>
                    <Check size={14} aria-hidden />
                    {tr({ zh: '标为已处理', en: 'Mark handled' })}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2 className="quiz-manage-h2">{tr({ zh: '全部社区题', en: 'All community questions' })}</h2>
        {questions === null ? (
          <div className="quiz-stage" aria-busy="true" />
        ) : questions.length === 0 ? (
          <p className="quiz-intro">{tr({ zh: '还没有人出题。', en: 'Nobody has written one yet.' })}</p>
        ) : (
          <ul className="quiz-mine-list">
            {questions.map((q) => {
              const open = editing?.id === q.id;
              const needsZh = !q.qZh.trim();
              const needsEn = !q.qEn.trim();
              return (
                <li key={q.id} className={`quiz-mine-item${q.status === 'hidden' ? ' is-hidden' : ''}`}>
                  <div className="quiz-mine-q">{zh ? (q.qZh || q.qEn) : (q.qEn || q.qZh)}</div>
                  <div className="quiz-mine-meta">
                    <span>{q.authorName}</span>
                    <span>{q.cat}</span>
                    <span>{q.level}</span>
                    {(needsZh || needsEn) && (
                      <span className="quiz-mine-flag">
                        <Languages size={12} aria-hidden />
                        {needsZh ? tr({ zh: '缺中文', en: 'no Chinese' }) : tr({ zh: '缺英文', en: 'no English' })}
                      </span>
                    )}
                    {q.status === 'hidden' && (
                      <span className="quiz-mine-flag">{tr({ zh: '已下架', en: 'down' })}</span>
                    )}
                    {q.reportCount > 0 && (
                      <span className="quiz-mine-flag">
                        {tr({ zh: `举报 ${q.reportCount}`, en: `${q.reportCount} reports` })}
                      </span>
                    )}
                  </div>

                  {open && (
                    <>
                      <QuestionEditor
                        draft={editing.draft}
                        onChange={(draft) => setEditing({ id: q.id, draft })}
                      />
                      {draftProblem(editing.draft) && (
                        <p className="quiz-form-hint">{draftProblem(editing.draft)}</p>
                      )}
                    </>
                  )}

                  <div className="quiz-mine-actions">
                    {open ? (
                      <>
                        <button
                          type="button"
                          className="quiz-btn is-primary"
                          disabled={busy || draftProblem(editing.draft) !== null}
                          onClick={() => { void save(q, {}); }}
                        >
                          {tr({ zh: '保存', en: 'Save' })}
                        </button>
                        <button type="button" className="quiz-btn" onClick={() => setEditing(null)}>
                          {tr({ zh: '取消', en: 'Cancel' })}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="quiz-btn"
                        onClick={() => setEditing({ id: q.id, draft: draftFromRow(q) })}
                      >
                        <Languages size={14} aria-hidden />
                        {tr({ zh: '编辑 / 补译', en: 'Edit / translate' })}
                      </button>
                    )}

                    {q.status === 'published' ? (
                      <>
                        <input
                          className="quiz-input quiz-manage-note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={500}
                          placeholder={tr({ zh: '下架理由(会通知作者)', en: 'Reason (the author is told)' })}
                          aria-label={tr({ zh: '下架理由', en: 'Takedown reason' })}
                        />
                        <button
                          type="button"
                          className="quiz-btn"
                          disabled={busy || !note.trim()}
                          onClick={() => { void save(q, { status: 'hidden', hiddenNote: note.trim() }); }}
                        >
                          {tr({ zh: '下架', en: 'Take down' })}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="quiz-btn"
                        disabled={busy}
                        onClick={() => { void save(q, { status: 'published', hiddenNote: '' }); }}
                      >
                        {tr({ zh: '恢复', en: 'Restore' })}
                      </button>
                    )}

                    <button
                      type="button"
                      className="quiz-btn"
                      disabled={busy}
                      onClick={() => { void remove(q.id); }}
                    >
                      <Trash2 size={14} aria-hidden />
                      {tr({ zh: '删除', en: 'Delete' })}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
