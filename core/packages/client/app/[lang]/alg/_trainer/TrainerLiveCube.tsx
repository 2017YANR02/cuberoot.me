'use client';

/**
 * 训练器上那颗跟着手转的魔方。
 *
 * **出题时不出它。** 刚出一题的时候要看的是「这是哪个 case」,识别图(顶层平摊那张)
 * 说的就是这个,立体图说不了 —— 它只露一个面,还跟着手歪。等用户动了第一手,问题就
 * 换成了「我拧到哪儿了」,那才轮到立体图,而静态图这时候纹丝不动、看着像魔方没连上。
 * 所以这里按 `moves` 是否为空切:空 = 还没动手 = 出 `idle`(调用方给的识别图)。
 *
 * 每次重新瞄准 `moves` 都会清空(见 useTrainerCube),所以下一题自动回到识别图,
 * 上一题的收尾手也不会把它提前翻成立体图。
 *
 * 校准按钮不参与这次切换 —— 它属于这次连接,不属于哪张图。放在切换外面还顺带让这个
 * 格子的高度不随切换跳动。
 *
 * 日志从**还原态**起算,这一点是白得的:出题时 `useTrainerCube` 让魔方谎报「打乱作用在
 * 还原态上」的那个状态,所以 `打乱 + 这一题拧过的手` 恰好就是桌上那颗的真实状态。
 * /timer 那边要靠 `anchorAlgFor` 去猜开局,这里不用猜。
 *
 * 镜头正对 F 面(不是等轴):这颗魔方的姿态由陀螺仪给,校准按钮就在下面,而「歪没歪」
 * 只有正对一面时才看得出来 —— 等轴视角下几度偏差混在三个面的透视里读不出来。
 */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import { mirrorForBrand, sensorBasisForBrand } from '../../timer/_lib/bluetooth/orientation';
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
  state, scramble, idle,
}: {
  state: TrainerCubeState;
  /** 这一题的打乱 —— 日志的锚点,见文件头。 */
  scramble: string;
  /** 还没动手时摆在这儿的图(识别图)。见文件头第一段。 */
  idle: ReactNode;
}) {
  const [calibrateNonce, setCalibrateNonce] = useState(0);
  const { cube, moves, quatRef } = state;
  /** 动过手了没有。清空的时机归 `useTrainerCube` 管。 */
  const started = moves.length > 0;

  // three + /sim 引擎那一大块在魔方瞄准这一题时就先拉下来,别等到第一手才开始下载 ——
  // 那一手正是它该出现的时刻,现拉就是当场卡一下。拉完不渲染,不花帧。
  useEffect(() => { void import('@/components/sim-embed/SimCubeView'); }, []);

  // 打乱作为日志第一段。拆不拆词无所谓 —— SimCubeView 里最终是 join(' ') 成一条式子的,
  // 但拆开来第二段之后的每一手才算「纯追加」,那是能播动画的前提(见 sim_log.ts)。
  const log = useMemo(
    () => [...scramble.trim().split(/\s+/).filter(Boolean), ...moves],
    [scramble, moves],
  );

  return (
    <div className="trainer-live-cube">
      {!started ? idle : (
        <SimCubeView
          moves={log}
          quatRef={quatRef}
          calibrateToken={calibrateNonce}
          // 轴向走 /timer 那张品牌表,不另开一份:传感器怎么装在魔方里是这颗魔方的
          // 属性,和它出现在哪个页面上无关。
          sensorBasis={sensorBasisForBrand(cube.status.brand)}
          mirror={mirrorForBrand(cube.status.brand)}
          view="front"
          className="trainer-live-cube-3d"
          animate
          ariaLabel={tr({
            zh: '智能魔方实时三维状态',
            en: 'Live 3D smart-cube state',
          })}
        />
      )}
      {/* 手动校准:把魔方摆正、点一下,这个姿态就成了基准。它属于这次连接而不属于
          哪张图,所以两张图下面都在。没有陀螺仪的魔方按了也不会变,那就不摆。 */}
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
