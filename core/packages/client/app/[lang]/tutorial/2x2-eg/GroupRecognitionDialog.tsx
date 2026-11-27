'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from '@app-foundation/icons/lucide';
import { CompactSelect } from '@/components/CompactSelect';
import SettingsDialog from '@/components/SettingsDialog';
import { T, tr } from '@/i18n/tr';
import { getEgRecognition, recognitionExamples, recognitionKey, type RecognitionAnswer } from './case-comparison';
import { TopDiagram } from './diagrams';
import { egCaseName, type EgCase, type EgSet, type EgShape } from './lesson-data';
import { egPalette, useEgOrientation } from './orientation';
import { RecognitionDiagram, recognitionAnswer } from './RecognitionGuide';

export type GroupObservation = { index: number; answer: RecognitionAnswer };

export function groupRecognition(set: EgSet, shape: EgShape, observations: readonly GroupObservation[]) {
  const method = getEgRecognition(shape);
  if (!method) return null;
  const examples = recognitionExamples(method, set).filter(example => observations.every(({ index, answer }) =>
    recognitionKey(example.answers[index]) === recognitionKey(answer)));
  const entries = [...new Map(examples.map(example => [example.entry.id, example.entry])).values()];
  if (!entries.length) return null;
  const lastIndex = observations.at(-1)?.index ?? -1;
  const nextIndex = method.checks.findIndex((_, index) => index > lastIndex
    && new Set(examples.map(example => recognitionKey(example.answers[index]))).size > 1);
  return { method, examples, entries, nextIndex };
}

export default function GroupRecognitionDialog({ set, recognition, observations, paused, onObserve, onBack, onReset, onClose, onLearn }: {
  set: EgSet;
  recognition: NonNullable<ReturnType<typeof groupRecognition>>;
  observations: readonly GroupObservation[];
  paused: boolean;
  onObserve: (observation: GroupObservation) => void;
  onBack: () => void;
  onReset: () => void;
  onClose: () => void;
  onLearn: (entry: EgCase) => void;
}) {
  const top = egPalette(useEgOrientation()).name('U');
  const [sampleId, setSampleId] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const step = observations.length + 1;
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    heading.current?.focus();
  }, [step]);

  if (paused) return null;
  const { method, examples, entries, nextIndex } = recognition;
  const sample = examples.find(example => example.entry.id === sampleId) ?? examples[0];
  const check = method.checks[nextIndex];
  const options = check && new Map(examples.map(example =>
    [recognitionKey(example.answers[nextIndex]), example.answers[nextIndex]]));
  const caseName = tr(egCaseName(sample.entry.id));
  const observing = entries.length > 1 && check && options;
  const prompts = {
    relation: { zh: `比较两格非${top.zh}色贴纸。`, en: `Compare the two non-${top.en} stickers.` },
    bars: { zh: '数一数同色棒。', en: 'Count the matching pairs.' },
    'top-yellows': { zh: `看朝上的${top.zh}格。`, en: `Look for ${top.en} stickers facing up.` },
  };

  return <SettingsDialog label={tr({ zh: '辨识这一组', en: 'Recognize this group' })} heading
    panelClassName="eg-recognition-dialog" surface="dialog" onClose={onClose}>
    <div className="eg-recognition-layout">
      <div className="eg-recognition-visual">
        <figure className="eg-recognition-figure">
          {observing
            ? <RecognitionDiagram method={method} check={check} example={sample} focused keepReference outlineStickers={false} size={184} />
            : <TopDiagram setup={sample.entry.setup} size={184} />}
          {(observing || sample.entry.alg) && <figcaption>
            {observing
              ? <CompactSelect className="eg-recognition-sample" triggerClassName="eg-recognition-sample-trigger" showArrow
                ariaLabel={tr({ zh: '选择示例', en: 'Choose example' })} valueText={caseName} value={sample.entry.id} onChange={setSampleId}
                label={<><span><T zh="示例" en="Example" /></span><strong>{caseName}</strong></>}
                items={entries.map(entry => ({ value: entry.id, label: tr(egCaseName(entry.id)) }))} />
              : <T zh="公式起手位" en="Algorithm starting position" />}
          </figcaption>}
        </figure>
      </div>
      <div className="eg-recognition-body">
        {observing && step === 1 && <p><T zh="把魔方摆成图中的朝向。" en="Hold your cube as shown." />
          {set === 'eg1' && <T zh="底层的棒放在后面。" en=" Keep the bottom bar at the back." />}</p>}
        {observing && observations.length > 0 && <ol className="eg-recognition-observations" role="list">
          {observations.map(({ index, answer }, order) => <li key={index}>
            <strong><T zh={`第 ${order + 1} 处`} en={`Check ${order + 1}`} /></strong>
            {recognitionAnswer(answer, top)}
          </li>)}
        </ol>}
        <div className="eg-recognition-current">
          <h3 ref={heading} tabIndex={-1}>
            {observing ? <T zh={`看第 ${step} 处`} en={`Check ${step}`} />
              : <T zh={`识别为 ${caseName}`} en={`Identified as ${caseName}`} />}
          </h3>
          {observing ? <>
            <p><T {...prompts[check.kind]} /></p>
            <div className="eg-recognition-choices" role="group" aria-label={tr({ zh: '选择观察结果', en: 'Choose what you see' })}>
              {[...options].map(([key, answer]) => <button key={key} type="button" className="btn-secondary eg-control"
                onClick={() => onObserve({ index: nextIndex, answer })}>{recognitionAnswer(answer, top)}</button>)}
            </div>
            <div className="eg-recognition-candidates" role="status">
              <span><T zh="候选" en="Remaining cases" /></span>
              <ul role="list">
                {entries.map(entry => <li key={entry.id}><T {...egCaseName(entry.id)} /></li>)}
              </ul>
            </div>
          </> : sample.entry.alg ? <>
            <p>{set === 'eg1' && <T zh="底层的棒仍放在后面。" en="Keep the bottom bar at the back. " />}
              <T zh="按图摆好顶层，再做公式。" en="Match the top to the diagram, then apply the algorithm." /></p>
            <button type="button" className="btn-primary eg-control" aria-haspopup="dialog" onClick={() => onLearn(sample.entry)}>
              <T zh="看公式演示" en="Watch the algorithm" />
            </button>
          </> : <p><T zh="转 U 对齐上下两层即可复原。" en="Turn U to align the two layers and finish." /></p>}
        </div>
      </div>
    </div>
    <footer className="eg-recognition-nav">
      <button type="button" className="eg-recognition-back eg-control" disabled={observations.length === 0} onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /><T zh="上一步" en="Previous check" />
      </button>
      <button type="button" className="eg-recognition-back eg-control" disabled={observations.length === 0}
        onClick={() => { setSampleId(''); onReset(); }}><T zh="重新辨识" en="Start over" /></button>
    </footer>
  </SettingsDialog>;
}
