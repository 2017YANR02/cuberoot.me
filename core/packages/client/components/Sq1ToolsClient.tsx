'use client';

import BackHome from '@/components/BackHome';
import Sq1AlgorithmTrainer from '@/components/Sq1AlgorithmTrainer';
import { Sq1Importer, Sq1Inspector, Sq1Visualizer } from '@/components/Sq1InputTools';
import { Sq1CountPositions, Sq1ParityGame, Sq1ShapeTrainer } from '@/components/Sq1PracticeTools';
import Sq1ToolNav from '@/components/Sq1ToolNav';
import { tr } from '@/i18n/tr';
import styles from './Sq1Tools.module.css';

export type Sq1Tool = 'inspect' | 'visualize' | 'import' | 'count' | 'parity-game' | 'train' | 'algorithm-trainer';

const TOOL_TEXT = {
  inspect: {
    title: { zh: 'SQ1 打乱检查', en: 'Square-1 scramble inspector' },
    intro: { zh: '检查记号、切层和最终状态；输入会自动保留在链接中。', en: 'Check the notation, slices, and final state. Your input stays in the link.' },
  },
  visualize: {
    title: { zh: 'SQ1 形状过程', en: 'Square-1 shape visualizer' },
    intro: { zh: '从指定起始状态逐步执行公式，查看每一步的上下层形状。', en: 'Run an algorithm from an optional setup and see the two layer shapes after every move.' },
  },
  import: {
    title: { zh: 'SQ1 复形公式导入', en: 'Square-1 cubeshape algorithm importer' },
    intro: { zh: '粘贴复形公式，反推出起始形状，并可直接查看完整过程。', en: 'Paste a cubeshape algorithm to infer its starting shape and inspect the full sequence.' },
  },
  count: {
    title: { zh: 'SQ1 奇偶数位', en: 'Square-1 parity count positions' },
    intro: { zh: '查看每种单层形状的可切转数，以及对应的奇偶分组。', en: 'See the sliceable turns for each layer shape and their parity groups.' },
  },
  'parity-game': {
    title: { zh: 'SQ1 奇偶游戏', en: 'Square-1 parity game' },
    intro: { zh: '把未出现的颜色补在末尾，再判断相对 O-B-R-G 是奇排列还是偶排列。也可按左右方向键作答。', en: 'Append the missing color, then decide whether the order is an odd or even permutation of O-B-R-G. You can also answer with Left or Right.' },
  },
  train: {
    title: { zh: 'SQ1 组合练习', en: 'Square-1 shape pair drill' },
    intro: { zh: '按上下层形状生成练习打乱；打开 15 秒观察可先看图，再显示名称。', en: 'Generate scrambles by top and bottom shape. Turn on 15-second inspection to hide the names while you study the diagram.' },
  },
  'algorithm-trainer': {
    title: { zh: 'SQ1 公式训练', en: 'Square-1 algorithm trainer' },
    intro: { zh: '从 Squanmate 的五组情况中练习公式，可按奇偶排列筛选并控制中层状态。', en: 'Practise Squanmate’s five case groups with parity filters and middle-layer control.' },
  },
} as const;

export default function Sq1ToolsClient({ tool }: { tool: Sq1Tool }) {
  const text = TOOL_TEXT[tool];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className="page-back-row"><BackHome /></div>
        <h1 className={styles.title}>{tr(text.title)}</h1>
        <p className={styles.intro}>{tr(text.intro)}</p>
      </header>
      <div className={styles.navRow}><Sq1ToolNav contained /></div>
      <div className={styles.content}>
        {tool === 'inspect' && <Sq1Inspector />}
        {tool === 'visualize' && <Sq1Visualizer />}
        {tool === 'import' && <Sq1Importer />}
        {tool === 'count' && <Sq1CountPositions />}
        {tool === 'parity-game' && <Sq1ParityGame />}
        {tool === 'train' && <Sq1ShapeTrainer />}
        {tool === 'algorithm-trainer' && <Sq1AlgorithmTrainer />}
      </div>
    </main>
  );
}
