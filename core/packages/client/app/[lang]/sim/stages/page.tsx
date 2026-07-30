'use client';

/**
 * /sim/stages — thin host over <MaskCatalogGrid>. The 147 cards and the
 * STAGE_SECTIONS data live in the shared component + lib; a card opens the
 * simulator with that stage already selected (`?puzzle=N&stickering=…`).
 */

import { useParams } from 'next/navigation';
import Link from '@/components/AppLink';
import MaskCatalogGrid from '@/components/puzzle-image/MaskCatalogGrid';
import { stickeringValueForVcMask } from '../engine/nxn/vcStageMask';
import '@/components/puzzle-image/mask-catalog.css';
import { tr } from '@/i18n/tr';

export default function SimStagesPage() {
  const params = useParams();
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';

  return (
    <div className="vcs-page">
      <header className="vcs-header">
        <h1>{tr({ zh: '阶段遮罩速查', en: 'Stage Masks' })}</h1>
        <div className="vcs-header-right">
          <Link className="vcs-link" href={`/${lang}/sim`}>
            {tr({ zh: '模拟器', en: 'Simulator' })}
          </Link>
        </div>
      </header>

      <p className="vcs-intro">
        {tr({
          zh: '点任意一格在模拟器里打开,该阶段直接选好。stage 名大小写不敏感(如 fl / FL / Fl 等价)。Origin 是上游 visualcube 自带的 stage,3x3 (Custom) 起是 Ruimin Yan 在 PHP 端追加的。',
          en: 'Click any tile to open it in the simulator with that stage selected. Stage names are case-insensitive (fl / FL / Fl all match). "Origin" lists the upstream visualcube stages; everything below is added by Ruimin Yan in the PHP fork.',
        })}
      </p>

      <MaskCatalogGrid
        hrefFor={(cubeSize, mask) =>
          `/${lang}/sim?puzzle=${cubeSize}&stickering=${encodeURIComponent(stickeringValueForVcMask(cubeSize, mask))}`}
      />
    </div>
  );
}
