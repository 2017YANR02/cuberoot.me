'use client';

/**
 * GenDiffConfig — 随机状态来源的「难度」子面板(3×3 族项目)。
 *
 * 与真题来源的难度筛(components/WcaSourceConfig)刻意同一套控件与口径:底色子集 + 方法 + 阶段 +
 * 步数区间。差别在实现 —— 那边是**从真题里筛**,这边是**直接生成**该难度的状态(lib/cross-trainer),
 * 所以真题库里稀有到查无的档(六色十字 0 步、10 步 XCross)这边照样出得来,且不需要网络。
 *
 * 多出来的一维是 F2L 槽位(or18 训练器的口径:定色 + 定槽)。选了多个底色时槽位序号在各色之间指的
 * 不是同一个槽,没有共同含义 → 直接隐掉,按「四槽取最优」算(= /scramble/stats 的 XCross 口径)。
 */

import { Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  dataVariantOfStage,
  stageLabel,
  TIMER_RANDOM_DIFFICULTY_BEST_SLOT,
  uiStagesOf,
  uiVariantOf,
  uiVariantOptions,
  variantLabel,
  type TimerRandomDifficultySettings,
} from '@cuberoot/shared/timer';
import {
  canTrain,
  facesOfSubset,
  trainerCaps,
  trainerSlotOptions,
  trainerStagesOf,
} from '@cuberoot/puzzle-solvers/cross-trainer';
import {
  snapAllowed,
  trainerDepthBounds,
} from '@cuberoot/puzzle-solvers/cross-trainer/reach';
import { SubsetColorPicker, useSubsetSelection, type TimerUiLanguage } from './TimerColorSubsetPicker';
import { TimerPillToggle } from './TimerPillToggle';
import { TimerRangeSlider } from './TimerRangeSlider';
import { usePanelClamp } from './usePanelClamp';
import { usePopoverDismiss } from './usePopoverDismiss';

export interface TimerRandomDifficultyConfigProps {
  disabled?: boolean;
  language: TimerUiLanguage;
  settings: TimerRandomDifficultySettings;
  onChange: (patch: Partial<TimerRandomDifficultySettings>) => void;
  /** 「难度」开关的落点(计时器顶栏)。同 WcaSourceConfig 的 toggleSlot,不传就留在本组件顶行。 */
  toggleSlot?: HTMLElement | null;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 把升序整数列压成连续区间:[9] → [[9,9]];[3,4,5,9] → [[3,5],[9,9]]。 */
function spans(xs: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && x === last[1] + 1) last[1] = x;
    else out.push([x, x]);
  }
  return out;
}

/**
 * 方法 / 阶段下拉走**站内的 UI 聚合**(lib/scramble-variants),不是引擎的数据变体列表:
 * 数据层的 `eoline`(纯 EO / EOLine)并进「EO」方法,`222` 并进「砖」—— 与 /scramble/solver、
 * 首页近期打乱、真题难度筛看到的一模一样。存回设置的仍是数据变体(引擎按它查表)。
 */
const stagesOfMethod = (method: string): string[] =>
  uiStagesOf(method).filter((s) => canTrain(dataVariantOfStage(method, s), s));

/**
 * 换方法 / 换阶段时一并归零的两项。**槽位必须跟着清**:槽序号在阶段之间不通用(XCross 配对有 12
 * 个有序槽对,砖只有 4 个块),留着旧值会让面板显示「最优槽」、`trainerSpecOf` 却按定槽生成 ——
 * 难度上限还跟着变(砖定槽到 8 步、最优槽只到 7),而用户在下拉里根本点不回来:「最优槽」已经是
 * 当前选中项,再点一次不触发 change。
 */
const RESET = {
  genDiffSteps: [] as number[],
  genDiffSlot: TIMER_RANDOM_DIFFICULTY_BEST_SLOT,
};

