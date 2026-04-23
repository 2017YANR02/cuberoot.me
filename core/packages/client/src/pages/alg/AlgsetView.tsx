import { useState, useMemo } from 'react';
import type { AlgsetPostContent } from './useAlgCatalog';
import { CaseCard } from './CaseCard';
import { CaseModal } from './CaseModal';

interface AlgsetViewProps {
  post: AlgsetPostContent;
}

export function AlgsetView({ post }: AlgsetViewProps) {
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  const filteredCases = useMemo(() => {
    if (activeGroup === 'all') return post.cases;
    return post.cases.filter(c => c.group === activeGroup);
  }, [post.cases, activeGroup]);

  const hasGroups = post.groups.length > 1;

  return (
    <div className="algset-root">
      {hasGroups && (
        <div className="algset-groups">
          <button
            className={
              'algset-group-chip' + (activeGroup === 'all' ? ' is-active' : '')
            }
            onClick={() => setActiveGroup('all')}
          >
            全部 · {post.cases.length}
          </button>
          {post.groups.map(g => (
            <button
              key={g.id}
              className={
                'algset-group-chip' + (activeGroup === g.id ? ' is-active' : '')
              }
              onClick={() => setActiveGroup(g.id)}
            >
              {g.label} · {g.count}
            </button>
          ))}
        </div>
      )}

      <div className="algset-case-grid">
        {filteredCases.map((c, i) => (
          <CaseCard key={c.id} caseData={c} onClick={() => setModalIdx(i)} />
        ))}
      </div>

      {modalIdx !== null && filteredCases[modalIdx] && (
        <CaseModal
          caseData={filteredCases[modalIdx]}
          onClose={() => setModalIdx(null)}
          onPrev={
            modalIdx > 0 ? () => setModalIdx(modalIdx - 1) : undefined
          }
          onNext={
            modalIdx < filteredCases.length - 1
              ? () => setModalIdx(modalIdx + 1)
              : undefined
          }
        />
      )}
    </div>
  );
}
