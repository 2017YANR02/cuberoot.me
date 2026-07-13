'use client';

/**
 * 魔方项目选择下拉 —— /scramble/solver(SolveTabs)与 /scramble/stats 共用。
 *
 * 原「更多魔方」下拉(NonWcaPuzzlePicker)的泛化:现在一个下拉装下**全部**项目 ——
 * 传 `wcaEvents` 则 WCA 项目作为置顶分组(图标 + 名字)列出,其后按家族(长方体 / 异形扭转 /
 * Square 系 / 滑块 / 联体 / 其他)列出非 WCA 魔方。不传 `wcaEvents` = 只列非 WCA(旧行为)。
 * 新 puzzle 只要在 lib/cstimer-scramble.ts 标 `solvable: true` + `family` 就自动出现在对应
 * 分组,无需改本组件(数据驱动)。
 *
 * 契约:
 *   - selectedEvent:当前选中(命中则触发器高亮 + 显示其图标/名)。
 *   - linkFor(id):链接模式,返回 { href, hard? } → 渲染真实 <a>/AppLink(中键/Ctrl 新开;
 *     跨 COEP 边界 hard=原生 <a> 整页加载)。/scramble/solver 用。
 *   - onSelect(id):回调模式(无 linkFor 时),渲染 <button>。/scramble/stats 用。
 *
 * availableEvents 省略 = 全部 solvable;传入则只列交集(供按场景收窄)。
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronDown, Boxes } from 'lucide-react';
import AppLink from '../AppLink';
import { CubingIcon } from '../EventIcon/EventIcon';
import {
  CSTIMER_SOLVABLE_IDS, CSTIMER_FAMILY_LABEL, cstimerEvent, groupCstimerByFamily,
  type CstimerEvent,
} from '@/lib/cstimer-scramble';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import './puzzle_picker.css';

interface Props {
  isZh: boolean;
  selectedEvent?: string;
  /** WCA 项目(置顶分组,按 ALL_EVENT_IDS 顺序);省略 = 不列 WCA。 */
  wcaEvents?: ReadonlySet<string>;
  /** 限定可选的非 WCA id(交集);省略 = 全部 solvable。 */
  availableEvents?: ReadonlySet<string>;
  /** 回调模式(无 linkFor 时用);分布页传 setEvent。 */
  onSelect?: (id: string) => void;
  /** 链接模式;求解页传(跨 COEP 边界 hard=原生 <a>)。返回 null = 退回 button。 */
  linkFor?: (id: string) => { href: string; hard?: boolean } | null;
}

// 取本地化名:按 isZh 索引 [en, zh],避开 isZh 文案三元(param-isZh 仅作函数参数)。
const nameOf = (e: CstimerEvent, isZh: boolean): string => [e.en, e.zh][Number(isZh)];

export default function PuzzlePicker({
  isZh, selectedEvent, wcaEvents, availableEvents, onSelect, linkFor,
}: Props) {
  const params = useParams();
  const prefix = params?.lang === 'zh' ? '/zh' : '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupId = useId();

  const wcaIds = wcaEvents ? ALL_EVENT_IDS.filter((id) => wcaEvents.has(id)) : [];
  const ids = availableEvents
    ? new Set([...CSTIMER_SOLVABLE_IDS].filter((id) => availableEvents.has(id)))
    : CSTIMER_SOLVABLE_IDS;
  const groups = groupCstimerByFamily(ids);

  // 选中项落在本下拉里 → 触发器高亮 + 显示其图标/名;否则占位:装了 WCA 组 = 全项目选择器
  //(「项目」),只装非 WCA = 图标行旁的补充下拉(「更多」)。
  const selectedWca = selectedEvent && wcaEvents?.has(selectedEvent) ? selectedEvent : null;
  const selectedNonWca = selectedEvent && ids.has(selectedEvent) ? cstimerEvent(selectedEvent) : null;
  const placeholder = wcaEvents ? tr({ zh: '项目', en: 'Puzzle' }) : tr({ zh: '更多', en: 'More' });
  const triggerLabel = selectedWca
    ? eventDisplayName(selectedWca, isZh)
    : selectedNonWca
      ? nameOf(selectedNonWca, isZh)
      : placeholder;

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

  if (groups.length === 0 && wcaIds.length === 0) return null;

  // 图标槽:WCA 走 event-<id> 图标;非 WCA 有 iconClass 就用,否则退回短文本标签。
  const iconFor = (id: string, e?: CstimerEvent) => {
    if (!e) return <CubingIcon icon={`event-${id}`} className="pp-item-icon" />;
    if (e.iconClass) return <CubingIcon icon={e.iconClass} className="pp-item-icon" />;
    return <span className="pp-item-icon pp-item-tag">{e.textLabel ?? id}</span>;
  };

  const renderItem = (id: string, name: string, e?: CstimerEvent) => {
    const active = id === selectedEvent;
    const cls = `pp-item${active ? ' pp-item--active' : ''}`;
    const inner = (
      <>
        {iconFor(id, e)}
        <span className="pp-item-label">{name}</span>
      </>
    );
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
    <div ref={ref} className="pp">
      <button
        type="button"
        className={`pp-trigger${selectedWca || selectedNonWca ? ' pp-trigger--active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {selectedWca
          ? <CubingIcon icon={`event-${selectedWca}`} className="pp-trigger-icon" />
          : <Boxes size={15} className="pp-trigger-icon" />}
        <span className="pp-trigger-label">{triggerLabel}</span>
        <ChevronDown size={14} className="pp-trigger-chevron" />
      </button>
      {open && (
        <div className="pp-popup" id={popupId} role="menu">
          {wcaIds.length > 0 && (
            <div className="pp-group">
              <div className="pp-group-title">{tr({ zh: 'WCA 项目', en: 'WCA events' })}</div>
              <div className="pp-group-items">
                {wcaIds.map((id) => renderItem(id, eventDisplayName(id, isZh)))}
              </div>
            </div>
          )}
          {groups.map(({ family, events }) => (
            <div key={family} className="pp-group">
              <div className="pp-group-title">{tr(CSTIMER_FAMILY_LABEL[family])}</div>
              <div className="pp-group-items">
                {events.map((e) => renderItem(e.id, nameOf(e, isZh), e))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
