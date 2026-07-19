'use client';

/**
 * ReconPlayerCanvas — 复盘 3D 播放器(动画演示)的详情页渲染层。引擎选择委托
 * ReconEnginePlayer(sq1 / NxN → 自有 cuber 引擎,其余 → cubing.js TwistySection)。
 * 从 /recon/[id] 详情页抽出,详情页与统一成绩弹窗(AttemptPopover)共用,避免重复。
 *
 * 无 scramble 时不渲染(只录了空成绩的边界)。hideControls=true 时隐藏播放器自带
 * 控制条,改用画面内播放/暂停浮层(成绩弹窗内嵌预览用;仍可点解法 scrub)。
 */

import { type ReactNode, type RefObject } from 'react';
import ReconEnginePlayer from './ReconEnginePlayer';

export default function ReconPlayerCanvas({
  event, scramble, displayText, playerRef, fillPane = false, hideControls = false, fullscreenButton,
}: {
  event: string;
  /** 原始打乱(各 player 内部自行处理紧凑/canonical 形) */
  scramble: string;
  /** 要播放的解法(可能是 normalize 过的 displayText) */
  displayText: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef: RefObject<any>;
  fillPane?: boolean;
  /** 隐藏播放器自带完整控制条,改用画面内播放/暂停浮层(成绩弹窗内嵌预览用;仍可点解法 scrub) */
  hideControls?: boolean;
  /** 全屏/退出全屏按钮(详情页持有 fullscreen 状态)。 */
  fullscreenButton?: ReactNode;
}) {
  if (!scramble) return null;

  return (
    <ReconEnginePlayer
      event={event}
      scramble={scramble}
      solution={displayText}
      playerRef={playerRef}
      fillPane={fillPane}
      hideControls={hideControls}
      fullscreenButton={fullscreenButton}
    />
  );
}
