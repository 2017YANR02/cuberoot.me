'use client';

/**
 * /visualcube — thin host over the shared puzzle-image studio.
 *
 * All the state, rendering and controls now live in components/puzzle-image/*
 * (and the pure model in lib/puzzle-image/*), so /sim can mount the same studio
 * as a panel. This file owns only what a HOST owns: the URL (useImageSpec — nuqs
 * is page-level-only by project rule), the document title and the page chrome.
 *
 * The URL contract is unchanged (lib/puzzle-image/codec.ts at prefix ''): same
 * keys, same emission order, same emit-only-when-non-default discipline, and the
 * read-only legacy `puzzle=` alias.
 */

import { Suspense, useEffect, useMemo } from 'react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import PuzzleImageStudio from '@/components/puzzle-image/PuzzleImageStudio';
import { useImageSpec } from '@/components/puzzle-image/useImageSpec';
import { specToParams } from '@/lib/puzzle-image/codec';
import '@/components/puzzle-image/puzzle-image.css';
import { useT } from '@/hooks/useT';

function VisualCubeEditorPageInner() {
  const t = useT();
  const [spec, setSpec] = useImageSpec('');
  const batchQuery = useMemo(() => {
    const qs = specToParams(spec, '').toString();
    return qs ? `?${qs}` : '';
  }, [spec]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="vc-editor-page">
      <BackHome />
      <header className="vc-header">
        <h1>{t('VisualCube 编辑器', 'VisualCube Editor')}</h1>
        <div className="vc-header-right">
          {/* 设置整套在 URL 里,原样带过去 —— 批量页不重造一份控件。 */}
          <Link className="vc-header-link" href={`/visualcube/batch${batchQuery}`}>
            {t('批量出图', 'Batch')}
          </Link>
          <Link className="vc-header-link" href="/visualcube/stages">
            {t('Stage 速查', 'Stages')}
          </Link>
        </div>
      </header>

      <PuzzleImageStudio spec={spec} onSpecChange={setSpec} mode="page" />
    </div>
  );
}

export default function VisualCubeEditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <VisualCubeEditorPageInner />
    </Suspense>
  );
}
