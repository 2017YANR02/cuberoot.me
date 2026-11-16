'use client';

import TutorialNavigationShell from '../../components/TutorialNavigationShell';

import { useMemo, useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { VisualCube } from '@/components/VisualCube';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { tr, T } from '@/i18n/tr';
import { f2lDiagramFacelets, f2lPlaybackSections } from '../lib/cube-preview';
import { f2lNonstandardExamples, f2lSmartExtraction } from '../lib/curriculum';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';
import NonstandardIntro from './NonstandardIntro';
import { nonstandardTreatmentScenes, NONSTANDARD_TREATMENT_TITLE } from '../data/nonstandard-treatment';

const NO_STOPS: readonly number[] = [];
const EXTRACTION_TITLES = {
  edge: { zh: '棱在其他槽内', en: 'Edge in another slot' },
  corner: { zh: '角在其他槽内', en: 'Corner in another slot' },
  together: { zh: '棱角在同一个其他槽内', en: 'Both pieces in the same other slot' },
  apart: { zh: '棱角在不同槽内', en: 'Pieces in different slots' },
};

export default function ExtractionLesson({ orientation, pauseBetween, onNextChapter, includeExamples = false }: {
  orientation: string; pauseBetween: boolean; onNextChapter: () => void; includeExamples?: boolean;
}) {
  const [extractionKind, setExtractionKind] = useState<keyof typeof EXTRACTION_TITLES>('edge');
  const [section, setSection] = useQueryState('section', parseAsStringEnum(['intro', 'treatment', 'examples']).withDefault('intro'));
  const video = section === 'examples' ? (includeExamples ? null : 'intro') : section;
  const setVideo = (next: 'intro' | 'treatment' | null) => void setSection(next ?? 'examples');
  const [extractionIndices, setExtractionIndices] = useState<Record<string, number>>({});
  const examples = useMemo(() => f2lNonstandardExamples(8), []);
  const treatmentScenes = useMemo(() => nonstandardTreatmentScenes(orientation), [orientation]);
  const extractionChoices = examples.filter(example => example.kind === extractionKind);
  const extractionIndex = extractionIndices[extractionKind] ?? 0;
  const extraction = extractionChoices[extractionIndex];
  const smartExtraction = useMemo(() => extraction ? f2lSmartExtraction(extraction.setup) : '', [extraction]);
  const kinds = Object.keys(EXTRACTION_TITLES) as (keyof typeof EXTRACTION_TITLES)[];
  return <>
    <TutorialNavigationShell className="f2l-study-layout">

      <SectionNavigation label={tr(video === 'intro' ? { zh: '认识非标', en: 'Recognizing non-standard cases' }
        : video === 'treatment' ? NONSTANDARD_TREATMENT_TITLE : EXTRACTION_TITLES[extractionKind])} items={[{ id: 'section-0', label: tr({ zh: "认识非标", en: "Recognizing non-standard cases" }), active: video === 'intro', onSelect: () => setVideo('intro') }, { id: 'section-1', label: tr(NONSTANDARD_TREATMENT_TITLE), active: video === 'treatment', onSelect: () => setVideo('treatment') }, ...(includeExamples ? kinds.map((kind) => ({ id: String(kind), label: tr(EXTRACTION_TITLES[kind]), active: !video && extractionKind === kind, onSelect: () => { setVideo(null); setExtractionKind(kind); }, icon: <VisualCube view="iso" size={36} faceletColors={f2lDiagramFacelets(examples.find(item => item.kind === kind)!.setup, orientation)} alt=""/> })) : [])]} />
      <div className="f2l-study-main">
        {video === 'treatment' ? <NonstandardIntro key={`treatment:${orientation}`} orientation={orientation}
          scenes={treatmentScenes} title={NONSTANDARD_TREATMENT_TITLE} showSceneNumber />
        : video === 'intro' ? <NonstandardIntro key={orientation} orientation={orientation}
          edgeSetup={examples.find(item => item.kind === 'edge')!.setup}
          cornerSetup={examples.find(item => item.kind === 'corner')!.setup} /> : extraction && <>
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
        <StudyActions onPrevious={video === 'intro' ? undefined : video === 'treatment' ? () => setVideo('intro') : kinds.indexOf(extractionKind) > 0
          ? () => setExtractionKind(kinds[kinds.indexOf(extractionKind) - 1]) : () => setVideo('treatment')} onContinue={() => {
          if (video === 'intro') { setVideo('treatment'); return; }
          if (video === 'treatment') {
            if (includeExamples) { setVideo(null); setExtractionKind('edge'); }
            else onNextChapter();
            return;
          }
          const next = kinds[kinds.indexOf(extractionKind) + 1];
          if (next) setExtractionKind(next);
          else onNextChapter();
        }}>
          {!video && <button type="button" className="f2l-restart" disabled={extractionChoices.length < 2} onClick={() => {
            const candidate = Math.floor(Math.random() * (extractionChoices.length - 1));
            setExtractionIndices(current => ({ ...current, [extractionKind]: candidate >= extractionIndex ? candidate + 1 : candidate }));
          }}><T zh="换一个例子" en="Try another example" /></button>}
        </StudyActions>
      </div>
    </TutorialNavigationShell>
  </>;
}
