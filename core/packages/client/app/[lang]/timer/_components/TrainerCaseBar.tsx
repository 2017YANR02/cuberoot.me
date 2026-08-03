'use client';

/**
 * TrainerCaseBar — 「按难度生成」出的这条打乱是哪个 case、几步,以及(点了才算的)一条最优解。
 *
 * 这是 or18 那批训练器真正在训练的东西:题目本身写着「白十字 5 步」,你先自己找,找完对答案。
 * 只在随机来源 + 难度开启时出现,信息来自 trainer_pool 记下的生成态(不重新求解打乱)。
 *
 * 答案是**按需算**的:深一点的 XXCross 逐步下降要几百毫秒,而绝大多数打乱用户根本不会点。
 * 算完就留在这条打乱上(换打乱即清空),再点是收起,不会重算。
 */

import { useEffect, useState } from 'react';
import { stageLabel, uiVariantOf, variantLabel } from '@/lib/scramble-variants';
import { solveTrainerCase, trainerMetaFor } from '../_lib/scramble/trainer_pool';
import { tr } from '@/i18n/tr';

interface Props { scramble: string; isZh: boolean }

export default function TrainerCaseBar({ scramble, isZh }: Props) {
  const meta = trainerMetaFor(scramble);
  const [sol, setSol] = useState<{ notation: string; frame: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  // 换打乱 = 换题:收起答案(留着上一题的解会直接剧透这一题)。
  useEffect(() => { setSol(null); setShown(false); }, [scramble]);

  if (!meta) return null;

  const reveal = () => {
    if (sol) { setShown((v) => !v); return; }
    setBusy(true);
    void solveTrainerCase(scramble, isZh).then((r) => {
      setBusy(false);
      if (r) { setSol(r); setShown(true); }
    });
  };

  const stage = stageLabel(meta.spec.stage, isZh);
  // 方法名按站内的 UI 聚合来叫(数据变体 '222' 在下拉里是「砖」、'eoline' 是「EO」),否则这里会
  // 冒出「222 222」这种数据层的名字。标准不加前缀;阶段名里已经含着方法名的(EO 方法的 EO 与
  // EOLine 两个阶段)也不叠 —— 「EO EOLine」只是把同一个词说了两遍。
  const ui = uiVariantOf(meta.spec.variant);
  const name = ui === 'std' ? '' : variantLabel(ui, isZh);
  const method = name && !stage.startsWith(name) ? `${name} ` : '';

  return (
    <div
      className="trainer-case"
      data-no-timer
      // allow-static-onclick: 不是按钮,只是拦掉冒泡 —— 这条在打乱条里,点打乱条默认换题,
      // 读答案时误点就把答案连题一起换掉了。
      onClick={(e) => e.stopPropagation()}
    >
      <span className="trainer-case-what">
        {method}{stage}
        <span className="trainer-case-depth">
          {tr({ zh: `${meta.depth} 步`, en: `${meta.depth} move${meta.depth === 1 ? '' : 's'}` })}
        </span>
      </span>
      <button
        type="button"
        className="trainer-case-reveal"
        onClick={(e) => { e.stopPropagation(); reveal(); }}
        disabled={busy}
      >
        {busy
          ? tr({ zh: '求解中', en: 'Solving' })
          : shown ? tr({ zh: '收起', en: 'Hide' }) : tr({ zh: '答案', en: 'Answer' })}
      </button>
      {shown && sol && (
        <span className="trainer-case-sol">
          {sol.frame && <span className="trainer-case-frame">{sol.frame}</span>}
          {sol.notation}
        </span>
      )}
    </div>
  );
}
