import { ArrowDown } from '@app-foundation/icons/lucide';
import { FM_FIXED_COLOR, FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { Axis, Face, type ICubeOptions } from '@cuberoot/visualcube';
import { VisualCube } from '@/components/VisualCube';
import { T } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { BOTTOM_OVERVIEW, TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_SAMPLE } from './lesson-data';
import './chapter-flowchart.css';

const colors = orientedCubeFaceColors(TWO_BY_TWO_ORIENTATION);
const maskedSticker = FM_FIXED_COLOR[FM_IGNORED];
const mutedSticker = `color-mix(in srgb, ${maskedSticker} 11%, transparent)`;
const viewportRotations: ICubeOptions['viewportRotations'] = [[Axis.Y, 30], [Axis.X, -47]];
const projection = { dist: 4 };
const translucentProjection = { ...projection, cubeColor: 'black', cubeOpacity: 12, highlightHiddenFaces: [Face.D] };
const steps = BOTTOM_OVERVIEW.map(({ title, goal, corners }, index) => ({
  title, goal,
  id: TWO_BY_TWO_SAMPLE[0].sections[index].id,
  // The last corner is inserted after a y turn. Draw each completed corner at
  // its home position so the side colors keep the same order through all four steps.
  stickerColors: stageStickerColors(2, piece => corners.some(corner => corner === piece) ? FM_REGULAR : FM_IGNORED, colors),
}));

export function BottomLayerDiagram({ setup, stickerColors, size, alt = '', translucent = true }: {
  setup?: string;
  stickerColors: string[];
  size: number;
  alt?: string;
  translucent?: boolean;
}) {
  return <VisualCube local puzzleSize={2} view={translucent ? 'trans' : 'iso'} size={size} alt={alt}
    viewportRotations={viewportRotations} projection={translucent ? translucentProjection : projection}
    setup={setup} stickerColors={translucent ? stickerColors.map(color => color === maskedSticker ? mutedSticker : color) : stickerColors} />;
}

export default function BottomFlowchart({ onSelect }: { onSelect: (sectionId: string) => void }) {
  return <ol className="two-lbl-flow bottom-flow" role="list">
    {steps.map(({ id, title, goal, stickerColors }, index) => <li key={id}>
      <button type="button" className="two-lbl-flow-node" onClick={() => onSelect(id)}>
        <BottomLayerDiagram size={72} stickerColors={stickerColors} />
        <span>
          <strong><T {...title} /></strong>
          <span className="two-lbl-flow-detail"><T {...goal} /></span>
        </span>
      </button>
      {index < steps.length - 1 && <ArrowDown size={20} aria-hidden="true" />}
    </li>)}
  </ol>;
}
