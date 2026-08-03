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
import { createPortal } from 'react-dom';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { VariantSelect } from '@/components/VariantSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useSubsetSelection, SubsetColorPicker } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { dataVariantOfStage, stageLabel, uiStagesOf, uiVariantOf, uiVariantOptions } from '@/lib/scramble-variants';
import { canTrain, facesOfSubset, trainerCaps, trainerSlotOptions, trainerStagesOf } from '@/lib/cross-trainer';
import { snapAllowed, trainerDepthBounds } from '@/lib/cross-trainer/reach';
import { SLOT_BEST, type GenDiffSettings } from '../_lib/scramble/trainer-source';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  settings: GenDiffSettings;
  updateSettings: (patch: Partial<GenDiffSettings>) => void;
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

export default function GenDiffConfig({ isZh, settings, updateSettings, toggleSlot }: Props) {
  const methods = useMemo(() => uiVariantOptions((dv) => trainerStagesOf(dv).length > 0), []);
  const storedMethod = uiVariantOf(settings.genDiffVariant);
  const method = methods.includes(storedMethod) ? storedMethod : methods[0];
  const stages = useMemo(() => stagesOfMethod(method), [method]);
  const stage = stages.includes(settings.genDiffStage) ? settings.genDiffStage : stages[0];
  const variant = dataVariantOfStage(method, stage);
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

  // 刻度轴到「已知存在的最深」(上帝之数下界),但不是每一格都出得来:多底色 / 最优槽取的是
  // 多个帧的最小值,深档要所有帧同时深,存在但撞不上。撞不上的里头又分两种 —— 整档能列全的
  // (六色底十字 8 步共 40 个、六色底 XCross 10 步共 438 个)照样能出,其余置灰。见 reach.ts。
  const slotMode = showSlots && settings.genDiffSlot >= 0 ? 'fixed' : 'best';
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
      updateSettings({ genDiffSteps: range(snap(caps.band[0]), snap(caps.band[1])) });
    } else if (stored[0] !== lo || stored[stored.length - 1] !== hi) {
      updateSettings({ genDiffSteps: range(lo, hi) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.genDiffOn, variant, stage, mMin, mMax, allowed.length]);

  const diffToggle = (
    <span className="settings-row-tight-group">
      <span className="settings-row-label">{tr({ zh: '难度', en: 'Difficulty' })}</span>
      <PillToggle
        value={settings.genDiffOn}
        onChange={(v) => updateSettings({ genDiffOn: v })}
        ariaLabel={tr({ zh: '按难度生成', en: 'Generate by difficulty' })}
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
        <div className="wca-src-config">
          {!toggleSlot && <div className="settings-row wca-src-toprow">{diffToggle}</div>}

          {body && (
            <div className="wca-src-diff">
              <div className="wca-src-diff-row">
                <SubsetColorPicker sel={sel} isZh={isZh} />
                {methods.length > 1 && (
                  <VariantSelect
                    className="settings-row-control-select"
                    value={method}
                    options={methods}
                    onChange={(m) => {
                      const first = stagesOfMethod(m)[0];
                      updateSettings({
                        genDiffVariant: dataVariantOfStage(m, first), genDiffStage: first, genDiffSteps: [],
                      });
                    }}
                    isZh={isZh}
                    ariaLabel={tr({ zh: '方法', en: 'Method' })}
                  />
                )}
                <VariantSelect
                  className="settings-row-control-select"
                  value={stage}
                  options={stages}
                  onChange={(s) => updateSettings({
                    genDiffVariant: dataVariantOfStage(method, s), genDiffStage: s, genDiffSteps: [],
                  })}
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
                  max={bounds.god}
                  allowed={allowed}
                  value={[lo, hi]}
                  onChange={([a, b]) => updateSettings({ genDiffSteps: range(a, b) })}
                  marks={range(mMin, bounds.god)}
                  ariaLabel={tr({ zh: '步数范围', en: 'Step range' })}
                />
              </div>
            </div>
          )}

          {/* div 而非 p:InfoTooltip 展开的气泡是 div,套在 p 里是非法嵌套(浏览器会自动闭合 p,
              服务端与客户端的 DOM 因此对不上 → hydration 报错)。 */}
          {gaps.length > 0 && (
            <div className="wca-src-hint gen-diff-cap">
              {tr({ zh: `${gapText} 步太罕见,抽不出来`, en: `${gapText} moves: too rare to draw` })}
              <InfoTooltip
                iconSize={12}
                content={tr({
                  zh: `刻度画到 ${bounds.god} 步,是因为这个难度确实存在 —— 站内数据里见过这样的状态。\n`
                    + '但越深的档状态越少,多底色 / 最优槽还要每个底色、每个槽同时这么深,均匀随机撞不上。'
                    + '整档能一个不漏地列出来的(六色底十字 8 步共 40 个、六色底 XCross 10 步共 438 个)'
                    + '就直接从那份名单里出题,列不出来的才置灰。',
                  en: `The axis runs to ${bounds.god} because that difficulty really exists — the site's own data contains such states.\n`
                    + 'But deeper bands hold ever fewer states, and multi-colour / best-slot needs every colour and every slot to be that deep at once, '
                    + 'which a uniform draw never hits. Where the whole band can be listed (40 states for six-colour cross at 8, 438 for '
                    + 'six-colour XCross at 10) cases come straight off that list; only the bands we cannot list are greyed out.',
                })}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
