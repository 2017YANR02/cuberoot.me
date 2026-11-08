import { Alg } from 'cubing/alg';
import { Axis } from '@cuberoot/visualcube';
import { Play, GitBranch } from '@app-foundation/icons/lucide';
import { FM_FIXED_COLOR, FM_IGNORED, FM_REGULAR, stickeringMaskFn, mergeStickeringMaskFns } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { VisualCube } from '@/components/VisualCube';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { LBL_STEPS, LESSON_STICKERING } from './content';
import { BASIC_GUIDE_TOPICS } from './BasicsGuide';
import { MiddleCaseDiagram } from './MiddleCases';
import { LastLayerTermDiagram } from './LastLayerTerms';
import { StageImage } from './StageImage';
import { chapters, type Lesson } from './curriculum';
import { whiteEdgeMask } from './white-edge';
import { withBrightCenters } from './cross-display';
import { FishThumbnail } from './FishLessons';
import { DaisyFace } from './DaisyTerms';
import { bottomCornerPreview, middleEdgePreview } from './complete-demo-state';

const scheme = orientedCubeFaceColors('z2');
const ignored = FM_FIXED_COLOR[FM_IGNORED]!;

/** Temporary LBL thumbnails follow the original LBL recognition diagrams. */
export default function LessonThumbnail({ chapter, lesson, size = 52, viewportRotations }: { chapter: typeof chapters[number]; lesson: Lesson; size?: number; viewportRotations?: [Axis, number][] }) {
  if (lesson.kind === 'flowchart') return <GitBranch size={size} aria-hidden="true" />;
  if (chapter.id === 'sune-learning' && !lesson.example) return <FishThumbnail />;
  if (lesson.id === 'white-edge') return <VisualCube local size={size} view="iso" setup={lesson.example?.setup}
    stickerColors={stageStickerColors(3, whiteEdgeMask, scheme)} stickerMaskColor={ignored} alt="" />;
  if (lesson.kind === 'notation' || (chapter.id === 'cross' && lesson.example?.title.en === 'Complete demonstration')) {
    return <span className="lbl-thumbnail"><VisualCube local size={size} view="iso" algorithm={lesson.example?.alg ?? ''} setup={lesson.example?.setup} alt="" /><Play className="lbl-thumbnail-play" size={26} /></span>;
  }
  if (lesson.kind === 'terms') return chapter.id === 'daisy' ? <DaisyFace size={size} />
    : chapter.id === 'middle' ? <MiddleCaseDiagram size={size} /> : <LastLayerTermDiagram size={size} wall={chapter.id === 'edge-position'} />;
  if (chapter.id === 'structure' || lesson.kind === 'layers') {
    const guide = BASIC_GUIDE_TOPICS.find(item => item.id === (lesson.kind === 'notation' ? 'moves' : lesson.id));
    const colors = lesson.kind === 'facelet' ? Array.from({ length: 54 }, (_, i) => i === 20 ? scheme.F : ignored)
      : lesson.kind === 'overview' ? stageStickerColors(3, piece => {
        const coordinates = [piece % 3, Math.floor(piece / 3) % 3, Math.floor(piece / 9)];
        return coordinates[1] === 0 || coordinates.filter(value => value === 1).length === 2 ? FM_REGULAR : FM_IGNORED;
      }, scheme) : guide?.colors ?? stageStickerColors(3, lesson.mask ? stickeringMaskFn(3, lesson.mask) : null, scheme);
    return <VisualCube local size={size} view="iso" stickerColors={colors} stickerMaskColor={ignored} setup={guide?.setup ?? ''} alt="" />;
  }
  const example = lesson.example;
  if (!example) return <span className="lbl-thumbnail"><StageImage stage={chapter.id} size={size} />{lesson.kind === 'complete' && <Play className="lbl-thumbnail-play" size={26} />}</span>;
  const index = Number(lesson.id.replace('case-', ''));
  const lastLayer = LBL_STEPS.findIndex(item => item.id === chapter.id) >= 5;
  const name = pickStickering('3x3', lesson.mask ?? LESSON_STICKERING[chapter.id] ?? '', 'sim');
  const baseMask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
  const mask = chapter.id === 'cross' || chapter.id === 'corners' ? withBrightCenters(baseMask) : baseMask;
  const plan = ['yellow-face', 'corner-position'].includes(chapter.id) || lesson.id.startsWith('sune-learning');
  let colors = stageStickerColors(3, mergeStickeringMaskFns([mask, lastLayer && !plan || lesson.id.startsWith('sune-learning') ? stickeringMaskFn(3, 'F2L') : null]), scheme);
  if (chapter.id === 'yellow-face' && (index === 2 || index === 3)) {
    colors = Array<string>(54).fill(ignored);
    for (const i of [1, 3, 4, 5, 7, index === 2 ? 18 : 38, ...(index === 2 ? [0, 2] : [])]) colors[i] = scheme.U;
    return <VisualCube local size={size} view="plan" stickerColors={colors} stickerMaskColor={ignored} alt="" />;
  }
  const preparation = chapter.id === 'corners' ? new Alg(example.alg).expand().toString().split(/\s+/).slice(0, index === 1 ? 1 : 2).join(' ')
    : chapter.id === 'corner-position' && index === 0 ? 'y' : chapter.id === 'yellow-cross' && index < 2 ? 'U' : '';
  const setup = new Alg(`${resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false)} ${preparation}`).expand().toString();
  const specialCorner = chapter.id === 'corners' && index === 1;
  const specialEdge = chapter.id === 'middle' && index === 2;
  if (specialCorner || specialEdge) {
    const { highlights } = specialCorner ? bottomCornerPreview(setup) : middleEdgePreview(setup);
    for (const sticker of highlights) {
      const face = 'URFDLB'.indexOf(sticker[0]);
      colors[face * 9 + Number(sticker.slice(1))] = '#a855f7';
    }
  }
  const rotations: [Axis, number][] | undefined = chapter.id === 'corners' ? [[Axis.Y, index === 2 ? -30 : 30], [Axis.X, -25]]
    : chapter.id === 'middle' && index < 2 ? [[Axis.Y, index === 1 ? -30 : 30], [Axis.X, -30]] : undefined;
  return <VisualCube local size={size} view={plan ? 'plan' : 'iso'} scheme="yogwrb" setup={setup} stickerColors={colors} stickerMaskColor={ignored} viewportRotations={viewportRotations ?? rotations} alt="" />;
}
