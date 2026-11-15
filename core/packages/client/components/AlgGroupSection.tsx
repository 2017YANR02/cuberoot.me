'use client';

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AlgCase } from '@cuberoot/shared';
import AlgCard from '@/components/AlgCard';
import { MoreTogglePanel } from '@/components/MoreToggle';

interface Group {
  key: string;
  title: ReactNode;
  thumb: ReactNode;
  showHeading: boolean;
  cases: AlgCase[];
  before?: ReactNode;
}

/** Shared algorithm groups: continuous cover column and one independent case panel. */
export default function AlgGroupSection({ groups, collapsible, expandedGroup, onToggle, renderCases }: {
  groups: Group[];
  collapsible: boolean;
  expandedGroup: string | null;
  onToggle: (key: string) => void;
  renderCases: (cases: AlgCase[]) => ReactNode;
}) {
  const coversRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const groupKeys = JSON.stringify(groups.map(group => group.key));
  useLayoutEffect(() => {
    const covers = coversRef.current;
    if (!collapsible || !covers) return;
    const measure = () => {
      const top = covers.getBoundingClientRect().top;
      const next = Array.from(covers.children, cover => cover.getBoundingClientRect().top - top);
      setOffsets(previous => previous.length === next.length && previous.every((value, index) => Math.abs(value - next[index]) < 0.5)
        ? previous : next);
    };
    measure();
    // Observe only the cover column; writing panel offsets cannot resize these nodes.
    const observer = new ResizeObserver(measure);
    for (const cover of covers.children) observer.observe(cover);
    return () => observer.disconnect();
  }, [collapsible, groupKeys]);

  if (!collapsible) return <>{groups.map(group => <Fragment key={group.key}>
    {group.before}
    <section className="alg-subgroup">
      {group.showHeading && <h2 className="alg-subgroup-title">{group.title}</h2>}
      {renderCases(group.cases)}
    </section>
  </Fragment>)}</>;

  return <div className="alg-group-section">
    <div className="alg-group-covers" ref={coversRef}>
      {groups.map(group => <AlgCard key={group.key} thumb={group.thumb} title={group.title}
        expand={expandedGroup === group.key ? 'open' : 'closed'}
        ariaControls={`alg-group-${encodeURIComponent(group.key)}`}
        onClick={() => onToggle(group.key)} />)}
    </div>
    <div className="alg-group-panels">
      {groups.map((group, index) => <MoreTogglePanel key={group.key}
        axis="horizontal"
        style={{ marginTop: offsets[index] ?? 0 }}
        id={`alg-group-${encodeURIComponent(group.key)}`} expanded={expandedGroup === group.key}>
        <GroupCases group={group} render={renderCases} />
      </MoreTogglePanel>)}
    </div>
  </div>;
}

// Keep formula formatting and case-card construction behind the panel's lazy mount.
function GroupCases({ group, render }: { group: Group; render: (cases: AlgCase[]) => ReactNode }) {
  return <>{group.before}{render(group.cases)}</>;
}
