'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpen, Columns2, Play } from 'lucide-react';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { pushRules, pushRule } from '@/lib/push-notation';
import type { FingerMark } from '@/lib/alg-finger-marks';
import { findGripMarks, stripGripMarks } from '@cuberoot/shared/alg-notation';
import { evenFingerExamples } from './evenFingerNotation';
import { nailComparisons, thumbComparisons, type ContactComparison } from './grips/contactComparisons';
import { regripComparison, type RegripComparison } from './grips/regripComparison';
import { demoPhases, grips, type AtlasOrder } from './grips/catalog';
import type { DemoPhase, mountGripDemo } from './grips/gripDemo';
import type { GripName } from './engine/hands/handsRig';

type Label = readonly [string, string];
interface Entry {
  key: string;
  name: Label;
  description: Label;
  examples: string[];
  mark?: FingerMark;
  rightStart?: GripName;
  compareIndexSingles?: boolean;
  compareRegrip?: boolean;
  input?: Label;
}
const pushEntry: Entry = { key: 'p', name: ['推', 'Push'], examples: pushRules.map(rule => rule.token),
      description: ["双手中握时，U'p 指定右食指推顶层。Up 用左食指，Dp 用右无名指，D'p 用左无名指。", "From home grip, U'p calls for a right index push. Up uses the left index, Dp the right ring finger, and D'p the left ring finger."],
      input: ["选中或高亮 U、U'、D 或 D'，在虚拟键盘的记号菜单点 p，再点一次取消。手动输入时把 p 紧接在转动后，例如 U'p。", "Select or highlight U, U', D or D' and choose p in the keyboard’s marks menu. Choose it again to remove it. When typing, attach p directly to the move, as in U'p."] };
const regripEntries: Entry[] = [
  { key: '↑', name: ['上握', 'Up'], examples: ['↑U', '↑ U'],
    description: ['↑U 先让右手上握，↑ U 先让左手上握。两例都是换握完成后再转 U。', 'In ↑U the right hand regrips up. In ↑ U the left hand does. Both then turn U.'] },
  { key: '↓', name: ['下握', 'Down'], examples: ['↓F', '↓ F'],
    description: ['↓F 先让右手下握，↓ F 先让左手下握，然后转 F。', 'In ↓F the right hand regrips down. In ↓ F the left hand does. Both then turn F.'] },
  { key: '·', name: ['中握', 'Home'], examples: ['·U'], rightStart: 'up',
    description: ['回到中握。此例从右手上握开始，右手先回中握，再转 U。', 'Return to the home grip. Here the right hand starts up, returns home, then turns U.'] },
  { key: '↑↑', name: ['向上半转握', 'Half via up'], examples: ['↑↑U'],
    description: ['右手经上握绕到半转握姿，换握占一步，魔方保持原位。接着转 U。', 'The right hand moves through the up grip into a half-turn grip. The cube stays still during this step, then U turns.'] },
  { key: '↓↓', name: ['向下半转握', 'Half via down'], examples: ['↓↓U'],
    description: ['右手经下握绕到半转握姿，接着转 U。与 ↑↑ 对照时，留意手腕绕行的方向。', 'The right hand moves through the down grip into a half-turn grip, then U turns. Compare the wrist path with ↑↑.'] },
  { key: '↑｜↑', name: ['双手上握', 'Both up'], examples: ['↑｜↑ U'],
    description: ['先右手上握，再左手上握，最后转 U。竖线两边各占一步。', 'Regrip up with the right hand, then the left, then turn U. Each side of the bar takes one step.'] },
  { key: '↓｜↓', name: ['双手下握', 'Both down'], examples: ['↓｜↓ U'],
    description: ['先右手下握，再左手下握，最后转 U。也可以混合方向，如 ↑｜↓。', 'Regrip down with the right hand, then the left, then turn U. The directions can differ, as in ↑｜↓.'] },
];
const evenRegrips: Entry[] = regripEntries.map(entry => ({
  ...entry, compareRegrip: true,
  examples: entry.key.includes('｜') ? [entry.key + ' R'] : [entry.key + 'R', entry.key + ' R'],
}));

