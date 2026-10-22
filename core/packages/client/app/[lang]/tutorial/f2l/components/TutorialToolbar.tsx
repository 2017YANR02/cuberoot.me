'use client';

import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import CubeColorChip from '@/components/CubeColorChip/CubeColorChip';
import { CUBE_COLOR_NAMES, CUBE_COLOR_LETTER_FOR_FACE, type CubeFace } from '@/lib/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';
import { F2L_CHAPTERS, type ChapterId } from '../data/chapters';

const COLORS = Object.keys(CUBE_COLOR_NAMES) as CubeFace[];
const COLOR_CHOICES = CUBE_ORIENTATIONS.map(option => ({ ...option, colors: orientedFaceColors(option.value) }));

export default function TutorialToolbar({ stepId, orientation, pauseBetween, onChapterChange, onOrientationChange, onPauseBetweenChange }: {
  stepId: ChapterId;
  orientation: string;
  pauseBetween: boolean;
  onChapterChange: (id: ChapterId) => void;
  onOrientationChange: (orientation: string) => void;
  onPauseBetweenChange: (pause: boolean) => void;
}) {
  const stepIndex = F2L_CHAPTERS.findIndex(chapter => chapter.id === stepId);
  const tutorialStep = F2L_CHAPTERS[stepIndex];
  const selectedColors = orientedFaceColors(orientation);
  const bottom = selectedColors.D;
  const colorName = (face: CubeFace) => tr(CUBE_COLOR_NAMES[face]);
  const colorLetter = (face: CubeFace) => CUBE_COLOR_LETTER_FOR_FACE[face];
  const slotName = (front: CubeFace, right: CubeFace) => tr({
    zh: '前：' + colorName(front) + ' · 右：' + colorName(right),
    en: 'Front: ' + colorName(front) + ' · Right: ' + colorName(right),
  });
  return <div className="f2l-toolbar">
      <nav className="f2l-nav" aria-label={tr({ zh: '教程步骤', en: 'Tutorial steps' })}>
        <CompactSelect variant="plain" className="f2l-step-select" label={String(stepIndex + 1) + '. ' + tr(tutorialStep.title)} value={tutorialStep.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
          items={F2L_CHAPTERS.map((item, index) => ({ value: item.id, label: String(index + 1) + '. ' + tr(item.title) }))}
          onChange={onChapterChange} />
      </nav>
      <div className="f2l-colors" role="group" aria-label={tr({ zh: '教程配色', en: 'Tutorial colors' })}>
        <span className="f2l-color-field">
          <span><T zh="底色" en="Bottom" /></span>
          <CompactSelect ariaLabel={tr({ zh: '选择底色', en: 'Choose bottom color' })}
            value={bottom} valueText={colorName(bottom)} label={<CubeColorChip colors={colorLetter(bottom)} />}
            items={COLORS.map(face => ({ value: face, label: <CubeColorChip colors={colorLetter(face)} /> }))}
            onChange={value => {
              const nextBottom = value as CubeFace;
              const options = COLOR_CHOICES.filter(option => option.colors.D === nextBottom);
              onOrientationChange((options.find(option => option.colors.F === selectedColors.F) ?? options[0]).value);
            }} />
        </span>
        <span className="f2l-color-field">
          <span><T zh="FR槽" en="FR slot" /></span>
          <CompactSelect ariaLabel={tr({ zh: '选择 FR 槽颜色', en: 'Choose FR slot colors' })}
            value={orientation} valueText={slotName(selectedColors.F, selectedColors.R)}
            label={<CubeColorChip colors={colorLetter(selectedColors.F) + colorLetter(selectedColors.R)} title={slotName(selectedColors.F, selectedColors.R)} />}
            items={COLOR_CHOICES.filter(option => option.colors.D === bottom).map(option => ({
              value: option.value,
              label: <CubeColorChip colors={colorLetter(option.colors.F) + colorLetter(option.colors.R)} title={slotName(option.colors.F, option.colors.R)} />,
            }))}
            onChange={onOrientationChange} />
        </span>
      </div>
      <div className="f2l-playback-setting">
        <BoolToggle value={pauseBetween} onChange={onPauseBetweenChange} label={tr({ zh: '分段停顿', en: 'Pause between sections' })} />
      </div>
    </div>;
}
