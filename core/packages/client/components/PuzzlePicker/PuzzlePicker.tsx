'use client';

/**
 * 全站魔方项目选择下拉。
 *
 * 原「更多魔方」下拉(NonWcaPuzzlePicker)的泛化:现在一个下拉装下**全部**项目 ——
 * 传 `wcaEvents` 则 WCA 项目作为置顶分组(图标 + 名字)列出,其后按家族(长方体 / 异形扭转 /
 * Square 系 / 滑块 / 联体 / 其他)列出非 WCA 魔方。不传 `wcaEvents` = 只列非 WCA(旧行为)。
 * 新 puzzle 只要在 lib/cstimer-scramble.ts 标 `solvable: true` + `family` 就自动出现在对应
 * 分组,无需改本组件(数据驱动)。
 *
 * 契约:
 *   - selectedEvent:当前选中(命中则触发器高亮,收起态只显示其图标 + 箭头)。
 *   - selectedEvents + onToggle:多选模式,点击项目只切换选中态,弹层保持打开。
 *   - linkFor(id):链接模式,返回 { href, hard? } → 渲染真实 <a>/AppLink(中键/Ctrl 新开;
 *     跨 COEP 边界 hard=原生 <a> 整页加载)。/scramble/solver 用。
 *   - onSelect(id):回调模式(无 linkFor 时),渲染 <button>。/scramble/stats 用。
 *
 * availableEvents 省略 = 全部 solvable;传入则只列交集(供按场景收窄)。页面有自己的项目
 * catalog 时传 groups;组件仍统一负责触发器、图标 + 名称、弹层、关闭/焦点与窄屏布局。
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronDown, Boxes } from 'lucide-react';
import AppLink from '../AppLink';
import { CubingIcon } from '../EventIcon/EventIcon';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import {
  CSTIMER_SOLVABLE_IDS, CSTIMER_FAMILY_LABEL, groupCstimerByFamily,
  type CstimerEvent,
} from '@/lib/cstimer-scramble';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import './puzzle_picker.css';

export interface PuzzlePickerItem {
  id: string;
  label: string;
  iconClass?: string;
  textLabel?: string;
}

export interface PuzzlePickerGroup {
  id: string;
  label: string;
  items: readonly PuzzlePickerItem[];
}

interface Props {
  isZh?: boolean;
  selectedEvent?: string;
  /** 多选模式的当前项目;与 onToggle 配套使用。 */
  selectedEvents?: ReadonlySet<string>;
  /** WCA 项目(置顶分组,按 ALL_EVENT_IDS 顺序);省略 = 不列 WCA。 */
  wcaEvents?: ReadonlySet<string>;
  /** 限定可选的非 WCA id(交集);省略 = 全部 solvable。 */
  availableEvents?: ReadonlySet<string>;
  /** 回调模式(无 linkFor 时用);分布页传 setEvent。 */
  onSelect?: (id: string) => void;
  /** 多选模式回调;点击后不关闭弹层。 */
  onToggle?: (id: string) => void;
  /** 链接模式;求解页传(跨 COEP 边界 hard=原生 <a>)。返回 null = 退回 button。 */
  linkFor?: (id: string) => { href: string; hard?: boolean } | null;
  /** 页面自己的项目 catalog。传入后不再生成默认 WCA + csTimer 家族分组。 */
  groups?: readonly PuzzlePickerGroup[];
  /** 计时表面用:让整个弹层都跳过空格/指针计时手势。 */
  dataNoTimer?: boolean;
}

// 取本地化名:按 isZh 索引 [en, zh],避开 isZh 文案三元(param-isZh 仅作函数参数)。
const nameOf = (e: CstimerEvent, isZh: boolean): string => [e.en, e.zh][Number(isZh)];

