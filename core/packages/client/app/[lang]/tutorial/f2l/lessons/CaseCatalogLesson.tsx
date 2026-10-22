'use client';

import { useMemo, useState } from 'react';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { f2lCatalogCases, f2lCatalogDiagrams, f2lGroupName } from '../lib/curriculum';
import StudyActions from '../components/StudyActions';

export default function CaseCatalogLesson({ orientation, onNextChapter }: { orientation: string; onNextChapter: () => void }) {
  const [selectedGroup, setSelectedGroup] = useState('');
  const cases = useMemo(() => f2lCatalogCases(), []);
  const diagrams = useMemo(() => f2lCatalogDiagrams(cases, orientation), [cases, orientation]);
  const groups = [...new Set(diagrams.map(c => c.group))];
  const activeGroup = groups.includes(selectedGroup) ? selectedGroup : groups[0];
  return <>
    <div className="f2l-study-layout">

      <div className="f2l-section-nav"><div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择情况分组', en: 'Choose a case group' })}>
        {groups.map(group => <button className="f2l-section-button" key={group} type="button" aria-pressed={activeGroup === group} onClick={() => setSelectedGroup(group)}>
          <span className="f2l-section-label"><VisualCube view="iso" size={36} faceletColors={diagrams.find(c => c.group === group)!.facelets} alt="" />
            <span>{tr(f2lGroupName(group))}</span></span>
        </button>)}
      </div></div>
      <section className="f2l-catalog-group f2l-study-main">
        <div className="f2l-recognition">{diagrams.filter(c => c.group === activeGroup).map(c => <figure key={c.name}>
          <VisualCube view="iso" size={150} faceletColors={c.facelets} interactive enlargeable alt={c.name} />
          <figcaption>{c.name}</figcaption>
        </figure>)}</div>
        <StudyActions onContinue={() => {
          const next = groups[groups.indexOf(activeGroup) + 1];
          if (next) setSelectedGroup(next);
          else onNextChapter();
        }} />
      </section>
    </div>
  </>;
}
