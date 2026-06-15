'use client';
// 管理员「成绩变更」编辑器(选手页 + comp 直播页共用)。
// 一条成绩可经历多次更改 → 这里管理该成绩的变更链:列出已有事件(增/删/改),
// 每个事件可改 单次 / 平均 / 单次纪录 / 平均纪录(旧→新)+ 发生日期 + 原因。
// 仅管理员渲染(调用方已门控,内部再防御一次)。写接口走 requireAdminOrApiKey。

import { useMemo, useState } from 'react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthStore } from '@/lib/auth-store';
import { formatWcaResult } from '@/lib/wca-format-result';
import { tr } from '@/i18n/tr';
import {
  createResultChange,
  updateResultChange,
  deleteResultChange,
  parseHumanResult,
  formatChangeFieldValue,
  type ResultChange,
  type ResultChangeField,
  type ResultChangeInput,
} from '@/lib/result-watch-api';
import './result-change.css';

export interface ResultChangeTarget {
  wcaId: string;
  competitionId: string;
  eventId: string;
  roundTypeId: string;
  resultId?: number | null;
  currentBest?: number | null;
  currentAverage?: number | null;
  currentSingleRecord?: string | null;
  currentAverageRecord?: string | null;
  personName?: string | null;
  compName?: string | null;
}

interface Props {
  target: ResultChangeTarget;
  existingChanges: ResultChange[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  effectiveAt: string;
  note: string;
  oldBest: string; newBest: string;
  oldAverage: string; newAverage: string;
  oldSingleRec: string; newSingleRec: string;
  oldAvgRec: string; newAvgRec: string;
}

/** 厘秒 → 输入框字符串(0/null 留空,DNF/DNS 走 formatWcaResult)。 */
function valueToInput(v: number | null | undefined, eventId: string, kind: 'single' | 'average'): string {
  if (v == null || v === 0) return '';
  return formatWcaResult(v, eventId, kind);
}

function emptyForm(t: ResultChangeTarget): FormState {
  return {
    effectiveAt: '',
    note: '',
    oldBest: '', newBest: valueToInput(t.currentBest, t.eventId, 'single'),
    oldAverage: '', newAverage: valueToInput(t.currentAverage, t.eventId, 'average'),
    oldSingleRec: '', newSingleRec: t.currentSingleRecord ?? '',
    oldAvgRec: '', newAvgRec: t.currentAverageRecord ?? '',
  };
}

function formFromChange(c: ResultChange, t: ResultChangeTarget): FormState {
  const f = emptyForm(t);
  f.effectiveAt = (c.effectiveAt ?? '').slice(0, 10);
  f.note = c.note ?? '';
  for (const fld of c.fields ?? []) {
    const oldS = fld.old == null ? '' : String(fld.old);
    const newS = fld.new == null ? '' : String(fld.new);
    if (fld.field === 'best') {
      f.oldBest = valueToInput(Number(fld.old), t.eventId, 'single');
      f.newBest = valueToInput(Number(fld.new), t.eventId, 'single');
    } else if (fld.field === 'average') {
      f.oldAverage = valueToInput(Number(fld.old), t.eventId, 'average');
      f.newAverage = valueToInput(Number(fld.new), t.eventId, 'average');
    } else if (fld.field === 'regional_single_record') {
      f.oldSingleRec = oldS; f.newSingleRec = newS;
    } else if (fld.field === 'regional_average_record') {
      f.oldAvgRec = oldS; f.newAvgRec = newS;
    }
  }
  return f;
}

function buildFields(f: FormState, eventId: string): ResultChangeField[] {
  const out: ResultChangeField[] = [];
  if (f.oldBest || f.newBest) {
    out.push({ field: 'best', old: parseHumanResult(f.oldBest, eventId), new: parseHumanResult(f.newBest, eventId) });
  }
  if (f.oldAverage || f.newAverage) {
    out.push({ field: 'average', old: parseHumanResult(f.oldAverage, eventId), new: parseHumanResult(f.newAverage, eventId) });
  }
  if (f.oldSingleRec || f.newSingleRec) {
    out.push({ field: 'regional_single_record', old: f.oldSingleRec || null, new: f.newSingleRec || null });
  }
  if (f.oldAvgRec || f.newAvgRec) {
    out.push({ field: 'regional_average_record', old: f.oldAvgRec || null, new: f.newAvgRec || null });
  }
  return out;
}

/** 已有事件一行的字段摘要,如「平均 0.78 → 2.83」。 */
function fieldSummary(c: ResultChange, eventId: string): string {
  return (c.fields ?? [])
    .map((f) => `${fieldLabel(f.field)} ${formatChangeFieldValue(f.field, f.old, eventId)} → ${formatChangeFieldValue(f.field, f.new, eventId)}`)
    .join('  ');
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'best': return tr({ zh: '单次', en: 'Single' });
    case 'average': return tr({ zh: '平均', en: 'Average' });
    case 'regional_single_record': return tr({ zh: '单次纪录', en: 'Single rec.' });
    case 'regional_average_record': return tr({ zh: '平均纪录', en: 'Avg rec.' });
    case 'pos': return tr({ zh: '名次', en: 'Place' });
    case 'attempts': return tr({ zh: '各次', en: 'Attempts' });
    default: return field;
  }
}

