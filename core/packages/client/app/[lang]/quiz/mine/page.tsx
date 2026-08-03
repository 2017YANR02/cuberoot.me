'use client';

/**
 * /quiz/mine —— 我出的题。含被管理员下架的(带下架理由)—— 作者必须看得到自己的题
 * 为什么不见了,否则只会以为站点吞了它。
 */

import { useCallback, useEffect, useState } from 'react';
import { Key, Pencil, Trash2 } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import Link from '@/components/AppLink';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { deleteQuestion, fetchMyQuestions, type CommunityQuestionRow } from '@/lib/quiz-api';
import { findCategory } from '../_data';
import '../quiz.css';

export default function QuizMinePage() {
  const user = useAuthUser();
  const lang = useLang();
  const zh = lang === 'zh';
  const [rows, setRows] = useState<CommunityQuestionRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchMyQuestions()
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => { if (user) load(); }, [load, user]);

  const remove = async (id: number) => {
    setError('');
    try {
      await deleteQuestion(id);
      setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="quiz-page">
      <div className="quiz-head">
        <BackHome />
        <HeaderToggles />
      </div>

      <div className="quiz-hub quiz-form-page">
        <h1>{tr({ zh: '我出的题', en: 'My questions' })}</h1>

        {!user ? (
          <button
            type="button"
            className="quiz-btn is-primary quiz-login"
            onClick={() => useAuthStore.getState().login()}
          >
            <Key size={15} aria-hidden />
            {tr({ zh: '登录后查看', en: 'Log in to see them' })}
          </button>
        ) : (
          <>
            <div className="quiz-actions">
              <Link href="/quiz/new" className="quiz-btn is-primary">
                {tr({ zh: '再出一道', en: 'Write another' })}
              </Link>
            </div>

            {error && <p className="quiz-form-error">{error}</p>}

            {rows === null ? (
              <div className="quiz-stage" aria-busy="true" />
            ) : rows.length === 0 ? (
              <p className="quiz-intro">
                {tr({ zh: '还没出过题。', en: 'Nothing yet.' })}
              </p>
            ) : (
              <ul className="quiz-mine-list">
                {rows.map((r) => {
                  const cat = findCategory(r.cat);
                  return (
                    <li key={r.id} className={`quiz-mine-item${r.status === 'hidden' ? ' is-hidden' : ''}`}>
                      <div className="quiz-mine-q">{zh ? (r.qZh || r.qEn) : (r.qEn || r.qZh)}</div>
                      <div className="quiz-mine-meta">
                        <span>{cat ? tr(cat.name) : r.cat}</span>
                        <span>{r.level === 'hard' ? tr({ zh: '进阶', en: 'Advanced' }) : tr({ zh: '简单', en: 'Easy' })}</span>
                        <span>{r.type === 'choice' ? tr({ zh: '选择题', en: 'Multiple choice' }) : tr({ zh: '问答题', en: 'Short answer' })}</span>
                        {r.status === 'hidden' && (
                          <span className="quiz-mine-flag">{tr({ zh: '已下架', en: 'Taken down' })}</span>
                        )}
                        {r.reportCount > 0 && (
                          <span className="quiz-mine-flag">
                            {tr({ zh: `被举报 ${r.reportCount} 次`, en: `${r.reportCount} report${r.reportCount === 1 ? '' : 's'}` })}
                          </span>
                        )}
                      </div>
                      {r.status === 'hidden' && r.hiddenNote && (
                        <p className="quiz-mine-note">
                          {tr({ zh: '下架理由:', en: 'Reason: ' })}{r.hiddenNote}
                        </p>
                      )}
                      <div className="quiz-mine-actions">
                        <Link href={`/quiz/new?edit=${r.id}`} className="quiz-btn">
                          <Pencil size={14} aria-hidden />
                          {tr({ zh: '编辑', en: 'Edit' })}
                        </Link>
                        <button type="button" className="quiz-btn" onClick={() => { void remove(r.id); }}>
                          <Trash2 size={14} aria-hidden />
                          {tr({ zh: '删除', en: 'Delete' })}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