const COPY = {
  answerWhy: {
    en: 'The axis runs to {god} because that difficulty really exists — the site\'s own data contains such states.\nBut deeper bands hold ever fewer states, and multi-colour / best-slot needs every colour and every slot to be that deep at once, which a uniform draw never hits. Where the whole band can be listed (40 states for six-colour cross at 8, 438 for six-colour XCross at 10) cases come straight off that list; only the bands we cannot list are greyed out.',
    zh: '刻度画到 {god} 步,是因为这个难度确实存在 —— 站内数据里见过这样的状态。\n但越深的档状态越少,多底色 / 最优槽还要每个底色、每个槽同时这么深,均匀随机撞不上。整档能一个不漏地列出来的(六色底十字 8 步共 40 个、六色底 XCross 10 步共 438 个)就直接从那份名单里出题,列不出来的才置灰。',
  },
  bestBlock: { en: 'Best block', zh: '最优块' },
  bestSlot: { en: 'Best slot', zh: '最优槽' },
  block: { en: 'Block', zh: '块' },
  difficulty: { en: 'Difficulty', zh: '难度' },
  difficultyAria: { en: 'Generate by difficulty', zh: '按难度生成' },
  f2lSlot: { en: 'F2L slot', zh: 'F2L 槽位' },
  method: { en: 'Method', zh: '方法' },
  moreInfo: { en: 'More info', zh: '更多信息' },
  rare: { en: '{gaps} moves: too rare to draw', zh: '{gaps} 步太罕见,抽不出来' },
  stage: { en: 'Stage', zh: '阶段' },
  steps: { en: 'Step range', zh: '步数范围' },
} as const;

