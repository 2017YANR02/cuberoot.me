'use client';

/**
 * 另解只读查看页 —— /recon/[id]/alt/[altIdx]
 * 左栏 TwistyPlayer 动画 + 右栏只读打乱 + SolutionView(点解法跟随动画)。
 * Ported from packages/client-vite/src/pages/recon/AltViewPage.tsx.
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon } from '@/lib/recon-api';
import { getPuzzleId } from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { useIsMobile } from '@/hooks/useIsMobile';
import TwistySection from '@/components/TwistySection';
import SolutionView from '@/components/SolutionView';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { computeAllStats } from '@/lib/recon-stats';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseReconId } from '@/lib/recon-seo';
import '../../../recon.css';
import '../../../submit/recon_submit.css';
import '../../recon_detail.css';

export default function ReconAltViewClient() {
  const params = useParams<{ id: string; altIdx: string }>();
  const rawSeg = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const parentId = parseReconId(rawSeg); // strip cosmetic slug suffix → numeric id
  const altIdxStr = (Array.isArray(params?.altIdx) ? params.altIdx[0] : params?.altIdx) ?? '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('替代解', 'Alternative Solution');
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

  const idx = altIdxStr ? Number(altIdxStr) : -1;
  const alt = parent?.alternatives?.[idx];
  const scramble = parent?.optimalScramble || parent?.wcaScramble || '';
  const displayScramble = parent?.event === 'sq1' ? formatScrambleForEvent('sq1', scramble) : scramble;
  const puzzle = parent ? getPuzzleId(parent.event) : '3x3x3';

  const stats = useMemo(
    () => alt ? computeAllStats(alt.solution, parent?.rawTime ?? 0, parent?.event) : null,
    [alt, parent?.rawTime, parent?.event],
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
        <Link href={`/recon/${parentId}`} className="recon-btn">{t('recon.cancel')}</Link>
      </div>
    );
  }

  return (
    <div className="recon-page submit-page">
      <div className="submit-header">
        <div className="detail-header">
          <h1>{displayCuberName(alt.addedBy || '', isZh)}</h1>
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
            <label className="submit-field">
              <span className="submit-label">{t('recon.scramble')}</span>
              <textarea
                rows={1}
                value={displayScramble}
                readOnly
                className="submit-field-textarea submit-input-locked alt-submit-scramble"
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
              <span className="submit-label">
                {t('recon.solution')}
                {stats && stats.stm > 0 && (
                  <span className="submit-label-stats"> ({stats.stm} STM)</span>
                )}
              </span>
              <SolutionView text={alt.solution} playerRef={playerRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