export default function PuzzlePicker({
  isZh = false, selectedEvent, selectedEvents, wcaEvents, availableEvents, onSelect, onToggle, linkFor,
  groups: suppliedGroups, dataNoTimer,
}: Props) {
  const params = useParams();
  const prefix = params?.lang === 'zh' ? '/zh' : '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  usePanelClamp(open, panelRef);

  const wcaIds = wcaEvents ? ALL_EVENT_IDS.filter((id) => wcaEvents.has(id)) : [];
  const ids = availableEvents
    ? new Set([...CSTIMER_SOLVABLE_IDS].filter((id) => availableEvents.has(id)))
    : CSTIMER_SOLVABLE_IDS;
  const cstimerGroups = groupCstimerByFamily(ids);

  const groups = useMemo<readonly PuzzlePickerGroup[]>(() => {
    if (suppliedGroups) return suppliedGroups.filter((group) => group.items.length > 0);
    const out: PuzzlePickerGroup[] = [];
    if (wcaIds.length > 0) {
      out.push({
        id: 'wca',
        label: tr({ zh: 'WCA 项目', en: 'WCA events' }),
        items: wcaIds.map((id) => ({ id, label: eventDisplayName(id, isZh), iconClass: `event-${id}` })),
      });
    }
    for (const { family, events } of cstimerGroups) {
      out.push({
        id: family,
        label: tr(CSTIMER_FAMILY_LABEL[family]),
        items: events.map((event) => ({
          id: event.id,
          label: nameOf(event, isZh),
          iconClass: event.iconClass || undefined,
          textLabel: event.textLabel,
        })),
      });
    }
    return out;
  }, [suppliedGroups, wcaIds, cstimerGroups, isZh]);

  const isMulti = selectedEvents !== undefined && onToggle !== undefined;
  const selectedItems = groups
    .flatMap((group) => group.items)
    .filter((item) => isMulti ? selectedEvents?.has(item.id) : item.id === selectedEvent);
  // 单选或仅选一个项目时显示具体图标;多选多个时保留通用项目图标,避免误指其中一个。
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const hasSelection = selectedItems.length > 0;
  const placeholder = wcaEvents ? tr({ zh: '项目', en: 'Puzzle' }) : tr({ zh: '更多', en: 'More' });
  const triggerLabel = selectedItem?.label ?? (suppliedGroups ? tr({ zh: '项目', en: 'Puzzle' }) : placeholder);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (groups.length === 0) return null;

  const iconFor = (item: PuzzlePickerItem, trigger = false) => {
    const className = trigger ? 'pp-trigger-icon' : 'pp-item-icon';
    if (item.iconClass) return <CubingIcon icon={item.iconClass} className={className} />;
    return <span className={`${className} pp-item-tag`}>{item.textLabel ?? item.id}</span>;
  };

  const renderItem = (item: PuzzlePickerItem) => {
    const active = isMulti ? Boolean(selectedEvents?.has(item.id)) : item.id === selectedEvent;
    const cls = `pp-item${active ? ' pp-item--active' : ''}`;
    const inner = (
      <>
        {iconFor(item)}
        <span className="pp-item-label">{item.label}</span>
      </>
    );
    const link = linkFor ? linkFor(item.id) : null;
    if (link) {
      return link.hard ? (
        <a
          key={item.id} href={`${prefix}${link.href}`} className={cls} role="menuitem"
          aria-current={active ? 'page' : undefined} onClick={() => close()}
        >{inner}</a>
      ) : (
        <AppLink
          key={item.id} href={link.href} className={cls} role="menuitem" prefetch={false}
          aria-current={active ? 'page' : undefined} onClick={() => close()}
        >{inner}</AppLink>
      );
    }
    return (
      <button
        key={item.id} type="button" className={cls} role={isMulti ? 'menuitemcheckbox' : 'menuitem'}
        aria-checked={isMulti ? active : undefined}
        aria-current={!isMulti && active ? 'page' : undefined}
        onClick={() => {
          if (isMulti) onToggle?.(item.id);
          else { onSelect?.(item.id); close(true); }
        }}
      >{inner}</button>
    );
  };

  return (
    <div ref={ref} className="pp" data-no-timer={dataNoTimer ? '' : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className={`pp-trigger${hasSelection ? ' pp-trigger--active' : ''}`}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {selectedItem ? iconFor(selectedItem, true) : <Boxes size={15} className="pp-trigger-icon" />}
        {!selectedItem && <span className="pp-trigger-label">{triggerLabel}</span>}
        <ChevronDown size={14} className="pp-trigger-chevron" />
      </button>
      {open && (
        <div ref={panelRef} className="pp-popup" id={popupId} role="menu">
          {groups.map((group) => (
            <div key={group.id} className="pp-group">
              <div className="pp-group-title">{group.label}</div>
              <div className="pp-group-items">
                {group.items.map(renderItem)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
