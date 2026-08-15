'use client';

import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { T } from '@/i18n/tr';
import {
  updateTrialLessonOverride,
  type TrialLessonDraft,
  type TrialLessonOverride,
} from '@/lib/teaching-api';
import type { MicroLesson } from './_data/types';

function draftFromLesson(lesson: MicroLesson): TrialLessonDraft {
  return {
    titleZh: lesson.title.zh,
    outcomeZh: lesson.outcome.zh,
    minutes: lesson.minutes,
    shotsZh: lesson.shots.map((line) => line.zh),
    scriptZh: lesson.script.map((line) => line.zh),
  };
}

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export default function TrialLessonEditor({
  lesson,
  onSaved,
}: {
  lesson: MicroLesson;
  onSaved: (override: TrialLessonOverride) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFromLesson(lesson));
  const [shotsText, setShotsText] = useState(() => lesson.shots.map((line) => line.zh).join('\n'));
  const [scriptText, setScriptText] = useState(() => lesson.script.map((line) => line.zh).join('\n'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  function startEditing() {
    setDraft(draftFromLesson(lesson));
    setShotsText(lesson.shots.map((line) => line.zh).join('\n'));
    setScriptText(lesson.script.map((line) => line.zh).join('\n'));
    setError(false);
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shotsZh = lines(shotsText);
    const scriptZh = lines(scriptText);
    if (!draft.titleZh.trim() || !draft.outcomeZh.trim() || shotsZh.length < 1 || scriptZh.length < 1) return;
    setSaving(true);
    setError(false);
    try {
      const saved = await updateTrialLessonOverride(lesson.id, { ...draft, shotsZh, scriptZh });
      onSaved(saved);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="teaching-trial-edit" type="button" onClick={startEditing}>
        <Pencil aria-hidden="true" /> <T zh="编辑本节中文" en="Edit this lesson in Chinese" />
      </button>
    );
  }

  return (
    <form className="teaching-advanced-editor teaching-trial-editor" onSubmit={save}>
      <div className="teaching-advanced-editor-head">
        <h3><T zh="编辑中文内容" en="Edit Chinese content" /></h3>
        <button className="teaching-advanced-cancel" type="button" onClick={() => setOpen(false)}><T zh="取消" en="Cancel" /></button>
      </div>
      <div className="teaching-advanced-editor-grid">
        <label><T zh="中文标题" en="Chinese title" />
          <input className="teaching-advanced-field-control" maxLength={200} required value={draft.titleZh} onChange={(event) => setDraft((current) => ({ ...current, titleZh: event.target.value }))} />
        </label>
        <label><T zh="本节目标" en="Lesson goal" />
          <textarea className="teaching-advanced-field-control teaching-advanced-textarea-control" maxLength={1000} rows={3} required value={draft.outcomeZh} onChange={(event) => setDraft((current) => ({ ...current, outcomeZh: event.target.value }))} />
        </label>
        <label><T zh="拍摄清单（一行一项）" en="Shot list (one item per line)" />
          <textarea className="teaching-advanced-field-control teaching-advanced-textarea-control" rows={7} required value={shotsText} onChange={(event) => setShotsText(event.target.value)} />
        </label>
        <label><T zh="完整口播（一行一段）" en="Complete narration (one paragraph per line)" />
          <textarea className="teaching-advanced-field-control teaching-advanced-textarea-control" rows={14} required value={scriptText} onChange={(event) => setScriptText(event.target.value)} />
        </label>
      </div>
      <label className="teaching-advanced-duration"><T zh="时长（分钟）" en="Duration (minutes)" />
        <input className="teaching-advanced-field-control teaching-advanced-duration-control" type="number" min={1} max={60} required value={draft.minutes} onChange={(event) => setDraft((current) => ({ ...current, minutes: Number(event.target.value) }))} />
      </label>
      {error && <p className="teaching-trial-error" role="alert"><T zh="保存失败，请确认管理员登录状态后重试。" en="Save failed. Check your administrator session and try again." /></p>}
      <button className="teaching-advanced-save" type="submit" disabled={saving}>{saving ? <T zh="保存中" en="Saving" /> : <T zh="保存中文内容" en="Save Chinese content" />}</button>
    </form>
  );
}
