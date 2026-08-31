import type { TimerScrambleSourceKind } from './types';

/** Runtime-neutral copy for the shared Web/Android/iOS timer print document. */
export interface TimerPrintDocumentCopy {
  best: string;
  comment: string;
  current: string;
  date: string;
  empty: string;
  generated: string;
  mean: string;
  number: string;
  result: string;
  results: string;
  scramble: string;
  session: string;
  source: string;
  sourceManual: string;
  sourceRandom: string;
  sourceWca: string;
  solved: string;
  solves: string;
  summary: string;
  timer: string;
  worst: string;
}

export const TIMER_PRINT_DOCUMENT_COPY = {
  en: {
    best: 'Best',
    comment: 'Comment',
    current: 'Current',
    date: 'Date',
    empty: 'No solves in this event.',
    generated: 'Generated',
    mean: 'Mean',
    number: '#',
    result: 'Result',
    results: 'Results',
    scramble: 'Scramble',
    session: 'Session',
    source: 'Source',
    sourceManual: 'Manual input',
    sourceRandom: 'Random state',
    sourceWca: 'WCA real',
    solved: 'Solved',
    solves: 'Solves',
    summary: 'Summary',
    timer: 'Cube Timer',
    worst: 'Worst',
  },
  zh: {
    best: '最佳',
    comment: '备注',
    current: '当前',
    date: '日期',
    empty: '当前项目还没有成绩。',
    generated: '生成时间',
    mean: '平均',
    number: '序号',
    result: '成绩',
    results: '成绩明细',
    scramble: '打乱',
    session: '分组',
    source: '来源',
    sourceManual: '手动输入',
    sourceRandom: '随机状态',
    sourceWca: 'WCA 真题',
    solved: '成功',
    solves: '次数',
    summary: '统计摘要',
    timer: '魔方计时器',
    worst: '最慢',
  },
} as const satisfies Record<'en' | 'zh', TimerPrintDocumentCopy>;

/** Canonical print spelling for every scramble source, with optional provenance. */
export function timerPrintScrambleSource(
  kind: TimerScrambleSourceKind,
  language: 'en' | 'zh',
  detail?: string,
): string {
  const copy = TIMER_PRINT_DOCUMENT_COPY[language];
  const label = kind === 'wca'
    ? copy.sourceWca
    : kind === 'random'
      ? copy.sourceRandom
      : copy.sourceManual;
  return detail ? `${label} · ${detail}` : label;
}
