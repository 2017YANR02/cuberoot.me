'use client';

import { tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';
import type { LocalizedText } from '../data/chapters';
import { F2L_CLASSIFICATION } from '../data/classification';
import SectionNavigation from './SectionNavigation';

export default function ClassifiedSectionNavigation({ active, orientation, onSelect }: {
  active: typeof F2L_CLASSIFICATION[number]['sections'][number];
  orientation: string;
  onSelect: (id: string) => void;
}) {
  const bottom = CUBE_COLOR_NAMES[orientedFaceColors(orientation).D];
  const label = (title: LocalizedText) => tr({
    zh: title.zh.replace('{bottom}', bottom.zh),
    en: title.en.replace('{bottom}', bottom.en),
  });
  return <SectionNavigation label={label(active.title)}>
    <div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择案例类型', en: 'Choose a case family' })}>
      {F2L_CLASSIFICATION.map(group => <div className="f2l-section-group" key={group.title.en}>
        <span>{tr(group.title)}</span>
        {group.sections.map(section => <button className="f2l-section-button" key={section.id} type="button"
          aria-pressed={active.id === section.id} onClick={() => onSelect(section.id)}>
          {label(section.title)}
        </button>)}
      </div>)}
    </div>
  </SectionNavigation>;
}
