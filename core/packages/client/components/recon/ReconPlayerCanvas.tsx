'use client';

/**
 * ReconPlayerCanvas — 复盘 3D 播放器(动画演示)的共享渲染层。
 * 按项目选引擎:sq1→Sq1ReconPlayer,NxN→cuber(CuberReconPlayer)/cubing.js(TwistySection)二选一,
 * 其余→TwistySection。从 /recon/[id] 详情页抽出,详情页与统一成绩弹窗(AttemptPopover)共用,避免重复。
 *
 * 引擎偏好持久化在 localStorage `recon.player.engine`(cuber / cubing),两处共享同一 key。
 * showEngineToggle=true 时在 NxN 下渲染左上角引擎切换(需父容器 position:relative,如 .detail-player-pane)。
 */

import { type RefObject } from 'react';
import { getPuzzleId } from '@/lib/recon-utils';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { canonicalSq1Alg } from '@/lib/sq1-svg';
import TwistySection from '@/components/TwistySection';
import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';
import CuberReconPlayer from '@/components/CuberReconPlayer';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';

export type ReconEngine = 'cuber' | 'cubing';
const ENGINE_KEY = 'recon.player.engine';

export function loadReconEngine(): ReconEngine {
  if (typeof window === 'undefined') return 'cuber';
  try { return localStorage.getItem(ENGINE_KEY) === 'cubing' ? 'cubing' : 'cuber'; }
  catch { return 'cuber'; }
}
export function saveReconEngine(e: ReconEngine): void {
  try { localStorage.setItem(ENGINE_KEY, e); } catch { /* private mode */ }
}

export default function ReconPlayerCanvas({
  event, scramble, displayText, playerRef, engine, onPickEngine,
  fillPane = false, showEngineToggle = false, hideControls = false,
}: {
  event: string;
  /** 原始打乱(sq1 的 player 吃紧凑形,cubedb 外链才要 canonical;此处内部各自处理) */
  scramble: string;
  /** 要播放的解法(可能是 normalize 过的 displayText) */
  displayText: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef: RefObject<any>;
  /** NxN 引擎选择(其它项目忽略) */
  engine: ReconEngine;
  onPickEngine?: (e: ReconEngine) => void;
  fillPane?: boolean;
  /** NxN 下渲染左上角 cuberoot/cubing.js 切换(父容器须 position:relative) */
  showEngineToggle?: boolean;
  /** 隐藏播放器自带控制条(成绩弹窗内嵌预览用,靠点解法 scrub) */
  hideControls?: boolean;
}) {
  const isSq1 = event === 'sq1';
  const playerScramble = isSq1 ? canonicalSq1Alg(scramble) : scramble;
  const puzzleId = getPuzzleId(event);
  const isNxnPuzzle = /^[2-7]x[2-7]x[2-7]$/.test(puzzleId);
  const nxnOrder = isNxnPuzzle ? parseInt(puzzleId, 10) : 3;

  if (!scramble) return null;

  return (
    <>
      {isSq1 ? (
        <Sq1ReconPlayer scramble={scramble} alg={displayText} playerRef={playerRef} fillPane={fillPane} hideControls={hideControls} />
      ) : isNxnPuzzle && engine === 'cuber' ? (
        <CuberReconPlayer
          scramble={playerScramble}
          alg={cleanForPlayer(displayText)}
          order={nxnOrder}
          playerRef={playerRef}
          fillPane={fillPane}
          hideControls={hideControls}
        />
      ) : (
        <TwistySection
          puzzle={puzzleId}
          scramble={playerScramble}
          alg={cleanForPlayer(displayText)}
          playerRef={playerRef}
          fillPane={fillPane}
          hideControls={hideControls}
        />
      )}
      {showEngineToggle && isNxnPuzzle && onPickEngine && (
        <div className="detail-engine-toggle">
          <PillToggle
            value={engine === 'cubing'}
            onChange={(v) => onPickEngine(v ? 'cubing' : 'cuber')}
            offLabel="cuberoot"
            onLabel="cubing.js"
            ariaLabel={tr({ zh: '渲染引擎', en: 'Render engine' })}
          />
        </div>
      )}
    </>
  );
}
