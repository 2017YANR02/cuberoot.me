import { useId } from 'react';
import { ArrowRight } from '@app-foundation/icons/lucide';
import { VisualCube } from '@/components/VisualCube';
import { T } from '@/i18n/tr';
import { TWO_BY_TWO_SAMPLE } from './lesson-data';
import './yellow-face-overview.css';

const [, { sections: [rightFish, leftFish, twoTouch, fourNoTouch] }] = TWO_BY_TWO_SAMPLE;
type YellowCase = typeof rightFish;

function CaseNode({ section, area, cue, yellowCount, onSelect }: {
  section: YellowCase;
  area: 'two' | 'zero' | 'left' | 'right';
  cue: { zh: string; en: string };
  yellowCount?: { zh: string; en: string };
  onSelect: (sectionId: string) => void;
}) {
  return <button type="button" className="yellow-flow-node yellow-flow-case" style={{ gridArea: area }}
    onClick={() => onSelect(section.id)}>
    <VisualCube local view="oll" hideGreySides puzzleSize={2} size={64} setup={section.guided.algorithm.demoSetup} alt="" />
    <span>
      {yellowCount && <span className="yellow-flow-detail"><T {...yellowCount} /></span>}
      <strong><T {...section.title} /></strong>
      <span className="yellow-flow-detail"><T {...cue} /></span>
    </span>
  </button>;
}

export default function YellowFaceOverview({ onSelect }: {
  onSelect: (chapterId: string, sectionId?: string) => void;
}) {
  const arrowId = useId().replace(/:/g, '');
  const arrow = `url(#${arrowId})`;
  const selectCase = (sectionId: string) => onSelect('yellow', sectionId);
  return <div className="yellow-flow">
    <p className="yellow-flow-intro"><T zh="保持底层复原，把四个黄格翻到顶面" en="Keep the first layer solved and turn all four yellow stickers up" /></p>
    <div className="yellow-flow-graph">
      <svg viewBox="0 0 600 572" preserveAspectRatio="none" aria-hidden="true" className="yellow-flow-lines">
        <defs>
          <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
          </marker>
        </defs>
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          <path d="M300 56 V70 M177 70 H423" />
          <path d="M177 70 V87" markerEnd={arrow} />
          <path d="M423 70 V87" markerEnd={arrow} />
          <path d="M66 28 H28 V292 H65" markerEnd={arrow} />
          <path d="M534 28 H572 V538 H535" markerEnd={arrow} />
          <path d="M177 232 V249 H423 V232" />
          <path d="M300 249 V263" markerEnd={arrow} />
          <path d="M300 320 V335 M177 335 H423" />
          <path d="M177 335 V351" markerEnd={arrow} />
          <path d="M423 335 V351" markerEnd={arrow} />
          <path d="M177 472 V488 H423 V472" />
          <path d="M300 488 V503" markerEnd={arrow} />
        </g>
      </svg>

      <div className="yellow-flow-node yellow-flow-start">
        <strong><T zh="顶面有几个黄格？" en="How many yellow stickers face up?" /></strong>
      </div>
      <CaseNode section={twoTouch} area="two" onSelect={selectCase}
        yellowCount={{ zh: '2 个黄格', en: '2 up' }} cue={{ zh: '左拇指碰黄\n→ 右鱼公式', en: 'Touch yellow\n→ Right Sune' }} />
      <CaseNode section={fourNoTouch} area="zero" onSelect={selectCase}
        yellowCount={{ zh: '0 个黄格', en: '0 up' }} cue={{ zh: '左拇指避黄\n→ 右鱼公式', en: 'Avoid yellow\n→ Right Sune' }} />
      <div className="yellow-flow-node yellow-flow-fish">
        <strong><T zh="1 个黄格 · 小鱼" en="1 up · Fish" /></strong>
        <span className="yellow-flow-detail"><T zh="看侧面的黄鱼鳍朝哪边" en="Which way do the fins point?" /></span>
      </div>
      <CaseNode section={leftFish} area="left" onSelect={selectCase} cue={{ zh: '用左鱼公式', en: 'Use left Sune' }} />
      <CaseNode section={rightFish} area="right" onSelect={selectCase} cue={{ zh: '用右鱼公式', en: 'Use right Sune' }} />
      <button type="button" className="yellow-flow-node yellow-flow-finish" onClick={() => onSelect('corner-position')}>
        <VisualCube local view="oll" hideGreySides puzzleSize={2} size={48} alt="" />
        <span>
          <strong><T zh="4 个黄格 · 顶面全黄" en="4 up · All yellow" /></strong>
          <span className="yellow-flow-detail"><T zh="进入角位置" en="Go to corner placement" /> <ArrowRight size={14} aria-hidden="true" /></span>
        </span>
      </button>
    </div>
  </div>;
}
