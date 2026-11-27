'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import { demoPhases, gripNames, grips, atlasCatalog, type AtlasOrder, suffixes } from './catalog';
import type { DemoPhase, mountGripDemo, StrokeSample } from './gripDemo';
import type { FlickStyle, HandGesture } from '../engine/hands/handsRig';
import './grips.css';

const parsers = {
  left: parseAsStringEnum(gripNames).withDefault('home'),
  right: parseAsStringEnum(gripNames).withDefault('home'),
  order: parseAsStringEnum(['2', '3', '4']).withDefault('3'),
  move: parseAsString.withDefault('U'),
};
const styles: Partial<Record<FlickStyle, readonly [string, string]>> = {
  lowerHook: ['勾拨', 'hook'], indexHook: ['勾拨', 'hook'], hook: ['勾拨', 'hook'], backHook: ['背面勾拨', 'back hook'],
  topPush: ['下压', 'press'], downPush: ['下拨', 'downward stroke'], upPush: ['上推', 'push'],
  thumbLift: ['上顶', 'upward push'], sliceNail: ['指甲上顶', 'nail push'],
  sliceNailDouble: ['指甲连拨两次', 'two nail strokes'],
  middleSlicePad: ['指腹拨动', 'pad stroke'],
} as const;
const fingers = {
  thumb: ['拇指', 'thumb'], index: ['食指', 'index'], middle: ['中指', 'middle'],
  ring: ['无名指', 'ring'], pinky: ['小指', 'little finger'],
} as const;

function Atlas() {
  const [query, select] = useQueryStates(parsers);
  const order = Number(query.order) as AtlasOrder;
  return <OrderAtlas key={order} order={order} query={query} select={select} />;
}

