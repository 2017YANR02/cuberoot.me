import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { T } from '@/i18n/tr';

export default function StudyActions({ onContinue, children }: { onContinue?: () => void; children?: ReactNode }) {
  return <div className="f2l-study-actions">
    <div className="f2l-study-secondary-actions">{children}</div>
    {onContinue && <button type="button" className="f2l-restart f2l-continue" onClick={onContinue}>
      <T zh="继续" en="Continue" /><ChevronRight size={16} aria-hidden="true" />
    </button>}
  </div>;
}
