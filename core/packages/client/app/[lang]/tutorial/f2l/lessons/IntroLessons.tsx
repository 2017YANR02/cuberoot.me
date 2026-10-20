'use client';

import { useMemo, useState } from 'react';
import { Alg } from 'cubing/alg';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { VisualCube } from '@/components/VisualCube';
import { tr, T } from '@/i18n/tr';
import { ORDERED_BASIC_CASES } from '../data/basic-cases';
import { F2L_INTRO_ALG, LBL_INTRO_ALG, lblIntroStickering, f2lDiagramFacelets, f2lIntroStickering } from '../lib/cube-preview';
// import { f2lGoalDiagrams } from '../lib/cube-preview';
import StudyActions from '../components/StudyActions';

function IntroComparison({ orientation, onContinue }: { orientation: string; onContinue: () => void }) {
  const [playRequest, setPlayRequest] = useState(0);
  return <div className="f2l-intro-comparison">
    <div className="f2l-intro-players">
      <section className="f2l-demo" aria-label={tr({ zh: '层先法逐块复原演示', en: 'LBL piece-by-piece demonstration' })}>
        <h3>LBL</h3>
        <div className="f2l-cube"><AlgPlayer puzzle="3x3" set="f2l-overview" engine="sim" alg={LBL_INTRO_ALG}
          orientation={orientation} fillPane moveDurationMs={650} stickeringAtStep={lblIntroStickering}
          autoPlay playRequest={playRequest} /></div>
      </section>
      <section className="f2l-demo" aria-label={tr({ zh: 'F2L 成对复原演示', en: 'F2L pair-by-pair demonstration' })}>
        <h3>F2L</h3>
        <div className="f2l-cube"><AlgPlayer puzzle="3x3" set="f2l-overview" engine="sim" alg={F2L_INTRO_ALG}
          orientation={orientation} fillPane moveDurationMs={650} stickeringAtStep={f2lIntroStickering}
          autoPlay playRequest={playRequest} /></div>
      </section>
    </div>
    <StudyActions onContinue={onContinue}>
      <button type="button" className="f2l-restart" onClick={() => setPlayRequest(current => current + 1)}><T zh="重新播放" en="Replay" /></button>
    </StudyActions>
  </div>;
}


export default function IntroLessons({ stepId, orientation, onNextChapter }: {
  stepId: 'lesson-1' | 'lesson-2'; orientation: string; onNextChapter: () => void;
}) {
  const chapterCases = ORDERED_BASIC_CASES;
  const diagrams = useMemo(() => chapterCases.map(item => f2lDiagramFacelets(new Alg(item.alg).invert().expand().toString(), orientation)), [orientation, chapterCases]);
  // const goalDiagrams = useMemo(() => f2lGoalDiagrams(orientation), [orientation]);
  return <>{stepId === 'lesson-1' && <div className="f2l-study-layout">
        <aside className="f2l-section-nav">
          <div className="f2l-section-list"><p className="f2l-section-label" aria-current="true"><T zh="F2L与层先法的区别" en="F2L vs. layer-by-layer" /></p></div>
        </aside>
        <div className="f2l-study-main">
        {/* {goalDiagrams && <figure className="f2l-goal">
          <div className="f2l-goal-diagrams">
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[0]} alt={tr({ zh: 'A：底十字已完成', en: 'A: solved bottom cross' })} />
              <span><T zh="A · 底十字完成" en="A · Cross solved" /></span>
            </div>
            <div className="f2l-goal-lbl-arrow">
              <span>LBL</span>
              <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M 3 23 Q 24 2 45 23 M 36 21 L 45 23 L 43 14" /></svg>
            </div>
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[1]} alt={tr({ zh: 'B：底层已完成', en: 'B: solved first layer' })} />
              <span><T zh="B · 完成底层" en="B · First layer solved" /></span>
            </div>
            <div className="f2l-goal-lbl-arrow">
              <span>LBL</span>
              <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M 3 23 Q 24 2 45 23 M 36 21 L 45 23 L 43 14" /></svg>
            </div>
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[2]} alt={tr({ zh: 'C：前两层已完成', en: 'C: solved first two layers' })} />
              <span><T zh="C · 前两层完成" en="C · First two layers solved" /></span>
            </div>
          </div>
          <div className="f2l-goal-f2l-arrow">
            <svg viewBox="0 0 720 90" preserveAspectRatio="none" aria-hidden="true"><path d="M 95 4 C 95 86 625 86 625 4 M 618 13 L 625 4 L 632 13" /></svg>
            <span>F2L</span>
          </div>

        </figure>} */}

        <IntroComparison key={orientation} orientation={orientation} onContinue={onNextChapter} />
        </div>
      </div>}

      {stepId === 'lesson-2' && <div className="f2l-study-layout">
        <aside className="f2l-section-nav">
          <div className="f2l-section-list"><p className="f2l-section-label" aria-current="true"><T zh="认识四种三步标态" en="Meet the four three-move cases" /></p></div>
        </aside>
        <div className="f2l-study-main">

        <div className="f2l-recognition">
          {chapterCases.map((item, index) => <figure key={item.id}>
            <VisualCube view="iso" size={190} faceletColors={diagrams[index]} interactive enlargeable alt={item.name} />
            <figcaption>{item.name}</figcaption>
          </figure>)}
        </div>

        <StudyActions onContinue={onNextChapter} />
        </div>
      </div>}

</>;
}
