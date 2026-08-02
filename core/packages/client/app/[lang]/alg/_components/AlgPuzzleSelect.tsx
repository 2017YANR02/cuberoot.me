'use client';

/**
 * /alg 页首的项目下拉 —— 取代落地页原来那一排项目卡片。
 *
 * 每一项都是真链接(AppLink),中键 / Ctrl 点能新开;当前项高亮但仍可点(回到自己)。
 * 三盲 / 换位子不是 ALG_PUZZLES 里的魔方阶,但各自是一个独立项目(整套编码体系 /
 * 一类构造法,不是某个魔方的一套公式),所以排在魔方之后、同一个下拉里。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import AppLink from '@/components/AppLink';
import { ChevronDown } from 'lucide-react';
import { ALG_PUZZLES } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { tr } from '@/i18n/tr';

interface Item { key: string; href: string; label: string; icon: ReactNode }

function algPuzzleItems(isZh: boolean): Item[] {
  return [
    ...ALG_PUZZLES.map(p => ({
      key: p,
      href: `/alg/${p}`,
      label: eventDisplayName(p, isZh),
      icon: <EventIcon event={p} className="alg-puzzle-select-icon" />,
    })),
    {
      key: '3bld',
      href: '/alg/3bld',
      label: tr({ zh: '三盲', en: '3BLD' }),
      icon: <EventIcon event="333bf" className="alg-puzzle-select-icon" />,
    },
    {
      key: 'commutator',
      href: '/alg/commutator',
      label: tr({ zh: '换位子', en: 'Commutator' }),
      icon: <span className="alg-puzzle-select-icon alg-bracket-icon" aria-hidden="true">[,]</span>,
    },
  ];
}

export default function AlgPuzzleSelect({ current, isZh }: { current: string; isZh: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = algPuzzleItems(isZh);
  const active = items.find(i => i.key === current) ?? items[0];

  return (
    <div className="alg-puzzle-select" ref={ref}>
      <button
        type="button"
        className="alg-puzzle-select-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={tr({ zh: '选择项目', en: 'Choose puzzle' })}
      >
        {active.icon}
        <span>{active.label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="alg-puzzle-select-panel" ref={panelRef}>
          {items.map(i => (
            <AppLink
              key={i.key}
              href={i.href}
              prefetch={false}
              className={`alg-puzzle-select-item${i.key === current ? ' is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {i.icon}
              <span>{i.label}</span>
            </AppLink>
          ))}
        </div>
      )}
    </div>
  );
}
