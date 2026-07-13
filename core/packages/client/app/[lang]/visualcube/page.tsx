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

import { Suspense, useEffect } from 'react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import PuzzleImageStudio from '@/components/puzzle-image/PuzzleImageStudio';
import { useImageSpec } from '@/components/puzzle-image/useImageSpec';
import '@/components/puzzle-image/puzzle-image.css';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';

function VisualCubeEditorPageInner() {
  useDocumentTitle('魔方可视化', 'VisualCube');
  const t = useT();
  const [spec, setSpec] = useImageSpec('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="vc-editor-page">
      <BackHome />
      <header className="vc-header">
        <h1>{t('VisualCube 编辑器', 'VisualCube Editor')}</h1>
        <div className="vc-header-right">
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
