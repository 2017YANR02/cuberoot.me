'use client';

import { useCallback, useMemo, useState } from 'react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { tr, T } from '@/i18n/tr';
import { f2lPlaybackSections } from '../lib/cube-preview';
import { buildFreePracticeCases, freePlacementKey, placeFreePiece, SOLVED_FREE_PLACEMENT } from '../lib/free-practice';
import StudyActions from '../components/StudyActions';
import PairEditor from '../components/PairEditor';

const NO_STOPS: readonly number[] = [];

export default function FreePracticeLesson({ orientation, pauseBetween }: { orientation: string; pauseBetween: boolean }) {
  const table = useMemo(buildFreePracticeCases, []);
  const [placement, setPlacement] = useState(SOLVED_FREE_PLACEMENT);
  const [preview, setPreview] = useState(false);
  const exercise = table.get(freePlacementKey(placement));
  const choosePiece = useCallback((position: number) => setPlacement(current => placeFreePiece(current, position)), []);

  return <>

    <div className="f2l-study-layout">
      <aside className="f2l-section-nav">
        <div className="f2l-section-list"><p className="f2l-section-label" aria-current="true"><T zh="自由练习" en="Free practice" /></p></div>
        <div className="f2l-guidance" aria-live="polite">
          {!exercise && <p><T zh="暂未收录这个情况的教学解法。" en="A teaching solution for this case is not available yet." /></p>}
        </div>
      </aside>
      <div className="f2l-study-main">
        <div className="f2l-study-scramble f2l-practice-scramble"><h3><T zh="打乱公式" en="Scramble" /></h3><code className="f2l-alg">{exercise?.alg ? exercise.setup : ''}</code></div>
        <section className="f2l-demo" aria-label={tr({ zh: '自由练习魔方', en: 'Free practice cube' })}>
          <div className="f2l-cube">
            {preview && exercise ? <AlgPlayer puzzle="3x3" set="f2l-tutorial" engine="sim" setup={exercise.setup} alg={exercise.alg}
              orientation={orientation} fillPane autoPlay moveDurationMs={850} sectionPauseMs={2000}
              pauseAfterSteps={pauseBetween ? f2lPlaybackSections(exercise.alg).slice(0, -1).map(section => section.end) : NO_STOPS} />
              : <PairEditor setup={exercise?.setup ?? ''} orientation={orientation} onPiece={choosePiece} />}
          </div>
          {exercise?.alg && <>
            <p className="f2l-caption"><T zh="复原公式" en="Solution" /> · {exercise.name}</p>
            <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{exercise.alg}</code>
          </>}

        </section>
        <StudyActions>
          <button type="button" className="f2l-restart" disabled={!preview && !exercise?.alg} onClick={() => setPreview(current => !current)}>
            {preview ? <T zh="重新摆放" en="Edit the case" /> : <T zh="演示复原" en="Play the solution" />}
          </button>
        </StudyActions>
      </div>
    </div>
  </>;
}
