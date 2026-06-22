'use client';

/**
 * 非 WCA 魔方分组选择器 —— /scramble/solver(SolveTabs)与 /scramble/stats 共用。
 *
 * WCA 求解项目 + ivy 留在 WcaEventSelector 图标行;~30 个非 WCA 魔方塞不进图标行,
 * 改走这个「更多魔方」下拉:点开后按家族(长方体 / 异形扭转 / Square 系 / 滑块 / 联体 /
 * 其他)分组列出。新 puzzle 只要在 lib/cstimer-scramble.ts 标 `solvable: true` + `family`
 * 就自动出现在对应分组,无需改本组件(数据驱动)。
 *
 * 与 WcaEventSelector 同款契约:
 *   - selectedEvent:当前选中(命中则触发器高亮 + 显示其名)。
 *   - linkFor(id):链接模式,返回 { href, hard? } → 渲染真实 <a>/AppLink(中键/Ctrl 新开;
 *     跨 COEP 边界 hard=原生 <a> 整页加载)。/scramble/solver 用。
 *   - onSelect(id):回调模式(无 linkFor 时),渲染 <button>。/scramble/stats 用。
 *
 * availableEvents 省略 = 全部 solvable;传入则只列交集(供未来按场景收窄)。
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronDown, Boxes } from 'lucide-react';
import AppLink from '../AppLink';
import {
  CSTIMER_SOLVABLE_IDS, CSTIMER_FAMILY_LABEL, cstimerEvent, groupCstimerByFamily,
  type CstimerEvent,
} from '@/lib/cstimer-scramble';
import { tr } from '@/i18n/tr';
import './non_wca_puzzle_picker.css';

interface Props {
  isZh: boolean;
  selectedEvent?: string;
  /** 限定可选 id(交集);省略 = 全部 solvable。 */
  availableEvents?: ReadonlySet<string>;
  /** 回调模式(无 linkFor 时用);分布页传 setEvent。 */
  onSelect?: (id: string) => void;
  /** 链接模式;求解页传(跨 COEP 边界 hard=原生 <a>)。返回 null = 退回 button。 */
  linkFor?: (id: string) => { href: string; hard?: boolean } | null;
}

// 取本地化名:按 isZh 索引 [en, zh],避开 isZh 文案三元(param-isZh 仅作函数参数)。
const nameOf = (e: CstimerEvent, isZh: boolean): string => [e.en, e.zh][Number(isZh)];

export default function NonWcaPuzzlePicker({
  isZh, selectedEvent, availableEvents, onSelect, linkFor,
}: Props) {
  const params = useParams();
  const prefix = params?.lang === 'zh' ? '/zh' : '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupId = useId();

  const ids = availableEvents
    ? new Set([...CSTIMER_SOLVABLE_IDS].filter((id) => availableEvents.has(id)))
    : CSTIMER_SOLVABLE_IDS;
  const groups = groupCstimerByFamily(ids);

  // 选中项落在本组里 → 触发器高亮 + 显示其名;否则显示「更多魔方」。
  const selected = selectedEvent && ids.has(selectedEvent) ? cstimerEvent(selectedEvent) : null;
  const triggerLabel = selected
    ? nameOf(selected, isZh)
    : tr({ zh: '更多', en: 'More' });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (groups.length === 0) return null;

  const renderItem = (e: CstimerEvent) => {
    const id = e.id;
    const name = nameOf(e, isZh);
    const active = id === selectedEvent;
    const cls = `nwp-item${active ? ' nwp-item--active' : ''}`;
    const inner = <span className="nwp-item-label">{name}</span>;
    const link = linkFor ? linkFor(id) : null;
    if (link) {
      return link.hard ? (
        <a
          key={id} href={`${prefix}${link.href}`} className={cls}
          aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}
        >{inner}</a>
      ) : (
        <AppLink
          key={id} href={link.href} className={cls}
          aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}
        >{inner}</AppLink>
      );
    }
    return (
      <button
        key={id} type="button" className={cls}
        aria-current={active ? 'page' : undefined}
        onClick={() => { onSelect?.(id); setOpen(false); }}
      >{inner}</button>
    );
  };

  return (
    <div ref={ref} className="nwp">
      <button
        type="button"
        className={`nwp-trigger${selected ? ' nwp-trigger--active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Boxes size={15} className="nwp-trigger-icon" />
        <span className="nwp-trigger-label">{triggerLabel}</span>
        <ChevronDown size={14} className="nwp-trigger-chevron" />
      </button>
      {open && (
        <div className="nwp-popup" id={popupId} role="menu">
          {groups.map(({ family, events }) => (
            <div key={family} className="nwp-group">
              <div className="nwp-group-title">{tr(CSTIMER_FAMILY_LABEL[family])}</div>
              {events.map(renderItem)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
