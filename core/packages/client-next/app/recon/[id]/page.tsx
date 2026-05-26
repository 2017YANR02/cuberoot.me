'use client';

/**
 * /recon/[id] — detail page (MINIMAL STUB).
 *
 * TODO (deferred from full client port):
 *   - TwistySection (cubing.js player, 761 lines) — depends on FaceOverlay + sim PuzzleSettings
 *   - SolutionView with caret-driven move sync
 *   - Discussion (comments + replies + pin)
 *   - Alternative submissions
 *   - Same-round nav / same-comp-event nav (WCA results API)
 *   - Normalized-cross block
 *   - Stats panel (STM / TPS / sub-stages)
 *   - Edit / delete (OAuth)
 *
 * Current behavior: fetch the recon record, show identity + scramble + solution
 * as plain text. Existing /recon/[id] URLs resolve so list links don't 404.
 * Full detail page port is the next milestone after auth + cubing TwistySection.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon } from '@/lib/recon-api';
import {
  formatTime, formatAvg, formatAoXR, formatRound, wcaPersonUrl,
} from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../recon.css';

export default function ReconDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [solve, setSolve] = useState<ReconSolve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(
    solve ? `${displayCuberName(solve.person || '', isZh)} ${solve.value || formatTime(solve.rawTime)}` : '复盘',
    solve ? `${displayCuberName(solve.person || '', isZh)} ${solve.value || formatTime(solve.rawTime)}` : 'Reconstruction',
  );

  useEffect(() => {
    if (!id) return;
    getRecon(Number(id))
      .then(s => { setSolve(s); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [id]);

  if (loading) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
  if (error || !solve) {
    return (
      <div className="recon-page">
        <div className="recon-error"><TriangleAlert size={16} /> {error || t('recon.notFound')}</div>
        <Link href="/recon" className="recon-btn"><ArrowLeft size={14} /> Back</Link>
      </div>
    );
  }

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href="/recon" className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
          </Link>
          <h1>
            {solve.value || formatTime(solve.rawTime)} {solve.event}
          </h1>
          <p className="recon-subtitle">
            {solve.personId ? (
              <a href={wcaPersonUrl(solve.personId)} target="_blank" rel="noopener noreferrer">
                {displayCuberName(solve.person || '', isZh)}
              </a>
            ) : displayCuberName(solve.person || '', isZh)}
            {solve.comp && ` · ${solve.comp}`}
            {solve.date && ` · ${solve.date.slice(0, 10)}`}
            {solve.round && ` · ${formatRound(solve.round, solve.solveNum)}`}
          </p>
        </div>
        <LangToggle />
      </div>

      <div className="recon-detail-stub">
        <p style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', marginBottom: 16 }}>
          {isZh
            ? '完整详情页（动画 / 评论 / 另解 / 统计）在 Next.js 端尚未迁移。下面是关键字段的只读视图。'
            : 'Full detail UI (animation / comments / alternatives / stats) is not yet ported to Next.js. The fields below are a read-only fallback.'}
        </p>

        {solve.wcaScramble && (
          <section style={{ marginBottom: 16 }}>
            <h3>{t('recon.scramble')}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {solve.wcaScramble}
            </pre>
          </section>
        )}

        {solve.optimalScramble && solve.optimalScramble !== solve.wcaScramble && (
          <section style={{ marginBottom: 16 }}>
            <h3>{isZh ? '最优打乱' : 'Optimal scramble'}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {solve.optimalScramble}
            </pre>
          </section>
        )}

        {solve.solution && (
          <section style={{ marginBottom: 16 }}>
            <h3>{t('recon.solution')}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.95rem' }}>
              {solve.solution}
            </pre>
          </section>
        )}

        {solve.note && (
          <section style={{ marginBottom: 16 }}>
            <h3>{t('recon.note')}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{solve.note}</pre>
          </section>
        )}

        {(solve.average || solve.aoType || solve.stm || solve.tps) && (
          <section style={{ marginBottom: 16 }}>
            <h3>{t('recon.statistics')}</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {solve.average != null && <li>{t('recon.average')}: {formatAvg(solve.average)}</li>}
              {solve.aoType && <li>AoXR: {formatAoXR(solve.aoType)}</li>}
              {solve.stm && <li>STM: {solve.stm}</li>}
              {typeof solve.tps === 'number' && <li>TPS: {solve.tps.toFixed(2)}</li>}
              {solve.method && <li>{t('recon.method')}: {solve.method}</li>}
            </ul>
          </section>
        )}

        {solve.videoUrl && (
          <section style={{ marginBottom: 16 }}>
            <h3>{t('recon.video')}</h3>
            <a href={solve.videoUrl} target="_blank" rel="noopener noreferrer">{solve.videoUrl}</a>
          </section>
        )}
      </div>
    </div>
  );
}
