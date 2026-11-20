'use client';
import { MethodStagePicker } from './TimerPuzzlePicker';

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

import './compact-select.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EO_AXIS_LABELS,
  TIMER_RANDOM_DIFFICULTY_BEST_SLOT,
  TIMER_RANDOM_DIFFICULTY_COPY as COPY,
  reconcileTimerRandomDifficultySettings,
  timerRandomDifficultyRangePatch,
  timerRandomDifficultySelection,
  timerRandomDifficultyStagesOf,
  timerRandomDifficultyUiModel,
  type TimerRandomDifficultySettings,
} from '@cuberoot/shared/timer/random-difficulty';
import { SubsetColorPicker, useSubsetSelection, type TimerUiLanguage } from './TimerColorSubsetPicker';
import { TimerRangeSlider } from './TimerRangeSlider';
import { TimerDifficultyHelp } from './TimerDifficultyHelp';
import { TimerDifficultyDialog } from './TimerDifficultyDialog';

export interface TimerRandomDifficultyConfigProps {
  disabled?: boolean;
  language: TimerUiLanguage;
  settings: TimerRandomDifficultySettings;
  onChange: (patch: Partial<TimerRandomDifficultySettings>) => void;
  /** 「难度」按钮的落点(计时器顶栏)。同 WcaSourceConfig 的 toggleSlot,不传就留在本组件顶行。 */
  toggleSlot?: HTMLElement | null;
}

export function TimerRandomDifficultyConfig({
  disabled = false,
  language,
  onChange: persist,
  settings: savedSettings,
  toggleSlot,
}: TimerRandomDifficultyConfigProps) {
  const [draft, setDraft] = useState<Partial<TimerRandomDifficultySettings> | null>(null);
  const difficultyTriggerRef = useRef<HTMLButtonElement>(null);
  const settings = { ...savedSettings, ...draft };
  const onChange = (patch: Partial<TimerRandomDifficultySettings>) => {
    if (draft !== null) setDraft(current => current === null ? null : { ...current, ...patch });
    else persist(patch);
  };
  const text = (copy: Readonly<Record<TimerUiLanguage, string>>) => copy[language];
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

  const model = timerRandomDifficultyUiModel({ ...settings, genDiffColors: sel.subsetKey });
  const { body, eoAxis, gapText, hi, lo, method, methods, pureEo, showColors, showSlots, slot, slotNames, stage } = model;
  useEffect(() => {
    const patch = reconcileTimerRandomDifficultySettings(settings, model);
    if (Object.keys(patch).length) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.genDiffOn, model.variant, stage, model.stepMin, model.allowed.at(-1), model.allowed.length]);

  const diffToggle = (
    <button ref={difficultyTriggerRef} type="button" className="timer-difficulty-trigger" aria-haspopup="dialog"
      aria-expanded={draft !== null} data-active={savedSettings.genDiffOn || undefined}
      onClick={() => setDraft(draft ? null : { genDiffOn: true })} disabled={disabled}>
      {text(COPY.difficulty)}
    </button>
  );
  return (
    <>
      {/* 设置仅在弹窗中显示，来源条不留空的内联面板。 */}
      {toggleSlot && createPortal(diffToggle, toggleSlot)}
      {!toggleSlot && diffToggle}
      {draft !== null && (
        <TimerDifficultyDialog anchorRef={difficultyTriggerRef} language={language} disabled={disabled} onClose={() => setDraft(null)}
          onApply={() => { persist(draft); setDraft(null); }}
          onClear={() => { persist({ genDiffOn: false }); setDraft(null); }}>
          <div className="timer-random-difficulty-config">
            {body && (
              <div className="timer-random-difficulty-body">
                <div className="timer-random-difficulty-options">
                  {showColors && (
                    <SubsetColorPicker disabled={disabled} sel={sel} language={language} />
                  )}
                  <MethodStagePicker
                    disabled={disabled} isZh={language === 'zh'} method={method} stage={stage}
                    methods={methods} stagesOf={timerRandomDifficultyStagesOf}
                    onSelect={(m, s) => onChange(timerRandomDifficultySelection(m, s))}
                  />
                  {pureEo && (
                    <select className="timer-random-difficulty-select" disabled={disabled}
                      aria-label={text(COPY.eoAxis)} value={eoAxis}
                      onChange={(event) => onChange({
                        genDiffEoAxis: event.target.value === 'best' ? 'best' : Number(event.target.value) as 0 | 1 | 2,
                      })}>
                      <option value="best">{text(COPY.bestAxis)}</option>
                      {([2, 1, 0] as const).map(axis => (
                        <option key={axis} value={axis}>
                          {text(COPY.fixedAxis).replace('{axis}', EO_AXIS_LABELS[axis])}
                        </option>
                      ))}
                    </select>
                  )}
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
                    min={model.stepMin}
                    max={model.stepMax}
                    allowed={model.allowed}
                    value={[lo, hi]}
                    onChange={([a, b]) => onChange(timerRandomDifficultyRangePatch(model, a, b))}
                    marks={model.marks}
                    ariaLabel={text(COPY.steps)}
                    disabled={disabled}
                  />
                </div>
              </div>
            )}

            {/* div 而非 p:InfoTooltip 展开的气泡是 div,套在 p 里是非法嵌套(浏览器会自动闭合 p,
                服务端与客户端的 DOM 因此对不上 → hydration 报错)。 */}
            {gapText && (
              <div className="timer-random-difficulty-hint">
                {text(COPY.rare).replace('{gaps}', gapText)}
                <TimerDifficultyHelp
                  content={text(COPY.answerWhy).replace('{god}', String(model.stepMax))}
                  label={text(COPY.moreInfo)}
                />
              </div>
            )}
          </div>
        </TimerDifficultyDialog>
      )}
    </>
  );
}
