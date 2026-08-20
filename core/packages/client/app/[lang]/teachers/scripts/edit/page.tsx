'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Plus } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { fetchMyTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import {
  createTeacherLiveScript,
  fetchMyTeacherLiveScripts,
  updateTeacherLiveScript,
  type LiveScriptBeat,
  type LiveScriptContent,
  type LiveScriptCueKind,
  type LiveScriptLink,
  type LiveScriptSection,
  type LocalizedScriptText,
  type TeacherLiveScriptDraft,
} from '@/lib/teacher-live-scripts-api';

const blankText = (): LocalizedScriptText => ({ zh: '', en: '' });
const blankSection = (index: number): LiveScriptSection => ({
  id: `section-${index + 1}`,
  title: blankText(), duration: blankText(), goal: blankText(),
  beats: [{ kind: 'say', text: blankText() }],
});
const emptyContent = (): LiveScriptContent => ({ preparation: [], sections: [blankSection(0)], notes: [], referenceLinks: [] });
const emptyDraft = (): TeacherLiveScriptDraft => ({ teacherEntryId: 0, titleZh: '', titleEn: '', summaryZh: '', summaryEn: '', durationMinutes: 30, content: emptyContent(), isVisible: true });
const cueOptions: { value: 'say' | LiveScriptCueKind; label: { zh: string; en: string } }[] = [
  { value: 'say', label: { zh: '直接说', en: 'Spoken copy' } },
  { value: 'action', label: { zh: '动作提示', en: 'Action cue' } },
  { value: 'interaction', label: { zh: '互动提示', en: 'Audience cue' } },
  { value: 'transition', label: { zh: '转场提示', en: 'Transition cue' } },
  { value: 'optional', label: { zh: '可选内容', en: 'Optional cue' } },
];

function BilingualRows({ rows, onChange, addLabel }: { rows: LocalizedScriptText[]; onChange: (rows: LocalizedScriptText[]) => void; addLabel: { zh: string; en: string } }) {
  return <div className="script-outline">{rows.map((row, index) => <div className="script-form-grid" key={index}><label className="script-field"><span>{tr({ zh: `中文 ${index + 1}`, en: `Chinese ${index + 1}` })}</span><textarea className="script-control" value={row.zh} onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, zh: event.target.value } : item))} /></label><label className="script-field"><span>{tr({ zh: `英文 ${index + 1}`, en: `English ${index + 1}` })}</span><textarea className="script-control" value={row.en} onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, en: event.target.value } : item))} /><button type="button" className="script-add-button" onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}>{tr({ zh: '删除此项', en: 'Remove item' })}</button></label></div>)}<button type="button" className="script-add-button" onClick={() => onChange([...rows, blankText()])}><Plus size={14} /> {tr(addLabel)}</button></div>;
}

