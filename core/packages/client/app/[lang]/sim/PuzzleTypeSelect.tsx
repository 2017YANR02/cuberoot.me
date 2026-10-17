'use client';

import { tr } from '@/i18n/tr';
import PuzzlePicker, { type PuzzlePickerGroup, type PuzzlePickerItem } from '@/components/PuzzlePicker/PuzzlePicker';
import { groupSimPuzzleOptions, type SimPuzzleTypeOption } from './puzzleOptions';

export function PuzzleTypeSelect({ value, onChange, isZh, allowedValues, showName = false }: {
  value: string;
  onChange: (v: string) => void;
  isZh: boolean;
  /** Optional subset for another /sim tool that shares this selector. */
  allowedValues?: readonly string[];
  showName?: boolean;
}) {
  const catalog = groupSimPuzzleOptions(allowedValues);
  const options = catalog.flatMap(group => group.options);
  const current = options.find((option) => option.value === value) ?? options[0];
  const toItem = (option: SimPuzzleTypeOption): PuzzlePickerItem => ({
      id: option.value,
      label: [option.labelEn, option.labelZh][Number(isZh)],
      iconClass: option.iconClass,
      textLabel: option.textLabel,
  });
  const families = catalog.filter(group => group.submenu);
  const groups: PuzzlePickerGroup[] = [];
  const wca = catalog.find(group => group.id === 'wca');
  if (wca) groups.push({ id: wca.id, label: [wca.labelEn, wca.labelZh][Number(isZh)], items: wca.options.map(toItem) });
  if (families.length) groups.push({
    id: 'sim-families', label: tr({ en: 'Series', zh: '系列' }),
    items: families.map(group => ({
      id: `sim-family:${group.id}`,
      label: [group.labelEn, group.labelZh][Number(isZh)],
      iconClass: group.options[0].iconClass,
      textLabel: group.options[0].textLabel,
      children: group.options.map(toItem),
    })),
  });
  const other = catalog.find(group => group.id === 'other');
  if (other) groups.push({ id: other.id, label: [other.labelEn, other.labelZh][Number(isZh)], items: other.options.map(toItem) });

  return (
    <PuzzlePicker
      isZh={isZh}
      selectedEvent={current?.value}
      groups={groups}
      onSelect={onChange}
      showTriggerIcon={!showName}
    />
  );
}

