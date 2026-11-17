'use client';

import { tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';
import type { LocalizedText } from '../data/chapters';
import { F2L_CLASSIFICATION_SECTIONS } from '../data/classification';
import SectionNavigation from './SectionNavigation';

export default function ClassifiedSectionNavigation({ active, orientation, onSelect }: {
  active: typeof F2L_CLASSIFICATION_SECTIONS[number];
  orientation: string;
  onSelect: (id: string) => void;
}) {
  const bottom = CUBE_COLOR_NAMES[orientedFaceColors(orientation).D];
  const label = (title: LocalizedText) => tr({
    zh: title.zh.replace('{bottom}', bottom.zh),
    en: title.en.replace('{bottom}', bottom.en),
  });
  return <SectionNavigation label={label(active.title)} items={F2L_CLASSIFICATION_SECTIONS.map(section => ({
    id: section.id, label: label(section.title), active: active.id === section.id, onSelect: () => onSelect(section.id),
  }))} />;
}