const groups: { name: Label; entries: Entry[] }[] = [
  { name: ['用指与接触', 'Finger & contact'], entries: [
    { key: 'middle', name: ['中指', 'Middle finger'], mark: 's', examples: ['U'],
      description: ['删除线指定中指。做这个 U 时，右中指从背面拨动顶层，左手稳住魔方。', 'Strikethrough selects the middle finger. For this U, the right middle finger flicks the top layer from the back while the left hand steadies the cube.'] },
    { key: 'thumb', name: ['拇指', 'Thumb'], mark: 'em', examples: ['F'],
      description: ['斜体指定拇指。做这个 F 时，左拇指从下方向上拨动前层。', 'Italics select the thumb. For this F, the left thumb pushes the front layer upward from below.'] },
    { key: 'nail', name: ['指甲', 'Fingernail'], mark: 'u', examples: ['S'],
      description: ['下划线指定用指甲接触贴纸。做这个 S 时，左食指用甲尖顶动中层。叠加删除线表示中指甲，叠加斜体表示拇指甲。', 'An underline marks fingernail contact. For this S, the left index nail pushes the standing slice. Combine underline with strikethrough for the middle fingernail, or italics for the thumbnail.'] },
  ] },
  { name: ['换握', 'Regrip'], entries: regripEntries },
  { name: ['推法', 'Push'], entries: [
    pushEntry,
  ] },
];

const evenThumb: Entry = {
  key: 'thumb', name: ['拇指', 'Thumb'], mark: 'em', examples: evenFingerExamples[2].em,
  description: ['双手中握起手。斜体转动时，发力手先换下握，用拇指指腹上拨。普通转动时，另一只手的食指越过顶面向下拨。',
    'Start with both hands in home grip. For the italic turn, the driving hand regrips down and pushes up with the thumb pad. For the plain turn, the other index reaches over the top and pushes down.'],
};
const evenContacts: Record<2 | 4, Entry[]> = {
  2: [
    { key: 'middle', name: ['中指', 'Middle finger'], mark: 's', examples: evenFingerExamples[2].s,
      description: ['从双手中握开始，U2 用右手，U2′ 用左手。发力手先上握，食指先拨 90°，中指接第二个 90°，随后恢复原握姿。以还原态为例，右手从 B0 接到 L0，左手从 B1 接到 R1。',
        'From home grip, use the right hand for U2 or the left for U2′. The driving hand regrips up. The index turns the first 90° and the middle finger takes the next 90°, then the wrist returns. From solved, the right hand goes from B0 to L0 and the left from B1 to R1.'] },
    evenThumb,
    { key: 'nail', name: ['指甲', 'Fingernail'], mark: 'u', examples: evenFingerExamples[2].u,
      description: ['双手中握时，普通 U 和 U′ 也会在约 65° 从指腹滚到指甲。对照的推法转动同一层、方向相同，在 45° 至 60° 从指甲滚到指腹。',
        'From home grip, plain U and U′ also roll from pad to nail around 65°. The comparison push turns the same layer in the same direction and rolls from nail to pad between 45° and 60°.'] },
  ],
  4: [
    { key: 'middle', name: ['中指', 'Middle finger'], mark: 's', examples: evenFingerExamples[4].s, compareIndexSingles: true,
      description: ['双手中握时，普通 2U2 也用食指起拨、中指接力。删除线明确指定第二拨用中指。对比时看 90° 处：连续半转由中指接住下一张贴纸；把同一层分两次各拨 90°，则由食指收回再拨。',
        'From home grip, a plain 2U2 already uses the index then the middle finger. Strikethrough specifies the middle finger for the second stroke. Watch the 90° handoff: in the half turn the middle finger takes the next sticker. In two separate quarter turns the index returns to flick again.'] },
    evenThumb,
    { key: 'nail', name: ['指甲', 'Fingernail'], mark: 'u', examples: evenFingerExamples[4].u,
      description: ['双手中握时，普通 2R2′ 和 2L2 也用指甲接力。对照动作沿相反方向转同一内层 180°，由同手的无名指和小指用指腹接力。两边终态相同。',
        'From home grip, plain 2R2′ and 2L2 already use a nail relay. The comparison turns the same inner slice 180° the other way, using the pads of the same ring and little fingers. Both end in the same cube state.'] },
  ],
};

