import { J_LESSON_MASK, LBL_STEPS, LBL_BASICS, type LblExample } from './content';
import { ALG_LESSONS } from './alg-lessons';
import { COMPLETE_DEMO_STAGES, type CompleteDemoStage } from './complete-demo-state';

type Text = { zh: string; en: string };
export type Lesson = {
  id: string; title: Text;
  kind: 'overview' | 'facelet' | 'layers' | 'notation' | 'terms' | 'example' | 'complete' | 'recognition' | 'flowchart';
  example?: LblExample;
  mask?: string;
  paragraphs?: Text[];
  practiceIndices?: number[];
};
type Chapter = typeof LBL_STEPS[number] & { lessons: Lesson[]; archived?: boolean };
export const chapters: Chapter[] = LBL_STEPS.flatMap(step => {
  const lessons: Lesson[] = [{ id: 'overview', title: { zh: '概览', en: 'Overview' }, kind: 'overview' }];
  if (step.id === 'structure') {
    lessons.push({ id: 'facelet', title: { zh: '格', en: 'Facelets' }, kind: 'facelet' });
    lessons.push(...LBL_BASICS.map(card => ({ id: card.id, title: card.title, kind: 'example' as const,
      mask: card.mask, example: { title: card.title, hint: card.headline, alg: card.alg, setup: card.setup, startSolved: true }, paragraphs: [card.hint] })));
    lessons.push({ id: 'notation', title: { zh: '转动记号', en: 'Move notation' }, kind: 'notation' });
  }
  if (step.id === 'daisy') lessons.push(
    { id: 'layers', title: { zh: '认识楼层', en: 'The layers' }, kind: 'layers' },
  );
  if (['middle', 'corner-position', 'edge-position'].includes(step.id)) lessons.push({ id: 'terms', title: { zh: '术语介绍', en: 'Terminology' }, kind: 'terms' });
  if (step.id === 'cross') lessons.push({ id: 'white-edge', title: { zh: '白棱归位', en: 'Solve one white edge' }, kind: 'example',
    example: { title: { zh: '白棱归位', en: 'Solve one white edge' }, alg: "U' R2", setup: 'R2 U',
      hint: { zh: '转顶层，让白棱侧面的颜色对齐同色中心。做“上上”归位。', en: 'Turn the top to match the white edge’s side color with its center. Turn the right face twice to insert it.' } } });
  if (step.id !== 'structure') {
    const cases: Lesson[] = step.examples.map((example, index) => ({ id: `case-${index}`, title: example.title,
      kind: step.id === 'cross' ? 'complete' : 'example', example: step.id === 'cross' ? undefined : example, practiceIndices: [index] }));
    if (step.id === 'daisy') {
      cases[0].title = { zh: '二楼', en: 'Middle floor' };
      cases[0].practiceIndices = [0, 1];
      cases.splice(1, 1);
    }
    if (step.id === 'middle') {
      cases[2].title = { zh: '棱块在中层', en: 'Edge in the middle layer' };
      cases[2].practiceIndices = [2, 3];
      cases.splice(3, 1);
    }
    if (step.id === 'corners') {
      // Teach all top-layer cases before ejecting a corner from the bottom.
      const [bottomCorner] = cases.splice(1, 1);
      cases.push(bottomCorner);
    }
    lessons.push(...cases);
  }
  if (COMPLETE_DEMO_STAGES.includes(step.id as CompleteDemoStage)) lessons.push({ id: 'complete', title: { zh: '完整演示', en: 'Complete demonstration' }, kind: 'complete' });
  if (step.id !== 'structure') lessons.push({ id: 'flowchart', title: { zh: '流程图', en: 'Flowchart' }, kind: 'flowchart' });
  const interludes: Chapter[] = ALG_LESSONS.filter(lesson => lesson.after === step.id).map(interlude => ({
    archived: true,
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

const formulaChapterByLesson = new Map<Lesson, Chapter>();
export const activeChapters = chapters.flatMap((chapter, index) => {
  if (chapter.archived) return [];
  const formulaChapter = chapters[index - 1];
  if (!formulaChapter?.archived) return [chapter];
  const isFishChapter = formulaChapter.id === 'sune-learning';
  const fishOverview = isFishChapter
    ? formulaChapter.lessons.find(lesson => lesson.kind === 'overview')
    : undefined;
  const [overview, ...remaining] = chapter.lessons;
  const formulaExamples = formulaChapter.lessons.filter(lesson => lesson.kind === 'example').reverse();
  const formulaLessons = [
    ...(fishOverview ? [{ ...fishOverview, id: 'sune-overview', title: { zh: '小鱼', en: 'Sune' } }] : []),
    ...formulaChapter.lessons.filter(lesson => lesson.kind !== 'overview' && lesson.kind !== 'example'),
    ...formulaExamples.map((lesson, index) => isFishChapter ? { ...lesson, title: chapter.examples[index].title, practiceIndices: [index] } : lesson),
  ];
  for (const lesson of formulaLessons) formulaChapterByLesson.set(lesson, formulaChapter);
  const remainingLessons = isFishChapter ? remaining.filter(lesson => lesson.id !== 'case-0' && lesson.id !== 'case-1') : remaining;
  if (chapter.id === 'corner-position') {
    const terms = remainingLessons.find(lesson => lesson.kind === 'terms');
    return [{ ...chapter, lessons: [overview, ...(terms ? [terms] : []), ...formulaLessons, ...remainingLessons.filter(lesson => lesson !== terms)] }];
  }
  return [{ ...chapter, lessons: [overview, ...formulaLessons, ...remainingLessons] }];
});

export function lessonSourceChapter(chapter: Chapter, lesson: Lesson): Chapter {
  return formulaChapterByLesson.get(lesson) ?? chapter;
}

/** Keep grouped exercises adjacent and use the same order as the visible lessons. */
export function practiceExampleOrder(chapter: Chapter): number[] {
  const ordered = chapter.lessons.flatMap(lesson => lesson.practiceIndices ?? []);
  return [...new Set([...ordered, ...chapter.examples.map((_, index) => index)])];
}
