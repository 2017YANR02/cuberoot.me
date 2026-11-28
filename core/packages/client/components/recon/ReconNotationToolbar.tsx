'use client';

import { useState, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import { CopySuccessIcon } from '@/components/CopySuccessIcon';
import { Copy, Download } from '@app-foundation/icons/lucide';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { CompactSelect } from '@/components/CompactSelect';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { saveBlob } from '@/lib/puzzle-image/image-export';
import { exportReconImages, type ReconImageFont, type ReconImageStyle } from '@/lib/export-recon-image';
import './recon-notation-toolbar.css';

const StageSolver = dynamic(() => import('@/components/StageSolver'), { ssr: false });
const NOTATION_VIEWS = ['recon', 'source'] as const;
const SOLVER_NOTATION_VIEWS = ['recon', 'source', 'solver'] as const;
export type NotationView = typeof SOLVER_NOTATION_VIEWS[number];

export function ReconNotationToolbar({ view, onChange, canSolve, formattedText, sourceText, copyKey, imageRef, imageName, className }: {
  view: NotationView;
  onChange: (view: NotationView) => void;
  canSolve: boolean;
  formattedText: string;
  sourceText: string;
  copyKey: string;
  imageRef: RefObject<HTMLDivElement | null>;
  imageName: string;
  className?: string;
}) {
  const { copiedKey, copy } = useCopy();
  const sourceView = view === 'source';
  const key = `${copyKey}:${view}`;
  const copied = copiedKey === key;
  const copyLabel = sourceView ? tr({ zh: '复制原文', en: 'Copy raw text' }) : tr({ zh: '复制复盘', en: 'Copy reconstruction' });

  async function downloadImage(style: ReconImageStyle | 'both', font: ReconImageFont) {
    if (!imageRef.current) throw new Error('Reconstruction image unavailable');
    const images = await exportReconImages(imageRef.current, style === 'both' ? ['black', 'white'] : [style], font);
    for (const { color, blob } of images) saveBlob(blob, `${imageName}-${color}${font === 'original' ? '' : '-roboto-condensed'}.png`);
  }

  return <div className={className ? `${className} detail-notation-toolbar` : 'detail-notation-toolbar'}>
    <LiquidGlassChips items={canSolve ? SOLVER_NOTATION_VIEWS : NOTATION_VIEWS} value={view} onChange={onChange}
      getLabel={item => item === 'solver' ? tr({ zh: '求解', en: 'Solve' }) : item === 'source' ? tr({ zh: '原始', en: 'Raw' }) : tr({ zh: '复盘', en: 'Recon' })}
      ariaLabel={tr({ zh: '复盘展示方式', en: 'Reconstruction view' })} />
    {view !== 'solver' && <>
      <button type="button" className="detail-source-copy" title={copyLabel} onClick={() => copy(sourceView ? sourceText : formattedText, key)}>
        {copied ? <CopySuccessIcon size={14} /> : <Copy size={14} aria-hidden />}
        <span className="sr-only" aria-live="polite">{copied ? tr({ zh: '已复制', en: 'Copied' }) : copyLabel}</span>
      </button>
      <ReconImageDownload onDownload={downloadImage} />
    </>}
  </div>;
}

export function ReconSourceText({ text }: { text: string }) {
  return <pre className="detail-source-text" tabIndex={0} aria-label={tr({ zh: '复盘原文', en: 'Reconstruction source' })}><code>{text}</code></pre>;
}

export function ReconStageSolver({ scramble, lang }: { scramble: string; lang: 'zh' | 'en' }) {
  return <StageSolver scramble={scramble} lang={lang} compact allowProgressiveReveal inlineSolutions />;
}

function ReconImageDownload({ onDownload }: {
  onDownload: (style: ReconImageStyle | 'both', font: ReconImageFont) => Promise<void>;
}) {
  const [imageStatus, setImageStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  const [imageFont, setImageFont] = useState<ReconImageFont>('original');
  const download = async (imageStyle: ReconImageStyle | 'both') => {
    if (imageStatus === 'busy') return;
    setImageStatus('busy');
    try {
      await onDownload(imageStyle, imageFont);
      setImageStatus('idle');
    } catch {
      setImageStatus('error');
    }
  };

  return (
    <CompactSelect<ReconImageStyle | 'both'>
      triggerClassName="detail-source-copy"
      unstyledTrigger
      showArrow={false}
      ariaLabel={tr({ zh: '下载 PNG', en: 'Download PNG' })}
      title={tr({ zh: '下载 PNG', en: 'Download PNG' })}
      disabled={imageStatus === 'busy'}
      label={<span className="recon-png-label"><Download size={14} aria-hidden="true" />
        <span className="sr-only" aria-live="polite">{imageStatus === 'busy'
          ? tr({ zh: '正在生成…', en: 'Generating…' })
          : imageStatus === 'error'
            ? tr({ zh: '下载失败，点击重试', en: 'Download failed, retry' })
            : 'PNG'}</span>
      </span>}
      items={[
        { value: 'both', label: tr({ zh: '黑白两版', en: 'Black & white versions' }) },
        { value: 'black', label: tr({ zh: '黑字', en: 'Black text' }) },
        { value: 'white', label: tr({ zh: '白字', en: 'White text' }) },
        { value: 'white-outline', label: tr({ zh: '白字黑边', en: 'White text, black outline' }) },
      ]}
      onChange={style => { void download(style); }}
      footer={() => <label className="recon-image-font">
        <span>{tr({ zh: '字体', en: 'Font' })}</span>
        <select className="recon-image-font-select" value={imageFont} onChange={e => setImageFont(e.target.value as ReconImageFont)}>
          <option value="original">{tr({ zh: '原始字体', en: 'Original font' })}</option>
          <option value="roboto-condensed">Roboto Condensed Regular</option>
        </select>
      </label>}
    />
  );
}