function inputHint(entry: Entry, t: ReturnType<typeof useT>) {
  if (entry.input) return t(...entry.input);
  if (entry.mark) return t(
    `选中完整转动，打开虚拟键盘 Tab 左侧的记号菜单，点「${entry.name[0]}」。再点一次可取消。`,
    `Select a whole move, open the marks menu to the left of Tab on the virtual keyboard, and choose ${entry.name[1]}. Select it again to remove it.`);
  if (entry.key.includes('｜')) return t('在记号菜单中选双手记号，或用 ｜ 或 | 连接右手和左手的记号。', 'Choose a two-hand mark in the menu, or join the right and left marks with ｜ or |.');
  const half = entry.key === '↑↑' || entry.key === '↓↓';
  return t('从记号菜单选取，或直接输入。紧贴后续转动指定右手，留空格指定左手。', 'Choose the mark in the menu or type it. Touching the next move selects the right hand. A space selects the left.') + ' ' +
    (half ? t('写在末尾时，无空格为右手，有空格为左手。', 'At the end, no space means right and a trailing space means left.')
      : t('单独写在末尾时指定左手。', 'At the end it selects the left hand.'));
}

function pushContactHint(order: AtlasOrder, rule: typeof pushRules[number], t: ReturnType<typeof useT>) {
  const upper = rule.layer === 'high';
  const row = upper ? t('上排', 'top row') : t('下排', 'bottom row');
  if (order === 2) return t(`用指甲抵住 ${rule.hand} 面${row}靠前的角块贴纸，向背面推转。`,
    `Push the front corner sticker in the ${row} of the ${rule.hand} face toward the back with your nail.`);
  if (order === 4) return t(`在 ${rule.hand} 面${row}中间两张翼棱贴纸中，用指甲抵住靠前的一张，向背面推转。`,
    `Use your nail on the front one of the two wing stickers in the ${row} of the ${rule.hand} face and push toward the back.`);
  return t(`用指甲抵住 ${rule.hand} 面${row}中间的贴纸，向背面推转。`,
    `Push the middle sticker in the ${row} of the ${rule.hand} face toward the back with your nail.`);
}

function Example({ entry, text }: { entry: Entry; text: string }) {
  const Tag = entry.mark ?? 'span';
  return <code><Tag>{text}</Tag></code>;
}

