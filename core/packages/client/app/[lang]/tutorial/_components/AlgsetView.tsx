import { useState, useMemo } from 'react';
import type { AlgsetPostContent } from '../_lib/useTutorialCatalog';
import { CaseCard } from './CaseCard';
import { CaseModal } from './CaseModal';
import { tr } from '@/i18n/tr';

interface AlgsetViewProps {
  post: AlgsetPostContent;
}

export function AlgsetView({ post }: AlgsetViewProps) {
  const [activeGroup, setActiveGroupState] = useState<string>('all');
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  // 切换 group 时关闭 modal，避免 modalIdx 在新 filteredCases 里越界
  const setActiveGroup = (g: string) => {
    setActiveGroupState(g);
    setModalIdx(null);
  };

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
              'algset-group-chip tutorial-btn' + (activeGroup === 'all' ? ' is-active' : '')
            }
            onClick={() => setActiveGroup('all')}
          >
            {tr({ zh: '全部', en: 'All' })} · {post.cases.length}
          </button>
          {post.groups.map(g => (
            <button
              key={g.id}
              className={
                'algset-group-chip tutorial-btn' + (activeGroup === g.id ? ' is-active' : '')
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
