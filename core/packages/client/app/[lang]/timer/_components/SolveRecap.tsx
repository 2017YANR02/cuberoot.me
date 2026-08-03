'use client';

/**
 * SolveRecap —— 刚拧完的那把,就摊在计时页上。
 *
 * 复盘一直是「事后才想得起来」的东西:停表 → 打开成绩 → 找到刚才那条 → 点开。
 * 四步之后人早就开始下一把了,所以那份报告绝大多数时候没人看 —— 不是因为没用,
 * 是因为它在别的屏幕上。这块把它搬到停表那一刻的同一屏。
 *
 * 三条边界,决定了它是「顺手看一眼」而不是「又一个挡路的弹窗」:
 *
 *   - **不遮挡。** 它在文档流里,从计时区下面顶上来,读数和下一条打乱照旧在上面。
 *     空格照按 —— 开下一把时宿主直接把它卸掉(见 SoloView 的 phase 副作用)。
 *   - **只在有动作流时出现。** 手动/键盘计时的成绩没有可复盘的东西,这块不该冒出来
 *     占半屏。判定在宿主(`solve.moves`),这里只管渲染。
 *   - **报告只有一份实现。** 里面就是 `ReconstructReport` —— 和成绩详情页、`?replay=`
 *     深链是同一个组件,没有「精简版」分叉。想看全的按「整屏」,那是成绩详情页。
 *
 * 报告本体留在自己的 chunk 里(200 KB 起步,还牵三维魔方和 cubing.js):计时页首屏
 * 不该为一个还没发生的停表买单。宿主在智能魔方连上时就 onIdle 预取,所以真停表那
 * 一下它已经在注册表里了。
 */

import dynamic from 'next/dynamic';
import { Maximize2, X } from 'lucide-react';
import type { Solve } from '../_lib/types';
import { tr } from '@/i18n/tr';

const ReconstructReport = dynamic(() => import('./ReconstructReport'), { ssr: false });

export interface SolveRecapProps {
  solve: Solve;
  isZh: boolean;
  /** 同项目的历史成绩,给报告里的「比你平时快/慢多少」用。 */
  history: Solve[];
  /** 展开成整屏的成绩详情(那一页也渲染同一份报告)。 */
  onFull: () => void;
  /** 收起这块 —— 只关这一次,不改设置。 */
  onDismiss: () => void;
  onUseScramble?: (scramble: string) => void;
  onReconFeedback?: (ok: boolean | undefined) => void;
}

export default function SolveRecap({
  solve, isZh, history, onFull, onDismiss, onUseScramble, onReconFeedback,
}: SolveRecapProps) {
  return (
    <section className="shell-recap" aria-label={tr({ zh: '这把的复盘', en: 'This solve' })}>
      <div className="shell-recap-head">
        <span className="shell-recap-title">{tr({ zh: '这把', en: 'This solve' })}</span>
        <button type="button" className="shell-recap-btn" onClick={onFull}>
          <Maximize2 size={13} />
          {tr({ zh: '整屏', en: 'Full screen' })}
        </button>
        {/* 工具栏形态:左标题、右关闭。 */}
        <button
          type="button"
          className="shell-recap-x"
          onClick={onDismiss}
          aria-label={tr({ zh: '收起', en: 'Hide' })}
          title={tr({ zh: '收起', en: 'Hide' })}
        >
          <X size={16} />
        </button>
      </div>
      <div className="shell-recap-body">
        {/* hideDate:这把是刚拧完的,日期是唯一不用告诉他的东西。 */}
        <ReconstructReport
          solve={solve}
          isZh={isZh}
          history={history}
          hideDate
          onUseScramble={onUseScramble}
          onReconFeedback={onReconFeedback}
        />
      </div>
    </section>
  );
}
