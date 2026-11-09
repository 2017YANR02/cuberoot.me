import { parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';
import Practice from './Practice';
import { activeChapters, practiceExampleOrder } from './curriculum';

export default function PracticeRoute() {
  const [stepHints, setStepHints] = useState(false);
  const [route, setRoute] = useQueryStates({ view: parseAsString, step: parseAsString, case: parseAsString });
  const chapters = activeChapters.filter(chapter => chapter.id !== 'structure' && chapter.examples.length > 0);
  const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === route.step));
  const chapter = chapters[chapterIndex];
  const order = practiceExampleOrder(chapter);
  const extra = route.case === 'white-edge' ? chapter.lessons.find(lesson => lesson.id === 'white-edge')?.example : undefined;
  const requested = Number(route.case ?? 1);
  const position = Number.isInteger(requested) && requested >= 1 && requested <= order.length ? requested - 1 : 0;
  const moveChapter = (direction: number) => {
    const next = chapters[chapterIndex + direction];
    const nextOrder = practiceExampleOrder(next);
    void setRoute({ step: next.id, case: String(direction > 0 ? 1 : nextOrder.length) });
  };
  return <Practice key={`${chapter.id}/${route.case ?? '1'}`} step={chapter} exampleOrder={order}
    stepHints={stepHints} setStepHints={setStepHints}
    initialIndex={order[position]} extraExample={extra}
    onIndexChange={index => void setRoute({ step: chapter.id, case: String(extra ? index : index + 1) })}
    onPreviousChapter={chapterIndex > 0 ? () => moveChapter(-1) : undefined}
    onNextChapter={chapterIndex < chapters.length - 1 ? () => moveChapter(1) : undefined}
    onClose={() => void setRoute({ view: null, step: chapter.id, case: extra ? 'white-edge' : String(position + 1) }, { history: 'push' })} />;
}