type Demo = ReturnType<typeof mountGripDemo>;
function Preview({ order, entry, example, contact, regrip, compare, onCompare, onExample }: {
  order: AtlasOrder; entry: Entry; example: string; contact?: ContactComparison; regrip?: RegripComparison; compare: boolean; onCompare: () => void; onExample: (move: string) => void;
}) {
  const t = useT();
  const primary = useRef<HTMLDivElement>(null);
  const ordinary = useRef<HTMLDivElement>(null);
  const players = useRef<Demo[]>([]);
  const waiting = useRef<((atMs: number) => void) | null>(null);
  const [run, setRun] = useState(0);
  const [phases, setPhases] = useState<DemoPhase[]>(['loading', 'loading']);
  const [paused, setPaused] = useState(false);
  const [gripStep, setGripStep] = useState(0);
  const indexComparison = compare && !!entry.compareIndexSingles;
  const [secondStroke, setSecondStroke] = useState(false);
  const [cueIndices, setCueIndices] = useState([0, 0]);
  const quarter = example.endsWith("'") ? "2U'" : '2U';
  const plain = contact ? contact.reference : indexComparison ? quarter : entry.key === 'p' ? example.slice(0, -1) : stripGripMarks(example).trim();

  useEffect(() => () => {
    waiting.current = null;
    players.current.forEach(player => player.dispose());
    players.current = [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    waiting.current = null;
    setPaused(false);
    setSecondStroke(false);
    setGripStep(0);
    const whenBothReady = (advance: (atMs: number) => void) => {
      const first = waiting.current;
      if (!first) { waiting.current = advance; return; }
      waiting.current = null;
      const atMs = performance.now();
      first(atMs);
      advance(atMs);
    };
    void import('./grips/gripDemo').then(({ mountGripDemo }) => {
      if (cancelled || !primary.current || (compare && !ordinary.current)) return;
      if (!players.current.length) {
        const hosts = compare ? [primary.current, ordinary.current!] : [primary.current];
        hosts.forEach((host, i) => {
          const player = mountGripDemo(host, phase => {
            setPhases(previous => previous.map((value, slot) => slot === i ? phase : value));
            if (phase === 'error' || phase === 'unavailable') players.current.forEach(p => p.pause(true));
          }, {
            regripDemo: entry.compareRegrip, onGripStep: entry.compareRegrip && i === 0 ? setGripStep : undefined,
            order, comparePush: entry.key === 'p',
            upperRelayComparison: indexComparison ? (i === 0 ? 'relay' : 'two-singles') : undefined,
            onSecondStroke: indexComparison && i === 0 ? () => setSecondStroke(true) : undefined,
            whenBothReady: compare ? whenBothReady : undefined,
            onOrbit: compare ? (dx, dy) => players.current[1 - i]?.orbitBy(dx, dy) : undefined,
            onContactCue: index => setCueIndices(previous => previous[i] === index ? previous
              : previous.map((value, slot) => slot === i ? index : value)),
          });
          players.current.push(player);
        });
      }
      const tag = entry.mark;
      const left = regrip?.start.L ?? 'home';
      const right = regrip?.start.R ?? entry.rightStart ?? 'home';
      players.current[0].play(left, right, example, tag ? `<${tag}>${example}</${tag}>` : undefined, contact?.marked);
      players.current[1]?.play(left, right, plain, undefined, contact?.ordinary);
    }).catch(() => {
      if (cancelled) return;
      players.current.forEach(player => player.dispose());
      players.current = [];
      setPhases(['error', 'error']);
    });
    return () => { cancelled = true; };
  }, [order, entry, example, plain, compare, indexComparison, contact, regrip, run]);

  const visiblePhases = compare ? phases : phases.slice(0, 1);
  const canPause = visiblePhases.every(p => !['loading', 'error', 'unavailable'].includes(p))
    && visiblePhases.some(p => p !== 'end');
  function phaseLabel(phase: DemoPhase, marked: boolean) {
    if (regrip) {
      const step = regrip.steps[gripStep];
      let cue: Label | undefined;
      if (phase === 'start' || (!marked && phase === 'prepare')) cue = regrip.startLabel;
      if (step && marked && phase === 'regrip') cue = step.moving;
      if (step && marked && phase === 'gripped') cue = step.seated;
      if (phase === 'turn') {
        const support = grips[(marked ? regrip.after : regrip.start).L];
        cue = [`右手转 R · 左手${support[0]}`, `Right turns R · left stays ${support[1].toLowerCase()}`];
      }
      if (cue) return (paused ? t('已暂停 · ', 'Paused · ') : '') + t(...cue);
    }
    if (contact && phase === 'turn') {
      const cue = marked ? contact.marked.cues[cueIndices[0]] : contact.ordinary.cues[cueIndices[1]];
      if (cue) return (paused ? t('已暂停 · ', 'Paused · ') : '') + t(...cue.finger) + ' · ' + cue.sticker;
    }
    if (paused) return t('已暂停', 'Paused');
    if (indexComparison && phase === 'turn') {
      if (!secondStroke) return t('第一拨 · 食指', 'First flick · index');
      return marked ? t('第二拨 · 中指', 'Second flick · middle') : t('第二拨 · 食指', 'Second flick · index');
    }
    return t(demoPhases[phase][0], demoPhases[phase][1]);
  }
  let primaryTitle = t(...entry.name);
  let referenceTitle = t('普通转动', 'Plain turn');
  let compareTitle = t('对比普通转动', 'Compare with plain turn');
  if (regrip) {
    primaryTitle = t('换握后', 'After regrip');
    referenceTitle = t('原握姿', 'Original grip');
    compareTitle = t('对比换握前后', 'Compare before and after');
  } else if (contact && entry.mark === 'em') {
    primaryTitle = t('拇指上拨', 'Thumb pushes up');
    referenceTitle = t('普通 · 食指下拨', 'Plain · index pushes down');
    compareTitle = t('对比拇指与食指', 'Compare thumb and index');
  } else if (contact) {
    primaryTitle = order === 2 ? t('指腹转指甲', 'Pad to nail') : t('指甲接力', 'Nail relay');
    referenceTitle = order === 2 ? t('指甲转指腹', 'Nail to pad') : t('指腹接力', 'Pad relay');
    compareTitle = t('对比指甲与指腹', 'Compare nail and pad');
  } else if (entry.compareIndexSingles) {
    if (compare) {
      primaryTitle = t('中指接力', 'Middle relay');
      referenceTitle = t('食指分两拨', 'Two index flicks');
    }
    compareTitle = t('对比食指分两拨', 'Compare two index flicks');
  }
  return <div className="finger-guide-preview">
    <div className="finger-guide-examples">
      {entry.examples.length > 1 && <select className="sim-puzzle-select sim-preset-select finger-guide-select" aria-label={t('演示动作', 'Example move')} value={example}
        onChange={event => onExample(event.target.value)}>
        {entry.examples.map(move => <option key={move} value={move}>{move}{entry.compareRegrip &&
          (findGripMarks(move)[0].side === 'R' ? t(' · 右手', ' · right hand') : t(' · 左手', ' · left hand'))}</option>)}
      </select>}
      <button type="button" className="skewb-guide-restore" onClick={() => setRun(n => n + 1)}>
        <Play size={12} />{t('重播', 'Replay')}</button>
      {canPause && <button type="button" className="skewb-guide-restore" onClick={() => {
        const atMs = performance.now();
        players.current.forEach(player => player.pause(!paused, atMs));
        setPaused(!paused);
      }}>{paused ? t('继续', 'Resume') : t('暂停', 'Pause')}</button>}
      <button type="button" className="skewb-guide-restore" aria-pressed={compare} onClick={onCompare}>
        <Columns2 size={13} />{compare ? t('退出对比', 'Close comparison') : compareTitle}</button>
    </div>
    <div className="finger-guide-views">
      {visiblePhases.map((phase, i) => <figure key={i}>
        <figcaption><span>{i === 0 ? <><Example entry={entry} text={example} /> · {primaryTitle}</>
          : <><code>{indexComparison ? plain + ' ' + plain : plain}</code> · {referenceTitle}</>}</span>
          <span className="skewb-guide-caption" role="status">{phaseLabel(phase, i === 0)}</span>
        </figcaption>
        <div ref={i === 0 ? primary : ordinary} className="finger-guide-canvas" role="img"
          aria-label={i === 0 ? t('指法演示', 'Marked turn animation') : t(`${referenceTitle}演示`, `${referenceTitle} animation`)} />
      </figure>)}
    </div>
  </div>;
}

export default function FingerNotationGuide({ order, onOpen, selectedPush }: { order: AtlasOrder; onOpen: () => void; selectedPush?: string }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState(order === 3 ? groups[0].entries[0] : evenThumb);
  const [pushToken, setPushToken] = useState<string>(pushRules[0].token);
  const rule = pushRule(pushToken)!;
  const [example, setExample] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const sample = entry.key === 'p' ? rule.token : entry.examples[0];
  const selectedMove = example ?? sample;
  const regrip = useMemo(() => entry.compareRegrip ? regripComparison(selectedMove) : undefined, [entry, selectedMove]);
  let contact: ContactComparison | undefined;
  if (order !== 3) {
    if (entry.mark === 'em') contact = thumbComparisons[order][selectedMove];
    if (entry.mark === 'u') contact = nailComparisons[selectedMove];
  }
  return <div className="skewb-guide finger-guide">
    <MoreToggle className="skewb-guide-toggle" expanded={open} aria-controls={id} onToggle={() => {
      setCompare(false);
      if (open) setExample(null);
      else {
        onOpen();
        if (selectedPush) {
          setEntry(pushEntry);
          setPushToken(selectedPush);
        }
      }
      setOpen(!open);
    }}><BookOpen size={13} />{t('指法记号', 'Finger notation')}</MoreToggle>
    <MoreTogglePanel id={id} expanded={open}>
      <div className="skewb-guide-body">
        <div className="skewb-guide-grid">{groups.map(group => <Fragment key={group.name[1]}>
          <span className="skewb-guide-label">{t(...group.name)}</span>
          <div className="skewb-guide-chips" role="group" aria-label={t(...group.name)}>{(order !== 3 && group.entries[0].mark ? evenContacts[order] : order !== 3 && group.entries === regripEntries ? evenRegrips : group.entries).map(item =>
            <button type="button" key={item.key} className={'skewb-guide-chip' + (entry === item ? ' is-active' : '')}
              aria-pressed={entry === item} onClick={() => {
                setEntry(item);
                setExample(item.key === 'p' ? rule.token : item.examples[0]);
                setCompare(false);
              }}>
              <Example entry={item} text={item.mark ? item.examples[0] : item.key} /> {t(...item.name)}
            </button>)}</div>
        </Fragment>)}</div>
        {!example && <div className="finger-guide-examples"><button type="button" className="skewb-guide-restore"
          onClick={() => setExample(sample)}><Play size={12} />{t('播放', 'Play')} <Example entry={entry} text={sample} /></button></div>}
        <p className="finger-guide-meaning">{entry.key === 'p'
          ? <><code>{rule.token}</code> · {t(rule.label[0], rule.label[1])}{t('。', '. ')}{pushContactHint(order, rule, t)}{t('双腕和左右中指保持中握，转到 45° 至 60° 时逐渐换用指腹，继续推同一张贴纸。', ' Keep both wrists and middle fingers in their home positions. Between 45° and 60°, roll onto the finger pad and finish pushing the same sticker.')}</>
          : regrip ? regrip.steps.map(step => t(...step.watch)).join(' ') : t(...entry.description)}</p>
        {regrip && <p className="skewb-guide-caption">{t('换握时魔方静止。对比中，原握姿一栏等候就位，两栏再同时由右手转 R，左手稳住魔方。', 'The cube stays still during the regrip. The original-grip view waits, then both right hands turn R together while the left hands support the cube.')}</p>}
        {contact && <p className="skewb-guide-caption">{t(...contact.watch)}{entry.mark === 'u' && ' ' + t('描边标出当前发力的贴纸。', 'The outline follows the driving sticker.')}</p>}
        {entry.compareIndexSingles && <p className="skewb-guide-caption">{(example ?? sample).endsWith("'")
          ? t('2U2′ 用左手。从还原态起拨，左食指拨 B7，左中指接 R7。', 'For 2U2′ use the left hand. From solved, the index starts on B7 and the middle takes R7.')
          : t('2U2 用右手。从还原态起拨，右食指拨 B4，右中指接 L4。', 'For 2U2 use the right hand. From solved, the index starts on B4 and the middle takes L4.')}</p>}
        <p className="skewb-guide-caption">{inputHint(entry, t)}</p>
        {open && example && <Preview key={entry.key + compare} order={order} entry={entry} example={example} contact={contact} regrip={regrip} compare={compare}
          onCompare={() => setCompare(value => !value)} onExample={move => {
            if (entry.key === 'p') setPushToken(move);
            setExample(move);
          }} />}
        {order === 3 && <details><MoreToggle as="summary" className="skewb-guide-toggle">{t('进阶指法注解', 'Advanced finger annotations')}</MoreToggle>
          <div className="finger-guide-annotation">
            <p>{t('转动右层时，右手食指一直贴着同一张贴纸。', 'Keep your right index finger on the same sticker as you turn the right face.')}</p>
            <code>{'R[R2:@C>Q]'}</code>
            <dl>
              <dt><code>R</code></dt><dd>{t('右层顺时针转四分之一圈。', 'Turn the right face a quarter turn clockwise.')}</dd>
              <dt><code>R2:</code></dt><dd>{t('方括号内的 R2 指右手食指，冒号后写它的接触位置。', 'Inside the brackets, R2 means the right index finger. Its contact position follows the colon.')}</dd>
              <dt><code>@C</code></dt><dd>{t('指尖贴住 C，也就是右前上角块朝上的贴纸。', 'Place the fingertip on C, the top sticker of the upper front right corner.')}</dd>
              <dt><code>{'>Q'}</code></dt><dd>{t('跟着这张贴纸转到 Q。', 'Follow that sticker to position Q.')}</dd>
            </dl>
            <p>{t('省略终点可写作', 'With the endpoint omitted, write')} <code>{'R[R2:@C]'}</code>{t('。输入时整条记号连写。', '. Type the notation without spaces.')}</p>
          </div>
        </details>}
      </div>
    </MoreTogglePanel>
  </div>;
}
