'use client';

import { useState } from 'react';
import MoreToggle from '@/components/MoreToggle';
import { T, tr } from '@/i18n/tr';
import { FL_CASE_ALGS } from '../2x2-fl/case-algs';
import { EG_CASES } from './lesson-data';
import SolveComparisonDemo from './SolveComparisonDemo';
import data from './solve-comparison-data.json';

const flAlgorithmCount = Object.values(FL_CASE_ALGS)
  .flatMap(group => Object.values(group))
  .reduce((total, cases) => total + cases.length, 0);
const bottomMethods = {
  lbl: { label: { zh: '逐角拼层', en: 'Corner by corner' }, looks: 3, algorithms: 2 },
  fl: { label: { zh: 'FL 拼层', en: 'FL' }, looks: 2, algorithms: flAlgorithmCount },
  face: { label: { zh: '只拼一面', en: 'One face' }, looks: 1, algorithms: 0 },
};
const finishes = {
  lbl: { label: { zh: '层先收尾', en: 'LBL finish' }, algorithms: 3 },
  cll: { label: { zh: 'CLL', en: 'CLL' }, algorithms: EG_CASES.filter(item => item.set === 'cll').length },
  ortega: { label: { zh: 'Ortega', en: 'Ortega' }, algorithms: 7 + 5 }, // OLL + PBL
  eg: { label: { zh: 'EG', en: 'EG' }, algorithms: EG_CASES.length },
};
const bottomOptions = ['lbl', 'fl', 'face'] as const;
const finishOptions = ['two', 'one'] as const;
const palettes = [1, 2, 6] as const;
const moveScale = Math.max(...Object.values(data.totals).flatMap(modes =>
  Object.values(modes).flatMap(entries => entries.map(([opening, ending]) => (opening + ending) / data.sampleSize))));
const paletteLabels = {
  1: { zh: '单色底', en: '1 color' },
  2: { zh: '双色底', en: '2 colors' },
  6: { zh: '六色底', en: '6 colors' },
};
const paletteDetail = {
  1: { zh: '固定白底', en: 'White only' },
  2: { zh: '白、黄二选一', en: 'White or yellow' },
  6: { zh: '六色任选', en: 'Any of the six colors' },
};

type Bottom = typeof bottomOptions[number];
type Finish = typeof finishOptions[number];
type Palette = typeof palettes[number];
type Label = { zh: string; en: string };

function finishMethod(bottom: Bottom, finish: Finish) {
  if (bottom === 'face') return finish === 'one' ? finishes.eg : finishes.ortega;
  return finish === 'one' ? finishes.cll : finishes.lbl;
}

function result(bottom: Bottom, finish: Finish, palette: Palette) {
  const [bottomSum, finishSum] = data.totals[bottom][finish][palettes.indexOf(palette)];
  const opening = bottomSum / data.sampleSize;
  const ending = finishSum / data.sampleSize;
  const method = bottomMethods[bottom];
  const end = finishMethod(bottom, finish);
  return {
    bottom: method.label,
    finish: end.label,
    opening,
    ending,
    moves: opening + ending,
    looks: method.looks + (finish === 'one' ? 1 : 2),
    algorithms: method.algorithms + end.algorithms,
  };
}

const referenceSelection = { bottom: 'face', finish: 'one', paletteIndex: palettes.indexOf(6) } as const;
const reference = result(referenceSelection.bottom, referenceSelection.finish, palettes[referenceSelection.paletteIndex]);

function Choices<TValue extends string | number>({ label, options, value, onChange, optionLabel }: {
  label: Label;
  options: readonly TValue[];
  value: TValue;
  onChange: (value: TValue) => void;
  optionLabel: (value: TValue) => Label;
}) {
  return <fieldset className="eg-comparison-choice">
    <legend><T {...label} /></legend>
    <div className="eg-actions">
      {options.map(option => <button type="button" key={option} className="btn-secondary eg-control"
        aria-pressed={value === option} onClick={() => onChange(option)}><T {...optionLabel(option)} /></button>)}
    </div>
  </fieldset>;
}

