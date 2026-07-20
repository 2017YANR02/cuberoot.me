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
import { stepPuzzleOf } from '../_lib/scramble/step-metrics';
import { tr } from '@/i18n/tr';

interface Props {
  event: EventId;
  isZh: boolean;
}

export default function ScrambleSourceBar({ event, isZh }: Props) {
  const s = useSettings();
  const hasSteps = !!stepPuzzleOf(event);
  const src = s.scrambleSource;

  // 「打乱来源」下拉本身已挪到顶栏(和「人数」/项目选择器同组,见 SoloView);这里只留下
  // 各来源的细项配置。random 且无「按步数」时无细项 → 整条为空,靠 CSS :empty 收起。

  return (
    <div className="scramble-src-bar surface-chrome" data-no-timer>
      {src === 'wca' && (
        <WcaSourceConfig isZh={isZh} event={event} settings={s} updateSettings={updateSettings} />
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

      {hasSteps && src !== 'manual' && (
        <GenStepsConfig
          isZh={isZh}
          event={event}
          source={src === 'wca' ? 'wca' : 'random'}
          settings={s}
          updateSettings={updateSettings}
        />
      )}
    </div>
  );
}
