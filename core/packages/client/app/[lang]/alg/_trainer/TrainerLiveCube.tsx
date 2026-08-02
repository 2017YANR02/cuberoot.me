'use client';

/**
 * 训练器上那颗跟着手转的魔方。
 *
 * 连着智能魔方时它顶掉卡片上那张静态 case 图。理由和 /timer 那边是同一条:两张图说的是
 * 同一件事,而这一张多说了「你现在拧到哪儿了」——静态图只画出题那一刻,拧起来一动不动,
 * 看上去就像魔方没连上。
 *
 * 日志从**还原态**起算,这一点是白得的:出题时 `useTrainerCube` 让魔方谎报「打乱作用在
 * 还原态上」的那个状态,所以 `打乱 + 这一题拧过的手` 恰好就是桌上那颗的真实状态。
 * /timer 那边要靠 `anchorAlgFor` 去猜开局,这里不用猜。
 *
 * 镜头正对 F 面(不是等轴):这颗魔方的姿态由陀螺仪给,校准按钮就在下面,而「歪没歪」
 * 只有正对一面时才看得出来 —— 等轴视角下几度偏差混在三个面的透视里读不出来。
 */

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import type { TrainerCubeState } from './useTrainerCube';

/** three + /sim 引擎只在真的挂了这颗魔方时才加载。 */
const SimCubeView = dynamic(() => import('@/components/sim-embed/SimCubeView'), {
  ssr: false,
  loading: () => (
    <div className="trainer-live-cube-3d trainer-live-cube-loading">
      <Spinner size={16} label={tr({ zh: '加载中', en: 'Loading' })} />
    </div>
  ),
});

export default function TrainerLiveCube({
  state, scramble,
}: {
  state: TrainerCubeState;
  /** 这一题的打乱 —— 日志的锚点,见文件头。 */
  scramble: string;
}) {
  const [calibrateNonce, setCalibrateNonce] = useState(0);
  const { cube, moves, quatRef } = state;

  // 打乱作为日志第一段。拆不拆词无所谓 —— SimCubeView 里最终是 join(' ') 成一条式子的,
  // 但拆开来第二段之后的每一手才算「纯追加」,那是能播动画的前提(见 sim_log.ts)。
  const log = useMemo(
    () => [...scramble.trim().split(/\s+/).filter(Boolean), ...moves],
    [scramble, moves],
  );

  return (
    <div className="trainer-live-cube">
      <SimCubeView
        moves={log}
        quatRef={quatRef}
        calibrateToken={calibrateNonce}
        view="front"
        className="trainer-live-cube-3d"
        animate
        ariaLabel={tr({
          zh: '智能魔方实时三维状态',
          en: 'Live 3D smart-cube state',
        })}
      />
      {/* 传感器认哪一边是「上」每个牌子都没验过,所以只能手动:把魔方摆正、点一下,
          这个姿态就成了基准。没有陀螺仪的魔方按了什么也不会变,那就不摆。 */}
      {cube.status.hasGyro && (
        <button
          type="button"
          className="trainer-opts-btn is-ghost"
          onClick={() => setCalibrateNonce(n => n + 1)}
          title={tr({
            zh: '把魔方当前朝向设为正面朝上的基准',
            en: 'Set the cube’s current orientation as the upright reference',
          })}
        >
          {tr({ zh: '校准朝向', en: 'Calibrate' })}
        </button>
      )}
    </div>
  );
}
