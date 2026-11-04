const GROUP_NAMES: Record<string, { zh: string; en: string }> = {
  'Free Pairs': { zh: '基态', en: 'Free pairs' },
  'Disconnected Pairs': { zh: '分离', en: 'Disconnected' },
  'Connected Pairs': { zh: '合并', en: 'Connected' },
  'Corner In Slot': { zh: '角在槽', en: 'Corner in slot' },
  'Edge In Slot': { zh: '棱在槽', en: 'Edge in slot' },
  'Pieces In Slot': { zh: '棱角在槽', en: 'Pieces in slot' },
};
export function f2lGroupName(group: string) {
  return Object.entries(GROUP_NAMES).find(([key]) => key.toLowerCase() === group.toLowerCase())?.[1]
    ?? { zh: group, en: group };
}
