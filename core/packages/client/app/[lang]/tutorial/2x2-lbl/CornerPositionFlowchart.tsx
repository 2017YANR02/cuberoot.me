import { ArrowDown, ArrowLeft } from '@app-foundation/icons/lucide';
import { VisualCube } from '@/components/VisualCube';
import { T } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_SAMPLE } from './lesson-data';
import './chapter-flowchart.css';
import './corner-position-flowchart.css';

const [headlights, noHeadlights] = TWO_BY_TWO_SAMPLE[2].sections;
const colors = stageStickerColors(2, null, orientedCubeFaceColors(TWO_BY_TWO_ORIENTATION));
const cases = [
  { section: headlights, cue: { zh: '眼放右，再做公式', en: 'Put headlights on the right, then apply the algorithm' } },
  { section: noHeadlights, cue: { zh: '先做一次公式造眼', en: 'Apply the algorithm once to make headlights' } },
];

export default function CornerPositionFlowchart({ onSelect }: {
  onSelect: (chapterId: string, sectionId?: string) => void;
}) {
  return <div className="two-lbl-flow corner-flow">
    <div className="corner-flow-graph">
      <div className="two-lbl-flow-node corner-flow-start">
        <strong><T zh="观察四个侧面的顶排，有眼吗？" en="Do the top rows on the sides have headlights?" /></strong>
      </div>
      <div className="corner-flow-branches" aria-hidden="true"><ArrowDown /><ArrowDown /></div>
      {cases.map(({ section, cue }, index) => <button key={section.id} type="button"
        className="two-lbl-flow-node two-lbl-flow-case" data-eye-case={section.id}
        onClick={() => onSelect('corner-position', section.id)}>
        <VisualCube local view="plan" puzzleSize={2} size={75} stickerColors={colors}
          setup={index === 0 ? `${section.exercise.setup} y2` : section.exercise.setup} alt="" />
        <strong><T {...section.title} /></strong>
        <span className="two-lbl-flow-detail"><T {...cue} /></span>
      </button>)}
      <ArrowLeft className="corner-flow-make" aria-hidden="true" />
      <ArrowDown className="corner-flow-finish-arrow" aria-hidden="true" />
      <div className="two-lbl-flow-node two-lbl-flow-finish corner-flow-finish">
        <VisualCube local view="iso" puzzleSize={2} size={48} stickerColors={colors} alt="" />
        <strong><T zh="六面复原" en="Cube solved" /></strong>
      </div>
    </div>
  </div>;
}