function OrderAtlas({ order, query, select }: {
  order: AtlasOrder; query: { left: typeof gripNames[number]; right: typeof gripNames[number]; move: string };
  select: (update: { order?: `${AtlasOrder}`; left?: typeof gripNames[number]; right?: typeof gripNames[number]; move?: string }) => unknown;
}) {
  const t = useT();
  const { left, right } = query;
  const { groups: moveGroups, moves, resolve } = atlasCatalog[order];
  const selected = resolve(query.move);
  const move = selected ?? 'U';
  const [geometry, setGeometry] = useState(false);
  const [samples, setSamples] = useState<StrokeSample[]>([]);
  const [replay, setReplay] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>('loading');
  const [gesture, setGesture] = useState<HandGesture | null>(null);
  const [paused, setPaused] = useState(false);
  const [demo, setDemo] = useState<ReturnType<typeof mountGripDemo> | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let instance: ReturnType<typeof mountGripDemo> | undefined;
    void import('./gripDemo').then(({ mountGripDemo }) => {
      if (cancelled || !host.current) return;
      instance = mountGripDemo(host.current, setPhase, { order, onGesture: setGesture, showStrokeView: true,
        onContact: sample => setSamples(previous => [...previous.filter(row => row.quarter !== sample.quarter), sample]),
      });
      setDemo(instance);
    }).catch(() => { if (!cancelled) setPhase('error'); });
    return () => { cancelled = true; instance?.dispose(); };
  }, [order]);
  useEffect(() => {
    demo?.showGeometry(geometry);
  }, [demo, geometry]);
  useEffect(() => {
    setSamples([]);
    if (selected) demo?.play(left, right, selected);
    else {
      demo?.pause(true);
      setGesture(null);
      setPhase('unavailable');
    }
    setPaused(false);
  }, [demo, left, right, selected, replay]);

  const review = geometry && order !== 3 ? demo?.contactReview() : null;
  const group = moveGroups.find(g => g.bases.includes(move.replace(/2'?$|'$/, '')))!;
  const pairs = gripNames.length ** 2;
  const count = pairs * moves.length;
  const index = (gripNames.indexOf(left) * gripNames.length + gripNames.indexOf(right)) * moves.length + moves.indexOf(move);
  function showIndex(i: number) {
    const pair = Math.floor(i / moves.length);
    void select({ left: gripNames[Math.floor(pair / gripNames.length)], right: gripNames[pair % gripNames.length], move: moves[i % moves.length] });
  }
  const replayMove = () => setReplay(n => n + 1);
  const phaseLabel = demoPhases[phase];
  const workingGrips = gesture?.kind === 'flick' ? demo?.workingGrips() : null;
  const describeHand = (side: 'L' | 'R') => {
    if (!gesture) return '—';
    if (gesture.kind === 'weld' && gesture.hands.includes(side)) return gesture.hands.length === 2
      ? t('随魔方转体', 'Rotates with cube') : t('手腕转动', 'Wrist turn');
    if (gesture.kind === 'flick' && gesture.hand === side) {
      const first = fingers[gesture.finger];
      const second = gesture.finger2 && fingers[gesture.finger2];
      const digits = second ? t(first[0] + ' → ' + second[0], first[1] + ' → ' + second[1]) : t(first[0], first[1]);
      if (!gesture.style) return digits + ' · ' + t('通用拨动', 'general stroke');
      const style = styles[gesture.style];
      return style ? digits + ' · ' + t(style[0], style[1]) : digits;
    }
    return t('支撑', 'Supports');
  };

  return <main className="grip-atlas">
    <header><PageHeading backHref={order === 3 ? '/sim' : '/sim?puzzle=' + order}>{t('握姿与手法', 'Grip & Turn Atlas')}</PageHeading>
      <p>{t(`${pairs} 种双手起手握姿 × ${moves.length} 种转动`, `${pairs} starting grip pairs × ${moves.length} turns`)}</p>
    </header>
    <label>{t('魔方阶数', 'Cube size')}{' '}
      <select className="grip-atlas-select" value={order} onChange={e => {
        const next = Number(e.target.value) as AtlasOrder;
        void select({ order: `${next}`, move: atlasCatalog[next].resolve(query.move) ?? 'U' });
      }}>{[2, 3, 4].map(n => <option key={n} value={n}>{n}×{n}</option>)}</select>
    </label>
    {!selected && <p role="alert">{t('该阶数不支持此转动，请重新选择。', 'This turn is unavailable at this size. Select another turn.')}</p>}
    <div className="grip-atlas-layout">
      <section className="grip-atlas-view" data-site-surface="panel" aria-label={t('三维演示', '3D demonstration')}>
        <div className="grip-atlas-caption"><strong>{selected ?? query.move}</strong><span role="status">{paused ? t('已暂停', 'Paused') : t(phaseLabel[0], phaseLabel[1])}</span></div>
        <div className="grip-atlas-canvas" ref={host} hidden={!selected} />
        <div className="grip-atlas-hands">
          {(['L', 'R'] as const).map(side => {
            const start = side === 'L' ? left : right;
            const name = grips[start], seated = workingGrips?.[side];
            return <div key={side}><span>{side === 'L' ? t('左手', 'Left hand') : t('右手', 'Right hand')} · {t(name[0] + '起手', name[1] + ' start')}{seated && seated !== start && <> → {t(grips[seated][0] + '发力', grips[seated][1] + ' stroke')}</>}</span>
              <strong>{describeHand(side)}</strong></div>;
          })}
        </div>
        <div className="grip-atlas-controls">
          <button className="grip-atlas-button" type="button" disabled={index === 0} onClick={() => showIndex(index - 1)}>{t('上一项', 'Previous')}</button>
          {phase === 'error'
            ? <button className="grip-atlas-button" type="button" onClick={() => window.location.reload()}>{t('重新加载', 'Reload')}</button>
            : <button className="grip-atlas-button" type="button" disabled={!selected || !demo || phase === 'loading'} onClick={replayMove}>{t('重播', 'Replay')}</button>}
          <button className="grip-atlas-button" type="button" disabled={!demo || ['loading', 'end', 'error', 'unavailable'].includes(phase)} onClick={() => {
            demo?.pause(!paused); setPaused(!paused);
          }}>{paused ? t('继续', 'Resume') : t('暂停', 'Pause')}</button>
          <button className="grip-atlas-button" type="button" disabled={index === count - 1} onClick={() => showIndex(index + 1)}>{t('下一项', 'Next')}</button>
          <span>{index + 1} / {count}</span>
        </div>
        <details onToggle={event => {
          setGeometry(event.currentTarget.open);
          if (event.currentTarget.open) replayMove();
        }}>
          <summary>{t('坐标轴与发力位置', 'Axes and stroke contacts')}</summary>
          <p>{t('原点在魔方中心。+X 向右，+Y 向上，+Z 向前。', 'The origin is the cube center. +X points right, +Y up, and +Z forward.')}</p>
          {samples.map(sample => {
            const contact = sample.geometry.contact!;
            const point = contact.point.map(n => n.toFixed(1)).join(', ');
            return <p key={sample.quarter}>{Math.round(Math.abs(sample.angle) * 180 / Math.PI)}° · {sample.hand === 'R' ? t('右手', 'Right') : t('左手', 'Left')}{' '}
              {t(fingers[sample.finger][0], fingers[sample.finger][1])} · {sample.surface === 'pad' ? t('指腹', 'pad') : t('指甲', 'nail')}
              {' · '}{contact.sticker} ({point})</p>;
          })}
          {review && (review.missing.length > 0 || !review.supportObserved || review.relayObserved === false) && <p role="status">
            {t('待标定', 'Needs calibration')}{' · '}
            {[
              ...review.missing.map(i => t(`第 ${i + 1} 拨尚未测到贴纸接触`, `No sticker contact sampled for stroke ${i + 1}`)),
              ...(review.relayObserved === false && !review.missing.length ? [t('90° 附近尚未测到两指交接', 'Both fingers have yet to be observed near the 90° handoff')] : []),
              ...(!review.supportObserved ? [t('尚未测到静止层指腹支撑', 'No pad support sampled on a stationary layer')] : []),
            ].join(' · ')}
          </p>}
          {geometry && !review && gesture?.kind === 'flick' && !samples.length && <p>{t('尚未采到活动贴纸上的接触点', 'No contact sampled on a moving sticker yet')}</p>}
          {geometry && (demo?.candidateCount() ?? 0) > 1 && <p>{t('有多种已标定指法可用，按当前手指到发力区的距离和朝向选指。', 'Several calibrated strokes fit. Finger reach and orientation determine the choice.')}</p>}
          {geometry && phase === 'end' && demo?.recording().entry && <button className="grip-atlas-button" type="button" onClick={() => {
            const blob = new Blob([JSON.stringify({ move, left, right, ...demo.recording() }, null, 2)],
              { type: 'application/json' });
            const url = URL.createObjectURL(blob), link = document.createElement('a');
            link.href = url; link.download = [order, left, right, move, 'contacts.json'].join('-'); link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>{t('导出接触记录', 'Export contact samples')}</button>}
        </details>
      </section>
      <section className="grip-atlas-picker" data-site-surface="panel" aria-label={t('选择演示', 'Choose a demonstration')}>
        <h2>{t('起手握姿', 'Starting grips')}</h2>
        <div className="grip-atlas-selects">
          {(['left', 'right'] as const).map(side => <div key={side}>
            <label htmlFor={side}>{side === 'left' ? t('左手', 'Left hand') : t('右手', 'Right hand')}</label>
            <select className="grip-atlas-select" id={side} value={side === 'left' ? left : right} onChange={e => {
              const grip = gripNames.find(name => name === e.target.value);
              if (grip) void select({ [side]: grip });
            }}>{gripNames.map(name => <option key={name} value={name}>
              {grips[name][2]} {t(grips[name][0], grips[name][1])}
            </option>)}</select>
          </div>)}
        </div>
        <h2>{t('转动', 'Turns')}</h2>
        <div className="grip-atlas-groups">{moveGroups.map(g =>
          <button className="grip-atlas-button" type="button" key={g.en} aria-pressed={g === group} onClick={() => {
            if (g !== group) void select({ move: g.bases[0] });
          }}>{t(g.zh, g.en)}</button>)}</div>
        <div className="grip-atlas-grid">{group.bases.flatMap(base => suffixes.map(suffix => {
          const token = base + suffix;
          return <button className="grip-atlas-button" type="button" key={token} aria-pressed={selected === token}
            onClick={() => selected === token ? replayMove() : void select({ move: token })}>{token}</button>;
        }))}</div>
      </section>
    </div>
  </main>;
}

export default function Page() {
  return <Suspense><Atlas /></Suspense>;
}
