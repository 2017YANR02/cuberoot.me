'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { T, tr } from '@/i18n/tr';
import {
  createAdvancedCourseLesson,
  deleteAdvancedCourseLesson,
  fetchAdvancedCourseLessons,
  reorderAdvancedCourseLessons,
  updateAdvancedCourseLesson,
  type AdvancedCourseDraft,
  type AdvancedCourseLesson,
  type AdvancedCourseTrack,
} from '@/lib/teaching-api';
import { ADVANCED_COURSE_FALLBACK } from './_data/advanced-course-fallback';

const EMPTY_DRAFT: AdvancedCourseDraft = {
  track: '333',
  titleZh: '',
  titleEn: '',
  descriptionZh: '',
  descriptionEn: '',
  minutes: 5,
};

const TRACKS: { id: AdvancedCourseTrack; title: { zh: string; en: string }; summary: { zh: string; en: string } }[] = [
  {
    id: '333',
    title: { zh: '三阶进阶', en: 'Advanced 3×3' },
    summary: { zh: '继续学习高级 CFOP、其他解法、预判、公式原理与复盘。', en: 'Continue with advanced CFOP, other methods, lookahead, algorithm theory, and solve review.' },
  },
  {
    id: '222',
    title: { zh: '二阶进阶', en: 'Advanced 2×2' },
    summary: { zh: '从面先法、底层法继续进入 CLL、EG、LEG 与 TCLL。', en: 'Move from face-first and first-layer methods into CLL, EG, LEG, and TCLL.' },
  },
];

function sortedLessons(lessons: AdvancedCourseLesson[]) {
  return [...lessons].sort((a, b) => a.track.localeCompare(b.track) || a.position - b.position || a.id - b.id);
}

