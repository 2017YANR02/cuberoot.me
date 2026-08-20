'use client';

import { CheckCircle2, Clock3, MessageCircleQuestion, Mic2, MoveRight, Radio } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import type { LiveScriptCueKind, TeacherLiveScript } from '@/lib/teacher-live-scripts-api';

const cueLabels: Record<LiveScriptCueKind, { zh: string; en: string }> = {
  action: { zh: '动作', en: 'Action' },
  interaction: { zh: '互动', en: 'Audience' },
  transition: { zh: '转场', en: 'Transition' },
  optional: { zh: '可选', en: 'Optional' },
};

export default function LiveScriptDocument({ script }: { script: TeacherLiveScript }) {
  const title = tr({ zh: script.titleZh, en: script.titleEn });
  const summary = tr({ zh: script.summaryZh, en: script.summaryEn });
  const author = tr({ zh: script.teacher.nameZh, en: script.teacher.nameEn });
  return (
    <main className="live-script-page">
      <div className="live-script-wrap">
        <header className="live-script-topbar">
          <AppLink href="/teachers/scripts" className="live-script-home" prefetch={false}>← {tr({ zh: '直播话术库', en: 'Script library' })}</AppLink>
          <span>{author}</span>
        </header>
        <section className="live-script-hero" aria-labelledby="live-script-title">
          <p className="live-script-kicker"><Radio aria-hidden size={16} />{tr({ zh: `约 ${script.durationMinutes} 分钟`, en: `About ${script.durationMinutes} minutes` })}</p>
          <h1 id="live-script-title">{title}</h1>
          {summary && <p className="live-script-lead">{summary}</p>}
          <p className="live-script-byline">{tr({ zh: `由 ${author} 发布`, en: `Published by ${author}` })}</p>
        </section>
        {script.content.preparation.length > 0 && <section className="live-script-prep" aria-labelledby="live-script-prep-title">
          <div className="live-script-prep-heading"><CheckCircle2 aria-hidden size={18} /><div><h2 id="live-script-prep-title">{tr({ zh: '开播前准备', en: 'Before going live' })}</h2><p>{tr({ zh: '先补齐会随场次变化的信息。', en: 'Fill in details that change between sessions.' })}</p></div></div>
          <ol>{script.content.preparation.map((item, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{tr(item)}</li>)}</ol>
        </section>}
      </div>

      <nav className="live-script-nav" aria-label={tr({ zh: '直播流程', en: 'Livestream flow' })}><div className="live-script-nav-inner">
        {script.content.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{tr(section.title).split('：')[0].split(':')[0]}</a>)}
      </div></nav>

      <div className="live-script-wrap live-script-flow">
        <div className="live-script-flow-heading"><Mic2 aria-hidden size={20} /><h2>{tr({ zh: '正式话术', en: 'Full script' })}</h2><p>{tr({ zh: '正文可直接说，标签内容是现场提示。', en: 'Read the main text aloud; labelled lines are cues.' })}</p></div>
        {script.content.sections.map((section, sectionIndex) => <section key={section.id} id={section.id} className="live-script-segment">
          <div className="live-script-segment-meta"><span className="live-script-number">{String(sectionIndex + 1).padStart(2, '0')}</span>{tr(section.duration) && <p className="live-script-duration"><Clock3 aria-hidden size={14} />{tr(section.duration)}</p>}</div>
          <div className="live-script-segment-content"><header><h2>{tr(section.title)}</h2>{tr(section.goal) && <p>{tr(section.goal)}</p>}</header><div className="live-script-beats">
            {section.beats.map((beat, beatIndex) => beat.kind === 'say'
              ? <p className="live-script-say" key={beatIndex}>{tr(beat.text)}</p>
              : <aside className={`live-script-cue live-script-cue-${beat.cue}`} key={beatIndex}><span>{tr(cueLabels[beat.cue])}</span><p>{tr(beat.text)}</p></aside>)}
          </div></div>
        </section>)}
        {script.content.notes.length > 0 && <section className="live-script-notes" aria-labelledby="live-script-notes-title"><div><MessageCircleQuestion aria-hidden size={20} /><h2 id="live-script-notes-title">{tr({ zh: '现场提醒', en: 'Presenter notes' })}</h2></div><ol>{script.content.notes.map((note, index) => <li key={index}>{tr(note)}</li>)}</ol></section>}
        {script.content.referenceLinks.length > 0 && <footer className="live-script-footer"><p>{tr({ zh: '话术中用到的链接', en: 'Links used in this script' })}</p><div>{script.content.referenceLinks.map((item) => item.href.startsWith('/') ? <AppLink key={item.href} href={item.href} prefetch={false}>{tr(item.label)}<MoveRight aria-hidden size={14} /></AppLink> : <a key={item.href} href={item.href} target="_blank" rel="noreferrer">{tr(item.label)}<MoveRight aria-hidden size={14} /></a>)}</div></footer>}
      </div>
    </main>
  );
}
