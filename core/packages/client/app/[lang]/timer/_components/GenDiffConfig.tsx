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

import { useEffect, useMemo } from 'react';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { VariantSelect } from '@/components/VariantSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useSubsetSelection, SubsetColorPicker } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { stageLabel } from '@/lib/scramble-variants';
import { facesOfSubset, trainerCaps, trainerSlotOptions, trainerStagesOf, trainerVariants } from '@/lib/cross-trainer';
import { SLOT_BEST, type GenDiffSettings } from '../_lib/scramble/trainer-source';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  settings: GenDiffSettings;
  updateSettings: (patch: Partial<GenDiffSettings>) => void;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export default function GenDiffConfig({ isZh, settings, updateSettings }: Props) {
  const variants = trainerVariants();
  const variant = variants.includes(settings.genDiffVariant) ? settings.genDiffVariant : variants[0];
  const stages = trainerStagesOf(variant);
  const stage = stages.includes(settings.genDiffStage) ? settings.genDiffStage : stages[0];
  const caps = trainerCaps(variant, stage);

  // 底色子集:与真题难度筛共用同一个选择器(sel.subsetKey 是过滤性质,变了就写回)。
  const sel = useSubsetSelection('cn', settings.genDiffColors);
  useEffect(() => {
    if (sel.subsetKey !== settings.genDiffColors) updateSettings({ genDiffColors: sel.subsetKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.subsetKey]);

  // 存的方法/阶段不在支持列表里(旧存档 / 从真题筛那边带过来的组合)→ 回退到能生成的第一项。
  useEffect(() => {
    if (variant !== settings.genDiffVariant || stage !== settings.genDiffStage) {
      updateSettings({ genDiffVariant: variant, genDiffStage: stage, genDiffSteps: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, stage]);

  const faces = useMemo(() => facesOfSubset(sel.subsetKey), [sel.subsetKey]);
  const showSlots = !!caps?.slots && faces.length === 1;
  // 两槽阶段的选项是槽对:XXCross 两槽同解(FR+FL),XCross 配对一解一配、有先后(FR→FL)。
  const slotNames = showSlots ? trainerSlotOptions(variant, stage, faces[0]) : [];

  const [mMin, mMax] = caps ? caps.range : [0, 0];
  const stored = settings.genDiffSteps;
  const rawLo = stored.length ? stored[0] : (caps ? caps.band[0] : 0);
  const rawHi = stored.length ? stored[stored.length - 1] : (caps ? caps.band[1] : 0);
  const lo = clamp(Math.min(rawLo, rawHi), mMin, mMax);
  const hi = clamp(Math.max(rawLo, rawHi), mMin, mMax);

  // 步数为空(首开 / 换阶段)→ 落该阶段默认带;越界(换阶段端点变窄)→ 夹回去,保证滑块与生成口径一致。
  useEffect(() => {
    if (!settings.genDiffOn || !caps) return;
    if (stored.length === 0) {
      updateSettings({ genDiffSteps: range(clamp(caps.band[0], mMin, mMax), clamp(caps.band[1], mMin, mMax)) });
    } else if (stored[0] < mMin || stored[stored.length - 1] > mMax) {
      updateSettings({ genDiffSteps: range(lo, hi) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.genDiffOn, variant, stage, mMin, mMax]);

  return (
    <div className="wca-src-config">
      <div className="settings-row wca-src-toprow">
        <span className="settings-row-tight-group">
          <span className="settings-row-label">{tr({ zh: '难度', en: 'Difficulty' })}</span>
          <PillToggle
            value={settings.genDiffOn}
            onChange={(v) => updateSettings({ genDiffOn: v })}
            ariaLabel={tr({ zh: '按难度生成', en: 'Generate by difficulty' })}
          />
        </span>
      </div>

      {settings.genDiffOn && caps && (
        <div className="wca-src-diff">
          <div className="wca-src-diff-row">
            <SubsetColorPicker sel={sel} isZh={isZh} />
            {variants.length > 1 && (
              <VariantSelect
                className="settings-row-control-select"
                value={variant}
                options={variants}
                onChange={(v) => updateSettings({ genDiffVariant: v, genDiffStage: trainerStagesOf(v)[0], genDiffSteps: [] })}
                isZh={isZh}
                ariaLabel={tr({ zh: '方法', en: 'Method' })}
              />
            )}
            <VariantSelect
              className="settings-row-control-select"
              value={stage}
              options={stages}
              onChange={(s) => updateSettings({ genDiffStage: s, genDiffSteps: [] })}
              isZh={isZh}
              label={stageLabel}
              ariaLabel={tr({ zh: '阶段', en: 'Stage' })}
            />
            {showSlots && (
              <select
                className="settings-row-control-select"
                value={settings.genDiffSlot}
                onChange={(e) => updateSettings({ genDiffSlot: Number(e.target.value) })}
                aria-label={tr({ zh: 'F2L 槽位', en: 'F2L slot' })}
              >
                <option value={SLOT_BEST}>{tr({ zh: '最优槽', en: 'Best slot' })}</option>
                {slotNames.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="wca-src-steps-range">
            <RangeSlider
              min={mMin}
              max={mMax}
              value={[lo, hi]}
              onChange={([a, b]) => updateSettings({ genDiffSteps: range(a, b) })}
              marks={range(mMin, mMax)}
              ariaLabel={tr({ zh: '步数范围', en: 'Step range' })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
