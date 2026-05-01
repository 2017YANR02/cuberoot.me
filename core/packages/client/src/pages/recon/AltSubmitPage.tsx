/**
 * 另解提交/编辑页
 *  - /recon/:parentId/alt              —— 新建另解
 *  - /recon/:parentId/alt/:altIdx/edit —— 编辑已有另解(预填解法)
 * 极简表单:左栏 TwistyPlayer(跟随光标)+ 右栏只读打乱 + 解法 textarea + 提交按钮。
 * 复用 ReconSubmitPage 的 player 跟随光标、SolutionView 等基建。
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon, addAlternative, updateAlternative } from '../../utils/recon_api';
import { getPuzzleId } from '../../utils/recon_utils';
import { useAuthStore } from '../../stores/auth_store';
import LangToggle from '../../components/LangToggle';
import TwistySection from './components/TwistySection';
import { cleanForPlayer, extractAlgFromText, syncPlayerToMoveCount } from '../../utils/recon_alg_utils';
import { computeAllStats } from '../../utils/recon_stats';
import '../../recon.css';
import './recon_submit.css';
import './recon_detail.css';

function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return m;
}

export default function AltSubmitPage() {
  const isMobile = useIsMobile();
  const { parentId, altIdx } = useParams<{ parentId: string; altIdx?: string }>();
  const editIdx = altIdx != null ? Number(altIdx) : null;
  const isEditing = editIdx != null;
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

  // NOTE: 拉 parent solve(打乱来自它,显示标题/选手元信息;edit 模式下还要预填该 alt 的解法)
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

  // NOTE: edit 模式异步预填解法后,撑开 textarea 至自然高度
  useEffect(() => {
    if (solutionRef.current) autoResize(solutionRef.current);
  }, [solution, autoResize]);

  // NOTE: 同 ReconSubmitPage — paste 后 player 看的是 debouncedSolution,
  // 等防抖更新完才 sync 到当前光标位置(否则 player 停在打乱状态)。
  useEffect(() => {
    if (solutionRef.current) handleCursorSync(solutionRef.current);
  }, [debouncedSolution, handleCursorSync]);

  // NOTE: 实时统计基于已防抖的解法 + 父 solve 的 rawTime
  const stats = useMemo(
    () => computeAllStats(debouncedSolution, parent?.rawTime ?? 0),
    [debouncedSolution, parent?.rawTime],
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
            {isEditing ? t('recon.editAlternative') : t('recon.addAlternative')}
          </h1>
        </div>
      </div>

      <div className="submit-layout">
        {/* 桌面/平板: 左栏动画;手机端搬到打乱与解法之间 */}
        {!isMobile && (
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
        )}

        {/* 内容栏 */}
        <div className="submit-form-pane">
          <div className="submit-form alt-submit-form">
            {stats.stm > 0 && (
              <div className="submit-stats-preview">
                <span>{stats.stm} STM</span>
                {stats.tps > 0 && <span>{stats.tps} TPS</span>}
              </div>
            )}

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

            {/* 手机端: 动画演示插在打乱/统计与解法之间(贴在解法正上方) */}
            {isMobile && scramble && parent.event && parent.event !== 'sq1' && (
              <div className="submit-inline-player">
                <TwistySection
                  puzzle={puzzle}
                  scramble={scramble}
                  alg={cleanForPlayer(debouncedSolution)}
                  playerRef={playerRef}
                  fillPane
                />
              </div>
            )}

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
                {submitting ? t('recon.posting') : (isEditing ? t('recon.save') : t('recon.addAlternative'))}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
