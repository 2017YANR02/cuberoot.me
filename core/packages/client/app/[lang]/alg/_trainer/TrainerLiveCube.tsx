'use client';

/**
 * 训练器上那颗跟着手转的魔方。
 *
 * q2Look / 三维都是用户主动选择的实时投影,选择后就立即显示;否则下拉已经切了,
 * 画面却仍是旧的 case 识别图,设置看起来完全没生效。q2Look 读实时 facelets;
 * 三维在第一手之前用当前题打乱建立初始状态,之后再按智能魔方的每一手追加动画。
 *
 * 每次重新瞄准 `moves` 都会清空(见 useTrainerCube),所以下一题自动回到识别图,
 * 上一题的收尾手也不会把它提前翻成立体图。
 *
 * 校准按钮只属于三维视图:q2Look 是固定投影,没有朝向可校准。按钮放在三维画面下方,
 * 不参与「识别图 → 实况图」的切换。
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
import { FaceletsCube } from '@/components/FaceletsCube';
import { tr } from '@/i18n/tr';
import { mirrorForBrand, sensorBasisForBrand } from '../../timer/_lib/bluetooth/orientation';
import type { TrainerCubeState } from './useTrainerCube';
import { pickTrainerLiveVisual } from './trainer-live-view';

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
  const { cube, moves, quatRef, view } = state;
  const visual = pickTrainerLiveVisual(view, !!cube.facelets);

  // three + /sim 引擎那一大块在魔方瞄准这一题时就先拉下来,别等到第一手才开始下载 ——
  // 那一手正是它该出现的时刻,现拉就是当场卡一下。拉完不渲染,不花帧。
  useEffect(() => {
    if (view === '3d') void import('@/components/sim-embed/SimCubeView');
  }, [view]);

  // 打乱作为日志第一段。拆不拆词无所谓 —— SimCubeView 里最终是 join(' ') 成一条式子的,
  // 但拆开来第二段之后的每一手才算「纯追加」,那是能播动画的前提(见 sim_log.ts)。
  const log = useMemo(
    () => [...scramble.trim().split(/\s+/).filter(Boolean), ...moves],
    [scramble, moves],
  );

  return (
    <div className="trainer-live-cube">
      {visual === 'q2look' && cube.facelets ? (
        <FaceletsCube
          fd={cube.facelets.toLowerCase()}
          view="q2look"
          size={140}
          alt={tr({ zh: '智能魔方 q2Look 实时状态', en: 'Live q2Look smart-cube state' })}
        />
      ) : visual === 'idle' ? idle : (
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
      {/* 手动校准只服务三维姿态:q2Look 是固定投影,不显示一个按了没意义的按钮。 */}
      {view === '3d' && cube.status.hasGyro && (
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
