'use client';

import { useState } from 'react';
import SettingsDialog from '@/components/SettingsDialog';
import { T, tr } from '@/i18n/tr';
import { getEgRecognition, recognitionExamples, recognitionKey, type RecognitionAnswer } from './case-comparison';
import { TopDiagram } from './diagrams';
import { EG_SHAPES, egCaseName, type EgCase, type EgSet, type EgShape } from './lesson-data';
import { RecognitionDiagram, RecognitionReference, recognitionAnswer, recognitionInstruction } from './RecognitionGuide';

export default function GroupRecognitionDialog({ set, shape, onClose, onLearn }: {
  set: EgSet; shape: EgShape; onClose: () => void; onLearn: (entry: EgCase) => void;
}) {
  const [observations, setObservations] = useState<{ index: number; key: string }[]>([]);
  const [sampleId, setSampleId] = useState('');
  const method = getEgRecognition(shape);
  if (!method) return null;
  const examples = recognitionExamples(method, set)
    .filter(example => observations.every(({ index, key }) => recognitionKey(example.answers[index]) === key));
  const entries = [...new Map(examples.map(example => [example.entry.id, example.entry])).values()];
  const sample = examples.find(example => example.entry.id === sampleId) ?? examples[0];
  if (!sample) return null;

  const lastIndex = observations.at(-1)?.index ?? -1;
  const nextIndex = method.checks.findIndex((_, index) => index > lastIndex
    && new Set(examples.map(item => recognitionKey(item.answers[index]))).size > 1);
  const check = method.checks[nextIndex];
  const options = new Map<string, RecognitionAnswer>(check
    ? examples.map(item => [recognitionKey(item.answers[nextIndex]), item.answers[nextIndex]]) : []);
  const shapeName = tr(EG_SHAPES.find(group => group.id === shape)!.name);
  const caseName = tr(egCaseName(sample.entry.id));
  const title = tr({ zh: `辨识 ${shapeName} 组`, en: `Recognize ${shapeName} cases` });

  return <SettingsDialog label={title} heading panelClassName="eg-recognition-panel" onClose={onClose}>
    {entries.length > 1 && check ? <>
      <RecognitionReference anchor={method.anchor} bottomBar={set === 'eg1'} />
      <div className="eg-recognition-prompt">
        <figure>
          <RecognitionDiagram method={method} check={check} example={sample} focused keepReference size={136} />
          <figcaption>
            <label><T zh="示例" en="Example" />{' '}
              <select value={sample.entry.id} onChange={event => setSampleId(event.target.value)}>
                {entries.map(entry => <option key={entry.id} value={entry.id}>{tr(egCaseName(entry.id))}</option>)}
              </select>
            </label>
          </figcaption>
        </figure>
        <div className="eg-recognition-answers">
          <p><T {...recognitionInstruction(check)} /></p>
          <div className="eg-actions" role="group" aria-label={tr({ zh: '选择观察结果', en: 'Choose what you see' })}>
            {[...options].map(([key, answer]) => <button key={key} type="button" className="btn-secondary eg-control"
              onClick={() => setObservations(previous => [...previous, { index: nextIndex, key }])}>{recognitionAnswer(answer)}</button>)}
          </div>
          <p className="eg-recognition-candidates" role="status">
            <T zh={`候选 ${entries.map(entry => tr(egCaseName(entry.id))).join('、')}`}
              en={`Possible cases: ${entries.map(entry => tr(egCaseName(entry.id))).join(', ')}`} />
          </p>
        </div>
      </div>
    </> : <>
      <p className="eg-recognition-result" role="status"><T zh={`识别为 ${caseName}`} en={`Identified as ${caseName}`} /></p>
      <div className="eg-recognition-prompt">
        <figure>
          <TopDiagram setup={sample.entry.setup} size={136} />
          {sample.entry.alg && <figcaption><T zh="公式起手位" en="Algorithm starting position" /></figcaption>}
        </figure>
        <div className="eg-recognition-answers">
          {sample.entry.alg ? <><p>{set === 'eg1' && <T zh="底层的棒仍放在后面。" en="Keep the bottom bar at the back. " />}
            <T zh="按图调整顶层，再做公式。" en="Match the top to this diagram before starting the algorithm." /></p>
          <button type="button" className="btn-primary eg-control" onClick={() => onLearn(sample.entry)}>
            <T zh="看公式演示" en="Watch the algorithm" />
          </button></> : <p><T zh="转 U 对齐上下两层即可复原。" en="Turn U to align the two layers and finish." /></p>}
        </div>
      </div>
    </>}
    {observations.length > 0 && <div className="eg-actions eg-recognition-nav">
      <button type="button" className="btn-secondary eg-control" onClick={() => setObservations(previous => previous.slice(0, -1))}>
        <T zh="上一步" en="Previous check" />
      </button>
      <button type="button" className="btn-secondary eg-control" onClick={() => { setObservations([]); setSampleId(''); }}>
        <T zh="重新辨识" en="Start over" />
      </button>
    </div>}
  </SettingsDialog>;
}
