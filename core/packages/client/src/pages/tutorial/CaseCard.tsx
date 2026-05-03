import type { AlgsetCase } from './useTutorialCatalog';

interface CaseCardProps {
  caseData: AlgsetCase;
  onClick: () => void;
}

export function CaseCard({ caseData, onClick }: CaseCardProps) {
  const primaryAlg = caseData.algs.find(a => a.primary) ?? caseData.algs[0];
  return (
    <div className="case-card" onClick={onClick} role="button" tabIndex={0}
         onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <div className="case-card-img">
        {caseData.image ? (
          <img src={caseData.image} alt={caseData.label} loading="lazy" />
        ) : (
          <span style={{ color: 'var(--tutorial-text-faint)' }}>—</span>
        )}
      </div>
      <div className="case-card-label">{caseData.label}</div>
      {primaryAlg && primaryAlg.alg !== '(no alg found)' && (
        <div className="case-card-alg">{primaryAlg.alg}</div>
      )}
    </div>
  );
}
