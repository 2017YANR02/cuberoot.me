'use client';

/**
 * ScrambleSourceBar — 计时器「打乱来源」常驻配置条,固定在计时读数上方。
 *
 * 2026-07(取代旧的 ScrambleSourcePanel 右栏可折叠面板):随机状态 / WCA 真题(按日期
 * 范围+难度 / 指定比赛;「最优」开关搬去了齿轮设置)/ 手动输入(多行队列,每行一条)。
 * 常驻计时读数上方,所有项目可见;计时中随 .surface-chrome 淡出。整块挂 data-no-timer,
 * 保证在其中操作不会触发按压计时(见 lib/timer-ignore-target)。
 *
 * 复用 .settings-row* / .wca-src-* 原语(样式来自 WcaSourceConfig 顺带 import 的
 * wca-source.css),那些原语本身已经全走站点 token,这里不需要再补取色。
 */

import { updateSettings, useSettings } from '../_lib/settings';
import type { EventId } from '../_lib/types';
import WcaSourceConfig from '@/components/WcaSourceConfig';
import GenStepsConfig from './GenStepsConfig';
import GenDiffConfig from './GenDiffConfig';
import { stepPuzzleOf } from '../_lib/scramble/step-metrics';
import { canTrainerDifficulty } from '../_lib/scramble/trainer-source';
import { tr } from '@/i18n/tr';
import Scramble222ModePicker from '@/components/Scramble222ModePicker';
import { SCRAMBLE_222_TYPES, WCA_SCRAMBLE_222_TYPES, use222Type, type Scramble222Type } from '@/lib/scramble-222-mode';

interface Props {
  event: EventId;
  isZh: boolean;
  /** 顶栏里「难度」开关的落点(SoloView 提供)。给了就把开关 portal 上去,不给就留在本条里。 */
  diffSlot?: HTMLElement | null;
}

export default function ScrambleSourceBar({ event, isZh, diffSlot }: Props) {
  const s = useSettings();
  const hasSteps = !!stepPuzzleOf(event);
  const src = s.scrambleSource;
  const [type222] = use222Type();
  // 随机来源支持 csTimer 全部类型；WCA 真题只显示能从最终状态精确判定的类型。
  // 3-gen 只是一种生成过程，切到真题时按完整状态显示，但不覆盖用户保存的随机来源偏好。
  const type222Options: readonly Scramble222Type[] | null = event === '222' && !s.syncSeed
    ? src === 'random' ? SCRAMBLE_222_TYPES : src === 'wca' ? WCA_SCRAMBLE_222_TYPES : null
    : null;
  const show222SpecialTypes = !!type222Options;
  const active222Type = type222Options?.includes(type222) ? type222 : 'full';
  const uses222SpecialType = show222SpecialTypes && active222Type !== 'full';

  // 「打乱来源」下拉本身已挪到顶栏(和「人数」/项目选择器同组,见 SoloView);这里只留下
  // 各来源的细项配置。random 且无「按步数」时无细项 → 整条为空,靠 CSS :empty 收起。

  return (
    <div className="scramble-src-bar surface-chrome" data-no-timer>
      {src === 'wca' && (
        <WcaSourceConfig isZh={isZh} event={event} settings={s} updateSettings={updateSettings} toggleSlot={diffSlot} />
      )}

      {src === 'manual' && (
        <div className="settings-row scramble-src-manual">
          <textarea
            className="scramble-src-manual-input"
            value={s.manualScrambles}
            onChange={(e) => updateSettings({ manualScrambles: e.target.value })}
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-label={tr({ zh: '手动输入打乱', en: 'Manual scrambles' })}
          />
        </div>
      )}

      {/* 随机状态来源的难度 = 直接生成该难度的状态(3×3 族;真题那边的难度筛在 WcaSourceConfig 里)。 */}
      {src === 'random' && canTrainerDifficulty(event) && (
        <GenDiffConfig isZh={isZh} settings={s} updateSettings={updateSettings} toggleSlot={diffSlot} />
      )}

      {/* 二阶专项打乱有自己的精确目标条件,不再叠加「按步数」状态筛选。 */}
      {uses222SpecialType && (
        <div className="wca-src-config">
          <div className="settings-row wca-src-toprow">
            <Scramble222ModePicker
              active222
              showLabel={false}
              showSpecialTypes
              typeOptions={type222Options ?? undefined}
            />
          </div>
        </div>
      )}

      {hasSteps && src !== 'manual' && !uses222SpecialType && (
        <GenStepsConfig
          isZh={isZh}
          event={event}
          source={src === 'wca' ? 'wca' : 'random'}
          settings={s}
          updateSettings={updateSettings}
          // 2x2 口径 toggle(WCA 11 步 ↔ 最优/Q|H)塞进「按步数」顶行左侧,与它并排成一组;
          // 对随机状态与 WCA 真题都生效(真题的「最优」= 服务端 God's-number 最优等态)。
          extraToprow={event === '222'
            ? <Scramble222ModePicker
                active222
                showLabel={false}
                showSpecialTypes={show222SpecialTypes}
                typeOptions={type222Options ?? undefined}
              />
            : undefined}
        />
      )}
    </div>
  );
}
