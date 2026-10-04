'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getOwnerKey, useAuthUser } from '@/lib/auth-store';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { loadPlatformResource, PlatformPermissionError } from '@/lib/platform-gateway';
import { platformLearningRequest, learningTime, type LearningLesson, type LearningNote, type LearningAttempt, type LessonLearningState } from '@/lib/platform-learning';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import './platform-learning.css';

interface MediaProps { lessonId: string; startTime: number; onVideoElement: (video: HTMLVideoElement | null) => void; onNext?: () => void; onPrevious?: () => void }
interface Props { courseId: string; lessonId: string; lessons?: LearningLesson[]; startTime?: number; onSelectLesson?: (id: string) => void; renderMedia: (props: MediaProps) => ReactNode }

/** One learning session for both section pages and direct lesson links. */
export function PlatformClassroom({ courseId, lessonId, lessons: initialLessons = [], startTime, onSelectLesson, renderMedia }: Props) {
  const t = useT(); const user = useAuthUser();
  const [lesson,setLesson] = useState<PlatformEntity | null>(null);
  const [state,setState] = useState<LessonLearningState | null>(null);
  const [publicLessons,setPublicLessons]=useState<LearningLesson[]>([]);
  const [error,setError] = useState(''); const [saveError,setSaveError] = useState('');
  const [video,setVideo] = useState<HTMLVideoElement | null>(null);
  const [initialPosition,setInitialPosition] = useState(startTime ?? 0);
  const [editing,setEditing] = useState<LearningNote | null>(null); const [draft,setDraft] = useState('');
  const [draftPosition,setDraftPosition] = useState(0); const [noteOpen,setNoteOpen] = useState(false); const [busy,setBusy] = useState(false);
  const progress = useRef({ progressBps:0, status:'not_started' });
  const saveQueue = useRef(Promise.resolve());
  const session=useRef({lessonId,user});session.current={lessonId,user};
  const english=t('zh','en')==='en';
  const refresh=useCallback(async()=>{
    if(!user) return;
    const data=await platformLearningRequest<LessonLearningState>(`/learning/lessons/${encodeURIComponent(lessonId)}/state`,undefined,'GET');
    if(session.current.lessonId===lessonId&&session.current.user===user)setState(data);
  },[lessonId,user]);
  useEffect(()=>{
    const abort=new AbortController();setLesson(null);setState(null);setPublicLessons([]);setError('');setSaveError('');setNoteOpen(false);setEditing(null);setDraft('');
    void (async()=>{
      const result=await loadPlatformResource('course-lesson',{params:{id:courseId,lessonId},signal:abort.signal});
      if(abort.signal.aborted) return; setLesson(result.items[0]??null);
      if(user){
        const next=await platformLearningRequest<LessonLearningState>(`/learning/lessons/${encodeURIComponent(lessonId)}/state`,undefined,'GET',abort.signal);
        if(abort.signal.aborted) return; setState(next);progress.current=next.progress??{progressBps:0,status:'not_started'};setInitialPosition(startTime ?? next.progress?.positionSeconds ?? 0);
      }else {
        setInitialPosition(startTime ?? 0);
        if(!initialLessons.length){
          const course=await loadPlatformResource('courses',{params:{id:courseId},signal:abort.signal});
          const directory=course.items[0]?.data?.lessons;
          if(!abort.signal.aborted&&Array.isArray(directory))setPublicLessons(directory.filter((item):item is LearningLesson=>!!item&&typeof item==='object'&&typeof item.id==='string'));
        }
      }
    })().catch(reason=>{if(!abort.signal.aborted){if(reason instanceof PlatformPermissionError){setLesson({id:lessonId,title:'',data:{}});setState({progress:null,notes:[],lessons:[],attempts:[]});}else setError(String(reason.message??reason));}});
    return()=>abort.abort();
  },[courseId,lessonId,user,startTime]);
  useEffect(()=>{
    if(!video||!user||!state)return;
    const ownerKey=getOwnerKey();
    let last=0;
    const save=(ended=false)=>{
      if(!Number.isFinite(video.duration)||video.duration<=0)return;
      const positionSeconds=Math.max(0,Math.min(86400,Math.floor(video.currentTime)));
      const progressBps=Math.max(progress.current.progressBps,ended?10000:Math.min(9999,Math.round(video.currentTime/video.duration*10000)));
      const status=ended||progress.current.status==='completed'?'completed':'in_progress';
      progress.current={progressBps,status};
      saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
        if(getOwnerKey()!==ownerKey)return;
        await platformLearningRequest(`/me/progress/${encodeURIComponent(lessonId)}`,{positionSeconds,progressBps,status},'PUT');if(session.current.lessonId===lessonId&&session.current.user===user)setSaveError('');
        if(ended) await refresh();
      }).catch(()=>setSaveError(t('学习记录暂未同步，暂停或继续播放时会重试。','Progress could not sync. Pausing or continuing playback retries.')));
    };
    const tick=()=>{if(Date.now()-last>=10000){last=Date.now();save();}};
    const pause=()=>save(); const ended=()=>save(true); const visibility=()=>{if(document.visibilityState==='hidden')save();};
    video.addEventListener('timeupdate',tick);video.addEventListener('pause',pause);video.addEventListener('ended',ended);document.addEventListener('visibilitychange',visibility);
    return()=>{save();video.removeEventListener('timeupdate',tick);video.removeEventListener('pause',pause);video.removeEventListener('ended',ended);document.removeEventListener('visibilitychange',visibility);};
    // Only a new player/session installs listeners; progress updates must not trigger save loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[video,user,lessonId,Boolean(state)]);
  const lessons=initialLessons.length?initialLessons:state?.lessons??publicLessons;
  const index=lessons.findIndex(item=>item.id===lessonId);
  const select=(offset:number)=>{const item=lessons[index+offset];if(item&&onSelectLesson)onSelectLesson(item.id);};
  const title=(item:LearningLesson)=>String(item[english?'titleEn':'titleZh']||item.titleZh||item.titleEn||'');
  const seek=(seconds:number)=>{if(video){video.currentTime=Math.min(seconds,Number.isFinite(video.duration)?video.duration:seconds);void video.play().catch(()=>{});}};
  const saveNote=async()=>{setBusy(true);try{await platformLearningRequest(`/me/notes/${encodeURIComponent(lessonId)}`,{...(editing?{noteId:editing.id}:{}),contentMarkdown:draft,positionSeconds:draftPosition},'PUT');setNoteOpen(false);setEditing(null);setDraft('');await refresh();}catch(reason){setSaveError(String(reason));}finally{setBusy(false);}};
  if(error)return <PlatformState kind="error" message={error}/>;
  if(!lesson || (user&&!state))return <PlatformState kind="loading"/>;
  const data=lesson.data??{};
  const readBody=(body:unknown):string=>{if(typeof body==='string')return body; if(!body||typeof body!=='object')return ''; const fields=body as Record<string,unknown>; return ['markdown','text','content'].map(key=>fields[key]).find((value):value is string=>typeof value==='string'&&Boolean(value.trim()))??'';};
  const markdown=readBody(data[english?'bodyEn':'bodyZh'])||readBody(data[english?'bodyZh':'bodyEn']);
  return <div className="platform-learning-classroom">
    <nav className="platform-learning-directory" data-site-surface="panel"><h2>{t('课程目录','Course lessons')}</h2>{lessons.map(item=>{
      const done=state?.lessons.find(row=>row.id===item.id)?.status==='completed';
      const label=<><span>{title(item)}</span>{done||item.accessScope==='public'||item.durationSeconds?<small>{done?t('已完成','Completed'):item.accessScope==='public'?t('试看','Preview'):learningTime(item.durationSeconds??0)}</small>:null}</>;
      return onSelectLesson||initialLessons.length?<button type="button" key={item.id} aria-current={item.id===lessonId?'step':undefined} onClick={()=>onSelectLesson?.(item.id)}>{label}</button>:<AppLink key={item.id} href={`/platform/courses/${courseId}/learn/${item.id}`} prefetch={false} aria-current={item.id===lessonId?'step':undefined}>{label}</AppLink>;
    })}</nav>
    <div className="platform-learning-stage">{renderMedia({lessonId,startTime:initialPosition,onVideoElement:setVideo,onPrevious:index>0&&onSelectLesson?()=>select(-1):undefined,onNext:index<lessons.length-1&&onSelectLesson?()=>select(1):undefined})}
      {saveError?<p role="status">{saveError}</p>:null}{markdown?<div className="platform-prose">{renderArticleMarkdown(markdown)}</div>:null}
      {!user?<p>{t('登录后同步进度、笔记和测验。','Sign in to sync progress, notes and quizzes.')}</p>:<>
      <section className="platform-learning-panel" data-site-surface="panel"><h3>{t('课程笔记','Lesson notes')}</h3>
        <button className="platform-button" type="button" onClick={()=>{setEditing(null);setDraft('');setDraftPosition(Math.floor(video?.currentTime??0));setNoteOpen(true);}}>{t('在当前时间记一笔','Take a note at this moment')}</button>
        {noteOpen?<form onSubmit={event=>{event.preventDefault();void saveNote();}}><label>{t('笔记','Note')} · {learningTime(draftPosition)}<textarea className="platform-field-control" required maxLength={20000} rows={4} value={draft} onChange={event=>setDraft(event.target.value)}/></label><div className="platform-write-actions"><button className="platform-button platform-button-primary" disabled={busy}>{t('保存','Save')}</button><button className="platform-button" type="button" onClick={()=>setNoteOpen(false)}>{t('取消','Cancel')}</button></div></form>:null}
        {!state?.notes.length?<p>{t('还没有笔记。','No notes yet.')}</p>:state.notes.map(note=><article key={note.id}><button type="button" className="platform-text-button" onClick={()=>seek(note.positionSeconds??0)}>{learningTime(note.positionSeconds??0)}</button><div className="platform-prose">{renderArticleMarkdown(note.body)}</div><div className="platform-write-actions"><button type="button" className="platform-text-button" onClick={()=>{setEditing(note);setDraft(note.body);setDraftPosition(note.positionSeconds??0);setNoteOpen(true);}}>{t('编辑','Edit')}</button><button type="button" className="platform-text-button" disabled={busy} onClick={()=>{if(window.confirm(t('删除这条笔记？','Delete this note?')))void platformLearningRequest(`/me/notes/${note.id}`,{},'DELETE').then(refresh).catch(reason=>setSaveError(String(reason)));}}>{t('删除','Delete')}</button></div></article>)}
      </section><ClassroomQuiz key={String(data.quizId??lessonId)} data={data} lessonId={lessonId} attempts={state?.attempts??[]} onSaved={refresh}/></>}
    </div>
  </div>;
}

