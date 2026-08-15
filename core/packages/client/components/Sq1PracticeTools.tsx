'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAlg, type AlgCase } from '@cuberoot/shared';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import BoolToggle from '@/components/BoolToggle';
import { CaseThumb } from '@/components/CaseThumb';
import Link from '@/components/AppLink';
import { Sq1StateSvg } from '@/components/Sq1StateSvg';
import { tr } from '@/i18n/tr';
import { displaySq1ShapeName, SQ1_SHAPES, sq1ShapeById } from '@/lib/sq1-shapes';
import { persistItem } from '@/lib/safe-storage';
import { DEFAULT_SQ1_COLORS } from '@/lib/sq1-svg';
import {
  filterSq1ShapePairGroups,
  generateSq1ShapeScramble,
  groupSq1ShapePairs,
  pickSq1ShapePair,
  sq1ShapeTrainerRepeatAction,
  sq1CountPositionGroups,
  sq1ShapePreviewState,
  type Sq1GeneratedShapeScramble,
  type Sq1MiddleMode,
  type Sq1ShapePairGroup,
  type Sq1TrainingParity,
} from '@/lib/sq1-tools';
import styles from './Sq1Tools.module.css';

export function Sq1CountPositions() {
  const [shapeId, setShapeId] = useQueryState('shape', parseAsString.withDefault('square'));
  const [requestedPosition, setPosition] = useQueryState('pos', parseAsInteger.withDefault(0));
  const shape = sq1ShapeById(shapeId) ?? SQ1_SHAPES.find((item) => item.id === 'square')!;
  const baseGroups = sq1CountPositionGroups(shape);
  const positions = baseGroups.flat().sort((a, b) => a - b);
  const position = positions.includes(requestedPosition) ? requestedPosition : (positions[0] ?? 0);
  const groups = sq1CountPositionGroups(shape, position);
  const preview = sq1ShapePreviewState(shape, position);
  const movePosition = (direction: -1 | 1) => {
    const index = Math.max(0, positions.indexOf(position));
    const next = positions[(index + direction + positions.length) % positions.length];
    if (next != null) void setPosition(next);
  };
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  return <>
    <label className={styles.field}>
      <span className={styles.label}>{tr({ zh: '单层形状', en: 'Layer shape' })}</span>
      <select className={styles.select} value={shape.id} onChange={(event) => {
        void setShapeId(event.target.value);
        void setPosition(0);
      }}>
        {SQ1_SHAPES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <div className={styles.countExplorer}>
      <div className={styles.countVisual}>
        <div className={styles.countDiagram}>
          <Sq1StateSvg
            state={preview}
            layer="top"
            label={tr({ zh: `${shape.name}，当前位置 ${signed(position)}`, en: `${shape.name}, current position ${signed(position)}` })}
            className={styles.countShapeSvg}
          />
          {groups.flatMap((values, groupIndex) => values.map((value) => {
            const angle = (-60 - value * 30) * Math.PI / 180;
            return (
              <span
                aria-hidden="true"
                className={`${styles.countMarker} ${groupIndex === 0 ? styles.countMarkerA : styles.countMarkerB}${value === 0 ? ` ${styles.countMarkerCurrent}` : ''}`}
                key={`${groupIndex}-${value}`}
                style={{
                  left: `${(50 + Math.cos(angle) * 42).toFixed(4)}%`,
                  top: `${(50 + Math.sin(angle) * 42).toFixed(4)}%`,
                }}
              >
                {signed(value)}
              </span>
            );
          }))}
        </div>
        <div className={styles.countControls}>
          <button className={styles.button} type="button" onClick={() => movePosition(-1)} aria-label={tr({ zh: '上一个可切位置', en: 'Previous sliceable position' })}>−</button>
          <output className={styles.countCurrent} aria-live="polite">
            {tr({ zh: `当前位置 ${signed(position)}`, en: `Position ${signed(position)}` })}
          </output>
          <button className={styles.button} type="button" onClick={() => movePosition(1)} aria-label={tr({ zh: '下一个可切位置', en: 'Next sliceable position' })}>+</button>
        </div>
      </div>
      <div className={styles.countGroups}>
        {groups.map((values, index) => <section className={`${styles.countGroup} ${index === 0 ? styles.countGroupA : styles.countGroupB}`} key={index}>
          <h2>{tr({ zh: `第 ${index + 1} 组`, en: `Group ${index + 1}` })}</h2>
          <div className={styles.countRow}>{values.map((value) => <span className={`${styles.countValue}${value === 0 ? ` ${styles.countValueCurrent}` : ''}`} key={value}>{signed(value)}</span>)}</div>
        </section>)}
      </div>
    </div>
    <p className={styles.hint}>{tr({ zh: '同组数位之间跨过切口的块数为偶数；跨组则为奇数。', en: 'Turns in the same group move an even number of pieces across the cut; changing groups moves an odd number.' })}</p>
  </>;
}

const COLORS = ['O', 'B', 'R', 'G'] as const;
type ColorLetter = (typeof COLORS)[number];
const ODD_ORDERS = new Set(['BOR', 'BRG', 'BGO', 'GBR', 'GOB', 'GRO', 'RBO', 'RGB', 'ROG', 'ORB', 'OGR', 'OBG']);
const COLOR_VALUE: Record<ColorLetter, string> = {
  O: DEFAULT_SQ1_COLORS.B,
  B: DEFAULT_SQ1_COLORS.L,
  R: DEFAULT_SQ1_COLORS.F,
  G: DEFAULT_SQ1_COLORS.R,
};

function randomSequence(): ColorLetter[] {
  const values = [...COLORS];
  for (let index = values.length - 1; index > 0; index--) {
    const pick = Math.floor(Math.random() * (index + 1));
    [values[index], values[pick]] = [values[pick], values[index]];
  }
  return values.slice(0, 3);
}

function parityExplanation(sequence: readonly ColorLetter[]): { missing: ColorLetter; swaps: number } {
  const missing = COLORS.find((color) => !sequence.includes(color))!;
  const order = [...sequence, missing].map((color) => COLORS.indexOf(color));
  let swaps = 0;
  for (let left = 0; left < order.length; left++) {
    for (let right = left + 1; right < order.length; right++) {
      if (order[left] > order[right]) swaps++;
    }
  }
  return { missing, swaps };
}

function hasInteractiveFocus(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"]'));
}

export function Sq1ParityGame() {
  const [sequence, setSequence] = useState<ColorLetter[]>(['O', 'B', 'R']);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const explanation = parityExplanation(sequence);
  const answer = useCallback((odd: boolean) => {
    const isCorrect = ODD_ORDERS.has(sequence.join('')) === odd;
    setCorrect(isCorrect);
    if (isCorrect) {
      setStreak((value) => value + 1);
      setSequence(randomSequence());
    } else setStreak(0);
  }, [sequence]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (hasInteractiveFocus(event.target)) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); answer(true); }
      if (event.key === 'ArrowRight') { event.preventDefault(); answer(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answer]);

  return <>
    <div className={styles.gameSequence} aria-label={sequence.join(' ')}>
      {sequence.map((color) => <span
        className={`${styles.colorTile}${color === 'O' || color === 'G' ? ` ${styles.darkTileText}` : ''}`}
        style={{ backgroundColor: COLOR_VALUE[color] }}
        key={color}
      >{color}</span>)}
    </div>
    <div className={styles.actions}>
      <button type="button" className={styles.choice} onClick={() => answer(true)}>← {tr({ zh: '奇', en: 'Odd' })}</button>
      <button type="button" className={styles.choice} onClick={() => answer(false)}>{tr({ zh: '偶', en: 'Even' })} →</button>
    </div>
    <p className={correct === true ? styles.success : styles.hint} role="status" aria-live="polite">
      {correct == null
        ? tr({ zh: `连续正确：${streak}`, en: `Streak: ${streak}` })
        : correct
          ? tr({ zh: `正确，连续 ${streak} 题`, en: `Correct. Streak: ${streak}` })
          : tr({
            zh: `正确答案：${ODD_ORDERS.has(sequence.join('')) ? '奇' : '偶'}。末尾补 ${explanation.missing} 后，需要 ${explanation.swaps} 次相邻交换回到 O-B-R-G。`,
            en: `Answer: ${ODD_ORDERS.has(sequence.join('')) ? 'odd' : 'even'}. Append ${explanation.missing}; it takes ${explanation.swaps} adjacent swaps to return to O-B-R-G.`,
          })}
    </p>
  </>;
}

