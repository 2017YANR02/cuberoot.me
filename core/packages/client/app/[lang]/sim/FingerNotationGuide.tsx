'use client';

import { useMemo, useEffect, useId, useCallback, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import AppLink from '@/components/AppLink';
import FingerAnnotationExample, { pinExampleHref } from './FingerAnnotationExample';
import type PlaybackBar from '@/components/PlaybackBar';
import { BookOpen, ExternalLink, Play } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { gripMarkNamesZh } from '@/lib/grip-mark-labels';
import { pushRules, pushRule } from '@/lib/push-notation';
import type { FingerMark } from '@/lib/alg-finger-marks';
import { techniqueMoves, homePose, type Technique, type LessonMethod, type Pose } from './grips/techniqueLessons';
import { nailComparisons, thumbComparisons, type ContactComparison } from './grips/contactComparisons';
import { atlasCatalog, grips, demoPhases, type AtlasOrder } from './grips/catalog';
import type { DemoPhase, GripDemoMount, mountGripDemo } from './grips/gripDemo';
import HandsRig, { type GripName } from './engine/hands/handsRig';

type Label = readonly [string, string];
interface Entry {
  key: string;
  name: Label;
  description: Label;
  examples: string[];
  mark?: FingerMark;
  grip?: GripName;
  compareIndexSingles?: boolean;
}
const pushEntry: Entry = { key: 'p', name: ['推', 'Push'], examples: pushRules.map(rule => rule.token),
      description: ["双手中起手时，U'p 指定右食指推顶层。Up 用左食指，Dp 用右无名指，D'p 用左无名指。", "From home grip, U'p calls for a right index push. Up uses the left index, Dp the right ring finger, and D'p the left ring finger."],
};
const gripEntries: Entry[] = [
  { key: '↑', name: [gripMarkNamesZh['↑'], 'Up'], grip: 'up', examples: ['R', 'L'],
    description: ['拇指在顶面，食指、中指和无名指在底面。', 'The thumb rests on the top face. The index, middle and ring fingers rest on the bottom face.'] },
  { key: '↓', name: [gripMarkNamesZh['↓'], 'Down'], grip: 'down', examples: ['R', 'L'],
    description: ['拇指在底面，食指、中指和无名指在顶面。', 'The thumb rests on the bottom face. The index, middle and ring fingers rest on the top face.'] },
  { key: '·', name: [gripMarkNamesZh['·'], 'Home'], grip: 'home', examples: ['both'],
    description: ['双手拇指在前面，食指、中指和无名指在背面。', 'Both thumbs rest on the front face. The index, middle and ring fingers rest on the back face.'] },
  { key: '↑↑', name: [gripMarkNamesZh['↑↑'], 'Half via up'], grip: 'half', examples: ['R', 'L'],
    description: ['拇指在背面，食指、中指和无名指在前面。从正面看，掌心露出较多。', 'The thumb rests on the back face and the index, middle and ring fingers on the front. More of the palm is visible from the front.'] },
  { key: '↓↓', name: [gripMarkNamesZh['↓↓'], 'Half via down'], grip: 'halfDown', examples: ['R', 'L'],
    description: ['拇指在背面，食指、中指和无名指在前面。从正面看，手背露出较多。', 'The thumb rests on the back face and the index, middle and ring fingers on the front. More of the back of the hand is visible from the front.'] },
  { key: '↑｜↑', name: [gripMarkNamesZh['↑｜↑'], 'Both up'], grip: 'up', examples: ['both'],
    description: ['双手拇指都在顶面，其余手指从两侧托住底面。', 'Both thumbs rest on the top face, with the fingers supporting the bottom face from either side.'] },
  { key: '↓｜↓', name: [gripMarkNamesZh['↓｜↓'], 'Both down'], grip: 'down', examples: ['both'],
    description: ['双手拇指都在底面，两手的食指、中指和无名指搭在顶面。', 'Both thumbs rest on the bottom face. The index, middle and ring fingers of both hands rest on the top face.'] },
];

const techniques: Record<Technique, Entry> = {
  middle: { key: 'middle', name: ['中指', 'Middle finger'], mark: 's', examples: ['U'], description: ['中指直接拨动，或在半转时接第二拨。', 'The middle finger drives the turn or takes the second flick of a half turn.'] },
  thumb: { key: 'thumb', name: ['拇指', 'Thumb'], mark: 'em', examples: ['F'], description: ['用拇指拨动转层。', 'Drive the layer with the thumb.'] },
  nail: { key: 'nail', name: ['指甲', 'Fingernail'], mark: 'u', examples: ['S'], description: ['用指甲接触活动贴纸。', 'Use the nail to drive a moving sticker.'] },
  push: pushEntry,
};
const fingerNames = {
  index: ['食指', 'index'], middle: ['中指', 'middle'], thumb: ['拇指', 'thumb'], ring: ['无名指', 'ring'], pinky: ['小指', 'little finger'],
} as const;
function methodLabel(method: LessonMethod, t: ReturnType<typeof useT>) {
  const hand = method.hand === 'R' ? t('右手', 'Right hand') : t('左手', 'Left hand');
  const first = t(fingerNames[method.finger][0], fingerNames[method.finger][1]);
  const second = method.second ? t(fingerNames[method.second][0], fingerNames[method.second][1]) : '';
  let action = t(`${first}拨动`, `${first} flick`);
  if (second) action = t(`${first}起拨，${second}接第二拨`, `${first} first, then ${second}`);
  else if (method.push) action = t(`${first}推`, `${first} push`);
  else if (method.style === 'sliceNailDouble') action = t(`${first}甲连拨两次`, `two flicks with the ${first} nail`);
  else if (method.nail && !method.rollsToNail) action = t(`${first}甲拨动`, `${first} nail flick`);
  const surface = second && method.nail && !method.rollsToNail ? t('指甲接力', 'nail relay') : '';
  return [hand, action, surface].filter(Boolean).join(' · ');
}
function setupLabel(method: LessonMethod, t: ReturnType<typeof useT>) {
  return method.setup.map(({ side, grip }) => {
    const [zh, en] = grips[grip];
    return side === 'R' ? t(`右手先换到${zh}`, `Regrip right to ${en}`) : t(`左手先换到${zh}`, `Regrip left to ${en}`);
  }).join(' · ') || t('可直接做', 'Direct');
}

function Example({ entry, text }: { entry: Entry; text: string }) {
  const Tag = entry.mark ?? 'span';
  return <code><Tag>{text}</Tag></code>;
}

type Demo = ReturnType<typeof mountGripDemo>;
export type LessonTransport = Pick<ComponentProps<typeof PlaybackBar>, 'disabled' | 'step' | 'total' | 'playing'
  | 'segmentEnds' | 'scrubValueText' | 'onScrub' | 'onTogglePlay' | 'onSkipStart' | 'onSkipEnd' | 'onStepBack' | 'onStepForward'>;
interface StageProps {
  stage: HTMLElement; mountView: GripDemoMount; rate: number;
  onActive: (active: boolean) => void;
  renderPlaybackBar: (transport: LessonTransport) => ReactNode;
}
function Preview({ actionSlot, hands, startPose, method, playRequest, order, entry, example, contact, compare, onCompare, onExample, stage, mountView, rate, onActive, renderPlaybackBar }: StageProps & {
  actionSlot: HTMLDivElement | null; hands: HandsRig; startPose: Pose; method?: LessonMethod; playRequest: number; order: AtlasOrder; entry: Entry; example: string; contact?: ContactComparison; compare: boolean; onCompare: () => void; onExample: (move: string) => void;
}) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Demo | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useLayoutEffect(() => {
    onActive(true);
    return () => onActive(false);
  }, [onActive]);
  const speed = useRef(rate);
  speed.current = rate;
  const [phase, setPhase] = useState<DemoPhase>(() => hands.getLoadState().hands === 'ready' ? 'start' : 'loading');
  const [reference, setReference] = useState(false);
  const [percent, setPercent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [secondStroke, setSecondStroke] = useState(false);
  const [cueIndex, setCueIndex] = useState(0);
  const indexComparison = compare && !!entry.compareIndexSingles;
  const quarter = example.endsWith("'") ? "2U'" : '2U';
  const plain = contact ? contact.reference : indexComparison ? quarter : method?.push ? example.slice(0, -1) : example;
  const playClip = useCallback((ordinary: boolean, seek?: number) => {
    const demo = player.current;
    if (!demo) return;
    setReference(ordinary);
    setPaused(seek !== undefined);
    setPercent(0);
    setCueIndex(0);
    setSecondStroke(false);
    const markedHtml = method?.marks?.reduce((html, tag) => `<${tag}>${html}</${tag}>`, example);
    if (hands.getLoadState().hands === 'error') hands.retryLoad();
    if (entry.grip) {
      const left = example === 'R' ? 'home' : entry.grip;
      const right = example === 'L' ? 'home' : entry.grip;
      demo.play(left, right, null);
      return;
    }
    // The even-order thumb comparison was authored against a plain turn from two home grips.
    // The marked Fw driver owns its temporary down grip, including the return after withdrawal.
    const frontMiddle = method?.style === 'middle-nail-front-wide' || method?.style === 'middle-pad-front-wide';
    const setup = ordinary && contact && method?.marks?.includes('em')
      ? (['L', 'R'] as const).filter(side => startPose[side] !== 'home').map(side => ({ side, grip: 'home' as const }))
      : frontMiddle && !ordinary ? method.setup.filter(step => step.side !== method.hand) : method?.setup;
    demo.play(startPose.L, startPose.R, ordinary ? plain : example, ordinary ? undefined : markedHtml,
      ordinary ? contact?.ordinary : contact?.marked,
      { setup, keepView: ordinary, comparePush: method?.push, relay: indexComparison ? ordinary ? 'two-singles' : 'relay' : undefined });
    if (seek !== undefined) demo.seek(seek);
  }, [hands, startPose, method, entry, example, plain, contact, indexComparison]);

  const start = useRef(playClip);
  start.current = playClip;
  useEffect(() => {
    let cancelled = false;
    void import('./grips/gripDemo').then(({ mountGripDemo }) => {
      if (cancelled || !host.current) return;
      player.current = mountGripDemo(host.current, setPhase, {
        mountView, order, hands,
        onContactCue: setCueIndex, onSecondStroke: () => setSecondStroke(true),
        lessonClock: { rate: () => speed.current, progress: setPercent },
      });
      start.current(false);
    }).catch(() => { if (!cancelled) setPhase('error'); });
    return () => { cancelled = true; player.current?.dispose(); player.current = null; };
  }, [mountView, order, stage, hands, loadAttempt]);

  useLayoutEffect(() => { playClip(false); }, [playClip, compare, playRequest]);
  useEffect(() => {
    if (phase !== 'end' || reference || !compare || paused) return;
    const timer = window.setTimeout(() => playClip(true), 350);
    return () => window.clearTimeout(timer);
  }, [phase, reference, compare, paused, playClip]);

  const step = (reference ? 100 : 0) + percent;
  const total = compare ? 200 : 100;
  const seek = useCallback((value: number) => {
    const ordinary = compare && value >= 100;
    playClip(ordinary, ordinary ? value - 100 : value);
  }, [compare, playClip]);
  const ended = phase === 'end' && (!compare || reference);
  const controls = !entry.grip && renderPlaybackBar({
    disabled: phase === 'loading' || phase === 'error' || phase === 'unavailable',
    step, total, playing: !paused && !ended,
    segmentEnds: compare ? [100, 200] : undefined,
    scrubValueText: reference ? t(`对照动作 ${percent}%`, `Comparison move ${percent}%`)
      : t(`标记动作 ${percent}%`, `Marked move ${percent}%`),
    onTogglePlay() {
      if (ended) { playClip(false); return; }
      player.current?.pause(!paused);
      setPaused(!paused);
    },
    onScrub: seek, onSkipStart: () => seek(0), onSkipEnd: () => seek(total),
    onStepBack: () => seek(Math.max(0, step - 25)), onStepForward: () => seek(Math.min(total, step + 25)),
  });
  function phaseLabel(phase: DemoPhase, marked: boolean) {
    if (contact && phase === 'turn') {
      const cue = marked ? contact.marked.cues[cueIndex] : contact.ordinary.cues[cueIndex];
      if (cue) return (paused ? t('已暂停 · ', 'Paused · ') : '') + t(...cue.finger) + ' · ' + cue.sticker;
    }
    if (paused) return t('已暂停', 'Paused');
    if (indexComparison && phase === 'turn') {
      if (!secondStroke) return t('第一拨 · 食指', 'First flick · index');
      return marked ? t('第二拨 · 中指', 'Second flick · middle') : t('第二拨 · 食指', 'Second flick · index');
    }
    if (marked && method?.second && phase === 'turn') {
      const finger = fingerNames[percent < 50 ? method.finger : method.second];
      return percent < 50 ? t(`第一拨 · ${finger[0]}`, `First flick · ${finger[1]}`) : t(`第二拨 · ${finger[0]}`, `Second flick · ${finger[1]}`);
    }
    return t(demoPhases[phase][0], demoPhases[phase][1]);
  }
  let primaryTitle = method ? methodLabel(method, t) : t(...entry.name);
  let referenceTitle = t('普通转动', 'Plain turn');
  let compareTitle = t('对比普通转动', 'Compare with plain turn');
  if (contact && entry.mark === 'em') {
    primaryTitle = t('拇指上拨', 'Thumb pushes up');
    referenceTitle = t('普通 · 食指下拨', 'Plain · index pushes down');
    compareTitle = t('对比拇指与食指', 'Compare thumb and index');
  } else if (contact) {
    if (order !== 2) primaryTitle = t('指甲接力', 'Nail relay');
    referenceTitle = order === 2 ? t('指甲转指腹', 'Nail to pad') : t('指腹接力', 'Pad relay');
    compareTitle = t('对比指甲与指腹', 'Compare nail and pad');
  } else if (entry.compareIndexSingles) {
    if (compare) {
      primaryTitle = t('中指接力', 'Middle relay');
      referenceTitle = t('食指分两拨', 'Two index flicks');
    }
    compareTitle = t('对比食指分两拨', 'Compare two index flicks');
  }
  function exampleLabel(move: string) {
    if (!entry.grip) return move;
    if (move === 'both') return t('双手', 'Both hands');
    return move === 'R' ? t('右手', 'Right hand') : t('左手', 'Left hand');
  }
  function restart() {
    if (player.current) playClip(false);
    else setLoadAttempt(n => n + 1);
  }
  const hasChoices = !!entry.grip && entry.examples.length > 1;
  const showGripControls = hasChoices || (entry.grip && phase === 'error');
  const captionMove = entry.grip ? entry.key : reference ? (indexComparison ? plain + ' ' + plain : plain) : example;
  return <div className="finger-guide-preview">
    {showGripControls && <div className="finger-guide-examples">
      {hasChoices && <CompactSelect ariaLabel={entry.grip ? t('演示用手', 'Demonstration hand') : t('演示动作', 'Example move')}
        value={example} label={exampleLabel(example)} keyboardListNavigation showArrow triggerClassName="finger-guide-select"
        items={entry.examples.map(move => ({ value: move, label: exampleLabel(move) }))}
        onChange={onExample} />}
      {entry.grip && phase === 'error' && <button type="button" className="skewb-guide-restore" onClick={restart}>
        {t('重新加载', 'Reload')}</button>}
    </div>}
    {!entry.grip && actionSlot && createPortal(<>
      <button type="button" className="skewb-guide-restore" onClick={restart}>
        <Play size={12} />{compare ? t('重播对比', 'Replay comparison') : t('重播', 'Replay')}</button>
      {(method?.marks?.length || method?.push || contact) ? <button type="button" className="skewb-guide-restore" aria-pressed={compare} onClick={onCompare}>
        {compare ? t('退出对比', 'Close comparison') : compareTitle}</button> : null}
    </>, actionSlot)}
    {controls}
    {createPortal(<div className="finger-guide-stage" ref={host} role="group" aria-label={t('指法演示', 'Finger demonstration')}>
      <div className="finger-guide-stage-caption" role="status" data-phase={paused ? 'paused' : phase}>
        <span className="finger-guide-move" data-compact={captionMove.length > 2 || undefined}>
          {entry.grip || reference ? <code>{captionMove}</code> : <code>{method?.marks?.reduce<ReactNode>((text, Tag) => <Tag>{text}</Tag>, captionMove) ?? captionMove}</code>}
        </span>
        <div className="finger-guide-caption-text">
          <strong>{reference && !entry.grip ? referenceTitle : primaryTitle}{entry.grip && hasChoices && ' · ' + exampleLabel(example)}</strong>
          {phase !== 'pose' && <span>{phaseLabel(phase, !reference)}</span>}
        </div>
      </div>
    </div>, stage)}
  </div>;
}

export default function FingerNotationGuide({ order, onOpen, selectedPush, ...stageProps }: StageProps & { order: AtlasOrder; onOpen: () => void; selectedPush?: string }) {
  const t = useT();
  const id = useId();
  const [actionSlot, setActionSlot] = useState<HTMLDivElement | null>(null);
  // Keep the prepared meshes, skeletons and skin textures across teaching sessions.
  const [hands, setHands] = useState<HandsRig | null>(null);
  useEffect(() => () => hands?.dispose(), [hands]);
  const [open, setOpen] = useState(false);
  const [technique, setTechnique] = useState<Technique | null>(null);
  const [nailOnly, setNailOnly] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
  const [grip, setGrip] = useState(gripEntries[2]);
  const [side, setSide] = useState('both');
  const [showPose, setShowPose] = useState(false);
  const [move, setMove] = useState('');
  const [variant, setVariant] = useState('');
  const [playing, setPlaying] = useState(false);
  const [playRequest, setPlayRequest] = useState(0);
  const [compare, setCompare] = useState(false);
  const startPose = useMemo(() => ({
    L: side === 'R' ? homePose.L : grip.grip!, R: side === 'L' ? homePose.R : grip.grip!,
  }), [grip, side]);
  const choices = useMemo(() => technique ? techniqueMoves(order, technique, nailOnly, startPose, directOnly) : [],
    [order, technique, nailOnly, startPose, directOnly]);
  const methods = choices.find(choice => choice.move === move)?.methods;
  const method = methods?.find(m => m.id === variant) ?? methods?.[0];
  const selectedLabel = method && methodLabel(method, t);
  const methodOptions = new Map<string, LessonMethod>();
  for (const candidate of methods ?? []) {
    const label = methodLabel(candidate, t);
    // The catalog orders grip variants by the fewest regrips from the selected pose.
    if (!methodOptions.has(label)) methodOptions.set(label, candidate);
  }
  const contact = method && order !== 3 ? method.marks?.includes('em') ? thumbComparisons[order][method.move]
    : method.marks?.includes('u') ? nailComparisons[method.move] : undefined : undefined;
  const lesson = useMemo(() => {
    if (!technique) return grip;
    return { ...techniques[technique], compareIndexSingles: order === 4 && method?.marks?.includes('s') && /^2U2/.test(move) };
  }, [technique, grip, order, method, move]);
  function stop() { setPlaying(false); setCompare(false); }
  function chooseTechnique(next: Technique) {
    stop(); setMove(''); setVariant(''); setNailOnly(false); setTechnique(next);
  }
  function chip(label: ReactNode, selected: boolean, click: () => void, key: string, title?: string) {
    return <button type="button" key={key} className={'skewb-guide-chip' + (selected ? ' is-active' : '')}
      aria-pressed={selected} onClick={click} title={title}>{label}</button>;
  }
  function playMove(nextMove: string, nextVariant: string) {
    onOpen();
    setMove(nextMove);
    setVariant(nextVariant);
    setCompare(false);
    setPlaying(true);
    setPlayRequest(n => n + 1);
  }
  function moveButton(choice: typeof choices[number]) {
    const selected = choice.move === move;
    const target = selected && method ? method : choice.methods[0];
    return chip(<code>{choice.move.replace("'", '′')}</code>, selected, () => playMove(choice.move, target.id),
      choice.move, methodLabel(target, t) + ' · ' + setupLabel(target, t));
  }
  const columns = [
    { label: t('可直接做', 'Direct'), items: choices.filter(c => !c.methods[0].setup.length) },
    { label: t('需换握', 'Regrip first'), items: choices.filter(c => c.methods[0].setup.length) },
  ].filter(column => column.items.length);
  const groupByLayer = choices.length > 8;
  const rows = (groupByLayer ? atlasCatalog[order].groups : [null]).map(group => ({
    label: group && t(group.zh, group.en),
    cells: columns.map(({ items }) => items.filter(c => !group || group.bases.includes(c.move.replace(/p$/, '').replace(/2'?$|'$/, '')))),
  })).filter(row => row.cells.some(cell => cell.length));
  const halfTurns = choices.filter(c => /2'?$/.test(c.move));
  const middleRelay = technique === 'middle' && halfTurns.length > 0 && halfTurns.every(c => c.methods.every(m => m.second === 'middle'));
  return <div className="skewb-guide finger-guide">
    <MoreToggle className="skewb-guide-toggle" expanded={open} aria-controls={id} onToggle={() => {
      stop();
      if (!open) {
        if (!hands) setHands(new HandsRig());
        onOpen();
        if (selectedPush && pushRule(selectedPush)) { chooseTechnique('push'); setMove(selectedPush); }
      }
      setOpen(!open);
    }}><BookOpen size={13} />{t('指法记号', 'Finger notation')}</MoreToggle>
    <MoreTogglePanel id={id} expanded={open}>
      <div className="skewb-guide-body">
        <div className="skewb-guide-grid">
          <span className="skewb-guide-label">{t('指法', 'Technique')}</span>
          <div className="finger-guide-technique-row">
            <div className="skewb-guide-chips" role="group" aria-label={t('指法', 'Technique')}>
              {(Object.keys(techniques) as Technique[]).map(key => {
                const item = techniques[key];
                return chip(<><Example entry={item} text={item.mark ? item.examples[0] : 'p'} /> {key === 'push' ? t('推法', 'Push') : t(...item.name)}</>,
                  technique === key, () => chooseTechnique(key), key);
              })}
              {(technique === 'middle' || technique === 'thumb') && <label><input type="checkbox" checked={nailOnly}
                onChange={e => { stop(); setNailOnly(e.target.checked); setMove(''); setVariant(''); }} />{t('叠加指甲', 'With fingernail')}</label>}
            </div>
            <div className="finger-guide-actions" ref={setActionSlot} />
          </div>
          {technique && <div className="finger-guide-moves" role="group" aria-label={t('可演示转动', 'Available moves')}>
            <div className="finger-guide-move-heading">
              <strong>{t('可演示转动', 'Available moves')}</strong>
              <label><input type="checkbox" checked={directOnly} onChange={e => { stop(); setDirectOnly(e.target.checked); }} />
                {t('只看当前起手可直接做', 'Only moves available without regripping')}</label>
            </div>
            {!choices.length ? <p className="skewb-guide-caption">{t('此条件下暂无可演示转动。', 'No demonstrations match this selection.')}</p>
              : !groupByLayer && columns.length === 1 ? <div className="skewb-guide-chips">{choices.map(moveButton)}</div>
              : <table className="finger-guide-move-table" aria-label={t('按握姿排列的转动', 'Moves by grip requirement')}>
                <thead><tr>
                  {groupByLayer && <th scope="col">{t('转层', 'Layer')}</th>}
                  {columns.map(column => <th scope="col" key={column.label}>{column.label}</th>)}
                </tr></thead>
                <tbody>{rows.map(row => <tr key={row.label ?? 'all'}>
                  {row.label && <th scope="row">{row.label}</th>}
                  {row.cells.map((cell, i) => <td key={columns[i].label}>
                    <div className="skewb-guide-chips">{cell.map(moveButton)}</div>
                  </td>)}
                </tr>)}</tbody>
              </table>}
            {middleRelay && <small className="skewb-guide-caption">{t('第二步转动用中指做第二拨', 'On the second step, use your middle finger for the second flick.')}</small>}
          </div>}
          <span className="skewb-guide-label">{t('起手', 'Starting grips')}</span>
          <div className="skewb-guide-chips" role="group" aria-label={t('起手', 'Starting grips')}>
            {gripEntries.map(item => chip(<><code>{item.key}</code> {t(...item.name)}</>, item === grip, () => {
              stop(); setGrip(item); setSide(item.examples.includes(side) ? side : item.examples[0]); setShowPose(true); onOpen();
            }, item.key))}
          </div>
        </div>
        {showPose && !playing && <p className="finger-guide-meaning">{t(...grip.description)}</p>}
        {method && <>
          {methodOptions.size > 1 && <div className="skewb-guide-chips" role="group" aria-label={t('具体做法', 'Method')}>
            {Array.from(methodOptions, ([label, candidate]) =>
              chip(label, label === selectedLabel, () => playMove(move, candidate.id), candidate.id))}
          </div>}
          <p className="finger-guide-meaning"><strong>{method.move.replace("'", '′')} · {selectedLabel}</strong></p>
        </>}
        {open && hands && (playing && method || showPose) && <Preview {...stageProps} actionSlot={actionSlot} hands={hands} playRequest={playRequest} order={order}
          entry={playing ? lesson : grip} example={playing && method ? method.move : side} method={playing ? method : undefined}
          startPose={startPose} contact={playing ? contact : undefined} compare={compare}
          onCompare={() => setCompare(value => !value)} onExample={setSide} />}
        {order === 3 && <details><MoreToggle as="summary" className="skewb-guide-toggle">{t('进阶指法注解', 'Advanced finger annotations')}</MoreToggle>
          <div className="finger-guide-annotation">
            <FingerAnnotationExample />
            <div className="finger-guide-annotation-links">
              <AppLink className="skewb-guide-restore finger-guide-example-link" href={pinExampleHref} target="_blank" rel="noopener">
                {t('在模拟器中打开示例', 'Open example in simulator')}<ExternalLink size={14} aria-hidden />
              </AppLink>
              <AppLink className="skewb-guide-restore" href="/sim/finger-annotations" target="_blank" rel="noopener">
                {t('阅读进阶指法注解', 'Read the advanced annotation guide')}<ExternalLink size={14} aria-hidden />
              </AppLink>
            </div>
          </div>
        </details>}
      </div>
    </MoreTogglePanel>
  </div>;
}
