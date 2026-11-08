import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from '@app-foundation/icons/lucide';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { Axis } from '@cuberoot/visualcube';
import { tr } from '@/i18n/tr';
import { LBL_STEPS } from './content';
import './solve-flowchart.css';
import LessonThumbnail from './LessonThumbnail';
import { StageImage } from './StageImage';
import { chapters } from './curriculum';

const text = (zh: string, en: string) => ({ zh, en });
type Text = ReturnType<typeof text>;
type CasePath = [Text, Text, { row: number; label: Text }?];
const stages: { done: Text; paths: CasePath[] }[] = [
  { done: text('四片白花瓣？', 'Four white petals?'), paths: [
    [text('二楼有白棱？', 'Middle white edge?'), text('顶面有白花瓣挡住时，先转顶层让开\n左手上／右手上', 'If a white petal blocks the top slot,\nturn the top to clear it\nLift left / right')],
    [text('一楼或三楼有白棱？', 'Bottom/top white edge?'), text('压到二楼', 'Lower to middle'), { row: 0, label: text('变成二楼 case', 'Middle-floor case') }],
    [text('白棱朝地下室？', 'White edge faces down?'), text('顶面有白花瓣挡住时，先转顶层让开\n旋转 180°，将白棱转到顶层', 'If a white petal blocks the top slot,\nturn the top to clear it\nTurn that face 180° to lift the white edge')],
  ] },
  { done: text('底面十字完成？', 'Bottom cross solved?'), paths: [
    [text('还有白花瓣？', 'White petals remain?'), text('白棱侧色与同色中心对齐\n旋转 180°，将白棱转到底面', 'Match the edge’s side color to its center\nTurn that face 180° to send the edge down')],
  ] },
  { done: text('底层角块完成？', 'Bottom corners solved?'), paths: [
    [text('顶层有白角？', 'White corner on top?'), text('朝左 → 左公式\n朝右 → 右公式\n朝上 → 三遍右公式', 'Left → left trigger\nRight → right trigger\nUp → 3 right triggers')],
    [text('底层白角未归位？', 'Unsolved bottom corner?'), text('右公式取出', 'Eject with right trigger'), { row: 0, label: text('变成顶层白角 case', 'Top white-corner case') }],
  ] },
  { done: text('中层完成？', 'Middle layer solved?'), paths: [
    [text('顶层有非黄棱？', 'Non-yellow edge on top?'), text('去左 → 去左公式\n去右 → 去右公式', 'Left → left insertion\nRight → right insertion')],
    [text('中层棱放错／翻转？', 'Wrong/flipped middle edge?'), text('去右公式取出', 'Eject with right insertion'), { row: 0, label: text('变成顶层非黄棱 case', 'Top non-yellow-edge case') }],
  ] },
  { done: text('黄色十字完成？', 'Yellow cross formed?'), paths: [
    [text('横线？', 'Line?'), text('压 → 右公式 → 提', 'F → right trigger → F′')],
    [text('三点半？', 'L shape?'), text('双压 → 右公式 → 双提', 'f → right trigger → f′')],
    [text('点？', 'Dot?'), text('双压 → 右公式 → 双提', 'f → right trigger → f′'), { row: 0, label: text('变成横线 case', 'Line case') }],
  ] },
  { done: text('0灰，顶面全黄？', '0 gray, yellow face?'), paths: [
    [text('3灰？', '3 gray?'), text('右鱼 → 右鱼公式\n左鱼 → 左鱼公式', 'Right fish → right Sune\nLeft fish → left Sune')],
    [text('2灰？', '2 gray?'), text('二碰，右鱼公式', '2: touch yellow, right Sune'), { row: 0, label: text('变成三灰小鱼', '3-gray fish case') }],
    [text('4灰？', '4 gray?'), text('四不碰，右鱼公式', '4: avoid yellow, right Sune'), { row: 0, label: text('变成三灰小鱼', '3-gray fish case') }],
  ] },
  { done: text('四个顶角已归位？', 'Top corners positioned?'), paths: [
    [text('有眼？', 'Headlights?'), text('J 公式\n转顶层对齐', 'J algorithm\nAlign top')],
    [text('无眼？', 'No headlights?'), text('J 公式造眼', 'J algorithm to make eyes'), { row: 0, label: text('变成有眼 case', 'Headlights case') }],
  ] },
  { done: text('整颗魔方已复原？', 'Cube solved?'), paths: [
    [text('有墙？', 'A solved wall?'), text('对色在左 → 右鱼，调整顶层，按小鱼还原\n对色在右 → 左鱼，调整顶层，按小鱼还原', 'Opposite color on the left → right Sune, adjust the top, finish with Sune\nOpposite color on the right → left Sune, adjust the top, finish with Sune')],
    [text('无墙？', 'No wall?'), text('右鱼，调整顶层，按小鱼还原', 'Right Sune, adjust the top, finish with Sune'), { row: 0, label: text('变成有墙 case', 'Solved-wall case') }],
  ] },
];

