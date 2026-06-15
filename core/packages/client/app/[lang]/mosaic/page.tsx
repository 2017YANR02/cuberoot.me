'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/components/AppLink';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMosaicStore } from './_components/state/store';
import type { Stage } from './_components/state/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './mosaic.css';
import { tr } from '@/i18n/tr';

const UploadStage = dynamic(() => import('./_components/stages/UploadStage'), { ssr: false });
const CropStage = dynamic(() => import('./_components/stages/CropStage'), { ssr: false });
const MethodChooseStage = dynamic(() => import('./_components/stages/MethodChooseStage'), { ssr: false });
const VariantChooseStage = dynamic(() => import('./_components/stages/VariantChooseStage'), { ssr: false });
const AdjustStage = dynamic(() => import('./_components/stages/AdjustStage'), { ssr: false });
const PaletteStage = dynamic(() => import('./_components/stages/PaletteStage'), { ssr: false });

const STAGE_TITLE_KEY: Record<Stage, string> = {
  'upload': 'mosaic.topbar.upload',
  'crop': 'mosaic.topbar.crop',
  'choose-method': 'mosaic.topbar.chooseMethod',
  'choose-variant': 'mosaic.topbar.chooseVariant',
  'adjust': 'mosaic.topbar.adjust',
  'palette': 'mosaic.topbar.palette',
};

function stageComponent(stage: Stage) {
  switch (stage) {
    case 'upload': return <UploadStage />;
    case 'crop': return <CropStage />;
    case 'choose-method': return <MethodChooseStage />;
    case 'choose-variant': return <VariantChooseStage />;
    case 'adjust': return <AdjustStage />;
    case 'palette': return <PaletteStage />;
  }
}

export default function MosaicPage() {
  const { t } = useTranslation();
  useDocumentTitle('马赛克', 'Mosaic');
  const stage = useMosaicStore(s => s.stage);
  const resetAll = useMosaicStore(s => s.resetAll);
  const goToStage = useMosaicStore(s => s.goToStage);
  const openPalette = useMosaicStore(s => s.openPalette);
  const closePalette = useMosaicStore(s => s.closePalette);

  // Build back-button behavior based on stage
  const backAction: { label: string; fn: () => void } | null = (() => {
    if (stage === 'upload') return null;
    if (stage === 'palette') return { label: t('mosaic.topbar.done'), fn: closePalette };
    if (stage === 'crop') return { label: t('mosaic.topbar.newMosaic'), fn: resetAll };
    if (stage === 'choose-method') return { label: t('mosaic.topbar.backCrop'), fn: () => goToStage('crop') };
    if (stage === 'choose-variant') return { label: t('mosaic.topbar.backMethod'), fn: () => goToStage('choose-method') };
    if (stage === 'adjust') return { label: t('mosaic.topbar.backVariant'), fn: () => goToStage('choose-variant') };
    return null;
  })();

  return (
    <div className="mosaic-page">
      <div className="mosaic-topbar">
        <div className="mosaic-topbar-left">
          {backAction && (
            <button className="mosaic-back" onClick={backAction.fn}>{backAction.label}</button>
          )}
          <div>
            <h1 className="mosaic-title">
              {t('mosaic.name')}
              <Link
                href="/mosaic-about"
                className="mosaic-title-help"
                title={tr({ zh: '这页是干啥的?', en: 'What is this page?'
                })}
                aria-label={tr({ zh: '查看说明', en: 'About this page'
                })}
              >
                <HelpCircle size={18} strokeWidth={1.75} />
              </Link>
            </h1>
            <p className="mosaic-subtitle">{t(STAGE_TITLE_KEY[stage])}</p>
          </div>
        </div>
        <div className="mosaic-topbar-left">
          {stage !== 'palette' && stage !== 'upload' && (
            <button className="mosaic-btn" onClick={openPalette}>🎨 {t('mosaic.topbar.palette')}</button>
          )}
          {(stage === 'choose-method' || stage === 'choose-variant' || stage === 'adjust') && (
            <button className="mosaic-btn" onClick={resetAll}>＋ {t('mosaic.topbar.newMosaic')}</button>
          )}
        </div>
      </div>

      <div className="mosaic-main">
        <Suspense fallback={<div style={{ textAlign: 'center', padding: 40 }}>…</div>}>
          {stageComponent(stage)}
        </Suspense>
      </div>
    </div>
  );
}
