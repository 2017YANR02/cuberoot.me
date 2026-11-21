'use client';

import { useState } from 'react';
import { Axis } from '@cuberoot/visualcube';
import { FM_FIXED_COLOR, FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { T, tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { LessonPane } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { FL_CASES, FL_EXAMPLE, FL_GROUPS, FL_TWISTS, FL_VIEWS, type FlCase, type FlGroup } from './lesson-data';

type SelectSection = (chapter: string, section?: string) => void;
const faceColors = orientedCubeFaceColors(TWO_BY_TWO_ORIENTATION);
// Renderer home corners 0/4 are bottom left; 1/5 are bottom right.
const colorsFor = (visible: readonly number[]) =>
  stageStickerColors(2, piece => visible.includes(piece) ? FM_REGULAR : FM_IGNORED, faceColors);
const leftPairColors = colorsFor([0, 4]);
const rightPairColors = colorsFor([1, 5]);
const layerColors = colorsFor([0, 1, 4, 5]);
const maskColor = FM_FIXED_COLOR[FM_IGNORED];

function CaseDiagram({ item, lazy }: { item: FlCase; lazy?: boolean }) {
  return <VisualCube local puzzleSize={2} size={94} setup={item.exercise.setup} alt=""
    view={item.group === 'top' ? 'plan' : 'iso'}
    viewportRotations={item.group === 'bottom' ? [[Axis.Y, 30], [Axis.X, 29]] : undefined}
    stickerColors={item.group === 'top' ? rightPairColors : layerColors} stickerMaskColor={maskColor}
    loading={lazy ? 'lazy' : undefined} />;
}

function PairDiagram({ solved = false }: { solved?: boolean }) {
  return <VisualCube local puzzleSize={2} size={142} view="iso" alt=""
    setup={solved ? undefined : FL_EXAMPLE.leftPairSetup}
    viewportRotations={[[Axis.Y, -30], [Axis.X, 26]]}
    stickerColors={solved ? layerColors : leftPairColors} stickerMaskColor={maskColor} />;
}

export function Introduction({ onSelect }: { onSelect: SelectSection }) {
  return <div className="fl-reading">
    <p className="fl-lead"><T
      zh="先在左侧拼好两个相邻的白角，再看右侧两个白角的盘面，用一条公式把它们一起归位。底面全白、四个侧面的底排各自同色时，第一层就完成了。"
      en="Solve two adjacent white corners on the left. Then recognize the two remaining corners and solve them together with one algorithm. The first layer is complete when the bottom is white and each side has a matching bottom row." /></p>
    <div className="fl-overview-stages">
      <button type="button" className="fl-diagram-card" onClick={() => onSelect('intro', 'left-pair')}>
        <PairDiagram />
        <strong><T zh="先做左侧白角对" en="Build the left pair" /></strong>
      </button>
      <button type="button" className="fl-diagram-card" onClick={() => onSelect('walkthrough')}>
        <PairDiagram solved />
        <strong><T zh="看完整第一层示范" en="Watch a full first layer" /></strong>
      </button>
    </div>
    <h2><T zh="剩下两个白角在哪里？" en="Where are the two remaining white corners?" /></h2>
    <div className="fl-chapter-links">
      {(Object.keys(FL_GROUPS) as FlGroup[]).map(group => <button key={group} type="button" className="fl-diagram-card"
        onClick={() => onSelect(group)}>
        <CaseDiagram item={FL_CASES[group][0]} />
        <strong><T {...FL_GROUPS[group].title} /></strong>
        <span className="fl-case-note">{FL_CASES[group].length} <T zh="种" en="cases" /></span>
      </button>)}
    </div>
    <p><T zh="这套进阶方法可以和 CLL 一起学。第一层完成后，用 CLL 一次处理顶层四角。"
      en="FL pairs with CLL. Once the first layer is solved, CLL solves the four last-layer corners in one algorithm." /></p>
    <p className="fl-source"><T zh="《2×2 FL Algorithms》将公式归功于 Anthony Brooks 和 Andy Klise。"
      en="Algorithms credited to Anthony Brooks and Andy Klise in 2×2 FL Algorithms." /></p>
  </div>;
}

export function LeftPair() {
  return <div className="fl-reading">
    <h2><T zh="在底层左侧拼好相邻的两个白角" en="Solve two adjacent white corners on the bottom left" /></h2>
    <figure className="fl-pair-figure">
      <PairDiagram />
      <figcaption><T zh="白朝下，蓝排在左，红格朝前。" en="White down, blue row on the left, red sticker in front." /></figcaption>
    </figure>
    <ol className="fl-instructions">
      <li><T zh="找到白橙蓝角，把它摆到底层左后，白格朝下。"
        en="Find the white–orange–blue corner and place it at bottom back-left with white down." /></li>
      <li><T zh="把白蓝红角插到底层左前。左面两个蓝格同色，底面两个白格相邻。"
        en="Insert the white–blue–red corner at bottom front-left. The two blue stickers match on the left, with two adjacent white stickers on the bottom." /></li>
      <li><T zh="保持这对白角在左侧。如果白红绿角在顶层，用 U 把它转到左前，再把白绿橙角提到顶层。"
        en="Keep the pair on the left. If the white–red–green corner is on top, use U to bring it to front-left, then lift the white–green–orange corner to the top if needed." /></li>
      <li><T zh="如果白红绿角在底层，先用 R 把它转到底层右前，再看白绿橙角此时在哪一层，选择「一上一下」或「两角在底层」。"
        en="If the white–red–green corner is on the bottom, use R to bring it to bottom front-right first. Check which layer the other corner is now on and use the mixed or bottom chapter." /></li>
    </ol>
    <AppLink href="/tutorial/2x2-lbl?step=lesson-2" prefetch={false}>
      <T zh="在层先法里练前两个白角" en="Practice the first two corners in Layer by Layer" />
    </AppLink>
  </div>;
}

export function CaseIndex({ group, onSelect }: { group: FlGroup; onSelect: SelectSection }) {
  const cases = FL_CASES[group];
  return <div className="fl-reading fl-cases">
    <p className="fl-lead"><T {...FL_GROUPS[group].alignment} /></p>
    <p><T zh="用白红绿角的白格方向找 0、+、− 组，再对照白绿橙角的位置和朝向。"
      en="Use the white–red–green corner's white sticker to find group 0, + or −. Then match the position and orientation of the white–green–orange corner." /></p>
    {FL_TWISTS.map((twist, index) => {
      const items = cases.filter(item => item.twist === twist);
      const direction = items[0].guided.recognition.choices[index];
      return <section key={twist} className="fl-case-group">
        <h2>{twist} <T zh={`组 · 白格${direction.zh}`} en={`· White faces ${direction.en.toLowerCase()}`} /></h2>
        <ul className="fl-case-grid">
          {items.map(item => <li key={item.id}>
            <button type="button" className="fl-diagram-card" onClick={() => onSelect(group, item.id)}>
              <CaseDiagram item={item} lazy />
              <span className="fl-case-note"><T {...item.position} />{' · '}
                <T zh={`${item.color.zh}格朝${group === 'bottom' ? '下' : '上'}`}
                  en={`${item.color.en} ${group === 'bottom' ? 'down' : 'up'}`} /></span>
              <code>{item.exercise.solution}</code>
            </button>
          </li>)}
        </ul>
      </section>;
    })}
    {group === 'bottom' && <p><T
      zh="右后角白格朝下、侧色也对齐时，只剩白红绿角需要调整朝向。底面全白且四个侧面底排同色时，第一层已经完成。"
      en="If the back-right corner has white down and its side colors match, only the white–red–green corner needs a twist. A white bottom with matching rows on all four sides means the first layer is already solved." /></p>}
  </div>;
}

const stages = [
  { from: 0, alg: FL_EXAMPLE.leftPairMoves, title: { zh: '拼左侧白角对', en: 'Build the left pair' },
    note: { zh: '先放白橙蓝角，再插入白蓝红角，让蓝格在左侧并排。', en: 'Place the white–orange–blue corner, then insert the white–blue–red corner to make a blue row on the left.' } },
  { from: 2, alg: FL_EXAMPLE.alignment, title: { zh: '把白红绿角摆到顶层左前', en: 'Align at top front-left' },
    note: { zh: '白红绿角的白格朝上，是 0 组。白绿橙角在顶层右后，也是白格朝上。', en: 'The white–red–green corner has white on top, so this is group 0. The white–green–orange corner is at top back-right with white up.' } },
  { from: 3, alg: FL_EXAMPLE.case.exercise.solution, title: { zh: '一起归位剩下两个白角', en: 'Insert the last two corners' },
    note: { zh: '检查底面四格全白，四个侧面的底排各自同色。', en: 'Check the four white stickers on the bottom and the matching bottom rows on all sides.' } },
];
const markers = stages.slice(1).map(stage => stage.from);

export function FirstLayerDemo() {
  const [step, setStep] = useState(0);
  const activeStage = stages.findLastIndex(stage => step >= stage.from);
  return <LessonPane layout="B" cube={<div className="course-cube fl-demo-cube">
    <AlgPlayer puzzle="2x2" set="" orientation={TWO_BY_TWO_ORIENTATION} engine="sim" fillPane
      setup={FL_EXAMPLE.setup} alg={FL_EXAMPLE.moves} sceneRot={FL_VIEWS.top}
      stepMarkers={markers} pauseAfterSteps={markers} sectionPauseMs={600} moveDurationMs={720}
      onStepChange={setStep} />
  </div>}>
    <div className="course-copy fl-demo-copy" data-course-section="walkthrough">
      <h2><T zh="从打乱到第一层" en="From scramble to first layer" /></h2>
      {step === 0 && <p className="fl-scramble"><T zh="打乱" en="Scramble" /> <code>{FL_EXAMPLE.setup}</code></p>}
      <ol className="fl-demo-stages" aria-label={tr({ zh: '示范步骤', en: 'Walkthrough stages' })}>
        {stages.map((stage, index) => <li key={stage.from} aria-current={index === activeStage ? 'step' : undefined}>
          <h3><T {...stage.title} /></h3>
          <code>{stage.alg}</code>
          <p><T {...stage.note} /></p>
        </li>)}
      </ol>
    </div>
  </LessonPane>;
}