function DifficultyHelp({ content, label }: { content: string; label: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);
  usePopoverDismiss(open, () => setOpen(false), panelRef, buttonRef);
  return (
    <span className="timer-random-difficulty-help">
      <button
        aria-expanded={open}
        aria-label={label}
        className="timer-random-difficulty-help-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      ><Info aria-hidden="true" size={12} /></button>
      {open && (
        <div className="timer-random-difficulty-help-panel" ref={panelRef} role="tooltip">
          {content.split('\n').map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </span>
  );
}

export function TimerRandomDifficultyConfig({
  disabled = false,
  language,
  onChange,
  settings,
  toggleSlot,
}: TimerRandomDifficultyConfigProps) {
  const text = (copy: Readonly<Record<TimerUiLanguage, string>>) => copy[language];
  // 方法有没有阶段,判据只有一个:**下拉真能列出来的**阶段数。用引擎侧的 trainerStagesOf 判会留
  // 一个缺口 —— 阶段键没登记进 VARIANT_STAGES 的话,方法照样出现、阶段下拉却是空的,于是 caps
  // 为 null、整个难度区悄悄消失,而引擎侧的测试全绿。
  const methods = useMemo(() => uiVariantOptions((dv) => trainerStagesOf(dv).length > 0)
    .filter((m) => stagesOfMethod(m).length > 0), []);
  const storedMethod = uiVariantOf(settings.genDiffVariant);
  const method = methods.includes(storedMethod) ? storedMethod : methods[0];
  const stages = useMemo(() => stagesOfMethod(method), [method]);
  const stage = stages.includes(settings.genDiffStage) ? settings.genDiffStage : stages[0];
  const variant = dataVariantOfStage(method, stage);
  const caps = trainerCaps(variant, stage);

  // 底色子集:与真题难度筛共用同一个选择器(sel.subsetKey 是过滤性质,变了就写回)。
  const sel = useSubsetSelection('cn', settings.genDiffColors);
  const settingsColorsRef = useRef(settings.genDiffColors);
  const applyingSettingsColorsRef = useRef(false);
  useEffect(() => {
    if (settingsColorsRef.current === settings.genDiffColors) return;
    settingsColorsRef.current = settings.genDiffColors;
    applyingSettingsColorsRef.current = true;
    sel.selectByKey(settings.genDiffColors);
  });
  useEffect(() => {
    if (applyingSettingsColorsRef.current) {
      if (sel.subsetKey === settingsColorsRef.current) applyingSettingsColorsRef.current = false;
      return;
    }
    if (sel.subsetKey === settingsColorsRef.current) return;
    settingsColorsRef.current = sel.subsetKey;
    onChange({ genDiffColors: sel.subsetKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.subsetKey]);

  // 存的方法/阶段不在支持列表里(旧存档 / 从真题筛那边带过来的组合)→ 回退到能生成的第一项。
  useEffect(() => {
    if (variant !== settings.genDiffVariant || stage !== settings.genDiffStage) {
      onChange({ genDiffVariant: variant, genDiffStage: stage, ...RESET });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, stage]);

  const faces = useMemo(() => facesOfSubset(sel.subsetKey), [sel.subsetKey]);
  const showSlots = !!caps?.slots && faces.length === 1;
  // 两槽阶段的选项是槽对:XXCross 两槽同解(FR+FL),XCross 配对一解一配、有先后(FR→FL)。
  const slotNames = showSlots ? trainerSlotOptions(variant, stage, faces[0]) : [];

  // 刻度轴到「已知存在的最深」(上帝之数下界),但不是每一格都出得来:多底色 / 最优槽取的是
  // 多个帧的最小值,深档要所有帧同时深,存在但撞不上。撞不上的里头又分两种 —— 整档能列全的
  // (六色底十字 8 步共 40 个、六色底 XCross 10 步共 438 个)照样能出,其余置灰。见 reach.ts。
  // 越界的槽序号一律按「最优槽」算,不按定槽算 —— 下拉里没有那一项,所以它显示的就是「最优槽」,
  // 判成定槽就会让显示和真去生成的对不上(而且用户点不回来:当前选中项已经是它了)。
  const slot = settings.genDiffSlot >= 0 && settings.genDiffSlot < slotNames.length
    ? settings.genDiffSlot
    : TIMER_RANDOM_DIFFICULTY_BEST_SLOT;
  const slotMode = showSlots && slot >= 0 ? 'fixed' : 'best';
  const mMin = caps ? caps.range[0] : 0;
  const bounds = caps
    ? trainerDepthBounds(variant, stage, faces.length, slotMode, caps.range[1], caps.range[0])
    : { god: 0, allowed: [] as number[] };
  const allowed = bounds.allowed;
  const mMax = allowed.length ? allowed[allowed.length - 1] : mMin;
  const snap = (v: number) => snapAllowed(v, allowed);
  const stored = settings.genDiffSteps;
  const rawLo = stored.length ? stored[0] : (caps ? caps.band[0] : 0);
  const rawHi = stored.length ? stored[stored.length - 1] : (caps ? caps.band[1] : 0);
  const lo = snap(Math.min(rawLo, rawHi));
  const hi = snap(Math.max(rawLo, rawHi));

  // 步数为空(首开 / 换阶段)→ 落该阶段默认带;端点越界或落进空档 → 贴回最近的可选档,
  // 保证滑块显示的和真去生成的是同一个区间。
  useEffect(() => {
    if (!settings.genDiffOn || !caps) return;
    if (stored.length === 0) {
      onChange({ genDiffSteps: range(snap(caps.band[0]), snap(caps.band[1])) });
    } else if (stored[0] !== lo || stored[stored.length - 1] !== hi) {
      onChange({ genDiffSteps: range(lo, hi) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.genDiffOn, variant, stage, mMin, mMax, allowed.length]);

  const diffToggle = (
    <span className="timer-random-difficulty-toggle">
      <span className="timer-random-difficulty-label">{text(COPY.difficulty)}</span>
      <TimerPillToggle
        value={settings.genDiffOn}
        onChange={(value) => onChange({ genDiffOn: value })}
        ariaLabel={text(COPY.difficultyAria)}
        disabled={disabled}
      />
    </span>
  );

  const body = !!(settings.genDiffOn && caps);
  // 置灰刻度的说明。刻度画得比可选的深是有意的(那些难度真的存在),但用户看到的是「拖不过去」
  // —— 不写一句原因就只是个坏掉的滑块。空档不一定连着最后一格(六色底 XCross 缺的是 9,10 反而
  // 有那 438 个),所以按连续段逐段报,不假设只有一条尾巴。
  const gaps = body ? spans(range(mMin, bounds.god).filter((d) => !allowed.includes(d))) : [];
  const gapText = gaps.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join('、');

  return (
    <>
      {/* 开关搬去顶栏(toggleSlot)时,本组件在原处就只剩难度细项 —— 难度关着连 wrapper 都不渲染,
          否则来源条里留下一个空 div,:empty 收不起来,计时读数上方白挂 16px。 */}
      {toggleSlot && createPortal(diffToggle, toggleSlot)}
      {(!toggleSlot || body) && (
        <div className="timer-random-difficulty-config">
          {!toggleSlot && <div className="timer-random-difficulty-top-row">{diffToggle}</div>}

          {body && (
            <div className="timer-random-difficulty-body">
              <div className="timer-random-difficulty-options">
                <SubsetColorPicker disabled={disabled} sel={sel} language={language} />
                {methods.length > 1 && (
                  <select
                    aria-label={text(COPY.method)}
                    className="timer-random-difficulty-select"
                    disabled={disabled}
                    value={method}
                    onChange={(event) => {
                      const m = event.target.value;
                      const first = stagesOfMethod(m)[0];
                      onChange({
                        genDiffVariant: dataVariantOfStage(m, first), genDiffStage: first, ...RESET,
                      });
                    }}
                  >
                    {methods.map((option) => (
                      <option key={option} value={option}>{variantLabel(option, language === 'zh')}</option>
                    ))}
                  </select>
                )}
                <select
                  aria-label={text(COPY.stage)}
                  className="timer-random-difficulty-select"
                  disabled={disabled}
                  value={stage}
                  onChange={(event) => onChange({
                    genDiffVariant: dataVariantOfStage(method, event.target.value),
                    genDiffStage: event.target.value,
                    ...RESET,
                  })}
                >
                  {stages.map((option) => (
                    <option key={option} value={option}>{stageLabel(option, language === 'zh')}</option>
                  ))}
                </select>
                {showSlots && (
                  <select
                    className="timer-random-difficulty-select"
                    disabled={disabled}
                    value={slot}
                    onChange={(event) => onChange({ genDiffSlot: Number(event.target.value) })}
                    // 砖挑的是块(角),不是 F2L 槽 —— 名字同形(FR/FL/BL/BR),含义不同。
                    aria-label={stage === 'block222'
                      ? text(COPY.block)
                      : text(COPY.f2lSlot)}
                  >
                    <option value={TIMER_RANDOM_DIFFICULTY_BEST_SLOT}>
                      {stage === 'block222' ? text(COPY.bestBlock) : text(COPY.bestSlot)}
                    </option>
                    {slotNames.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="timer-random-difficulty-range">
                <TimerRangeSlider
                  min={mMin}
                  max={bounds.god}
                  allowed={allowed}
                  value={[lo, hi]}
                  onChange={([a, b]) => onChange({ genDiffSteps: range(a, b) })}
                  marks={range(mMin, bounds.god)}
                  ariaLabel={text(COPY.steps)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {/* div 而非 p:InfoTooltip 展开的气泡是 div,套在 p 里是非法嵌套(浏览器会自动闭合 p,
              服务端与客户端的 DOM 因此对不上 → hydration 报错)。 */}
          {gaps.length > 0 && (
            <div className="timer-random-difficulty-hint">
              {text(COPY.rare).replace('{gaps}', gapText)}
              <DifficultyHelp
                content={text(COPY.answerWhy).replace('{god}', String(bounds.god))}
                label={text(COPY.moreInfo)}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
