/**
 * 另解只读查看页 —— /recon/:parentId/alt/:altIdx
 * 极简版:左栏 TwistyPlayer + 右栏只读打乱 + SolutionView。
 * 用于复盘详情页另解列表点击 → 跳到干净页面只看动画 + 解法。
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon } from '../../utils/recon_api';
import { getPuzzleId } from '../../utils/recon_utils';
import { displayCuberName } from '../../utils/name_utils';
import LangToggle from '../../components/LangToggle';
import TwistySection from './components/TwistySection';
import SolutionView from './components/SolutionView';
import { cleanForPlayer } from '../../utils/recon_alg_utils';
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

export default function AltViewPage() {
  const { parentId, altIdx } = useParams<{ parentId: string; altIdx: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const isMobile = useIsMobile();

  const [parent, setParent] = useState<ReconSolve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!parentId) return;
    getRecon(Number(parentId))
      .then(p => { setParent(p); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [parentId]);

  const idx = altIdx != null ? Number(altIdx) : -1;
  const alt = parent?.alternatives?.[idx];
  const scramble = parent?.optimalScramble || parent?.wcaScramble || '';
  const puzzle = parent ? getPuzzleId(parent.event) : '3x3x3';

  const stats = useMemo(
    () => alt ? computeAllStats(alt.solution, parent?.rawTime ?? 0) : null,
    [alt, parent?.rawTime],
  );

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
  if (!alt) {
    return (
      <div className="recon-page">
        <div className="recon-error">{t('recon.notFound')}</div>
        <button type="button" className="recon-btn" onClick={() => navigate(`/recon/${parentId}`)}>
          {t('recon.cancel')}
        </button>
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
          <h1>{displayCuberName(alt.addedBy, isZh)}</h1>
        </div>
      </div>

      <div className="submit-layout">
        {/* 桌面/平板: 左栏动画 */}
        {!isMobile && (
          <div className="submit-player-pane">
            {scramble && parent.event && parent.event !== 'sq1' && (
              <TwistySection
                puzzle={puzzle}
                scramble={scramble}
                alg={cleanForPlayer(alt.solution)}
                playerRef={playerRef}
                fillPane
              />
            )}
          </div>
        )}

        {/* 内容栏 */}
        <div className="submit-form-pane">
          <div className="submit-form alt-submit-form">
            {stats && stats.stm > 0 && (
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
              />
            </label>

            {/* 手机端: 动画在打乱与解法之间 */}
            {isMobile && scramble && parent.event && parent.event !== 'sq1' && (
              <div className="submit-inline-player">
                <TwistySection
                  puzzle={puzzle}
                  scramble={scramble}
                  alg={cleanForPlayer(alt.solution)}
                  playerRef={playerRef}
                  fillPane
                />
              </div>
            )}

            <div className="submit-field submit-block">
              <span className="submit-label">{t('recon.solution')}</span>
              <SolutionView text={alt.solution} playerRef={playerRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