function Label({ x, y, value, branch = false }: { x: number; y: number; value: Text; branch?: boolean }) {
  const lines = tr(value).split('\n');
  return <text className={branch ? 'lbl-flow-branch' : undefined} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
    {lines.map((line, index) => <tspan key={index} x={x} dy={index === 0 ? -(lines.length - 1) * 14 : 28}>{line}</tspan>)}
  </text>;
}

const caseExamples = [
  // The occupied-top example already exposes its middle white edge at the front.
  [2, 3, 5], [0], [0, 1], [0, 2],
  [0, 1, 2], [0, 2, 3], [0, 1], [0, 2],
];

function DecisionContent({ y, question, children }: { y: number; question: Text; children: ReactNode }) {
  return <foreignObject x="164" y={y - 68} width="200" height="128">
    <div className="lbl-flow-decision-content">
      {children}
      <div className="lbl-flow-question">{tr(question)}</div>
    </div>
  </foreignObject>;
}

// Each action links to the matching lesson in the active chapter.
const actionLessons: string[][][] = [
  [['case-0'], ['case-3'], ['case-5']],
  [['white-edge']],
  [['case-2', 'case-0', 'case-3'], ['case-1']],
  [['case-1', 'case-0'], ['case-2']],
  [['case-0'], ['case-1'], ['case-2']],
  [['sune-learning-1', 'sune-learning-0'], ['case-2'], ['case-3']],
  [['case-0'], ['case-1']],
  [['case-0', 'case-1'], ['case-2']],
];

