'use client';

/**
 * /recon/[id]/alt/[altIdx] — alternative view (STUB).
 *
 * TODO: Port full AltViewPage once TwistySection is ported.
 * Current behavior: fetch parent recon, show alternative solution as plain text.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon } from '@/lib/recon-api';
import { displayCuberName } from '@/lib/cuber-name-display';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../../recon.css';

export default function AltViewPage() {
  const params = useParams<{ id: string; altIdx: string }>();
  const parentId = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const altIdxStr = (Array.isArray(params?.altIdx) ? params.altIdx[0] : params?.altIdx) ?? '';
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('替代解', 'Alternative Solution');

  const [parent, setParent] = useState<ReconSolve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) return;
    getRecon(Number(parentId))
      .then(p => { setParent(p); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [parentId]);

  const idx = altIdxStr ? Number(altIdxStr) : -1;
  const alt = parent?.alternatives?.[idx];
  const scramble = parent?.optimalScramble || parent?.wcaScramble || '';

  if (loading) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
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
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href={`/recon/${parentId}`} className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回详情' : 'Back to detail'}
          </Link>
          <h1>{displayCuberName(alt.addedBy || '', isZh)}</h1>
        </div>
        <LangToggle />
      </div>

      <div className="recon-detail-stub">
        <p style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', marginBottom: 16 }}>
          {isZh
            ? '完整另解视图（TwistySection 动画 + SolutionView）尚未迁移。下面是只读视图。'
            : 'Full alternative view (animation + caret-driven SolutionView) is not yet ported. Read-only fallback below.'}
        </p>

        {scramble && (
          <section style={{ marginBottom: 16 }}>
            <h3>{t('recon.scramble')}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {scramble}
            </pre>
          </section>
        )}

        <section>
          <h3>{t('recon.solution')}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.95rem' }}>
            {alt.solution}
          </pre>
        </section>
      </div>
    </div>
  );
}
