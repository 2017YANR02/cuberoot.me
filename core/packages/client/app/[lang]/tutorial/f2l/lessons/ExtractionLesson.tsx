'use client';

import { useMemo, useState } from 'react';
import { VisualCube } from '@/components/VisualCube';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { tr, T } from '@/i18n/tr';
import { f2lDiagramFacelets, f2lPlaybackSections } from '../lib/cube-preview';
import { f2lNonstandardExamples, f2lSmartExtraction } from '../lib/curriculum';
import StudyActions from '../components/StudyActions';

const NO_STOPS: readonly number[] = [];
const EXTRACTION_TITLES = {
  edge: { zh: '棱在其他槽内', en: 'Edge in another slot' },
  corner: { zh: '角在其他槽内', en: 'Corner in another slot' },
  together: { zh: '棱角在同一个其他槽内', en: 'Both pieces in the same other slot' },
  apart: { zh: '棱角在不同槽内', en: 'Pieces in different slots' },
};

export default function ExtractionLesson({ orientation, pauseBetween, onNextChapter }: {
  orientation: string; pauseBetween: boolean; onNextChapter: () => void;
}) {
  const [extractionKind, setExtractionKind] = useState<keyof typeof EXTRACTION_TITLES>('edge');
  const [extractionIndices, setExtractionIndices] = useState<Record<string, number>>({});
  const examples = useMemo(() => f2lNonstandardExamples(8), []);
  const extractionChoices = examples.filter(example => example.kind === extractionKind);
  const extractionIndex = extractionIndices[extractionKind] ?? 0;
  const extraction = extractionChoices[extractionIndex];
  const smartExtraction = useMemo(() => extraction ? f2lSmartExtraction(extraction.setup) : '', [extraction]);
  return <>
    <div className="f2l-study-layout">

      <div className="f2l-section-nav">
        <div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择非标类型', en: 'Choose a non-standard case type' })}>
          {(Object.keys(EXTRACTION_TITLES) as (keyof typeof EXTRACTION_TITLES)[]).map(kind => <button className="f2l-section-button" key={kind} type="button"
            aria-pressed={extractionKind === kind} onClick={() => setExtractionKind(kind)}>
            <span className="f2l-section-label">
              <VisualCube view="iso" size={36} faceletColors={f2lDiagramFacelets(examples.find(item => item.kind === kind)!.setup, orientation)} alt="" />
              <span>{tr(EXTRACTION_TITLES[kind])}</span>
            </span>
          </button>)}
        </div>
      </div>
      <div className="f2l-study-main">
        {extraction && <>
          <div className="f2l-extraction-comparison">{[
            { id: 'mechanical', title: tr({ zh: '基础解法', en: 'Basic method' }), alg: extraction.alg },
            { id: 'smart', title: tr({ zh: '优化解法', en: 'Optimized method' }), alg: smartExtraction },
          ].map(method => <section className="f2l-extraction" key={method.id} aria-label={method.title}>
            <div className="f2l-cube"><AlgPlayer puzzle="3x3" set="f2l-tutorial" engine="sim" setup={extraction.setup} alg={method.alg}
              orientation={orientation} fillPane moveDurationMs={850}
              sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? f2lPlaybackSections(method.alg).slice(0, -1).map(section => section.end) : NO_STOPS} /></div>
            <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{method.alg}</code>
            <h3>{method.title}</h3>
          </section>)}</div>
        </>}
        <StudyActions onContinue={() => {
          const kinds = Object.keys(EXTRACTION_TITLES) as (keyof typeof EXTRACTION_TITLES)[];
          const next = kinds[kinds.indexOf(extractionKind) + 1];
          if (next) setExtractionKind(next);
          else onNextChapter();
        }}>
          <button type="button" className="f2l-restart" disabled={extractionChoices.length < 2} onClick={() => {
            const candidate = Math.floor(Math.random() * (extractionChoices.length - 1));
            setExtractionIndices(current => ({ ...current, [extractionKind]: candidate >= extractionIndex ? candidate + 1 : candidate }));
          }}><T zh="换一个例子" en="Try another example" /></button>
        </StudyActions>
      </div>
    </div>
  </>;
}
