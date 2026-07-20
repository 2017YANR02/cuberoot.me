'use client';

/**
 * /scramble/mcc 的「计分方式」说明块。
 *
 * 表里的每个数字都由当前滑杆参数实时算出(而不是写死文案),所以调参后说明与
 * lib/mcc.ts 的实际取值始终一致。代价表达式与 lib/mcc.ts 的各 case 分支一一对应。
 */
import { T } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import type { EsqParams, MccParams } from '@/lib/mcc';

/** 显示用:2 位小数去尾。 */
const n2 = (n: number) => String(Math.round(n * 100) / 100);

interface CostRow {
  /** 动作(记号本身,不翻译) */
  move: string;
  /** 代价表达式(参数符号) */
  expr: string;
  /** 当前参数下的值 */
  value: string;
  zh: string;
  en: string;
}

function mccCostRows(p: MccParams): CostRow[] {
  const { wristMult: w, pushMult: pu, ringMult: r, double: h, sesliceMult: s, rotation: rot } = p;
  return [
    { move: "R R' L L'", expr: 'w', value: n2(w), zh: '手腕转', en: 'wrist turn' },
    { move: 'R2 L2', expr: 'h × w', value: n2(h * w), zh: '手腕 180°', en: 'wrist half turn' },
    { move: "U U'", expr: '1', value: '1', zh: '食指拨(本手)', en: 'index flick' },
    { move: "U U'", expr: 'p ~ 1.15p', value: `${n2(pu)} ~ ${n2(1.15 * pu)}`, zh: '另一手推', en: 'pushed by the other hand' },
    { move: 'U2', expr: 'h', value: n2(h), zh: '双指 180°', en: 'two-finger half turn' },
    { move: "D D'", expr: 'r', value: n2(r), zh: '无名指拨', en: 'ring-finger flick' },
    { move: "D D'", expr: 'r × p', value: n2(r * pu), zh: '无名指推', en: 'ring-finger push' },
    { move: 'D2', expr: 'h × r', value: n2(h * r), zh: '无名指 180°', en: 'ring-finger half turn' },
    { move: "F F' B B'", expr: '1 ~ r', value: `1 ~ ${n2(r)}`, zh: '拨 / 无名指拨', en: 'flick / ring flick' },
    { move: 'F2 B2', expr: 'h ~ h × r', value: `${n2(h)} ~ ${n2(h * r)}`, zh: '180°', en: 'half turn' },
    { move: "M'", expr: '1', value: '1', zh: '食指拨', en: 'index flick' },
    { move: 'M', expr: 'p', value: n2(pu), zh: '拇指推', en: 'thumb push' },
    { move: 'M2', expr: 'h', value: n2(h), zh: '180°', en: 'half turn' },
    { move: "S S' E E'", expr: 's ~ s × p', value: `${n2(s)} ~ ${n2(s * pu)}`, zh: '中层拨 / 推', en: 'slice flick / push' },
    { move: 'S2 E2', expr: 's × h', value: n2(s * h), zh: '中层 180°', en: 'slice half turn' },
    { move: "x x' x2", expr: '0', value: '0', zh: '只改握持,不计时', en: 'free — only shifts the grip' },
    { move: "y y' z z'", expr: 'rot', value: n2(rot), zh: '转身', en: 'rotation' },
    { move: 'y2 z2', expr: 'rot × h', value: n2(rot * h), zh: '转身 180°', en: 'half rotation' },
  ];
}

