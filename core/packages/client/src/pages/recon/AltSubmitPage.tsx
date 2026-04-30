/**
 * 另解提交页 —— /recon/:parentId/alt
 * 极简表单:左栏 TwistyPlayer(跟随光标)+ 右栏只读打乱 + 解法 textarea + 提交按钮。
 * 复用 ReconSubmitPage 的 player 跟随光标、SolutionView 等基建。
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon, addAlternative } from '../../utils/recon_api';
import { getPuzzleId, formatTime, flagClass } from '../../utils/recon_utils';
import { displayCuberName } from '../../utils/name_utils';
import { eventDisplayName } from '../../utils/wca_events';
import { useAuthStore } from '../../stores/auth_store';
import LangToggle from '../../components/LangToggle';
import TwistySection from './components/TwistySection';
import { cleanForPlayer, extractAlgFromText, syncPlayerToMoveCount } from '../../utils/recon_alg_utils';
import '../../recon.css';
import './recon_submit.css';
import './recon_detail.css';

export default function AltSubmitPage() {
  const { parentId } = useParams<{ parentId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const user = useAuthStore(s => s.user);
  const currentWcaId = user?.wcaId || '';

  const [parent, setParent] = useState<ReconSolve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const solutionRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // NOTE: 拉 parent solve(打乱来自它,显示标题/选手元信息)
  useEffect(() => {
    if (!parentId) return;
    getRecon(Number(parentId))
      .then(p => { setParent(p); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [parentId]);

  const scramble = parent?.optimalScramble || parent?.wcaScramble || '';
  const puzzle = parent ? getPuzzleId(parent.event) : '3x3x3';

  // NOTE: 防抖延迟更新动画(避免打字频繁销毁/重建 player)
  const [debouncedSolution, setDebouncedSolution] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSolution(solution), 500);
    return () => clearTimeout(timer);
  }, [solution]);

  const handleCursorSync = useCallback((el: HTMLTextAreaElement) => {
    if (!playerRef.current) return;
    const offset = el.selectionStart;
    const textBefore = el.value.substring(0, offset);
    const algBefore = extractAlgFromText(textBefore);
    const moves = algBefore.trim().split(/\s+/).filter(s => s.length > 0);
    syncPlayerToMoveCount(playerRef.current, moves.length);
  }, []);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const parentSummary = useMemo(() => {
    if (!parent) return '';
    const time = parent.value || (parent.rawTime != null ? formatTime(parent.rawTime) : '');
    const name = displayCuberName(parent.person || '', isZh);
    const ev = parent.event ? eventDisplayName(parent.event, isZh) : '';
    return `${time} ${ev} ${name}`.trim();
  }, [parent, isZh]);

  const handleSubmit = async () => {
    const trimmed = solution.trim();
    if (!trimmed || !parentId) return;
    setSubmitting(true);
    try {
      await addAlternative(Number(parentId), trimmed);
      navigate(`/recon/${parentId}`);
    } catch (e) {
      alert((e as Error).message);
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
  if (!currentWcaId) {
    return (
      <div className="recon-page">
        <div className="recon-error">
          {t('recon.loginToAddAlternative')}
          <button type="button" onClick={() => useAuthStore.getState().login()}>
            {isZh ? '登录' : 'Login'}
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
            <LangToggle />
          </div>
          <h1>
            {t('recon.addAlternative')}
            <span className="alt-submit-parent-ref">
              {' · '}
              <Link to={`/recon/${parentId}`} className="alt-submit-parent-link">
                {parent.personCountry && <span className={flagClass(parent.personCountry)} />}
                {' '}{parentSummary}
              </Link>
            </span>
          </h1>
        </div>
      </div>

      <div className="submit-layout">
        {/* 左栏: 动画 */}
        <div className="submit-player-pane">
          {scramble && parent.event && parent.event !== 'sq1' && (
            <TwistySection
              puzzle={puzzle}
              scramble={scramble}
              alg={cleanForPlayer(debouncedSolution)}
              playerRef={playerRef}
              fillPane
            />
          )}
        </div>

        {/* 右栏: 极简表单 */}
        <div className="submit-form-pane">
          <div className="submit-form alt-submit-form">
            <label className="submit-field">
              <span className="submit-label">{t('recon.scramble')}</span>
              <textarea
                rows={1}
                value={scramble}
                readOnly
                className="submit-input-locked alt-submit-scramble"
                title={isZh ? '继承自原 solve,不可编辑' : 'Inherited from original, read-only'}
              />
            </label>

            <div className="submit-field submit-block">
              <span className="submit-label">{t('recon.solution')} *</span>
              <textarea
                ref={(el) => {
                  (solutionRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                  autoResize(el);
                }}
                value={solution}
                onChange={(e) => {
                  setSolution(e.target.value);
                  autoResize(e.currentTarget);
                  handleCursorSync(e.currentTarget);
                }}
                onClick={e => handleCursorSync(e.target as HTMLTextAreaElement)}
                onKeyUp={e => handleCursorSync(e.target as HTMLTextAreaElement)}
                placeholder={t('recon.writeAlternative')}
                className="submit-solution-textarea"
                rows={6}
                autoFocus
              />
            </div>

            <div className="submit-actions">
              <button
                type="button"
                className="recon-btn"
                onClick={() => navigate(`/recon/${parentId}`)}
              >
                {t('recon.cancel')}
              </button>
              <button
                type="button"
                className="recon-btn recon-btn-edit"
                onClick={handleSubmit}
                disabled={submitting || !solution.trim()}
              >
                {submitting ? t('recon.posting') : t('recon.addAlternative')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