interface TrainingCase {
  item: AlgCase;
  top: string;
  bottom: string;
  parity: 'odd' | 'even' | null;
}

interface TrainingRound extends Sq1GeneratedShapeScramble {
  item: AlgCase;
  pairKey: string;
}

function parseTrainingCase(item: AlgCase): TrainingCase | null {
  const parityMatch = item.name.match(/\s*\((Odd|Even)\)\s*$/i);
  const names = item.name.replace(/\s*\((Odd|Even)\)\s*$/i, '').split(/\s*\/\s*/).map(displaySq1ShapeName);
  if (names.length !== 2) return null;
  return {
    item,
    top: names[0],
    bottom: names[1],
    parity: parityMatch ? parityMatch[1].toLowerCase() as 'odd' | 'even' : null,
  };
}

function uniqueOrientations(group: Sq1ShapePairGroup<TrainingCase>) {
  const seen = new Set<string>();
  return group.variants.filter((variant) => {
    const key = `${variant.top}\n${variant.bottom}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function Sq1ShapeTrainer() {
  const allNames = useMemo<Set<string>>(() => new Set(SQ1_SHAPES.map((shape) => shape.name)), []);
  const [cases, setCases] = useState<TrainingCase[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [selectedTop, setSelectedTop] = useState<Set<string>>(() => new Set(allNames));
  const [selectedBottom, setSelectedBottom] = useState<Set<string>>(() => new Set(allNames));
  const [current, setCurrent] = useState<TrainingRound | null>(null);
  const [inspection, setInspection] = useState(false);
  const [middleMode, setMiddleMode] = useState<Sq1MiddleMode>('random');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const generationId = useRef(0);
  const repeatPrefixUntil = useRef(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('sq1:shape-trainer');
      if (raw) {
        const saved = JSON.parse(raw) as {
          top?: string[];
          bottom?: string[];
          inspection?: boolean;
          excluded?: string[];
          middle?: Sq1MiddleMode;
        };
        if (saved.top) setSelectedTop(new Set(saved.top.filter((name) => allNames.has(name))));
        if (saved.bottom) setSelectedBottom(new Set(saved.bottom.filter((name) => allNames.has(name))));
        if (typeof saved.inspection === 'boolean') setInspection(saved.inspection);
        if (saved.excluded) setExcluded(new Set(saved.excluded));
        if (saved.middle === 'random' || saved.middle === 'never' || saved.middle === 'always') setMiddleMode(saved.middle);
      }
    } catch { /* Invalid local data should not block training. */ }
    setLoading(true);
    setError(false);
    Promise.all([loadAlg('sq1', 'cs'), loadAlg('sq1', 'csp')])
      .then((files) => {
        setCases(files.flatMap((file) => file.cases.map(parseTrainingCase).filter((item): item is TrainingCase => item !== null)));
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [allNames, reloadKey]);

  useEffect(() => {
    persistItem('sq1:shape-trainer', JSON.stringify({
      top: [...selectedTop], bottom: [...selectedBottom], inspection, excluded: [...excluded], middle: middleMode,
    }));
  }, [excluded, inspection, middleMode, selectedBottom, selectedTop]);

  useEffect(() => {
    if (countdown == null || countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value == null ? null : value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const allGroups = useMemo(() => groupSq1ShapePairs(cases), [cases]);
  const eligibleGroups = useMemo(() => filterSq1ShapePairGroups(
    allGroups,
    selectedTop,
    selectedBottom,
    excluded,
  ), [allGroups, excluded, selectedBottom, selectedTop]);

  const generateForGroup = useCallback(async (
    group: Sq1ShapePairGroup<TrainingCase>,
    parity?: Sq1TrainingParity,
  ) => {
    const requestId = ++generationId.current;
    setGenerating(true);
    setGenerationError(false);
    setCountdown(null);
    try {
      const generated = await generateSq1ShapeScramble({
        pairKey: group.key,
        allowedOrientations: uniqueOrientations(group),
        parity,
        middle: middleMode,
        previousScramble: current?.scramble,
      });
      if (requestId !== generationId.current) return;
      const representative = group.variants.find((variant) =>
        variant.top === generated.top
        && variant.bottom === generated.bottom
        && variant.parity === generated.parity,
      ) ?? group.variants.find((variant) =>
        variant.top === generated.top && variant.bottom === generated.bottom,
      ) ?? group.variants[0];
      setCurrent({ ...generated, item: representative.item, pairKey: group.key });
      setCountdown(inspection ? 15 : null);
    } catch {
      if (requestId === generationId.current) setGenerationError(true);
    } finally {
      if (requestId === generationId.current) setGenerating(false);
    }
  }, [current?.scramble, inspection, middleMode]);

  const pick = useCallback((groups: readonly Sq1ShapePairGroup<TrainingCase>[] = eligibleGroups) => {
    const group = pickSq1ShapePair(groups);
    if (group) void generateForGroup(group);
  }, [eligibleGroups, generateForGroup]);

  const excludeCurrent = useCallback(() => {
    if (!current) return;
    const key = current.pairKey;
    setExcluded((values) => new Set(values).add(key));
    const remaining = eligibleGroups.filter((group) => group.key !== key);
    const next = pickSq1ShapePair(remaining);
    if (next) void generateForGroup(next);
    else {
      generationId.current++;
      setGenerating(false);
      setCurrent(null);
      setCountdown(null);
    }
  }, [current, eligibleGroups, generateForGroup]);

  const repeat = useCallback(() => {
    if (!current) return;
    const group = eligibleGroups.find((candidate) => candidate.key === current.pairKey);
    if (group) void generateForGroup(group);
  }, [current, eligibleGroups, generateForGroup]);

  const swapGroup = useMemo(() => {
    if (!current) return null;
    const group = allGroups.find((candidate) => candidate.key === current.pairKey);
    if (!group) return null;
    const variants = group.variants.filter((variant) =>
      variant.top === current.bottom && variant.bottom === current.top,
    );
    return variants.length ? { ...group, variants } : null;
  }, [allGroups, current]);

  const swap = useCallback(() => {
    if (!current || !swapGroup) return;
    setSelectedTop((values) => new Set(values).add(current.bottom));
    setSelectedBottom((values) => new Set(values).add(current.top));
    void generateForGroup(swapGroup);
  }, [current, generateForGroup, swapGroup]);

  const pickParity = useCallback((relation: 'same' | 'opposite') => {
    if (!current) return;
    const group = eligibleGroups.find((candidate) => candidate.key === current.pairKey);
    if (!group) return;
    const parity = relation === 'same'
      ? current.parity
      : current.parity === 'odd' ? 'even' : 'odd';
    void generateForGroup(group, parity);
  }, [current, eligibleGroups, generateForGroup]);

  useEffect(() => {
    if (!current) return;
    const group = eligibleGroups.find((candidate) => candidate.key === current.pairKey);
    const orientationAllowed = group?.variants.some((variant) =>
      variant.top === current.top && variant.bottom === current.bottom,
    );
    if (!group || !orientationAllowed) {
      generationId.current++;
      setGenerating(false);
      setCurrent(null);
      setCountdown(null);
    }
  }, [current, eligibleGroups]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (hasInteractiveFocus(event.target)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (event.shiftKey) excludeCurrent(); else pick();
        repeatPrefixUntil.current = 0;
        return;
      }
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const now = Date.now();
      if (key === 'r') {
        event.preventDefault();
        if (repeatPrefixUntil.current > now) {
          repeatPrefixUntil.current = 0;
          repeat();
        } else repeatPrefixUntil.current = now + 1200;
        return;
      }
      if (repeatPrefixUntil.current <= now) return;
      repeatPrefixUntil.current = 0;
      const action = sq1ShapeTrainerRepeatAction(key);
      if (action === 'same-parity') { event.preventDefault(); pickParity('same'); }
      if (action === 'opposite-parity') { event.preventDefault(); pickParity('opposite'); }
      if (action === 'swap-layers') { event.preventDefault(); swap(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [excludeCurrent, pick, pickParity, repeat, swap]);

  const toggle = (which: 'top' | 'bottom', name: string) => {
    const setter = which === 'top' ? setSelectedTop : setSelectedBottom;
    setter((old) => {
      const next = new Set(old);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  if (loading) return <p className={styles.hint}>{tr({ zh: '正在加载 CS/CSP 题库…', en: 'Loading the CS/CSP case library…' })}</p>;
  if (error) return <div className={styles.error} role="alert">
    <p>{tr({ zh: 'CS/CSP 题库加载失败。', en: 'Could not load the CS/CSP case library.' })}</p>
    <button type="button" className={styles.button} onClick={() => setReloadKey((key) => key + 1)}>{tr({ zh: '重新加载', en: 'Reload' })}</button>
  </div>;

  return <>
    <div className={styles.trainerToolbar}>
      <button type="button" className={styles.primary} disabled={!eligibleGroups.length || generating} onClick={() => pick()}>{tr({ zh: '新题', en: 'New scramble' })}</button>
      <BoolToggle value={inspection} onChange={setInspection} label={tr({ zh: '15 秒观察', en: '15-second inspection' })} />
      <label className={styles.trainerSetting}>
        <span>{tr({ zh: '中层', en: 'Middle layer' })}</span>
        <select className={styles.select} value={middleMode} onChange={(event) => setMiddleMode(event.target.value as Sq1MiddleMode)}>
          <option value="random">{tr({ zh: '随机', en: 'Random' })}</option>
          <option value="never">{tr({ zh: '不翻转', en: 'Never flipped' })}</option>
          <option value="always">{tr({ zh: '翻转', en: 'Always flipped' })}</option>
        </select>
      </label>
      {current && <>
        <button type="button" className={styles.button} disabled={generating} onClick={repeat}>{tr({ zh: '同组合再来一题', en: 'Repeat pair' })}</button>
        <button type="button" className={styles.button} disabled={generating} onClick={() => pickParity('same')}>{tr({ zh: '同奇偶', en: 'Same parity' })}</button>
        <button type="button" className={styles.button} disabled={generating} onClick={() => pickParity('opposite')}>{tr({ zh: '反奇偶', en: 'Opposite parity' })}</button>
        <button type="button" className={styles.button} disabled={generating || !swapGroup} onClick={swap}>{tr({ zh: '交换上下层', en: 'Flip layers' })}</button>
        <button type="button" className={styles.button} disabled={generating} onClick={excludeCurrent}>{tr({ zh: '排除当前组合', en: 'Exclude pair' })}</button>
      </>}
      {excluded.size > 0 && <button type="button" className={styles.button} onClick={() => setExcluded(new Set())}>{tr({ zh: '恢复排除题', en: 'Restore excluded' })}</button>}
    </div>
    <p className={styles.hint}>{tr({ zh: '中层选项决定新打乱完成后中层是否翻转。', en: 'The middle-layer option controls whether the new scramble finishes with the middle layer flipped.' })}</p>
    <p className={styles.hint} role="status" aria-live="polite">{tr({ zh: `当前可抽 ${eligibleGroups.length} 种组合。Space 新题，Shift+Space 排除；R R 重复，R S 同奇偶，R O 反奇偶，R F 交换上下层。`, en: `${eligibleGroups.length} shape pairs available. Space: new; Shift+Space: exclude; R R: repeat; R S: same parity; R O: opposite parity; R F: flip layers.` })}</p>
    {generating && <p className={styles.hint} role="status">{tr({ zh: '正在生成新的随机打乱…', en: 'Generating a fresh random scramble…' })}</p>}
    {generationError && <div className={styles.error} role="alert">
      <p>{tr({ zh: '没有生成符合当前选项的打乱，请重试或调整范围。', en: 'Could not generate a scramble for the current options. Try again or adjust the ranges.' })}</p>
      <button type="button" className={styles.button} disabled={!eligibleGroups.length || generating} onClick={() => pick()}>{tr({ zh: '重试', en: 'Retry' })}</button>
    </div>}
    {!eligibleGroups.length && <div className={styles.emptyTrainer} role="status">
      <p>{tr({ zh: '当前范围没有可抽的组合。', en: 'No shape pairs match the current ranges.' })}</p>
      <div className={styles.emptyActions}>
        {selectedTop.size === 0 && <button type="button" className={styles.button} onClick={() => setSelectedTop(new Set(allNames))}>{tr({ zh: '恢复上层范围', en: 'Restore top range' })}</button>}
        {selectedBottom.size === 0 && <button type="button" className={styles.button} onClick={() => setSelectedBottom(new Set(allNames))}>{tr({ zh: '恢复下层范围', en: 'Restore bottom range' })}</button>}
        {excluded.size > 0 && <button type="button" className={styles.button} onClick={() => setExcluded(new Set())}>{tr({ zh: '恢复排除题', en: 'Restore excluded' })}</button>}
        <button type="button" className={styles.button} onClick={() => {
          setSelectedTop(new Set(allNames));
          setSelectedBottom(new Set(allNames));
          setExcluded(new Set());
        }}>{tr({ zh: '恢复全部范围', en: 'Restore all ranges' })}</button>
      </div>
    </div>}
    {current ? <div className={styles.trainerStage}>
      <div className={styles.trainerThumb}>
        <CaseThumb puzzle="sq1" set="csp" sticker={current.item.sticker} alg={current.item.algs[0]?.[0]?.alg ?? ''} setup={current.scramble} size={280} alt={`${current.top} / ${current.bottom}`} />
      </div>
      <div>
        {countdown != null && countdown > 0 ? <>
          <p className={styles.countdown}>{countdown}</p>
          <p className={styles.hint}>{tr({ zh: '观察形状，倒计时结束后显示答案。', en: 'Study the shapes. The answer appears when inspection ends.' })}</p>
        </> : <>
          <h2>{current.top} / {current.bottom} ({current.parity === 'odd' ? tr({ zh: '奇', en: 'Odd' }) : tr({ zh: '偶', en: 'Even' })})</h2>
          <p className={styles.scramble}>{current.scramble}</p>
          <p className={styles.hint}>{current.middleFlipped ? tr({ zh: '中层：翻转', en: 'Middle layer: flipped' }) : tr({ zh: '中层：不翻转', en: 'Middle layer: not flipped' })}</p>
          <Link className={styles.compactLink} href="/alg/sq1/csp" prefetch={false}>{tr({ zh: '查看对应公式库', en: 'Open the algorithm set' })}</Link>
        </>}
      </div>
    </div> : eligibleGroups.length > 0 && !generating ? <p className={styles.hint}>{tr({ zh: '点击“新题”生成练习打乱；需要时再调整下方范围。', en: 'Select New scramble to generate a practice case. Adjust the ranges below only when needed.' })}</p> : null}
    <div className={styles.shapeFilters}>
      {(['top', 'bottom'] as const).map((which) => {
        const selected = which === 'top' ? selectedTop : selectedBottom;
        const setter = which === 'top' ? setSelectedTop : setSelectedBottom;
        return <details className={styles.shapeFilter} key={which}>
          <summary>{which === 'top' ? tr({ zh: `上层范围 ${selected.size}/29`, en: `Top layer ${selected.size}/29` }) : tr({ zh: `下层范围 ${selected.size}/29`, en: `Bottom layer ${selected.size}/29` })}</summary>
          <div className={styles.shapeButtons}>
            <button type="button" className={styles.shapeButton} onClick={() => setter(new Set(allNames))}>{tr({ zh: '全选', en: 'All' })}</button>
            <button type="button" className={styles.shapeButton} onClick={() => setter(new Set())}>{tr({ zh: '清空', en: 'None' })}</button>
            {SQ1_SHAPES.map((shape) => <button
              type="button"
              key={shape.id}
              aria-pressed={selected.has(shape.name)}
              className={`${styles.shapeButton}${selected.has(shape.name) ? ` ${styles.shapeSelected}` : ''}`}
              onClick={() => toggle(which, shape.name)}
            >{shape.name}</button>)}
          </div>
        </details>;
      })}
    </div>
  </>;
}
