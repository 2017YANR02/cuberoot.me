'use client';

import { CompactSelect, type CompactSelectItem } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import type { Sq1NotationMode } from '@/lib/sq1-pbl-notation';

interface Props {
  value: Sq1NotationMode;
  onChange: (value: Sq1NotationMode) => void;
  className?: string;
}

/** SQ1 公式页共用的数字简写、卡脑壳、数字完整记号下拉菜单。 */
export default function Sq1NotationSelect({ value, onChange, className }: Props) {
  const t = useT();
  const items: readonly CompactSelectItem<Sq1NotationMode>[] = [
    { value: 'compact', label: t('数字简写记号', 'Compact numeric notation') },
    { value: 'karnaukh', label: t('卡脑壳记号', 'Karnaukh notation') },
    { value: 'full', label: t('数字完整记号', 'Full numeric notation') },
  ];

  return (
    <CompactSelect
      className={className}
      label={items.find(item => item.value === value)?.label}
      items={items}
      value={value}
      onChange={onChange}
      ariaLabel={t('选择 SQ1 记号', 'Choose SQ1 notation')}
    />
  );
}
