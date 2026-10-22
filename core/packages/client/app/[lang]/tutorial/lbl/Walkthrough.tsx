'use client';

import { useState } from 'react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { T, tr } from '@/i18n/tr';
import { LBL_INITIAL_VIEW, LBL_STEPS } from './content';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS, lessonFrame, type LblLessonStageId } from './lesson-runs';

export default function Walkthrough() {
  const [runIndex, setRunIndex] = useState(0);
  const [stage, setStage] = useState<LblLessonStageId | 'all'>('all');
  const run = LBL_LESSON_RUNS[runIndex];
  const frame = lessonFrame(run, stage);
  const step = LBL_STEPS.find(item => item.id === stage);
  return <main className="lbl-page lbl-walkthrough">
    <header className="lbl-header">
      <BackHome />
      <Link href="/tutorial/lbl" prefetch={false}><T zh="层先法" en="LBL" /></Link>
      <h1><T zh="完整还原" en="Full solve" /></h1>
    </header>
    <div className="lbl-walkthrough-options">
      <label><T zh="示例" en="Example" />
        <select className="lbl-walkthrough-select" value={runIndex} onChange={event => setRunIndex(Number(event.target.value))}>
          {LBL_LESSON_RUNS.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select>
      </label>
      <label><T zh="播放范围" en="Playback range" />
        <select className="lbl-walkthrough-select" value={stage} onChange={event => setStage(event.target.value as typeof stage)}>
          <option value="all">{tr({ zh: '完整还原', en: 'Full solve' })}</option>
          {LBL_LESSON_STAGE_IDS.map(id => <option key={id} value={id}>{tr(LBL_STEPS.find(item => item.id === id)!.title)}</option>)}
        </select>
      </label>
      {step && <Link href={`/tutorial/lbl?step=${step.id}`} prefetch={false}><T zh="学习本节" en="Study this stage" /></Link>}
    </div>
    <p className="lbl-walkthrough-scramble">{run.scramble}</p>
    <div className="lbl-walkthrough-player">
      <AlgPlayer key={`${runIndex}-${stage}`} puzzle="3x3" set="" engine="sim" orientation="z2"
        sceneRot={LBL_INITIAL_VIEW} alg={frame.alg} setup={frame.setup} fillPane moveDurationMs={650} />
    </div>
    {step && <p>{tr(step.goal)}</p>}
    {!frame.alg && <p><T zh="此例已完成这一步，可直接进入下一步。" en="This stage is already solved in this example. Continue to the next stage." /></p>}
  </main>;
}
