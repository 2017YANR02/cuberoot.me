'use client';

/**
 * 打乱条上的逐步提示:已拧的变暗、当前这步高亮、剩下的正常。
 *
 * 从 SoloView 的打乱条里抽出来的 —— 联机房要一模一样的东西,而这段渲染和 solo
 * 的其余部分(WCA 来源、手动队列、点击复制)没有关系,留在那里就得抄一遍。
 *
 * `tailExtra` 是给最后一步挂东西用的(solo 的「已复制」绿勾):它必须绝对定位在
 * 最后一步右边而**不占宽度**,否则会多出一个断行点,把最后一步挤到下一行。
 */

import { Fragment, type ReactNode } from 'react';

import type { ScrambleHint } from '../_lib/bluetooth/scramble_hint';

export default function ScrambleHintText({ hint, tailExtra }: { hint: ScrambleHint; tailExtra?: ReactNode }) {
  const moves: Array<{ m: string; state: 'done' | 'current' | 'pending' }> = [
    ...hint.done.map((m) => ({ m, state: 'done' as const })),
    ...(hint.current === null ? [] : [{ m: hint.current, state: 'current' as const }]),
    ...hint.pending.map((m) => ({ m, state: 'pending' as const })),
  ];
  return (
    <>
      {moves.map(({ m, state }, idx) => {
        const isLast = idx === moves.length - 1;
        const span = <span className="scramble-move" data-hint={state}>{m}</span>;
        return (
          <Fragment key={idx}>
            {idx > 0 ? ' ' : null}
            {isLast ? <span className="scramble-copied-tail">{span}{tailExtra}</span> : span}
          </Fragment>
        );
      })}
    </>
  );
}
