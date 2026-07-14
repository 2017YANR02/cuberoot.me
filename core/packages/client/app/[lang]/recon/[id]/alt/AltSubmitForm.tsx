'use client';
// Alternative submit/edit form — shares ReconPlayerPane (live preview) and
// ReconSolutionField (AlgInput + ReconAutofill + virtual keyboard) with the
// main recon submit form (ReconSubmitForm) so both stay UI/UX-identical.

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, ArrowLeft, LogIn } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon, addAlternative, updateAlternative } from '@/lib/recon-api';
import { revalidateRecon } from '../../revalidate-action';
import { computeAllStats } from '@/lib/recon-stats';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { useAuthStore } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/useIsMobile';
import ReconPlayerPane from '@/components/ReconPlayerPane';
import ReconSolutionField from '@/components/ReconSolutionField';
import { syncReconPlayerCursorFromText } from '@/lib/recon-alg-utils';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../recon.css';
import '../../submit/recon_submit.css';
import '../recon_detail.css';
import { tr } from '@/i18n/tr';

interface Props {
  parentId: string;
  editIdx?: number;
}

export default function AltSubmitForm({ parentId, editIdx }: Props) {
  const isMobile = useIsMobile();
  const isEditing = editIdx != null;
  const router = useRouter();
  const { t } = useTranslation();
  useDocumentTitle('提交替代解', 'Submit Alternative');
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);

  const [parent, setParent] = useState<ReconSolve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!parentId) return;
    getRecon(Number(parentId))
      .then(p => {
        setParent(p);
        if (isEditing && editIdx != null) {
          const alt = p.alternatives?.[editIdx];
          if (alt) setSolution(alt.solution);
          else setError(t('recon.notFound'));
        }
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [parentId, isEditing, editIdx, t]);

  const scramble = parent?.optimalScramble || parent?.wcaScramble || '';
  const displayScramble = parent?.event === 'sq1' ? formatScrambleForEvent('sq1', scramble) : scramble;

  const stats = useMemo(
    () => computeAllStats(solution, parent?.rawTime ?? 0, parent?.event),
    [solution, parent?.rawTime, parent?.event],
  );

  const handleSubmit = async () => {
    const trimmed = solution.trim();
    if (!trimmed || !parentId) return;
    setSubmitting(true);
    try {
      if (isEditing && editIdx != null) {
        await updateAlternative(Number(parentId), editIdx, trimmed);
      } else {
        await addAlternative(Number(parentId), trimmed);
      }
      // Bust the parent recon's ISR cache so its alternatives section isn't stale.
      await revalidateRecon(parentId);
      router.push(`/recon/${parentId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
  }
  if (error || !parent) {
    return (
      <div className="recon-page">
        <div className="recon-error"><TriangleAlert size={16} /> {error || t('recon.notFound')}</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="recon-page">
        <div className="recon-page-header">
          <div>
            <Link href={`/recon/${parentId}`} className="recon-back-link">
              <ArrowLeft size={14} /> {tr({ zh: '返回详情', en: 'Back'
            })}
            </Link>
          </div>
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>{tr({ zh: '需要登录才能提交另解。', en: 'Login required to submit an alternative.'
        })}</p>
          <button type="button" className="recon-btn" onClick={() => login()}>
            <LogIn size={14} /> {tr({ zh: '登录', en: 'Sign in'
            })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recon-page submit-page">
      <div className="submit-header">
        <div className="detail-header">
          <div className="detail-header-nav">
            <Link href={`/recon/${parentId}`} className="recon-back-link">
              <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
            </Link>
          </div>
          <h1>{isEditing ? t('recon.editAlternative') : t('recon.addAlternative')}</h1>
        </div>
      </div>

      <div className="submit-layout">
        {!isMobile && (
          <div className="submit-player-pane">
            {scramble && parent.event && (
              <ReconPlayerPane
                event={parent.event}
                scramble={scramble}
                solution={solution}
                playerRef={playerRef}
              />
            )}
          </div>
        )}

        <div className="submit-form-pane">
          <div className="submit-form alt-submit-form">
            <label className="submit-field">
              <span className="submit-label">{t('recon.scramble')}</span>
              <textarea
                rows={1}
                value={displayScramble}
                readOnly
                className="submit-field-textarea submit-input-locked alt-submit-scramble"
                title={tr({ zh: '继承自原 solve,不可编辑', en: 'Inherited from original, read-only'
                })}
              />
            </label>

            {isMobile && scramble && parent.event && (
              <div className="submit-inline-player">
                <ReconPlayerPane
                  event={parent.event}
                  scramble={scramble}
                  solution={solution}
                  playerRef={playerRef}
                />
              </div>
            )}

            <div className="submit-field submit-block">
              <span className="submit-label">
                {t('recon.solution')} *
                {stats && stats.stm > 0 && (
                  <span className="submit-label-stats">
                    {' ('}{stats.stm} STM
                    {stats.tps > 0 && `, ${stats.tps} ${parent.event === 'sq1' ? 'SPS' : 'TPS'}`}
                    {')'}
                  </span>
                )}
              </span>
              <ReconSolutionField
                value={solution}
                onChange={setSolution}
                onCaretSync={(textBefore) => syncReconPlayerCursorFromText(playerRef.current, textBefore)}
                scramble={scramble || ''}
                isMobile={isMobile}
                autoFocus
              />
            </div>

            <div className="submit-actions">
              <button
                type="button"
                className="recon-btn"
                onClick={() => router.push(`/recon/${parentId}`)}
              >
                {t('recon.cancel')}
              </button>
              <button
                type="button"
                className="recon-btn recon-btn-edit"
                onClick={handleSubmit}
                disabled={submitting || !solution.trim()}
              >
                {submitting ? t('recon.posting') : t('recon.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