function ScriptEditor() {
  const pathname = usePathname();
  const user = useAuthUser();
  const [editId] = useQueryState('id', parseAsInteger);
  const [requestedTeacher] = useQueryState('teacher', parseAsInteger);
  const [entries, setEntries] = useState<TeacherDirectoryEntry[]>([]);
  const [draft, setDraft] = useState<TeacherLiveScriptDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    Promise.all([fetchMyTeacherDirectory(), fetchMyTeacherLiveScripts()]).then(([profiles, scripts]) => {
      if (!active) return;
      setEntries(profiles);
      if (editId) {
        const script = scripts.find((item) => item.id === editId);
        if (!script) { setMessage(tr({ zh: '找不到这条话术，或你没有编辑权限。', en: 'This script was not found or you cannot edit it.' })); return; }
        setDraft({ teacherEntryId: script.teacherEntryId, titleZh: script.titleZh, titleEn: script.titleEn, summaryZh: script.summaryZh, summaryEn: script.summaryEn, durationMinutes: script.durationMinutes, content: script.content, isVisible: script.isVisible });
      } else {
        const teacherEntryId = profiles.some((entry) => entry.id === requestedTeacher) ? requestedTeacher! : profiles[0]?.id ?? 0;
        setDraft((current) => ({ ...current, teacherEntryId }));
      }
    }).catch(() => setMessage(tr({ zh: '编辑器暂时无法加载。', en: 'The editor could not be loaded.' }))).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editId, requestedTeacher, user]);

  const setContent = (content: LiveScriptContent) => setDraft((current) => ({ ...current, content }));
  const setSections = (sections: LiveScriptSection[]) => setContent({ ...draft.content, sections });
  const updateSection = (index: number, section: LiveScriptSection) => setSections(draft.content.sections.map((item, itemIndex) => itemIndex === index ? section : item));
  const moveSection = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= draft.content.sections.length) return;
    const sections = [...draft.content.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setSections(sections);
  };
  const changeBeatKind = (beat: LiveScriptBeat, value: 'say' | LiveScriptCueKind): LiveScriptBeat => value === 'say' ? { kind: 'say', text: beat.text } : { kind: 'cue', cue: value, text: beat.text };

  const save = async () => {
    const targetId = editId ?? savedId;
    setMessage(''); setSavedId(null);
    if (!draft.teacherEntryId) { setMessage(tr({ zh: '请先选择老师或机构主页。', en: 'Choose a teacher or school profile.' })); return; }
    if (!draft.titleZh.trim() && !draft.titleEn.trim()) { setMessage(tr({ zh: '请至少填写一个语言的标题。', en: 'Add a title in at least one language.' })); return; }
    if (draft.content.sections.length === 0 || draft.content.sections.some((section) => (!section.title.zh.trim() && !section.title.en.trim()) || section.beats.length === 0 || section.beats.some((beat) => !beat.text.zh.trim() && !beat.text.en.trim()))) { setMessage(tr({ zh: '每个章节都需要标题和至少一段正文或提示。', en: 'Every section needs a title and at least one non-empty line.' })); return; }
    setSaving(true);
    try {
      const saved = targetId ? await updateTeacherLiveScript(targetId, draft) : await createTeacherLiveScript(draft);
      setSavedId(saved.id);
      setMessage(tr({ zh: '已保存。', en: 'Saved.' }));
    } catch { setMessage(tr({ zh: '保存失败，请检查内容后重试。', en: 'Save failed. Check the content and try again.' })); }
    finally { setSaving(false); }
  };

  if (!user) return <main className="script-editor-page"><div className="scripts-back-row"><BackHome /></div><section className="scripts-empty"><p>{tr({ zh: '登录后才能编辑直播话术。', en: 'Sign in to edit livestream scripts.' })}</p><AppLink href={`/account${nextQuery(pathname)}`} className="script-text-action">{tr({ zh: '登录', en: 'Sign in' })}</AppLink></section></main>;
  if (loading) return <main className="script-state-page"><p>{tr({ zh: '正在加载编辑器…', en: 'Loading the editor…' })}</p></main>;
  if (entries.length === 0) return <main className="script-editor-page"><div className="scripts-back-row"><BackHome /></div><section className="scripts-empty"><p>{tr({ zh: '请先建立老师或机构主页。', en: 'Create a teacher or school profile first.' })}</p><AppLink href="/teachers/edit" className="script-text-action">{tr({ zh: '建立教学主页', en: 'Build a profile' })}</AppLink></section></main>;

  return <main className="script-editor-page"><div className="scripts-back-row"><BackHome /></div><header className="script-editor-hero"><p className="scripts-kicker">{tr({ zh: editId ? '修改话术' : '新建话术', en: editId ? 'Edit script' : 'New script' })}</p><h1>{tr({ zh: '把直播排成一条线', en: 'Build a Clear Run of Show' })}</h1><p>{tr({ zh: '先定标题和时长，再按直播顺序写章节。正文是主播直接说的话；动作、互动和转场只作为现场提示。', en: 'Set the title and timing, then write sections in broadcast order. Spoken copy is read aloud; action, audience, and transition lines are presenter cues.' })}</p></header>
    <form className="script-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <section className="script-form-section"><header><span>01</span><div><h2>{tr({ zh: '归属与发布', en: 'Owner & publishing' })}</h2><p>{tr({ zh: '一条话术归属一个老师或机构主页。', en: 'Each script belongs to one teacher or school profile.' })}</p></div></header><label className="script-field"><span>{tr({ zh: '老师或机构', en: 'Teacher or school' })}</span><select className="script-control script-small-control" value={draft.teacherEntryId} onChange={(event) => setDraft({ ...draft, teacherEntryId: Number(event.target.value) })}>{entries.map((entry) => <option value={entry.id} key={entry.id}>{tr({ zh: entry.nameZh, en: entry.nameEn })}</option>)}</select></label><BoolToggle value={draft.isVisible} onChange={(value) => setDraft({ ...draft, isVisible: value })} label={tr({ zh: '公开话术', en: 'Public script' })} /><p className="script-list-summary">{tr({ zh: '即使话术公开，所属主页隐藏时，访客仍看不到它。', en: 'A public script remains hidden from visitors while its profile is private.' })}</p></section>
      <section className="script-form-section"><header><span>02</span><div><h2>{tr({ zh: '标题与简介', en: 'Title & summary' })}</h2></div></header><div className="script-form-grid"><label className="script-field"><span>{tr({ zh: '中文标题', en: 'Chinese title' })}</span><input className="script-control" value={draft.titleZh} onChange={(event) => setDraft({ ...draft, titleZh: event.target.value })} /></label><label className="script-field"><span>{tr({ zh: '英文标题', en: 'English title' })}</span><input className="script-control" value={draft.titleEn} onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })} /></label><label className="script-field"><span>{tr({ zh: '中文简介', en: 'Chinese summary' })}</span><textarea className="script-control" value={draft.summaryZh} onChange={(event) => setDraft({ ...draft, summaryZh: event.target.value })} /></label><label className="script-field"><span>{tr({ zh: '英文简介', en: 'English summary' })}</span><textarea className="script-control" value={draft.summaryEn} onChange={(event) => setDraft({ ...draft, summaryEn: event.target.value })} /></label></div><label className="script-field"><span>{tr({ zh: '预计总时长（分钟）', en: 'Estimated length (minutes)' })}</span><input type="number" min={1} max={240} className="script-control script-small-control" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /></label></section>
      <section className="script-form-section"><header><span>03</span><div><h2>{tr({ zh: '开播前准备', en: 'Before going live' })}</h2><p>{tr({ zh: '写下每次开播前必须补齐的信息。', en: 'List details to fill in before each session.' })}</p></div></header><BilingualRows rows={draft.content.preparation} onChange={(preparation) => setContent({ ...draft.content, preparation })} addLabel={{ zh: '添加准备项', en: 'Add preparation item' }} /></section>
      <section className="script-form-section"><header><span>04</span><div><h2>{tr({ zh: '直播流程', en: 'Run of show' })}</h2><p>{tr({ zh: '章节顺序就是直播顺序。', en: 'Section order is broadcast order.' })}</p></div></header><div className="script-outline">{draft.content.sections.map((section, sectionIndex) => <div className="script-outline-item" key={`${section.id}-${sectionIndex}`}><span className="script-outline-number">{String(sectionIndex + 1).padStart(2, '0')}</span><div className="script-outline-body"><div className="script-outline-heading"><strong>{tr(section.title) || tr({ zh: '未命名章节', en: 'Untitled section' })}</strong><div className="script-mini-actions"><button type="button" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}>{tr({ zh: '上移', en: 'Up' })}</button><button type="button" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === draft.content.sections.length - 1}>{tr({ zh: '下移', en: 'Down' })}</button><button type="button" onClick={() => setSections(draft.content.sections.filter((_, index) => index !== sectionIndex))}>{tr({ zh: '删除章节', en: 'Delete section' })}</button></div></div><div className="script-form-grid"><label className="script-field"><span>{tr({ zh: '中文章节名', en: 'Chinese section title' })}</span><input className="script-control" value={section.title.zh} onChange={(event) => updateSection(sectionIndex, { ...section, title: { ...section.title, zh: event.target.value } })} /></label><label className="script-field"><span>{tr({ zh: '英文章节名', en: 'English section title' })}</span><input className="script-control" value={section.title.en} onChange={(event) => updateSection(sectionIndex, { ...section, title: { ...section.title, en: event.target.value } })} /></label><label className="script-field"><span>{tr({ zh: '中文时长', en: 'Chinese timing' })}</span><input className="script-control" value={section.duration.zh} onChange={(event) => updateSection(sectionIndex, { ...section, duration: { ...section.duration, zh: event.target.value } })} /></label><label className="script-field"><span>{tr({ zh: '英文时长', en: 'English timing' })}</span><input className="script-control" value={section.duration.en} onChange={(event) => updateSection(sectionIndex, { ...section, duration: { ...section.duration, en: event.target.value } })} /></label><label className="script-field"><span>{tr({ zh: '中文目标', en: 'Chinese goal' })}</span><textarea className="script-control" value={section.goal.zh} onChange={(event) => updateSection(sectionIndex, { ...section, goal: { ...section.goal, zh: event.target.value } })} /></label><label className="script-field"><span>{tr({ zh: '英文目标', en: 'English goal' })}</span><textarea className="script-control" value={section.goal.en} onChange={(event) => updateSection(sectionIndex, { ...section, goal: { ...section.goal, en: event.target.value } })} /></label></div>
          {section.beats.map((beat, beatIndex) => <div className="script-beat-editor" key={beatIndex}><select className="script-control" value={beat.kind === 'say' ? 'say' : beat.cue} onChange={(event) => updateSection(sectionIndex, { ...section, beats: section.beats.map((item, index) => index === beatIndex ? changeBeatKind(item, event.target.value as 'say' | LiveScriptCueKind) : item) })}>{cueOptions.map((option) => <option value={option.value} key={option.value}>{tr(option.label)}</option>)}</select><div className="script-form-grid"><label className="script-field"><span>{tr({ zh: '中文内容', en: 'Chinese copy' })}</span><textarea className="script-control" value={beat.text.zh} onChange={(event) => updateSection(sectionIndex, { ...section, beats: section.beats.map((item, index) => index === beatIndex ? { ...item, text: { ...item.text, zh: event.target.value } } : item) })} /></label><label className="script-field"><span>{tr({ zh: '英文内容', en: 'English copy' })}</span><textarea className="script-control" value={beat.text.en} onChange={(event) => updateSection(sectionIndex, { ...section, beats: section.beats.map((item, index) => index === beatIndex ? { ...item, text: { ...item.text, en: event.target.value } } : item) })} /></label></div><button type="button" onClick={() => updateSection(sectionIndex, { ...section, beats: section.beats.filter((_, index) => index !== beatIndex) })}>{tr({ zh: '删除', en: 'Remove' })}</button></div>)}<button type="button" className="script-add-button" onClick={() => updateSection(sectionIndex, { ...section, beats: [...section.beats, { kind: 'say', text: blankText() }] })}><Plus size={14} /> {tr({ zh: '添加正文或提示', en: 'Add copy or cue' })}</button></div></div>)}<button type="button" className="script-add-button" onClick={() => setSections([...draft.content.sections, blankSection(draft.content.sections.length)])}><Plus size={14} /> {tr({ zh: '添加章节', en: 'Add section' })}</button></div></section>
      <section className="script-form-section"><header><span>05</span><div><h2>{tr({ zh: '现场提醒', en: 'Presenter notes' })}</h2></div></header><BilingualRows rows={draft.content.notes} onChange={(notes) => setContent({ ...draft.content, notes })} addLabel={{ zh: '添加提醒', en: 'Add note' }} /></section>
      <section className="script-form-section"><header><span>06</span><div><h2>{tr({ zh: '相关链接', en: 'Related links' })}</h2></div></header><div className="script-outline">{draft.content.referenceLinks.map((link, index) => <div className="script-form-grid" key={index}><label className="script-field"><span>{tr({ zh: '链接', en: 'URL' })}</span><input className="script-control" value={link.href} onChange={(event) => setContent({ ...draft.content, referenceLinks: draft.content.referenceLinks.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item) })} /></label><label className="script-field"><span>{tr({ zh: '中文名称', en: 'Chinese label' })}</span><input className="script-control" value={link.label.zh} onChange={(event) => setContent({ ...draft.content, referenceLinks: draft.content.referenceLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: { ...item.label, zh: event.target.value } } : item) })} /></label><label className="script-field"><span>{tr({ zh: '英文名称', en: 'English label' })}</span><input className="script-control" value={link.label.en} onChange={(event) => setContent({ ...draft.content, referenceLinks: draft.content.referenceLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: { ...item.label, en: event.target.value } } : item) })} /><button type="button" className="script-add-button" onClick={() => setContent({ ...draft.content, referenceLinks: draft.content.referenceLinks.filter((_, itemIndex) => itemIndex !== index) })}>{tr({ zh: '删除链接', en: 'Remove link' })}</button></label></div>)}<button type="button" className="script-add-button" onClick={() => setContent({ ...draft.content, referenceLinks: [...draft.content.referenceLinks, { href: '', label: blankText() } as LiveScriptLink] })}><Plus size={14} /> {tr({ zh: '添加链接', en: 'Add link' })}</button></div></section>
      {message && <p className="script-form-message">{message} {savedId && <AppLink href={`/teachers/scripts/edit?id=${savedId}`} prefetch={false}>{tr({ zh: '继续编辑已保存版本', en: 'Continue editing the saved version' })}</AppLink>}</p>}
      <div className="script-save-row"><button type="submit" disabled={saving}>{saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存话术', en: 'Save script' })}</button><AppLink href="/teachers/scripts/manage" className="script-text-action">{tr({ zh: '返回管理页', en: 'Back to manage' })}</AppLink></div>
    </form>
  </main>;
}

export default function Page() { return <Suspense><ScriptEditor /></Suspense>; }
