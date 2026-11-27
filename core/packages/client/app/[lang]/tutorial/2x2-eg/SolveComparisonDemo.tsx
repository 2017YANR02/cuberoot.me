'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE } from '../components/InteractiveTutorial';
import useTeachingFollow from '../components/useTeachingFollow';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { BottomDiagram } from './diagrams';
import { EgOrientationContext } from './orientation';

type Example = (typeof import('./solve-comparison-examples.json'))[number];
type Selection = {
  bottom: keyof Example['routeIds'];
  finish: keyof Example['routeIds']['face'];
  paletteIndex: number;
};

const labels = {
  selected: { zh: '当前方案', en: 'Selected method' },
  reference: { zh: '六色底 EG', en: 'Six-color EG' },
};
const colors: Record<string, { zh: string; en: string }> = {
  W: { zh: '白', en: 'White' }, Y: { zh: '黄', en: 'Yellow' }, R: { zh: '红', en: 'Red' },
  O: { zh: '橙', en: 'Orange' }, G: { zh: '绿', en: 'Green' }, B: { zh: '蓝', en: 'Blue' },
};
const moveCount = (alg: string) => alg ? alg.split(' ').length : 0;

function ExamplePlayback({ setup, path, faceOnly }: { setup: string; path: string[] | null; faceOnly: boolean }) {
  const [step, setStep] = useState(0);
  const { paneProps, playbackProps } = useTeachingFollow(step, setup);
  const [color, , opening, orienting, finishing] = path ?? [];
  const { alg, stages, markers, end } = useMemo(() => {
    const [ , regrip, bottom, orient, finish] = path ?? [];
    const parts = [
      { title: { zh: '转体选底', en: 'Choose the bottom color' }, alg: regrip },
      { title: faceOnly ? { zh: '拼好一面', en: 'Build one face' } : { zh: '复原底层', en: 'Build the first layer' }, alg: bottom },
      { title: { zh: '翻好顶面', en: 'Orient the top face' }, alg: orient },
      { title: { zh: '收尾复原', en: 'Finish the solve' }, alg: finish },
    ].filter(part => part.alg);
    let end = 0;
    const stages = parts.map(part => {
      const from = end;
      end += moveCount(part.alg);
      return { ...part, from, to: end };
    });
    return { stages, end, alg: parts.map(part => part.alg).join(' '), markers: stages.slice(1).map(stage => stage.from) };
  }, [faceOnly, path]);
  const moves = moveCount(opening) + moveCount(orienting) + moveCount(finishing);

  return <div className="eg-comparison-demo-layout" data-tutorial-layout="B">
    <div className="eg-comparison-cube" {...playbackProps}>
      {path ? <AlgPlayer puzzle="2x2" set="" engine="sim" orientation={TWO_BY_TWO_ORIENTATION} fillPane
        setup={setup} alg={alg} maxFramingEdge={CUBE_FRAMING_EDGE} stepMarkers={markers} moveDurationMs={480} onStepChange={setStep} />
        : <div className="eg-comparison-demo-preview">
          <EgOrientationContext.Provider value={TWO_BY_TWO_ORIENTATION}>
            <BottomDiagram setup="" size={112} decorative />
          </EgOrientationContext.Provider>
        </div>}
    </div>
    <div className="eg-comparison-demo-info" {...paneProps} tabIndex={path ? 0 : undefined}>
      {path && <>
        <p><T zh={`底色${colors[color].zh} · ${moves} 步`} en={`${colors[color].en} bottom · ${moves} moves`} /></p>
        <ol className="eg-comparison-demo-stages">
          {stages.map(stage => <li key={stage.from} aria-current={step >= stage.from && step < stage.to ? 'step' : undefined}>
            <strong><T {...stage.title} /></strong>
            <code>{stage.alg}</code>
          </li>)}
        </ol>
        <p className="eg-comparison-caption"><T zh="分段模拟 · 转体不计步" en="Stage simulation · Rotations are free" />
          {step >= end && <> · <T zh="已复原" en="Solved" /></>}
        </p>
      </>}
    </div>
  </div>;
}

export default function SolveComparisonDemo({ selected, reference }: { selected: Selection; reference: Selection }) {
  const [example, setExample] = useState<Example | null>(null);
  const [loading, setLoading] = useState(true);
  const shuffling = useRef(false);
  const [failed, setFailed] = useState(false);
  const [route, setRoute] = useState<keyof typeof labels>('selected');
  const selection = route === 'selected' ? selected : reference;
  const pathIndex = example?.routeIds[selection.bottom][selection.finish][selection.paletteIndex];
  const path = example && pathIndex !== undefined ? example.paths[pathIndex] : null;

  const shuffle = useCallback(async () => {
    if (shuffling.current) return;
    shuffling.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const { default: examples } = await import('./solve-comparison-examples.json');
      const draw = Math.random();
      setExample(previous => {
        const previousIndex = previous ? examples.indexOf(previous) : -1;
        const next = Math.floor(draw * (examples.length - Number(previousIndex >= 0)));
        return examples[next + Number(previousIndex >= 0 && next >= previousIndex)];
      });
    } catch {
      setFailed(true);
    } finally {
      shuffling.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { void shuffle(); }, [shuffle]);

  return <section className="eg-comparison-demo" aria-label={tr({ zh: '同一打乱的还原演示', en: 'Two solves from the same scramble' })}>
    <div className="eg-comparison-demo-heading">
      <h3><T zh="同一把打乱，两种解法" en="Same scramble, two solves" /></h3>
      <button type="button" className="btn-primary eg-control" disabled={loading} aria-busy={loading} onClick={shuffle}>
        <T zh="随机打乱" en="Random scramble" />
      </button>
    </div>
    <p className="eg-comparison-demo-setup">
      <span><T zh="打乱" en="Scramble" /></span>
      {failed ? <span className="eg-comparison-demo-value" role="status"><T zh="加载失败，请重试。" en="Couldn’t load. Try again." /></span>
        : <code className="eg-comparison-demo-value">{example?.setup ?? '—'}</code>}
    </p>
    <div className="eg-actions" role="group" aria-label={tr({ zh: '选择要播放的解法', en: 'Choose a solve to play' })}>
      {(['selected', 'reference'] as const).map(item => <button key={item} type="button" className="btn-secondary eg-control"
        disabled={!path} aria-pressed={route === item} onClick={() => setRoute(item)}><T {...labels[item]} /></button>)}
    </div>
    <ExamplePlayback key={`${example?.setup ?? ''}:${route}:${pathIndex}`} setup={example?.setup ?? ''} path={path} faceOnly={selection.bottom === 'face'} />
  </section>;
}
