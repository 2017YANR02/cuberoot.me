import { J_LESSON_MASK, LBL_STEPS, LBL_BASICS, type LblExample } from './content';
import { ALG_LESSONS } from './alg-lessons';
import { COMPLETE_DEMO_STAGES, type CompleteDemoStage } from './complete-demo-state';

type Text = { zh: string; en: string };
export type Lesson = {
  id: string; title: Text;
  kind: 'overview' | 'facelet' | 'layers' | 'notation' | 'terms' | 'example' | 'complete' | 'recognition';
  example?: LblExample;
  mask?: string;
  paragraphs?: Text[];
};
type Chapter = typeof LBL_STEPS[number] & { lessons: Lesson[] };
export const chapters: Chapter[] = LBL_STEPS.flatMap(step => {
  const lessons: Lesson[] = [{ id: 'overview', title: { zh: '概览', en: 'Overview' }, kind: 'overview' }];
  if (step.id === 'structure') {
    lessons.push({ id: 'facelet', title: { zh: '格', en: 'Facelets' }, kind: 'facelet' });
    lessons.push(...LBL_BASICS.map(card => ({ id: card.id, title: card.title, kind: 'example' as const,
      mask: card.mask, example: { title: card.title, hint: card.headline, alg: card.alg, setup: card.setup, startSolved: true }, paragraphs: [card.hint] })));
    lessons.push({ id: 'layers', title: { zh: '认识楼层', en: 'The layers' }, kind: 'layers' });
    lessons.push({ id: 'notation', title: { zh: '转动记号', en: 'Move notation' }, kind: 'notation' });
  }
  if (['middle', 'corner-position', 'edge-position'].includes(step.id)) lessons.push({ id: 'terms', title: { zh: '术语介绍', en: 'Terminology' }, kind: 'terms' });
  if (step.id === 'cross') lessons.push({ id: 'white-edge', title: { zh: '白棱归位', en: 'Solve one white edge' }, kind: 'example',
    example: { title: { zh: '白棱归位', en: 'Solve one white edge' }, alg: "U' R2", setup: 'R2 U',
      hint: { zh: '转顶层，让白棱侧面的颜色对齐同色中心。做“上上”归位。', en: 'Turn the top to match the white edge’s side color with its center. Turn the right face twice to insert it.' } } });
  if (step.id !== 'structure') lessons.push(...step.examples.map((example, index) => ({ id: `case-${index}`, title: example.title,
    kind: step.id === 'cross' ? 'complete' as const : 'example' as const, example: step.id === 'cross' ? undefined : example })));
  if (COMPLETE_DEMO_STAGES.includes(step.id as CompleteDemoStage)) lessons.push({ id: 'complete', title: { zh: '完整演示', en: 'Complete demonstration' }, kind: 'complete' });
  const interludes: Chapter[] = ALG_LESSONS.filter(lesson => lesson.after === step.id).map(interlude => ({
    id: interlude.id, title: {
      'trigger-learning': { zh: '左右公式', en: 'Left & right triggers' },
      'sune-learning': { zh: '小鱼公式', en: 'Sune algorithms' },
      'l-alg-learning': { zh: 'J公式', en: 'J algorithm' },
    }[interlude.id] ?? interlude.title, goal: interlude.usage, paragraphs: [], examples: [],
    lessons: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, kind: 'overview' as const },
      ...(interlude.id === 'sune-learning' ? [{ id: 'recognition', title: { zh: '状态辨识', en: 'Recognize the case' }, kind: 'recognition' as const }] : []),
      ...interlude.algs.map((alg, index) => ({ id: `${interlude.id}-${index}`, title: alg.title, kind: 'example' as const,
      mask: interlude.id === 'sune-learning' ? 'sim:oll' : interlude.id === 'l-alg-learning' ? J_LESSON_MASK : '',
      example: { title: alg.title, alg: alg.alg, hint: interlude.id === 'l-alg-learning' ? { zh: '', en: '' } : alg.naming }, paragraphs: interlude.id !== 'trigger-learning' && interlude.usage.zh ? [interlude.usage] : [] })),
    ],
  }));
  return [{ ...step, lessons }, ...interludes];
});
