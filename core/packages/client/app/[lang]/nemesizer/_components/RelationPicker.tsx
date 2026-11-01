'use client';
import { ListSelect } from '@/components/ListSelect';
import { tr } from '@/i18n/tr';
import type { RelationView } from '../_data/nemesizerApi';
const VIEWS: { id: RelationView; en: string; zh: string
 }[] = [
  { id: 'myNem',      en: 'My nemeses',              zh: '我的宿敌'
},
  { id: 'iNem',       en: 'Who I nemesize',          zh: '谁把我视为宿敌'
},
  { id: 'nearlyMe',   en: 'Who nearly nemesizes me', zh: '差一步就成我宿敌的人'
},
  { id: 'iNearly',    en: 'Who I nearly nemesize',   zh: '差一步就把我视为宿敌的人'
},
  { id: 'onlyJustMe', en: 'Who only just nemesizes me', zh: '刚好成为我宿敌的人'
},
  { id: 'iOnlyJust',  en: 'Who I only just nemesize',   zh: '刚好把我视为宿敌的人'
},
];

export default function RelationPicker({ view, onChange }: { view: RelationView; onChange: (view: RelationView) => void }) {
  return <ListSelect items={VIEWS.map(v => ({ value: v.id, label: tr(v) }))}
    value={view} onChange={v => onChange(v as RelationView)} clearable={false}
    allLabel={tr({ zh: '宿敌关系', en: 'Relationship' })} ariaLabel={tr({ zh: '宿敌关系', en: 'Relationship' })} />;
}