export function ResultChangeEditor({ target, existingChanges, onClose, onSaved }: Props) {
  const admin = useAuthStore((s) => isAdminWcaId(s.user?.wcaId));
  const [editingId, setEditingId] = useState<number | null>(null); // null = 新增表单关闭/打开靠 showForm
  const [showForm, setShowForm] = useState(existingChanges.length === 0);
  const [form, setForm] = useState<FormState>(() => emptyForm(target));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chain = useMemo(() => existingChanges, [existingChanges]);

  if (!admin) return null;

  const set = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }));

  const openAdd = () => { setEditingId(null); setForm(emptyForm(target)); setShowForm(true); setErr(null); };
  const openEdit = (c: ResultChange) => { setEditingId(c.id); setForm(formFromChange(c, target)); setShowForm(true); setErr(null); };

  const submit = async () => {
    const fields = buildFields(form, target.eventId);
    if (fields.length === 0) { setErr(tr({ zh: '至少填一个变更字段', en: 'Fill at least one changed field' })); return; }
    const input: ResultChangeInput = {
      wcaId: target.wcaId,
      resultId: target.resultId ?? null,
      competitionId: target.competitionId,
      eventId: target.eventId,
      roundTypeId: target.roundTypeId,
      changeType: 'modified',
      fields,
      note: form.note || null,
      effectiveAt: form.effectiveAt || null,
    };
    setBusy(true); setErr(null);
    try {
      if (editingId != null) await updateResultChange(editingId, input);
      else await createResultChange(input);
      setShowForm(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: ResultChange) => {
    if (!window.confirm(tr({ zh: '删除这条变更?', en: 'Delete this change?' }))) return;
    setBusy(true); setErr(null);
    try { await deleteResultChange(c.id); onSaved(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="wp-rce-overlay" onClick={onClose}>
      <div className="wp-rce-modal" onClick={stop} role="dialog" aria-modal="true">
        <div className="wp-rce-head">
          <div className="wp-rce-title">{tr({ zh: '编辑成绩变更', en: 'Edit result changes' })}</div>
          <button className="wp-rce-x" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="wp-rce-sub">
          {[target.personName, target.compName, target.eventId, target.roundTypeId].filter(Boolean).join(' · ')}
        </div>

        {chain.length > 0 && (
          <div className="wp-rce-list">
            {chain.map((c) => (
              <div key={c.id} className="wp-rce-item">
                <div className="wp-rce-item-main">
                  <span className="wp-rce-item-summary">{fieldSummary(c, target.eventId)}</span>
                  {c.note && <span className="wp-rce-item-note">{c.note}</span>}
                  <span className="wp-rce-item-meta">
                    {(c.effectiveAt ?? c.detectedAt ?? '').slice(0, 10)}
                    {c.source === 'manual' ? ' · ' + tr({ zh: '手动', en: 'manual' }) : ' · ' + tr({ zh: '自动', en: 'auto' })}
                  </span>
                </div>
                <div className="wp-rce-item-actions">
                  <button className="wp-rce-link" onClick={() => openEdit(c)} disabled={busy}>{tr({ zh: '编辑', en: 'Edit' })}</button>
                  <button className="wp-rce-link wp-rce-danger" onClick={() => remove(c)} disabled={busy}>{tr({ zh: '删除', en: 'Delete' })}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="wp-rce-form">
            <div className="wp-rce-form-title">
              {editingId != null ? tr({ zh: '编辑事件', en: 'Edit event' }) : tr({ zh: '新增变更事件', en: 'Add change event' })}
            </div>
            <div className="wp-rce-grid">
              <label className="wp-rce-field">
                <span>{tr({ zh: '单次', en: 'Single' })}</span>
                <div className="wp-rce-pair">
                  <input value={form.oldBest} onChange={(e) => set({ oldBest: e.target.value })} placeholder={tr({ zh: '旧', en: 'old' })} />
                  <span>→</span>
                  <input value={form.newBest} onChange={(e) => set({ newBest: e.target.value })} placeholder={tr({ zh: '新', en: 'new' })} />
                </div>
              </label>
              <label className="wp-rce-field">
                <span>{tr({ zh: '平均', en: 'Average' })}</span>
                <div className="wp-rce-pair">
                  <input value={form.oldAverage} onChange={(e) => set({ oldAverage: e.target.value })} placeholder={tr({ zh: '旧', en: 'old' })} />
                  <span>→</span>
                  <input value={form.newAverage} onChange={(e) => set({ newAverage: e.target.value })} placeholder={tr({ zh: '新', en: 'new' })} />
                </div>
              </label>
              <label className="wp-rce-field">
                <span>{tr({ zh: '单次纪录', en: 'Single record' })}</span>
                <div className="wp-rce-pair">
                  <input value={form.oldSingleRec} onChange={(e) => set({ oldSingleRec: e.target.value })} placeholder="WR / —" />
                  <span>→</span>
                  <input value={form.newSingleRec} onChange={(e) => set({ newSingleRec: e.target.value })} placeholder="—" />
                </div>
              </label>
              <label className="wp-rce-field">
                <span>{tr({ zh: '平均纪录', en: 'Average record' })}</span>
                <div className="wp-rce-pair">
                  <input value={form.oldAvgRec} onChange={(e) => set({ oldAvgRec: e.target.value })} placeholder="WR / —" />
                  <span>→</span>
                  <input value={form.newAvgRec} onChange={(e) => set({ newAvgRec: e.target.value })} placeholder="—" />
                </div>
              </label>
              <label className="wp-rce-field">
                <span>{tr({ zh: '发生日期', en: 'Effective date' })}</span>
                <input type="date" value={form.effectiveAt} onChange={(e) => set({ effectiveAt: e.target.value })} />
              </label>
              <label className="wp-rce-field wp-rce-field-wide">
                <span>{tr({ zh: '原因', en: 'Reason' })}</span>
                <input value={form.note} onChange={(e) => set({ note: e.target.value })} />
              </label>
            </div>
            <div className="wp-rce-hint">{tr({ zh: '时间输入支持 2.83 / 1:23.45 / DNF / DNS;留空表示该字段未变。', en: 'Times accept 2.83 / 1:23.45 / DNF / DNS; leave blank if unchanged.' })}</div>
            {err && <div className="wp-rce-err">{err}</div>}
            <div className="wp-rce-form-actions">
              <button className="wp-rce-btn" onClick={submit} disabled={busy}>{busy ? '…' : tr({ zh: '保存', en: 'Save' })}</button>
              <button className="wp-rce-btn wp-rce-btn-ghost" onClick={() => setShowForm(false)} disabled={busy}>{tr({ zh: '取消', en: 'Cancel' })}</button>
            </div>
          </div>
        ) : (
          <div className="wp-rce-form-actions">
            <button className="wp-rce-btn" onClick={openAdd} disabled={busy}>{tr({ zh: '+ 新增变更', en: '+ Add change' })}</button>
            {err && <div className="wp-rce-err">{err}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
