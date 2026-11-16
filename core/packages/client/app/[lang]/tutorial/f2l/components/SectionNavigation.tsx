'use client';

import { useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import { TutorialSectionsContext, sectionItems, sectionLink, type TutorialSections } from '../../components/TutorialNavigationShell';
import SectionMenu from '../../components/SectionMenu';
import { StudyNavigation } from './StudyActions';

export default function SectionNavigation({ label, items, groups }: TutorialSections & { label: string }) {
  const register = useContext(TutorialSectionsContext);
  const { mobileMenuTarget } = useContext(StudyNavigation);
  useEffect(() => { register?.({ items, groups }); }, [register, items, groups]);
  useEffect(() => () => register?.({ items: [] }), [register]);
  if (!mobileMenuTarget) return null;
  const all = [...items, ...(groups ?? []).flatMap(group => group.items)];
  return createPortal(<SectionMenu label={label}>
    <NavigationMenu items={sectionItems(items)} collapsed={false} label={label} renderLink={sectionLink(all)} />
    {groups?.map(group => <div key={group.id}><p>{group.label}</p><NavigationMenu items={sectionItems(group.items)} collapsed={false} label={group.label} renderLink={sectionLink(all)} /></div>)}
  </SectionMenu>, mobileMenuTarget);
}