export default function AdvancedCourseSection({ isAdmin }: { isAdmin: boolean }) {
  const [lessons, setLessons] = useState<AdvancedCourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<AdvancedCourseDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const editorRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLessons(sortedLessons(await fetchAdvancedCourseLessons()));
      setUsingFallback(false);
    } catch {
      setLessons(sortedLessons(ADVANCED_COURSE_FALLBACK));
      setUsingFallback(true);
      setError(tr({ zh: '当前显示初始大纲；课程接口恢复后可由管理员编辑。', en: 'The initial outline is shown. Administrators can edit it when the course API is available.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (editingId !== null) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingId]);

  const grouped = useMemo(() => ({
    '333': lessons.filter((lesson) => lesson.track === '333'),
    '222': lessons.filter((lesson) => lesson.track === '222'),
  }), [lessons]);
  const totalMinutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);

  function openCreate(track: AdvancedCourseTrack) {
    setDraft({ ...EMPTY_DRAFT, track });
    setEditingId('new');
    setError('');
  }

  function openEdit(lesson: AdvancedCourseLesson) {
    setDraft({
      track: lesson.track,
      titleZh: lesson.titleZh,
      titleEn: lesson.titleEn,
      descriptionZh: lesson.descriptionZh,
      descriptionEn: lesson.descriptionEn,
      minutes: lesson.minutes,
    });
    setEditingId(lesson.id);
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.titleZh.trim() || !draft.titleEn.trim() || draft.minutes < 1 || draft.minutes > 60) return;
    setSaving(true);
    setError('');
    try {
      const saved = editingId === 'new'
        ? await createAdvancedCourseLesson(draft)
        : await updateAdvancedCourseLesson(editingId as number, draft);
      setLessons((current) => sortedLessons([
        ...current.filter((lesson) => lesson.id !== saved.id),
        saved,
      ]));
      setEditingId(null);
    } catch {
      setError(tr({ zh: '保存失败，请确认管理员登录状态后重试。', en: 'Save failed. Check your administrator session and try again.' }));
    } finally {
      setSaving(false);
    }
  }

  async function move(lesson: AdvancedCourseLesson, direction: -1 | 1) {
    const trackLessons = grouped[lesson.track];
    const index = trackLessons.findIndex((item) => item.id === lesson.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= trackLessons.length) return;
    const reordered = [...trackLessons];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    const withPositions = reordered.map((item, position) => ({ ...item, position }));
    setLessons((current) => sortedLessons([
      ...current.filter((item) => item.track !== lesson.track),
      ...withPositions,
    ]));
    try {
      await reorderAdvancedCourseLessons(lesson.track, withPositions.map((item) => item.id));
    } catch {
      setError(tr({ zh: '排序保存失败，已重新载入服务器顺序。', en: 'The new order could not be saved. The server order has been restored.' }));
      await load();
    }
  }

  async function remove(lesson: AdvancedCourseLesson) {
    if (!window.confirm(tr({ zh: `确定删除“${lesson.titleZh}”吗？`, en: `Delete “${lesson.titleEn}”?` }))) return;
    setError('');
    try {
      await deleteAdvancedCourseLesson(lesson.id);
      setLessons((current) => current.filter((item) => item.id !== lesson.id));
      if (editingId === lesson.id) setEditingId(null);
    } catch {
      setError(tr({ zh: '删除失败，请确认管理员登录状态后重试。', en: 'Delete failed. Check your administrator session and try again.' }));
    }
  }

  return (
    <section id="advanced" className="teaching-course teaching-advanced" aria-labelledby="advanced-title">
      <div className="teaching-course-head">
        <div className="teaching-course-number" aria-hidden="true">04</div>
        <div>
          <p className="teaching-kicker"><T zh="后续课程" en="Further courses" /></p>
          <h2 id="advanced-title"><T zh="CFOP 之后，继续拓展解法与能力" en="Beyond CFOP: expand methods and solving skills" /></h2>
          <p><T zh="完成 CFOP 后，可按目标继续学习高级三阶与二阶内容。课程标题、双语说明、口播提纲、时长和顺序均可由管理员维护。" en="After CFOP, continue with advanced 3×3 and 2×2 topics. Administrators can maintain titles, bilingual notes, narration outlines, durations, and order." /></p>
          <dl className="teaching-course-meta">
            <div><dt><T zh="结构" en="Structure" /></dt><dd>2 <T zh="条路线，" en="tracks, " />{loading ? 58 : lessons.length} <T zh="节" en="lessons" /></dd></div>
            <div><dt><T zh="时长" en="Duration" /></dt><dd>{loading ? 290 : totalMinutes} <T zh="分钟（可调整）" en="minutes (editable)" /></dd></div>
          </dl>
        </div>
      </div>

      {error && <p className={usingFallback ? 'teaching-advanced-status' : 'teaching-advanced-error'} role="alert">{error} {!loading && <button type="button" onClick={() => void load()}><T zh="重试" en="Retry" /></button>}</p>}
      {loading && <p className="teaching-advanced-status"><T zh="正在加载后续课程…" en="Loading further courses…" /></p>}

      {!loading && TRACKS.map((track, trackIndex) => {
        const trackLessons = grouped[track.id];
        return (
          <details key={track.id} className="teaching-stage teaching-advanced-track" open={trackIndex === 0}>
            <summary>
              <span className="teaching-stage-index"><T zh="路线 " en="Track " />{trackIndex + 1}</span>
              <span className="teaching-stage-title">{tr(track.title)}</span>
              <span className="teaching-stage-summary">{tr(track.summary)}</span>
              <span className="teaching-stage-count">{trackLessons.length} <T zh="节" en="lessons" /></span>
            </summary>
            <div className="teaching-advanced-body">
              {isAdmin && !usingFallback && (
                <button className="teaching-advanced-add" type="button" onClick={() => openCreate(track.id)}>
                  <Plus aria-hidden="true" /> <T zh="新增课程" en="Add lesson" />
                </button>
              )}
              <ol className="teaching-advanced-list">
                {trackLessons.map((lesson, index) => (
                  <li key={lesson.id}>
                    <span className="teaching-advanced-index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="teaching-advanced-copy">
                      <h3>{tr({ zh: lesson.titleZh, en: lesson.titleEn })}</h3>
                      {(lesson.descriptionZh || lesson.descriptionEn) && <p>{tr({ zh: lesson.descriptionZh || lesson.descriptionEn, en: lesson.descriptionEn || lesson.descriptionZh })}</p>}
                    </div>
                    <span className="teaching-advanced-minutes">{lesson.minutes} <T zh="分钟" en="min" /></span>
                    {isAdmin && !usingFallback && (
                      <div className="teaching-advanced-actions">
                        <button type="button" onClick={() => void move(lesson, -1)} disabled={index === 0} aria-label={tr({ zh: '上移', en: 'Move up' })}><ChevronUp aria-hidden="true" /></button>
                        <button type="button" onClick={() => void move(lesson, 1)} disabled={index === trackLessons.length - 1} aria-label={tr({ zh: '下移', en: 'Move down' })}><ChevronDown aria-hidden="true" /></button>
                        <button type="button" onClick={() => openEdit(lesson)} aria-label={tr({ zh: '编辑', en: 'Edit' })}><Pencil aria-hidden="true" /></button>
                        <button type="button" onClick={() => void remove(lesson)} aria-label={tr({ zh: '删除', en: 'Delete' })}><Trash2 aria-hidden="true" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </details>
        );
      })}

      {isAdmin && !usingFallback && editingId !== null && (
        <form ref={editorRef} className="teaching-advanced-editor" onSubmit={save}>
          <div className="teaching-advanced-editor-head">
            <h3>{editingId === 'new' ? <T zh="新增课程" en="Add lesson" /> : <T zh="编辑课程" en="Edit lesson" />}</h3>
            <button type="button" onClick={() => setEditingId(null)}><T zh="取消" en="Cancel" /></button>
          </div>
          {editingId === 'new' && (
            <label><T zh="路线" en="Track" />
              <select value={draft.track} onChange={(event) => setDraft((current) => ({ ...current, track: event.target.value as AdvancedCourseTrack }))}>
                <option value="333"><T zh="三阶进阶" en="Advanced 3×3" /></option>
                <option value="222"><T zh="二阶进阶" en="Advanced 2×2" /></option>
              </select>
            </label>
          )}
          <div className="teaching-advanced-editor-grid">
            <label><T zh="中文标题" en="Chinese title" /><input maxLength={200} required value={draft.titleZh} onChange={(event) => setDraft((current) => ({ ...current, titleZh: event.target.value }))} /></label>
            <label><T zh="英文标题" en="English title" /><input maxLength={200} required value={draft.titleEn} onChange={(event) => setDraft((current) => ({ ...current, titleEn: event.target.value }))} /></label>
            <label><T zh="中文课程说明或口播提纲" en="Chinese notes or narration outline" /><textarea maxLength={20000} rows={6} value={draft.descriptionZh} onChange={(event) => setDraft((current) => ({ ...current, descriptionZh: event.target.value }))} /></label>
            <label><T zh="英文课程说明或口播提纲" en="English notes or narration outline" /><textarea maxLength={20000} rows={6} value={draft.descriptionEn} onChange={(event) => setDraft((current) => ({ ...current, descriptionEn: event.target.value }))} /></label>
          </div>
          <label className="teaching-advanced-duration"><T zh="时长（分钟）" en="Duration (minutes)" /><input type="number" min={1} max={60} required value={draft.minutes} onChange={(event) => setDraft((current) => ({ ...current, minutes: Number(event.target.value) }))} /></label>
          <button className="teaching-advanced-save" type="submit" disabled={saving}>{saving ? <T zh="保存中" en="Saving" /> : <T zh="保存课程" en="Save lesson" />}</button>
        </form>
      )}
    </section>
  );
}
