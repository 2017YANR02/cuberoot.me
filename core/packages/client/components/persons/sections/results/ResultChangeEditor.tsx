'use client';
// 管理员「成绩变更」编辑器(选手页 + comp 直播页共用)。
// 一条成绩可经历多次更改 → 这里管理该成绩的变更链:列出已有事件(增/删/改),
// 每个事件可改 单次 / 平均 / 单次纪录 / 平均纪录(旧→新)+ 发生日期 + 原因。
// 仅管理员渲染(调用方已门控,内部再防御一次)。写接口走 requireAdminOrApiKey。

import { useMemo, useState } from 'react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthStore } from '@/lib/auth-store';
import { formatWcaResult } from '@/lib/wca-format-result';
import { computeWcaBestAverage, canRecompute } from '@/lib/wca-compute';
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
  currentAttempts?: number[] | null;
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
  oldAttempts: string;
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

/** 厘秒数组 → 空格分隔的人类字符串(0/缺失留空位跳过)。 */
function attemptsToInput(arr: number[] | null | undefined, eventId: string): string {
  if (!arr || arr.length === 0) return '';
  return arr.filter((v) => v !== 0).map((v) => formatWcaResult(v, eventId, 'single')).join(' ');
}

function emptyForm(t: ResultChangeTarget): FormState {
  return {
    effectiveAt: '',
    note: '',
    oldAttempts: '',
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
    if (fld.field === 'attempts') {
      f.oldAttempts = Array.isArray(fld.old) ? attemptsToInput((fld.old as number[]).map(Number), t.eventId) : '';
    } else if (fld.field === 'best') {
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

/** 解析原始各次成绩输入(空格/逗号分隔)→ 厘秒数组。 */
function parseAttemptsInput(s: string, eventId: string): number[] {
  return s.trim().split(/[\s,]+/).filter(Boolean).map((x) => parseHumanResult(x, eventId) ?? 0);
}

/** 原始各次成绩是否驱动自动重算(填了 + 该项目可算 + 当前有 live 各次)。 */
function attemptsDriven(f: FormState, eventId: string, currentAttempts?: number[] | null): boolean {
  return !!f.oldAttempts.trim() && canRecompute(eventId) && !!currentAttempts && currentAttempts.length > 0;
}

function buildFields(f: FormState, t: ResultChangeTarget): ResultChangeField[] {
  const eventId = t.eventId;
  const currentAttempts = t.currentAttempts;
  const out: ResultChangeField[] = [];
  const origStr = f.oldAttempts.trim();
  // 填了「原始各次成绩」→ 旧=原始数组、新=当前 live 数组,并自动算出原始单次/平均一并划线。
  // 新值单次/平均取权威 live(target.currentBest/Average),只有旧值靠原始数组重算。
  if (origStr && currentAttempts && currentAttempts.length > 0) {
    const orig = parseAttemptsInput(origStr, eventId);
    out.push({ field: 'attempts', old: orig, new: currentAttempts });
    if (canRecompute(eventId)) {
      const o = computeWcaBestAverage(orig, eventId);
      const newBest = t.currentBest ?? null;
      const newAvg = t.currentAverage ?? null;
      if (newBest != null && o.best !== newBest) out.push({ field: 'best', old: o.best, new: newBest });
      if (o.average != null && newAvg != null && newAvg > 0 && o.average !== newAvg) {
        out.push({ field: 'average', old: o.average, new: newAvg });
      }
    }
  } else {
    if (f.oldBest || f.newBest) {
      out.push({ field: 'best', old: parseHumanResult(f.oldBest, eventId), new: parseHumanResult(f.newBest, eventId) });
    }
    if (f.oldAverage || f.newAverage) {
      out.push({ field: 'average', old: parseHumanResult(f.oldAverage, eventId), new: parseHumanResult(f.newAverage, eventId) });
    }
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

  const drivenByAttempts = attemptsDriven(form, target.eventId, target.currentAttempts);

  const submit = async () => {
    const fields = buildFields(form, target);
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
              {target.currentAttempts && target.currentAttempts.length > 0 && (
                <label className="wp-rce-field wp-rce-field-wide">
                  <span>{tr({ zh: '原始各次成绩', en: 'Original attempts' })}</span>
                  <input
                    className="wp-rce-field-input"
                    value={form.oldAttempts}
                    onChange={(e) => set({ oldAttempts: e.target.value })}
                    placeholder={attemptsToInput(target.currentAttempts, target.eventId)}
                  />
                </label>
              )}
              {drivenByAttempts ? (
                <div className="wp-rce-field wp-rce-field-wide wp-rce-derived">
                  {tr({ zh: '单次 / 平均按 WCA 规则自动重算并划线;当前值见上方占位。', en: 'Single / average auto-recomputed (WCA rules) and struck through; current values are the placeholder above.' })}
                </div>
              ) : (
                <>
                  <label className="wp-rce-field">
                    <span>{tr({ zh: '单次', en: 'Single' })}</span>
                    <div className="wp-rce-pair">
                      <input className="wp-rce-field-input" value={form.oldBest} onChange={(e) => set({ oldBest: e.target.value })} placeholder={tr({ zh: '旧', en: 'old' })} />
                      <span>→</span>
                      <input className="wp-rce-field-input" value={form.newBest} onChange={(e) => set({ newBest: e.target.value })} placeholder={tr({ zh: '新', en: 'new' })} />
                    </div>
                  </label>
                  <label className="wp-rce-field">
                    <span>{tr({ zh: '平均', en: 'Average' })}</span>
                    <div className="wp-rce-pair">
                      <input className="wp-rce-field-input" value={form.oldAverage} onChange={(e) => set({ oldAverage: e.target.value })} placeholder={tr({ zh: '旧', en: 'old' })} />
                      <span>→</span>
                      <input className="wp-rce-field-input" value={form.newAverage} onChange={(e) => set({ newAverage: e.target.value })} placeholder={tr({ zh: '新', en: 'new' })} />
                    </div>
                  </label>
                </>
              )}
              <label className="wp-rce-field">
                <span>{tr({ zh: '单次纪录', en: 'Single record' })}</span>
                <div className="wp-rce-pair">
                  <input className="wp-rce-field-input" value={form.oldSingleRec} onChange={(e) => set({ oldSingleRec: e.target.value })} placeholder="WR / —" />
                  <span>→</span>
                  <input className="wp-rce-field-input" value={form.newSingleRec} onChange={(e) => set({ newSingleRec: e.target.value })} placeholder="—" />
                </div>
              </label>
              <label className="wp-rce-field">
                <span>{tr({ zh: '平均纪录', en: 'Average record' })}</span>
                <div className="wp-rce-pair">
                  <input className="wp-rce-field-input" value={form.oldAvgRec} onChange={(e) => set({ oldAvgRec: e.target.value })} placeholder="WR / —" />
                  <span>→</span>
                  <input className="wp-rce-field-input" value={form.newAvgRec} onChange={(e) => set({ newAvgRec: e.target.value })} placeholder="—" />
                </div>
              </label>
              <label className="wp-rce-field">
                <span>{tr({ zh: '发生日期', en: 'Effective date' })}</span>
                <input className="wp-rce-field-input" type="date" value={form.effectiveAt} onChange={(e) => set({ effectiveAt: e.target.value })} />
              </label>
              <label className="wp-rce-field wp-rce-field-wide">
                <span>{tr({ zh: '原因', en: 'Reason' })}</span>
                <input className="wp-rce-field-input" value={form.note} onChange={(e) => set({ note: e.target.value })} />
              </label>
            </div>
            <div className="wp-rce-hint">{tr({ zh: '时间输入支持 2.83 / 1:23.45 / DNF / DNS;留空表示该字段未变。原始各次成绩按空格分隔填 5 次(或 3 次),如「0.74 0.70 0.97 0.78 0.81」,自动算出原始单次/平均并在详细成绩里逐次划线。', en: 'Times accept 2.83 / 1:23.45 / DNF / DNS; blank means unchanged. Original attempts: space-separated 5 (or 3) solves, e.g. "0.74 0.70 0.97 0.78 0.81" — single/average auto-derived and each solve struck through.' })}</div>
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
