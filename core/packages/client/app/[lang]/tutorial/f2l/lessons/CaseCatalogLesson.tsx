'use client';

import { useMemo } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { VisualCube } from '@/components/VisualCube';
import { f2lCatalogCases, f2lCatalogDiagrams } from '../lib/curriculum';
import { F2L_CLASSIFICATION_SECTIONS } from '../data/classification';
import StudyActions from '../components/StudyActions';
import ClassifiedSectionNavigation from '../components/ClassifiedSectionNavigation';

export default function CaseCatalogLesson({ orientation, onNextChapter }: { orientation: string; onNextChapter: () => void }) {
  const [group, setGroup] = useQueryState('algGroup', parseAsString);
  const selected = F2L_CLASSIFICATION_SECTIONS.find(section => section.id === group) ?? F2L_CLASSIFICATION_SECTIONS[0];
  const cases = useMemo(() => f2lCatalogCases(), []);
  const diagrams = useMemo(() => f2lCatalogDiagrams(cases, orientation), [cases, orientation]);
  const index = F2L_CLASSIFICATION_SECTIONS.indexOf(selected);
  const select = (id: string) => {
    const section = F2L_CLASSIFICATION_SECTIONS.find(item => item.id === id);
    if (section) void setGroup(section.id);
  };
  return <>
    <div className="f2l-study-layout">

      <ClassifiedSectionNavigation active={selected} orientation={orientation} onSelect={select} />
      <section className="f2l-catalog-group f2l-study-main">
        <div className="f2l-recognition">{diagrams.filter(c => selected.cases.includes(c.name)).map(c => <figure key={c.name}>
          <VisualCube view="iso" size={100} faceletColors={c.facelets} interactive enlargeable alt={c.name} />
          <figcaption>{c.name}</figcaption>
        </figure>)}</div>
        <StudyActions onPrevious={index > 0
          ? () => select(F2L_CLASSIFICATION_SECTIONS[index - 1].id) : undefined} onContinue={() => {
          const next = F2L_CLASSIFICATION_SECTIONS[index + 1];
          if (next) select(next.id);
          else onNextChapter();
        }} />
      </section>
    </div>
  </>;
}
