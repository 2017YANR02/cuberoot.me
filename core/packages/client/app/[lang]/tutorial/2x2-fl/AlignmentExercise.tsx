'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Color } from 'three';
import AlgPlayer, { type AlgPlayerHandle, type AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import type { CubeFace } from '@/lib/cube-colors';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import InteractiveQuestionCopy from '../components/InteractiveQuestionCopy';
import { CUBE_FRAMING_EDGE, LessonPane, useStickerFade } from '../components/InteractiveTutorial';
import { TUTORIAL_STICKER_PURPLE } from '../components/tutorial-colors';
import {
  FL_LAST_STICKERS, FL_PURPLE_LAST, FL_RECOGNITION_EXAMPLES, FL_TWISTS, FL_VIEWS, FL_WGO_HOME, FL_WRG_HOME,
  flAlignedTwist, flFirstLayerMask, flPalette, type FlGroup,
} from './lesson-data';

const questions = [
  { progressLabel: { zh: '摆位', en: 'Align' } },
  { progressLabel: { zh: '选公式组', en: 'Choose a group' } },
];

export default function AlignmentExercise({ group, orientation }: {
  group: FlGroup;
  orientation: string;
}) {
  const [revision, setRevision] = useState(0);
  return <AlignmentRound key={revision} group={group} orientation={orientation}
    onRestart={() => setRevision(value => value + 1)} />;
}

function AlignmentRound({ group, orientation, onRestart }: {
  group: FlGroup;
  orientation: string;
  onRestart: () => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const [corners, setCorners] = useState<{ reference: AlgStickerPlacement; last: number } | null>(null);
  const [feedback, setFeedback] = useState<'turn' | 'correct' | 'wrong' | null>(null);
  const example = FL_RECOGNITION_EXAMPLES.find(item => item.group === group)!;
  const twist = corners && flAlignedTwist(group, corners.reference, corners.last);
  const fade = useStickerFade(!!twist);
  const stickerColors = useMemo(() => {
    if (fade === 0) return FL_PURPLE_LAST;
    if (fade === 1) return undefined;
    const colors = orientedCubeFaceColors(orientation);
    const purple = new Color(TUTORIAL_STICKER_PURPLE);
    const displayColor = new Color();
    return Object.fromEntries(FL_LAST_STICKERS.map(sticker => [sticker,
      displayColor.set(colors[sticker[0] as CubeFace]).lerp(purple, 1 - fade).getStyle()]));
  }, [fade, orientation]);
  const alignedReference = corners?.reference.positionIndex === (group === 'top' ? 6 : 5);
  const face = !corners || twist ? null : group === 'top' ? (alignedReference ? 'R' : 'U')
    : group === 'mixed' && alignedReference ? 'U' : 'R';
  const { reference, color } = flPalette(orientation);
  const bottom = color('D');

  useEffect(() => {
    const handle = player.current;
    if (!ready || !handle) return;
    const readPositions = (queuedMoves: number) => {
      if (queuedMoves) return;
      const reference = handle.getStickerPlacement?.(FL_WRG_HOME, 'D');
      const other = handle.getStickerPlacement?.(FL_WGO_HOME, 'D');
      if (reference && other) setCorners({ reference, last: other.positionIndex });
      setFeedback(null);
    };
    readPositions(0);
    return handle.subscribeSettledCube?.(readPositions);
  }, [ready]);

  useEffect(() => {
    if (twist && group === 'bottom') player.current?.setSceneRotation?.(FL_VIEWS.bottom);
  }, [group, twist]);

  const allowTurn = (move: string) => move[0] === face && /^[UR]\d*'?$/.test(move);
  const turn = (move: string) => {
    const handle = player.current;
    if (!handle || handle.isUserMovePending?.(false) || !allowTurn(move)) return;
    return handle.applyUserMove?.(move);
  };
  const turnWithKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.key.toUpperCase() !== face) return;
    if (turn(event.shiftKey ? `${face}'` : face)) event.preventDefault();
  };

  const alignReference = group === 'top'
    ? { zh: `用 U 把${reference.zh}摆到顶层左前`, en: `Use U to place the ${reference.en} at top front-left` }
    : { zh: `用 R 把${reference.zh}摆到底层右前`, en: `Use R to place the ${reference.en} at bottom front-right` };
  const alignLast = group === 'top'
    ? { zh: '用 R 把紫色角提到顶层', en: 'Use R to lift the purple corner to the top layer' }
    : { zh: `用 U 把紫色角摆到${reference.zh}正上方`, en: `Use U to place the purple corner directly above the ${reference.en}` };
  const chooseTwist = { zh: `看${reference.zh}的${bottom.zh}格朝向`, en: `Check which way the ${bottom.en} sticker on the ${reference.en} faces` };
  const messages = {
    turn: { zh: `这一步转 ${face}`, en: `Turn ${face} on this step` },
    correct: { zh: '选对了', en: 'Correct' },
    wrong: { zh: `选错了，再看一次${reference.zh}的${bottom.zh}格`, en: `Try again. Check the ${bottom.en} sticker on the ${reference.en}.` },
  };
  const answer = feedback === 'turn' ? 'wrong' : feedback ?? 'pending';

  return <LessonPane layout="F" cube={<div className="course-cube" role="group" tabIndex={0}
    aria-label={tr({ zh: '摆位魔方。拖贴纸转层，拖空白转视角。', en: 'Alignment cube. Drag stickers to turn layers and drag empty space to orbit.' })}
    data-course-cube data-ready={ready} data-drag-enabled={!!face} onKeyDown={turnWithKey}>
    <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" setup={example.setup} alg=""
      orientation={orientation} sceneRot={FL_VIEWS.mixed} controlMode="none" interactionMode="turn" fillPane
      maxFramingEdge={CUBE_FRAMING_EDGE} stickeringAtStep={flFirstLayerMask}
      orbitSnapDegrees={30} orbitSnapLocked stickerColorOverrides={stickerColors}
      allowUserLayerTurn={allowTurn} onBlockedUserLayerTurn={() => { if (face) setFeedback('turn'); }}
      onReady={() => setReady(true)} />
  </div>}>
    <InteractiveQuestionCopy sectionId={`${group}-overview`} questions={questions} activeIndex={twist ? 1 : 0}
      answer={answer}
      heading={tr(twist ? { zh: '选 0、+ 或 −', en: 'Choose 0, + or −' } : { zh: '摆好剩余两角', en: 'Align the last two corners' })}
      prompt={tr(twist ? chooseTwist : alignedReference ? alignLast : alignReference)}
      reserveStatus status={feedback ? tr(messages[feedback]) : null}
      action={<div className="course-question-actions">
        {twist && FL_TWISTS.map(choice => <button type="button" key={choice.id} className="btn-secondary course-question-action"
          onClick={() => setFeedback(choice === twist ? 'correct' : 'wrong')}>{choice.symbol}</button>)}
        <button type="button" className="btn-secondary course-question-action" onClick={onRestart}><T zh="重来" en="Restart" /></button>
      </div>} />
  </LessonPane>;
}