function CaseImage({ chapter, stageIndex, row, size = 70 }: { chapter: typeof chapters[number]; stageIndex: number; row: number; size?: number }) {
  const index = caseExamples[stageIndex][row];
  const lesson = chapter.id === 'cross' ? { ...chapter.lessons.find(item => item.id === 'white-edge')!, example: chapter.examples[index] }
    : { id: `case-${index}`, title: chapter.examples[index].title, kind: 'example' as const, example: chapter.examples[index] };
  // Show the down-facing white sticker rather than hiding it beneath the cube.
  const bottomView: [Axis, number][] | undefined = chapter.id === 'daisy' && row === 2 ? [[Axis.Y, 30], [Axis.X, 25]] : undefined;
  return <div className="lbl-flow-case-images" style={{ width: size, height: size, flexBasis: size }} role="img" aria-label={tr(lesson.title)}>
    <LessonThumbnail chapter={chapter} lesson={lesson} size={size} viewportRotations={bottomView} />
  </div>;
}
function PreviewTarget({ x, y, width, height, label, onClick, diamond = false }: {
  x: number; y: number; width: number; height: number; label: string; onClick: () => void; diamond?: boolean;
}) {
  return <foreignObject x={x} y={y} width={width} height={height}>
    <button type="button" className="lbl-flow-preview-target" style={diamond ? { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' } : undefined} aria-label={label} onClick={onClick} />
  </foreignObject>;
}

function ImagePreview({ label, children, onClose }: { label: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropProps = useModalDismiss(onClose);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="lbl-flow-preview" {...backdropProps} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={label}>
    <div className="lbl-flow-preview-card" data-site-surface="panel">
      <button type="button" className="lbl-flow-preview-close" onClick={onClose} aria-label={tr(text('关闭', 'Close'))}><X size={22} /></button>
      <div className="lbl-flow-preview-image">{children}</div>
    </div>
  </dialog>;
}

export default function SolveFlowchart({ stageId, onSelectLesson }: { stageId: string; onSelectLesson?: (id: string) => void }) {
  const [preview, setPreview] = useState<'start' | 'done' | number | null>(null);
  const markerId = useId().replace(/:/g, '');
  const chapter = chapters.find(item => item.id === stageId)!;
  const stageIndex = LBL_STEPS.findIndex(item => item.id === stageId) - 1;
  const stage = stages[stageIndex];
  // A 200px decision and an 80px gap repeat on both axes.
  const rowSpacing = 280;
  const goalY = 268;
  const firstCaseY = goalY + rowSpacing;
  const endY = firstCaseY + (stage.paths.length - 1) * rowSpacing + 180;
  const returnY = Math.max(...stage.paths.flatMap(([, , conversion], row) => conversion ? [] : [firstCaseY + row * rowSpacing]));
  const arrow = `url(#${markerId})`;
  const view = stageId === 'yellow-face' || stageId === 'corner-position' ? 'plan' : 'iso';
  const previewLabel = typeof preview === 'number' ? tr(stage.paths[preview][0]) : tr(preview === 'start' ? text('开始', 'Start') : chapter.goal);
  return <section className="lbl-content lbl-solve-flow">
    <div className="lbl-flow-canvas" tabIndex={0} role="region" aria-label={tr(text(`${chapter.title.zh}流程图`, `${chapter.title.en} flowchart`))}>
      <svg className="lbl-flow-graph" width="1000" height={endY + 88} viewBox={`0 0 1000 ${endY + 88}`} role="group" aria-label={tr(text(`${chapter.title.zh}，判断与操作`, `${chapter.title.en}, decisions and actions`))}>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className="lbl-flow-arrowhead" /></marker></defs>
        <path className="lbl-flow-return" d={`M950 ${returnY} V140 Q950 128 938 128 H276 Q264 128 264 140 V168`} markerEnd={arrow} />
        <path d="M264 88 V128" />
        <path d={`M114 ${goalY} H46 Q34 ${goalY} 34 ${goalY + 12} V${endY + 20} Q34 ${endY + 32} 46 ${endY + 32} H144`} markerEnd={arrow} />
        <path d={`M264 ${goalY + 100} V${firstCaseY - 100}`} markerEnd={arrow} />
        <rect x="144" y="24" width="240" height="64" rx="32" className="lbl-flow-terminal" />
        <Label x={264} y={56} value={text('开始', 'Start')} />
        <PreviewTarget x={144} y={24} width={240} height={64} label={tr(text('开始', 'Start'))} onClick={() => setPreview('start')} />
        <g>
          <polygon points={`264,${goalY - 100} 414,${goalY} 264,${goalY + 100} 114,${goalY}`} className="lbl-flow-decision" />
          <DecisionContent y={goalY} question={stage.done}>
            <div className="lbl-flow-goal-image" role="img" aria-label={tr(chapter.goal)}><StageImage stage={stageId} size={70} brightCenters view={view} /></div>
          </DecisionContent>
          <PreviewTarget diamond x={114} y={goalY - 100} width={300} height={200} label={tr(stage.done)} onClick={() => setPreview('done')} />
          <Label branch x={74} y={goalY - 20} value={text('是', 'Yes')} />
          <Label branch x={290} y={goalY + 140} value={text('否', 'No')} />
          {stage.paths.map(([condition, solve, conversion], row) => {
            const y = firstCaseY + row * rowSpacing;
            const targets = actionLessons[stageIndex][row];
            const lines = tr(solve).split('\n');
            const targetY = conversion ? firstCaseY + conversion.row * rowSpacing : goalY;
            const sharesConversion = conversion && stage.paths.slice(row + 1).some(([, , next]) => next?.row === conversion.row);
            return <g key={row}>
              <polygon points={`264,${y - 100} 414,${y} 264,${y + 100} 114,${y}`} className="lbl-flow-decision" />
              <DecisionContent y={y} question={condition}><CaseImage chapter={chapter} stageIndex={stageIndex} row={row} /></DecisionContent>
              <PreviewTarget diamond x={114} y={y - 100} width={300} height={200} label={tr(condition)} onClick={() => setPreview(row)} />
              <path d={`M414 ${y} H494`} markerEnd={arrow} />
              <Label branch x={454} y={y - 20} value={text('是', 'Yes')} />
              <rect x="494" y={y - 72} width="360" height="144" rx="16" className="lbl-flow-operation" />
              <foreignObject x="494" y={y - 72} width="360" height="144"><div className="lbl-flow-actions">
                {targets.map((target, index) => <button key={target} type="button" className="lbl-flow-action" onClick={() => onSelectLesson?.(target)}>
                  {targets.length === 1 ? tr(solve) : index === targets.length - 1 ? lines.slice(index).join('\n') : lines[index]}
                </button>)}
              </div></foreignObject>
              {conversion ? sharesConversion ? <path className="lbl-flow-conversion" d={`M854 ${y} H910`} /> : <>
                <path className="lbl-flow-conversion" d={`M854 ${y} H898 Q910 ${y} 910 ${y - 12} V${targetY + 124} Q910 ${targetY + 112} 898 ${targetY + 112} H686 Q674 ${targetY + 112} 674 ${targetY + 100} V${targetY + 72}`} markerEnd={arrow} />
                <Label branch x={770} y={targetY + 140} value={conversion.label} />
              </> : <path className="lbl-flow-return" d={`M854 ${y} H950`} />}
              {row < stage.paths.length - 1 && <><path d={`M264 ${y + 100} V${y + rowSpacing - 100}`} markerEnd={arrow} /><Label branch x={290} y={y + rowSpacing / 2} value={text('否', 'No')} /></>}
            </g>;
          })}
        </g>
        <rect x="144" y={endY} width="240" height="64" rx="32" className="lbl-flow-terminal lbl-flow-complete" />
        <Label x={264} y={endY + 32} value={text('本步完成', 'Stage complete')} />
        <PreviewTarget x={144} y={endY} width={240} height={64} label={tr(text('本步完成', 'Stage complete'))} onClick={() => setPreview('done')} />
      </svg>
    </div>
    {preview !== null && <ImagePreview label={previewLabel} onClose={() => setPreview(null)}>
      {typeof preview === 'number' ? <CaseImage chapter={chapter} stageIndex={stageIndex} row={preview} size={320} />
        : preview === 'start' ? <StageImage stage={LBL_STEPS[stageIndex].id} size={320} brightCenters={stageId === 'cross'} />
        : <StageImage stage={stageId} size={320} />}
    </ImagePreview>}
  </section>;
}
