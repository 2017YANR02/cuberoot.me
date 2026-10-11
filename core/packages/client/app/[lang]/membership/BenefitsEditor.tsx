'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, Save } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { ClearButton } from '@/components/ClearButton';
import { validateMembershipBenefits, type MembershipBenefit, type MembershipBenefitGroup, type MembershipBenefits } from '@cuberoot/shared/membership-benefits';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableCard from '@/components/SortableCard';
import { listMembershipBenefits, saveMembershipBenefits } from '@/lib/membership-perks';
import { tr } from '@/i18n/tr';
import './benefits-editor.css';

export default function BenefitsEditor({ onSaved, children, group: targetGroup, benefitIds, language, heading }: {
  onSaved: (content: MembershipBenefits) => void;
  children: ReactNode;
  group?: MembershipBenefitGroup;
  benefitIds?: string[];
  language: 'zh' | 'en';
  heading?: { id: string; text: string };
}) {
  const [draft, setDraft] = useState<MembershipBenefits | null>(null);
  const [busy, setBusy] = useState(false);
  const [editLanguage, setEditLanguage] = useState(language);
  const [error, setError] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const editing = draft !== null;
  function close() {
    if (busy) return;
    setDraft(null);
    setError('');
  }
  useEffect(() => {
    if (editing) editorRef.current?.querySelector('textarea')?.focus();
  }, [editing]);
  useEffect(() => {
    editorRef.current?.querySelectorAll('textarea').forEach(input => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    });
  }, [draft, editLanguage]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function open() {
    setBusy(true); setError('');
    try { setDraft(await listMembershipBenefits()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  function update(id: string, patch: Partial<MembershipBenefit>) {
    setDraft(current => current && ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) }));
    setError('');
  }
  function add(group: MembershipBenefitGroup) {
    setEditLanguage('zh');
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
    const items = validateMembershipBenefits(draft.items.map(item => ({ ...item, enabled: true })));
    if (!items) { setError(tr({ zh: '请为每条权益填写中文（最多 1000 字），英文可留空（最多 2000 字），总计不超过 100 条。', en: 'Chinese is required for every benefit (max 1,000 characters). English is optional (max 2,000). Up to 100 benefits.' })); return; }
    setBusy(true); setError('');
    try {
      const result = await saveMembershipBenefits({ ...draft, items });
      onSaved(result); setDraft(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const visibleItems = draft?.items.filter(item => targetGroup ? item.group === targetGroup : benefitIds?.includes(item.id)) ?? [];
  const editButton = <Tooltip content={tr({ zh: '编辑权益', en: 'Edit benefits' })}>{tip => <button {...tip} type="button" className="mem-benefits-button mem-benefits-pencil" onClick={() => void open()} disabled={busy || editing} aria-label={tr({ zh: '编辑权益', en: 'Edit benefits' })}><Pencil size={15} /></button>}</Tooltip>;
  return <div className="mem-benefits-editor" ref={editorRef}>
    {heading && <h2 id={heading.id} className="mem-plan-section-title mem-benefits-heading">{heading.text}{editButton}</h2>}
    <div className="mem-benefits-inline">
      {!heading && editButton}
      <div className="mem-benefits-content">
        {!draft ? children : <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => {
            const item = draft.items.find(item => item.id === event.active.id);
            if (item) reorder(item.group, event);
          }}>
            <SortableContext items={visibleItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
              <div className="mem-benefits-edit-list">
                {visibleItems.map(item => <SortableCard className="mem-benefit-edit-row" key={item.id} id={item.id} draggable disabled={busy} stretch={false} dragLabel={tr({ zh: '拖动调整权益顺序', en: 'Drag to reorder benefits' })}>
                  <textarea className="mem-benefit-inline-input" rows={1} maxLength={editLanguage === 'zh' ? 1000 : 2000} disabled={busy} aria-label={tr({ zh: '权益内容', en: 'Benefit text' })} value={item[editLanguage]} placeholder={editLanguage === 'en' ? item.zh : undefined} onChange={event => update(item.id, editLanguage === 'zh' ? { zh: event.target.value, en: '' } : { en: event.target.value })} onKeyDown={event => {
                    if (event.key === 'Escape') { event.preventDefault(); close(); }
                  }} />
                </SortableCard>)}
              </div>
            </SortableContext>
          </DndContext>
          <div className="mem-benefits-actions">
            <select className="mem-benefits-language" aria-label={tr({ zh: '编辑语言', en: 'Editing language' })} value={editLanguage} disabled={busy} onChange={event => setEditLanguage(event.target.value as 'zh' | 'en')}><option value="zh">{tr({ zh: '中文', en: 'Chinese' })}</option><option value="en">{tr({ zh: '英文', en: 'English' })}</option></select>
            {targetGroup && targetGroup !== 'plan' && <button type="button" className="mem-benefits-button" onClick={() => add(targetGroup)} disabled={busy || draft.items.length >= 100} aria-label={tr({ zh: '新增权益', en: 'Add benefit' })} title={tr({ zh: '新增权益', en: 'Add benefit' })}><Plus size={15} /></button>}
            <button type="button" className="mem-benefits-button mem-benefits-save" onClick={() => void save()} disabled={busy} aria-busy={busy} aria-label={busy ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })} title={tr({ zh: '保存', en: 'Save' })}><Save size={16} /></button>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}><ClearButton variant="standalone" onClick={close} ariaLabel={tr({ zh: '取消', en: 'Cancel' })} /></fieldset>
          </div>
        </>}
        {error && <p role="alert" className="mem-benefits-error">{error}</p>}
      </div>
    </div>
  </div>;
}