function ClassroomQuiz({data,lessonId,attempts,onSaved}:{data:Record<string,unknown>;lessonId:string;attempts:LearningAttempt[];onSaved:()=>Promise<void>}){
  const t=useT();const english=t('zh','en')==='en';const questions=(Array.isArray(data.questions)?data.questions:[]) as Record<string,unknown>[];
  const [answers,setAnswers]=useState<Record<string,unknown>>({});const [result,setResult]=useState<LearningAttempt|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const latest=attempts.find(item=>item.quizId===data.quizId);const exhausted=Number(data.maxAttempts)>0&&Number(latest?.attemptNumber??0)>=Number(data.maxAttempts);
  if(!data.quizId||!questions.length)return null;
  const complete=questions.every(question=>{const answer=answers[String(question.id)];return answer!==undefined&&answer!==''&&(!Array.isArray(answer)||answer.length>0);});
  const describe=(question:Record<string,unknown>,answer:unknown):string=>{const choices=Array.isArray(question.choices)?question.choices:[];return Array.isArray(answer)?answer.map(value=>String(choices[Number(value)]??value)).join(', '):String(choices[Number(answer)]??answer??'');};
  return <section className="platform-learning-panel" data-site-surface="panel"><h3>{t('课后测验','Lesson quiz')}</h3>
    {latest?<p>{t('上次成绩','Last score')} {latest.scoreBps/100}% · {t('第','Attempt')} {latest.attemptNumber} {t('次','')}</p>:null}
    {result?<p role="status">{result.scoreBps/100}% · {result.passed?t('通过','Passed'):t('未通过','Not passed')}{result.awardedPoints?' · +5':''}</p>:null}
    <form onSubmit={event=>{event.preventDefault();setBusy(true);setError('');void platformLearningRequest<LearningAttempt>(`/learning/lessons/${lessonId}/quiz`,{quizId:data.quizId,answers}).then(async next=>{setResult(next);await onSaved();}).catch(reason=>setError(String(reason))).finally(()=>setBusy(false));}}>
      {questions.map((question,index)=>{const id=String(question.id);const choices=Array.isArray(question.choices)?question.choices:[];const feedback=result?.feedback?.find(row=>row.questionId===id);return <fieldset key={id} disabled={busy||!!result||exhausted}><legend>{index+1}. {String(question[english?'promptEn':'promptZh']||question.promptZh||question.promptEn||'')}</legend>
      {question.type==='multiple_choice'?<div className="platform-write-actions">{choices.map((choice,i)=>{const selected=Array.isArray(answers[id])&&(answers[id] as number[]).includes(i);return <button key={i} className="platform-answer-option" type="button" aria-pressed={selected} onClick={()=>setAnswers(previous=>({...previous,[id]:selected?(previous[id] as number[]).filter(value=>value!==i):[...(Array.isArray(previous[id])?previous[id] as number[]:[]),i]}))}>{String(choice)}</button>;})}</div>:question.type==='single_choice'?<select className="platform-field-control" value={String(answers[id]??'')} onChange={event=>setAnswers(previous=>({...previous,[id]:Number(event.target.value)}))} required><option value="">{t('请选择','Choose an answer')}</option>{choices.map((choice,i)=><option key={i} value={i}>{String(choice)}</option>)}</select>:question.type==='boolean'?<select className="platform-field-control" value={String(answers[id]??'')} onChange={event=>setAnswers(previous=>({...previous,[id]:event.target.value==='true'}))} required><option value="">{t('请选择','Choose an answer')}</option><option value="true">{t('正确','True')}</option><option value="false">{t('错误','False')}</option></select>:<input className="platform-field-control" required value={String(answers[id]??'')} onChange={event=>setAnswers(previous=>({...previous,[id]:event.target.value}))}/>}
      {feedback?<p>{feedback.correct?t('答对了','Correct'):t('答错了，正确答案：','Incorrect. Correct answer: ')+describe(question,feedback.expected)}{feedback.explanation?` · ${feedback.explanation}`:''}</p>:null}</fieldset>;})}
      {error?<p role="alert">{error}</p>:null}{result?<button type="button" className="platform-button" disabled={exhausted} onClick={()=>{setResult(null);setAnswers({});}}>{t('重新作答','Try again')}</button>:<button className="platform-button platform-button-primary" disabled={busy||!complete||exhausted}>{busy?t('提交中…','Submitting…'):exhausted?t('已用完作答次数','No attempts remaining'):t('提交答案','Submit answers')}</button>}
    </form>{attempts.length?<details><summary>{t('作答记录','Attempt history')}</summary>{attempts.map(attempt=><p key={attempt.id}>{attempt.attemptNumber} · {attempt.scoreBps/100}% · {attempt.passed?t('通过','Passed'):t('未通过','Not passed')} <button type="button" className="platform-text-button" onClick={()=>setResult(attempt)}>{t('查看结果','View result')}</button></p>)}</details>:null}
  </section>;
}
