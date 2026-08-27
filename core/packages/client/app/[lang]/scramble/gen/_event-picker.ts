import type { PuzzlePickerGroup, PuzzlePickerItem } from '@/components/PuzzlePicker/PuzzlePicker';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';

interface EventIconMeta {
  id: string;
  iconClass: string;
  textLabel?: string;
}

const WCA_EVENT_SET: ReadonlySet<string> = new Set(ALL_EVENT_IDS);

/** 把当前结果里的项目适配到全站 PuzzlePicker；菜单交互仍由共享组件统一负责。 */
export function scrambleEventPickerGroups(
  eventIds: readonly string[],
  appendEvents: readonly EventIconMeta[],
  isZh: boolean,
): readonly PuzzlePickerGroup[] {
  const appendById = new Map(appendEvents.map((item) => [item.id, item] as const));

  const toItem = (id: string): PuzzlePickerItem => {
    const append = appendById.get(id);
    const iconClass = WCA_EVENT_SET.has(id)
      ? `event-${id}`
      : /^nxn\d+$/.test(id)
        ? 'event-777'
        : append?.iconClass || undefined;
    return {
      id,
      label: eventDisplayName(id, isZh),
      iconClass,
      textLabel: append?.textLabel ?? (iconClass ? undefined : id),
    };
  };

  const wcaItems = eventIds.filter((id) => WCA_EVENT_SET.has(id)).map(toItem);
  const otherItems = eventIds.filter((id) => !WCA_EVENT_SET.has(id)).map(toItem);

  return [
    { id: 'wca', label: tr({ zh: 'WCA 项目', en: 'WCA events' }), items: wcaItems },
    { id: 'other', label: tr({ zh: '其他项目', en: 'Other events' }), items: otherItems },
  ];
}
