import { useEffect } from 'react';
import { tutorialMediaUrl, type AlgsetCase } from '../_lib/useTutorialCatalog';
import { AlgChip } from './AlgChip';

interface CaseModalProps {
  caseData: AlgsetCase;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function CaseModal({ caseData, onClose, onPrev, onNext }: CaseModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="case-modal-backdrop" onClick={onClose}>
      <div className="case-modal" onClick={e => e.stopPropagation()}>
        <div className="case-modal-header">
          <h2 className="case-modal-title">{caseData.label}</h2>
          <button className="case-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="case-modal-body">
          <div className="case-modal-img">
            {caseData.image && <img src={tutorialMediaUrl(caseData.image)} alt={caseData.label} />}
          </div>
          <div className="case-modal-algs">
            {caseData.algs
              .filter(a => a.alg !== '(no alg found)')
              .map((a, i) => (
                <div key={i} className="case-modal-tutorial-row">
                  <AlgChip alg={a.alg} algHtml={a.algHtml} />
                </div>
              ))}
            {caseData.notes && (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--tutorial-text-muted)' }}>
                {caseData.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