export default function ScoringGuide({ metric, mccParams, esqParams }: {
  metric: 'mcc' | 'esq';
  mccParams: MccParams;
  esqParams: EsqParams;
}) {
  const t = useT();
  const p = mccParams;

  if (metric === 'esq') {
    const { wristQuarter: wq, flickQuarter: fq, wristHalf: wh, flickHalf: fh } = esqParams;
    return (
      <section className="mcc-guide">
        <h2>{t('增强 SQTM 怎么算', 'How Enhanced SQTM is scored')}</h2>
        <p className="mcc-guide-lead">
          {t(
            '把每一步按「哪只手做 / 转多少度」分成四类,各计一个固定分,直接相加 —— 没有换手、过劳等情境代价,是一个纯粹的加权步数。',
            'Each move falls into one of four buckets by which motion performs it and how far it turns; the bucket values are simply summed. No regrip or fatigue modelling — it is a pure weighted move count.',
          )}
        </p>
        <p className="mcc-formula">
          {t('增强 SQTM', 'Enhanced SQTM')} = {t('Σ 每一步的档位分', 'Σ bucket value of each move')}
        </p>
        <div className="mcc-guide-table-wrap">
          <table className="mcc-guide-table">
            <thead>
              <tr>
                <th>{t('动作', 'Move')}</th>
                <th>{t('档位', 'Bucket')}</th>
                <th className="mcc-guide-num">{t('当前分值', 'Current value')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="mcc-guide-move">R L r l</td><td>{t('手腕 90°', 'wrist quarter')}</td><td className="mcc-guide-num">{n2(wq)}</td></tr>
              <tr><td className="mcc-guide-move">R2 L2 r2 l2</td><td>{t('手腕 180°', 'wrist half')}</td><td className="mcc-guide-num">{n2(wh)}</td></tr>
              <tr><td className="mcc-guide-move">{t('其余 90°(U F D B M S E x y z)', 'everything else, quarter (U F D B M S E x y z)')}</td><td>{t('手指 90°', 'flick quarter')}</td><td className="mcc-guide-num">{n2(fq)}</td></tr>
              <tr><td className="mcc-guide-move">{t('其余 180°', 'everything else, half')}</td><td>{t('手指 180°', 'flick half')}</td><td className="mcc-guide-num">{n2(fh)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mcc-guide-note">
          {t(
            '判据只看首字母:R / L 系(含小写宽层)算手腕,其余一律算手指;末尾是 2 就走 180° 档。',
            'The bucket is chosen by the first letter alone: R / L family (including lowercase wide moves) counts as wrist, everything else as a flick; a trailing 2 selects the half-turn value.',
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="mcc-guide">
      <h2>{t('MCC 怎么算', 'How MCC is scored')}</h2>
      <p className="mcc-guide-lead">
        {t(
          '它不是加权步数,而是一次执行模拟:程序替你摆好双手,逐步挑最省事的手法,累加每一步耗时,再加上被迫换手、手指没歇过来、魔方晃动这些额外开销。单位约等于「一次食指拨 U」= 1.0,所以数值大致可读作「相当于多少次 U 拨」。',
          'MCC is not a weighted move count — it is an execution simulation. The model holds the cube for you, picks the cheapest fingertrick for each move, sums how long each takes, then adds what it costs to regrip, to wait for a finger that has not recovered, and to steady a cube that has been knocked loose. One unit ≈ one index-finger U flick, so the score roughly reads as "how many U flicks this alg is worth".',
        )}
      </p>

      <p className="mcc-formula">
        MCC = Σ <T zh="动作代价" en="move cost" /> + Σ <T zh="换手" en="regrip" /> + Σ <T zh="过劳等待" en="overwork wait" />
        {' '}+ Σ <T zh="失稳 / 阻挡" en="destabilize / block" /> − Σ <T zh="连招折扣" en="trigger discount" />
      </p>

      <h3>{t('一、动作代价', '1. Move costs')}</h3>
      <p className="mcc-guide-note">
        {t(
          '同一个动作在不同握持下手法不同、代价也不同 —— 下表按当前滑杆参数实时计算(w=手腕转、p=推转、r=无名指拨、h=180°、s=中层、rot=转身)。',
          'The same move costs differently depending on the grip it is executed from. Values below are computed live from the current sliders (w = wrist, p = push, r = ring, h = half turn, s = slice, rot = rotation).',
        )}
      </p>
      <div className="mcc-guide-table-wrap">
        <table className="mcc-guide-table">
          <thead>
            <tr>
              <th>{t('动作', 'Move')}</th>
              <th>{t('手法', 'Fingertrick')}</th>
              <th>{t('代价', 'Cost')}</th>
              <th className="mcc-guide-num">{t('当前值', 'Current')}</th>
            </tr>
          </thead>
          <tbody>
            {mccCostRows(p).map((row, i) => (
              <tr key={`${row.move}-${i}`}>
                <td className="mcc-guide-move">{row.move}</td>
                <td>{t(row.zh, row.en)}</td>
                <td className="mcc-guide-expr">{row.expr}</td>
                <td className="mcc-guide-num">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t('二、附加代价', '2. Added costs')}</h3>
      <ul className="mcc-guide-list">
        <li>
          <strong>{t('换手', 'Regrip')}</strong>
          {t(
            `:走到某一步时双手怎么摆都做不出来,就在此处插入一次换手,代价 = 等空闲那只手的时间(最多 2)+ 软换手惩罚 ${n2(p.addRegrip)}。起手就不是中立握持同样计 ${n2(1 + p.addRegrip)}。`,
            `: when no hand position can perform the next move, a regrip is inserted there — costing the wait for the idle hand (at most 2) plus the soft-regrip penalty ${n2(p.addRegrip)}. Starting from a non-neutral grip costs the same ${n2(1 + p.addRegrip)}.`,
          )}
        </li>
        <li>
          <strong>{t('过劳等待', 'Overwork wait')}</strong>
          {t(
            `:同一根手指刚用过、这一步又要它换到别的位置,得先等它回来 —— 补上 ${n2(p.overWorkMult)} 减去已过去的时间。M' U' M' 这种连拨同指的序列就靠它拉开差距。`,
            `: if a finger was just used and now has to move somewhere else, the model waits out the remainder of ${n2(p.overWorkMult)}. This is what separates same-finger chains like M' U' M' from alternating ones.`,
          )}
        </li>
        <li>
          <strong>{t('失稳', 'Destabilize')}</strong>
          {t(
            `:在握不稳的姿势下做 U / B / D / S / E,每次 +${n2(p.destabilize)}。`,
            `: performing U / B / D / S / E from a shaky grip adds ${n2(p.destabilize)} each time.`,
          )}
        </li>
        <li>
          <strong>{t('前步阻挡', 'Move block')}</strong>
          {t(
            `:上一步的手指还压在这一步要转的层上,加 ${n2(p.moveblock)}(半挡 ${n2(p.moveblock * 0.5)})。`,
            `: the previous move leaves a finger sitting on the layer this move needs, adding ${n2(p.moveblock)} (half-block ${n2(p.moveblock * 0.5)}).`,
          )}
        </li>
        <li>
          <strong>{t('握持切换', 'Grip switch')}</strong>
          {t(
            ':R 块握 ⇄ L 块握 +0.65;上下握持(遇到小写 d 后再遇 U/u)+2.25。这两个是固定值,不随滑杆变。',
            ': switching between an R-block and an L-block grip adds 0.65; switching the up/down grip (a lowercase d followed later by U/u) adds 2.25. Both are fixed constants, not slider-controlled.',
          )}
        </li>
        <li>
          <strong>{t('U 与 D 同拨', 'Simultaneous U + D')}</strong>
          {t(
            ':相邻的 U、D 两步由两只手同时做,合并计为「较慢的一步 + 0.5」,比分别做快、但比单独一步慢。',
            ': an adjacent U and D are performed by both hands at once and merge into "the slower of the two + 0.5" — faster than doing them separately, slower than a single move.',
          )}
        </li>
      </ul>

      <h3>{t('三、连招折扣', '3. Trigger discounts')}</h3>
      <p className="mcc-guide-note">
        {t(
          "R U' R / R' U R 这类三步来回连招,手指本来就在位,减 0.5;换成 D 的对应形态(R D' R / R' D R)减 0.3。同样是固定值。",
          "Three-move back-and-forth triggers like R U' R / R' U R keep the fingers in place and get 0.5 off; the D-based counterparts (R D' R / R' D R) get 0.3 off. Fixed constants as well.",
        )}
      </p>

      <h3>{t('四、怎么挑最优手法', '4. How the best execution is found')}</h3>
      <p className="mcc-guide-note">
        {t(
          '程序先试 5 种起手握持各模拟一遍;哪一遍卡住了,就在卡住的位置插入换手,并对左右手 3×3 共 9 种新握持各分一支继续往下走,反复直到走完全程。最后取所有分支里总耗时最小的一条,四舍五入到 0.1 —— 也就是说,MCC 给的是「这条公式在最优手法下能有多快」,不含你没练熟、临场失误这些风险。',
          'The model simulates five starting grips; whenever a run gets stuck it inserts a regrip at that point and branches into all 3 × 3 combinations of new hand positions, repeating until a run reaches the end. The cheapest branch wins, rounded to 0.1. So MCC reports the potential of an alg under optimal fingertricks — it says nothing about how well you know it or how likely you are to lock up.',
        )}
      </p>
    </section>
  );
}
