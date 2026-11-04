'use client';

import { Mars, Venus } from '@app-foundation/icons/lucide';
import { ListSelect } from '@/components/ListSelect';
import { tr } from '@/i18n/tr';

export function WcaGenderSelect({ value, onChange, className }: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return <ListSelect className={className} hideSelectedLabel
    ariaLabel={tr({ zh: '性别', en: 'Gender' })}
    items={[
      { value: 'all', label: tr({ zh: '不限性别', en: 'All genders' }),
        icon: <><Mars size={16} /><Venus size={16} /></>, hideLabel: true },
      { value: 'm', label: tr({ zh: '男子', en: 'Male' }), icon: <Mars size={16} /> },
      { value: 'f', label: tr({ zh: '女子', en: 'Female' }), icon: <Venus size={16} /> },
    ]} value={value} onChange={onChange}
    allLabel={tr({ zh: '所有', en: 'All' })} clearable={false} />;
}
