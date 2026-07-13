'use client';

/**
 * /visualcube/stages — thin host over <MaskCatalogGrid>. The 147 cards and the
 * STAGE_SECTIONS data now live in the shared component + lib, so /sim can mount
 * the same catalog pointed at its own editor.
 */

import { useParams } from 'next/navigation';
import Link from '@/components/AppLink';
import MaskCatalogGrid from '@/components/puzzle-image/MaskCatalogGrid';
import '@/components/puzzle-image/mask-catalog.css';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';

export default function VisualCubeStagesPage() {
  const params = useParams();
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';
  useDocumentTitle('阶段可视化', 'Visualcube Stages');

  return (
    <div className="vcs-page">
      <header className="vcs-header">
        <h1>{tr({ zh: 'VisualCube Stage 速查', en: 'VisualCube Stages' })}</h1>
        <div className="vcs-header-right">
          <Link className="vcs-link" href={`/${lang}/visualcube`}>
            {tr({ zh: '编辑器', en: 'Editor' })}
          </Link>
        </div>
      </header>

      <p className="vcs-intro">
        {tr({
          zh: '点任意一格在编辑器里打开。stage 名大小写不敏感(如 fl / FL / Fl 等价)。Origin 是上游 visualcube 自带的 stage,3x3 (Custom) 起是 Ruimin Yan 在 PHP 端追加的。',
          en: 'Click any tile to open in the editor. Stage names are case-insensitive (fl / FL / Fl all match). "Origin" lists the upstream visualcube stages; everything below is added by Ruimin Yan in the PHP fork.',
        })}
      </p>

      <MaskCatalogGrid basePath="/visualcube" />
    </div>
  );
}
