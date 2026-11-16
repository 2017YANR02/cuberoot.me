import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { tr } from '@/i18n/tr';

export const StudyNavigation = createContext<{
  previous?: () => void; next?: () => void;
  dockTarget?: HTMLDivElement | null;
  mobileMenuTarget?: HTMLDivElement | null;
  setMobileMenuTarget?: (target: HTMLDivElement | null) => void;
}>({});

export default function StudyActions({ onPrevious, onContinue, continueDisabled = false, children }: {
  onPrevious?: () => void; onContinue?: () => void; continueDisabled?: boolean; children?: ReactNode;
}) {
  const navigation = useContext(StudyNavigation);
  const previous = onPrevious ?? navigation.previous;
  const next = onContinue ?? navigation.next;
  const dock = <div className="f2l-study-dock">
  <footer className="f2l-study-actions">
    <button type="button" className="f2l-footer-button tutorial-page-button" aria-label={tr({ zh: '上一节', en: 'Previous section' })} disabled={!previous} onClick={previous}>
      <ArrowLeft size={17} aria-hidden="true" />
    </button>
    <div className="tutorial-section-menu-host" ref={navigation.setMobileMenuTarget} />
    <div className="f2l-study-secondary-actions">{children}</div>
    <button type="button" className="f2l-footer-button f2l-footer-next tutorial-page-button" aria-label={tr({ zh: '下一节', en: 'Next section' })} disabled={!next || continueDisabled} onClick={next}>
      <ArrowRight size={17} aria-hidden="true" />
    </button>
  </footer></div>;
  return navigation.dockTarget ? createPortal(dock, navigation.dockTarget) : dock;
}
