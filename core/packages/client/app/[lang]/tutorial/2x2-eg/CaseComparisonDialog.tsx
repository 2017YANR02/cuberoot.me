'use client';

import { useMemo, useState } from 'react';
import SettingsDialog from '@/components/SettingsDialog';
import { T, tr } from '@/i18n/tr';
import { alternateEgRecognition, compareEgCases, recognitionKey } from './case-comparison';
import { egCaseName, type EgCase } from './lesson-data';
import { egPalette, useEgOrientation } from './orientation';
import { RecognitionDiagram, RecognitionReference, recognitionAnswer, recognitionInstruction } from './RecognitionGuide';

export default function CaseComparisonDialog({ first, second, onClose }: { first: EgCase; second: EgCase; onClose: () => void }) {
  const top = egPalette(useEgOrientation()).name('U');
  const result = useMemo(() => compareEgCases(first, second), [first, second]);
  const alternate = useMemo(() => alternateEgRecognition(first.set, first.shape, [first.id, second.id]), [first, second]);
  const [selectedCheck, setSelectedCheck] = useState<number | null>(null);
  const [showAlternate, setShowAlternate] = useState(false);
  const [keyStickersOnly, setKeyStickersOnly] = useState(false);
  if (!result) return null;

  const sideMethod = showAlternate ? alternate : null;
  const method = sideMethod ?? result.method;
  const checkIndex = sideMethod ? 0 : selectedCheck ?? result.difference;
  const check = method.checks[checkIndex];
  const title = tr({ zh: '怎么区分这两个 case', en: 'How to tell these cases apart' });
  const pair = [first, second].map((entry, index) => {
    const readings = sideMethod ? sideMethod.examples.filter(example => example.entry.id === entry.id) : result.readings[index];
    const example = sideMethod ? readings[0] : result.examples[index];
    const answer = example.answers[checkIndex];
    const alternatives = new Map(readings.map(item => [recognitionKey(item.answers[checkIndex]), item.answers[checkIndex]]));
    alternatives.delete(recognitionKey(answer));
    const otherAnswers = [...alternatives.values()].map(item => recognitionAnswer(item, top));
    return <figure key={entry.id}>
      <RecognitionDiagram example={example} method={method} check={check} focused={keyStickersOnly} />
      <figcaption>
        <strong><T {...egCaseName(entry.id)} /></strong>
        <span>{recognitionAnswer(answer, top)}</span>
        {otherAnswers.length > 0 && <span><T zh={`也可能是 ${otherAnswers.join('或')}`}
          en={`Also possible: ${otherAnswers.join(' or ')}`} /></span>}
      </figcaption>
    </figure>;
  });

  return <SettingsDialog label={title} heading surface="dialog" panelClassName="eg-recognition-dialog eg-case-compare-panel" onClose={onClose}>
    <div className="eg-recognition-layout eg-case-compare-layout">
      <div className="eg-recognition-visual eg-case-compare-pair">{pair}</div>
      <div className="eg-recognition-body">
        <RecognitionReference anchor={method.anchor} bottomBar={first.set === 'eg1'} />
        <div className="eg-recognition-current">
          <h3><T {...recognitionInstruction(check, top)} /></h3>
          {!sideMethod && result.difference > 0 && <div className="eg-recognition-choices" role="group"
            aria-label={tr({ zh: '组内观察顺序', en: 'Group recognition checks' })}>
            {method.checks.slice(0, result.difference + 1).map((_, index) => <button type="button" key={index}
              className="btn-secondary eg-control" aria-pressed={checkIndex === index} onClick={() => setSelectedCheck(index)}>
              <T zh={`看第 ${index + 1} 处`} en={`Check ${index + 1}`} />
            </button>)}
          </div>}
          <div className="eg-recognition-choices">
            <button type="button" className="btn-secondary eg-control" aria-pressed={keyStickersOnly}
              onClick={() => setKeyStickersOnly(value => !value)}><T zh="只看关键格" en="Show key stickers only" /></button>
            {alternate && <button type="button" className="btn-secondary eg-control" aria-pressed={showAlternate}
              onClick={() => setShowAlternate(value => !value)}><T zh="用侧面颜色作参照" en="Use side colors as the reference" /></button>}
          </div>
          {!sideMethod && result.difference > 0 && result.readings.some(readings => readings.length > 1)
            && <p><T zh={`${top.zh}格有对称摆法时，按上面的顺序结合几处一起看。`}
              en={`When the ${top.en} pattern is symmetric, use the checks together in order.`} /></p>}
        </div>
      </div>
    </div>
    <footer className="eg-recognition-nav eg-case-compare-footer">
      <p><T zh="做公式时，对照列表里的盘面摆好起手位。" en="For the algorithm, match the starting position in the list." /></p>
    </footer>
  </SettingsDialog>;
}
