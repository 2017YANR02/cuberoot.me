import type { ReactNode } from 'react';
import type { CfopFormulaFocus, CfopReplayStage } from './cfop-diagnosis';
import type { CfopHistoryIssue } from './cfop-personal-baseline';
import type { ReconstructLocalize } from './ReconstructHost';

export const cfopSeconds = (ms: number) => (ms / 1000).toFixed(3);

type Copy = { zh: string; en: string };
type Training = CfopReplayStage['training'] | 'auf';

export const cfopIssueLabels: Record<CfopHistoryIssue, Copy> = {
  incomplete: { zh: '动作记录疑似缺失，无法确认还原完成', en: 'Possible missing moves; a complete solve could not be verified' },
  clock: { zh: '动作时间无效或顺序倒退', en: 'Invalid or out-of-order move timestamps' },
  boundary: { zh: '阶段边界无法核对', en: 'Stage boundaries could not be verified' },
  'after-timer': { zh: '动作记录晚于计时成绩', en: 'Recorded moves extend past the timer result' },
  'shared-timestamp': { zh: '多个动作共用时间戳', en: 'Moves share a timestamp' },
  'marked-incorrect': { zh: '复盘已标记为不正确', en: 'The reconstruction was marked incorrect' },
  'other-method': { zh: '未识别为三阶 CFOP', en: 'The solve was not identified as 3×3 CFOP' },
  'no-comparable-stage': { zh: '没有可比的阶段或局面', en: 'No comparable stage or position' },
};

const recognitionPlans: Record<Exclude<Training, 'auf'>, Copy> = {
  cross: {
    zh: '用 5 条新打乱练十字。观察时想好前两枚棱的顺序，再起手。',
    en: 'Use five new scrambles. During inspection, plan your first two cross edges before turning.',
  },
  f2l: {
    zh: '连续练 5 组同类局面。做完十字或上一组前，先找到下一组的角块和棱块。',
    en: 'Practise five similar pairs. Locate the next corner and edge before finishing the cross or the previous pair.',
  },
  oll: {
    zh: '从不同的顶层朝向练 5 次。每次先口答是什么局面，再揭开核对，认对后再转。',
    en: 'Practise five times from varied starting angles. Name the case aloud, reveal the answer, and turn after identifying it correctly.',
  },
  pll: {
    zh: '从不同的顶层朝向练 5 次。每次先看侧面配色并口答，再揭开核对，认对后再转。',
    en: 'Practise five times from varied starting angles. Read the side colors, name the case aloud, then reveal to check before turning.',
  },
};

const executionPlans: Record<Training, Copy> = {
  cross: {
    zh: '用同一打乱慢做十字 3 次，确认四条棱落位。再换新打乱计时做 5 次。',
    en: 'Redo the cross slowly three times and check all four edges. Then time five crosses on new scrambles.',
  },
  f2l: {
    zh: '从同一局面慢做 3 次配对和插入，检查已解槽位。再换 5 个同类局面计时。',
    en: 'Pair and insert slowly three times from the same position, checking solved slots. Then time five similar cases.',
  },
  oll: {
    zh: '同一局面慢做 3 次，每次确认顶面颜色一致，再完整计时做 5 次。',
    en: 'Repeat the same case slowly three times, checking the top-face color. Then time five complete attempts.',
  },
  pll: {
    zh: '同一局面慢做 3 次，每次核对四个侧面和最后的顶层对齐，再完整计时做 5 次。',
    en: 'Repeat the same case slowly three times, checking all four sides and final U alignment. Then time five complete attempts.',
  },
  auf: {
    zh: '从不同的顶层朝向练 5 次。每次先看侧面颜色，再一次对齐顶层并核对四侧。',
    en: 'Practise five times from varied starting angles. Read the side colors, align the top layer in one move, and check all four sides.',
  },
};

const fewerTurnPlans: Record<Exclude<Training, 'auf'>, Copy> = {
  cross: {
    zh: '把原打乱摆回去，找一条能少转几步的十字解法。各试 3 次，核对四条棱是否正确落位。',
    en: 'Set up the original scramble and look for a shorter cross. Try each solution three times and check all four edges.',
  },
  f2l: {
    zh: '回到同一组块的起始局面，找更直接的配对和插入。各试 3 次，核对已解槽位是否保留。',
    en: 'Return to the same pair position and find a more direct pair and insert. Try each solution three times and check the solved slots.',
  },
  oll: {
    zh: '用同一局面各试 3 次原解法和另一条同局面公式，比较步数并核对顶面颜色。',
    en: 'Try your original solution and another algorithm for the same case three times each. Compare the turn counts and check the top face.',
  },
  pll: {
    zh: '用同一局面各试 3 次原解法和另一条同局面公式。比较步数时，把最后对齐顶层的动作也算进去。',
    en: 'Try your original solution and another algorithm for the same case three times each. Include turns for final U alignment in both counts.',
  },
};

export function CfopPracticePlan({ stage, focus, tr, children }: {
  stage: Training; focus: CfopFormulaFocus | 'turns'; tr: ReconstructLocalize; children?: ReactNode;
}) {
  const recognition = stage !== 'auf' && focus === 'recognition';
  const fewerTurns = stage !== 'auf' && focus === 'turns';
  return <section className="cfop-practice">
    <h4>{tr({ zh: '训练计划', en: 'Practice plan' })}</h4>
    <p>{tr(fewerTurns ? fewerTurnPlans[stage] : recognition ? recognitionPlans[stage] : executionPlans[stage])}</p>
    <p className="cfop-note">{tr(stage === 'auf' ? {
      zh: '复测时记录 5 次中一次对齐了几次。',
      en: 'On the retest, count how many of the five attempts align in one move.',
    } : recognition ? {
      zh: '复测时记下做对几次。把 5 次起手前用时排序，看排在中间的那次是否比之前短。',
      en: 'On the retest, record how many attempts were correct and whether the median time before execution improves.',
    } : fewerTurns ? {
      zh: '复测时用同一规则数步，记录新解法少了几步、做对了几次。',
      en: 'On the retest, use the same turn-counting rules and record how many turns you save and how often you get it right.',
    } : {
      zh: '复测时把 5 次执行用时排序，看排在中间的那次是否缩短，同时记录做对几次。',
      en: 'On the retest, compare median execution time over five attempts and record how many were correct.',
    })}</p>
    {children}
  </section>;
}

export function CfopEvidence({ items }: {
  items: Array<{ label: string; value: ReactNode; detail?: string; highlighted?: boolean }>;
}) {
  return <dl className="cfop-evidence">{items.map(({ label, value, detail, highlighted }) =>
    <div key={label} data-highlighted={highlighted || undefined}>
      <dt>{label}</dt>
      <dd>{value}{detail && <small>{detail}</small>}</dd>
    </div>,
  )}</dl>;
}