export default function SolveComparison() {
  const [palette, setPalette] = useState<Palette>(1);
  const [bottom, setBottom] = useState<Bottom>('lbl');
  const [finish, setFinish] = useState<Finish>('two');
  const selected = result(bottom, finish, palette);

  return <section className="eg-comparison" aria-label={tr({ zh: '还原流程对比', en: 'Compare solve methods' })}>
    <h3><T zh="还原流程对比" en="Compare solve methods" /></h3>
    <div className="eg-comparison-controls">
      <Choices label={{ zh: '底色范围', en: 'Bottom colors' }} options={palettes} value={palette}
        onChange={setPalette} optionLabel={option => paletteLabels[option]} />
      <Choices label={{ zh: '底层方法', en: 'Opening' }} options={bottomOptions} value={bottom}
        onChange={setBottom} optionLabel={option => bottomMethods[option].label} />
      <Choices label={{ zh: '顶层及收尾', en: 'Finish' }} options={finishOptions} value={finish}
        onChange={setFinish} optionLabel={option => finishMethod(bottom, option).label} />
    </div>
    <p className="eg-comparison-caption"><T {...paletteDetail[palette]} /> · <T zh={`${data.sampleSize} 个相同随机状态 · 模拟步数（HTM）`}
      en={`Same ${data.sampleSize} random states · simulated moves (HTM)`} /></p>
    <table className="eg-comparison-results">
      <caption className="sr-only"><T zh="当前方案与固定对照的步数、观察次数和公式量" en="Moves, looks, and algorithms for the selected method and fixed reference" /></caption>
      <thead><tr>
        <th scope="col"><T zh="方案" en="Method" /></th>
        <th scope="col"><T zh="平均还原步数" en="Avg. moves" /></th>
        <th scope="col"><T zh="观察次数" en="Looks" /></th>
        <th scope="col"><T zh="公式量" en="Algs" /></th>
      </tr></thead>
      <tbody>{[selected, reference].map((item, index) => <tr key={index}>
        <th scope="row">
          <span className="eg-comparison-caption">{index === 0 ? <T zh="当前方案" en="Selected" /> : <T zh="固定对照 · 六色底" en="Fixed reference · 6 colors" />}</span>
          <span><T {...item.bottom} /> + <T {...item.finish} /></span>
        </th>
        <td><strong>{item.moves.toFixed(1)}</strong>
          <span className="eg-comparison-bar" aria-hidden="true">
            <span style={{ width: `${100 * item.opening / moveScale}%` }} />
            <span style={{ width: `${100 * item.ending / moveScale}%` }} />
          </span>
          <span className="eg-comparison-caption"><T zh={`底层 ${item.opening.toFixed(1)} · 收尾 ${item.ending.toFixed(1)}`}
            en={`Open ${item.opening.toFixed(1)} · Finish ${item.ending.toFixed(1)}`} /></span>
        </td>
        <td><strong>{item.looks}</strong></td>
        <td><strong>{item.algorithms}</strong></td>
      </tr>)}</tbody>
    </table>
    <p className="sr-only" aria-live="polite"><T zh={`${selected.moves.toFixed(1)} 步，观察 ${selected.looks} 次，公式 ${selected.algorithms} 条。`}
      en={`${selected.moves.toFixed(1)} moves, ${selected.looks} looks, and ${selected.algorithms} algorithms.`} /></p>
    <p className="eg-comparison-caption"><T zh="观察次数按独立识别的阶段计，含起手观察，最后对齐并入收尾。跳步和预判会减少实际次数。"
      en="Looks count separately recognized stages, including inspection. Final alignment is part of the finish. Skips and one-looking can reduce this count." /></p>
    <SolveComparisonDemo selected={{ bottom, finish, paletteIndex: palettes.indexOf(palette) }} reference={referenceSelection} />
    <details className="eg-details">
      <MoreToggle as="summary"><T zh="计算口径" en="How the comparison is calculated" /></MoreToggle>
      <p><T zh="模拟在每个阶段取一条最短解，逐角拼层从参考角开始，FL 先做左角对，再同时解决另两角。收尾按是否先翻顶面分成两段或一段。允许多个底色时，每个状态选模拟总步数最少的那条路线。面转 90° 或 180° 都记一步，转体不计，阶段之间不消步。总数与分项独立取到一位小数。结果反映这些阶段目标，不是照抄教程公式或选手的实测成绩。"
        en="The simulation takes one shortest path at each checkpoint. Corner-by-corner starts with a reference corner. FL builds the left pair, then finishes the other two corners together. Finishes either orient the top separately or solve in one stage. With multiple colors, each state uses the shortest of the simulated routes. Quarter and half turns each count as one move. Rotations are free, and moves aren’t canceled between stages. Totals and subtotals are rounded separately. The results model these checkpoints, not tutorial algorithms or timed solves." /></p>
      <p><T zh="公式量按底层和收尾所教的公式合计。逐角拼层计左右两种手法，层先收尾计左右鱼和一条换角公式。成套公式中，每个需要做公式的 case 计一条，摆位、对齐和备选公式不计。"
        en="Algorithm counts add the opening and finish. Corner by corner uses a left and right trigger. The LBL finish uses two Sunes and one corner permutation. Full sets count one algorithm per case that needs one. Setup moves, alignment, and alternative algorithms are excluded." /></p>
    </details>
  </section>;
}
