'use client';
import { useState } from 'react';
import { Pencil, Plus, Save, X } from 'lucide-react';
import { validateMembershipBenefits, type MembershipBenefit, type MembershipBenefitGroup, type MembershipBenefits } from '@cuberoot/shared/membership-benefits';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableCard from '@/components/SortableCard';
import BoolToggle from '@/components/BoolToggle';
import { listMembershipBenefits, saveMembershipBenefits } from '@/lib/membership-perks';
import { tr } from '@/i18n/tr';
import './benefits-editor.css';

const GROUPS = [
  { id: 'common', title: { zh: '所有会员共有权益', en: 'Benefits for all members' } },
  { id: 'enterprise', title: { zh: '企业额外权益', en: 'Additional enterprise benefits' } },
  { id: 'plan', title: { zh: '特定套餐说明', en: 'Plan-specific benefits' } },
] as const;

export default function BenefitsEditor({ onSaved }: { onSaved: (content: MembershipBenefits) => void }) {
  const [draft, setDraft] = useState<MembershipBenefits | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function open() {
    setBusy(true); setError(''); setSaved(false);
    try { setDraft(await listMembershipBenefits()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  function update(id: string, patch: Partial<MembershipBenefit>) {
    setDraft(current => current && ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) }));
    setError('');
  }
  function add(group: MembershipBenefitGroup) {
    setDraft(current => current && ({ ...current, items: [...current.items, { id: `custom_${crypto.randomUUID().replaceAll('-', '')}`, zh: '', en: '', group, enabled: true }] }));
    setError('');
  }
  function reorder(group: MembershipBenefitGroup, { active, over }: DragEndEvent) {
    if (busy || !over || active.id === over.id) return;
    setDraft(current => {
      if (!current) return current;
      const groupItems = current.items.filter(item => item.group === group);
      const from = groupItems.findIndex(item => item.id === active.id);
      const to = groupItems.findIndex(item => item.id === over.id);
      if (from < 0 || to < 0) return current;
      const reordered = arrayMove(groupItems, from, to);
      let index = 0;
      return { ...current, items: current.items.map(item => item.group === group ? reordered[index++] : item) };
    });
  }
  async function save() {
    if (!draft) return;
    const items = validateMembershipBenefits(draft.items);
    if (!items) { setError(tr({ zh: '请为每条权益填写中文（最多 1000 字），英文可留空（最多 2000 字），总计不超过 100 条。', en: 'Chinese is required for every benefit (max 1,000 characters). English is optional (max 2,000). Up to 100 benefits.' })); return; }
    setBusy(true); setError('');
    try {
      const result = await saveMembershipBenefits({ ...draft, items });
      onSaved(result); setDraft(null); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="mem-benefits-editor">
    {!draft && <button type="button" className="mem-benefits-button" onClick={() => void open()} disabled={busy}><Pencil size={15} />{tr({ zh: '编辑权益', en: 'Edit benefits' })}</button>}
    {saved && <span role="status" className="mem-benefits-saved">{tr({ zh: '权益已保存', en: 'Benefits saved' })}</span>}
    {error && <p role="alert" className="mem-benefits-error">{error}</p>}
    {draft && <section className="mem-benefits-form" data-site-surface="panel" aria-label={tr({ zh: '编辑会员权益', en: 'Edit membership benefits' })}>
      <h2>{tr({ zh: '编辑会员权益', en: 'Edit membership benefits' })}</h2>
      <p>{tr({ zh: '中文必填，英文选填。修改中文会清空该条旧英文，未翻译时英文页面显示中文。保存后会员页和商业计划书同步使用。', en: 'Chinese is required; English is optional. Changing Chinese clears its old English translation. Untranslated benefits show Chinese on the English page. Membership and BP pages share saved content.' })}</p>
      <p>{tr({ zh: '此处修改展示内容；套餐价格、实际权限与服务额度仍按原有设置执行。', en: 'This edits presentation copy. Plan prices, enforced access and service limits keep their existing settings.' })}</p>
      <fieldset disabled={busy}>
        {GROUPS.map(group => <section className="mem-benefits-group" key={group.id}>
          <h3>{tr(group.title)}</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => reorder(group.id, event)}>
          <SortableContext items={draft.items.filter(item => item.group === group.id).map(item => item.id)} strategy={verticalListSortingStrategy}>
          {draft.items.filter(item => item.group === group.id).map((item, index) => <SortableCard className="mem-benefit-row" key={item.id} id={item.id} draggable disabled={busy} stretch={false} dragLabel={tr({ zh: '拖动调整权益顺序', en: 'Drag to reorder benefits' })}>
            <div className="mem-benefit-tools"><span>{index + 1}</span><BoolToggle value={item.enabled} onChange={enabled => update(item.id, { enabled })} label={tr({ zh: '显示', en: 'Visible' })} /></div>
            <label>{tr({ zh: '中文', en: 'Chinese' })}<textarea className="mem-benefit-textarea" rows={2} maxLength={1000} value={item.zh} onChange={event => update(item.id, { zh: event.target.value, en: '' })} /></label>
            <details><summary>{item.en.trim() ? tr({ zh: '英文（已填写）', en: 'English (provided)' }) : tr({ zh: '英文（选填 · 待补译）', en: 'English (optional · untranslated)' })}</summary><label>{tr({ zh: '英文', en: 'English' })}<textarea className="mem-benefit-textarea" rows={2} maxLength={2000} value={item.en} onChange={event => update(item.id, { en: event.target.value })} /></label></details>
          </SortableCard>)}
          </SortableContext>
          </DndContext>
          {group.id !== 'plan' && <button type="button" className="mem-benefits-button" onClick={() => add(group.id)} disabled={draft.items.length >= 100}><Plus size={15} />{tr({ zh: '新增权益', en: 'Add benefit' })}</button>}
        </section>)}
      </fieldset>
      <div className="mem-benefits-actions"><button type="button" className="mem-benefits-button mem-benefits-save" onClick={() => void save()} disabled={busy}><Save size={16} />{busy ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存权益', en: 'Save benefits' })}</button><button type="button" className="mem-benefits-button" disabled={busy} onClick={() => { setDraft(null); setError(''); }}><X size={16} />{tr({ zh: '取消', en: 'Cancel' })}</button></div>
    </section>}
  </div>;
}
