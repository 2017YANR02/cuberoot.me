'use client';

import { sessionFetch } from '@/lib/session-fetch';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from '@app-foundation/icons/lucide';
import { prepareImageUpload, uploadImageBlob } from '@/lib/image-upload';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { CSTIMER_SOLVABLE_IDS } from '@/lib/cstimer-scramble';
import { COURSE_TOPICS, COURSE_TOPIC_IDS, isCourseCatalogTag } from '@/lib/platform-course-catalog';
import { eventDisplayName } from '@/lib/wca-events';
import { PlatformReferenceField } from './PlatformReferenceField';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { platformLocalDateTime, platformMajorToMinor, platformMinorToMajor } from '@/lib/platform-commerce-fields';
import { commerceRecord, commerceText } from './PlatformCommerceContent';
import { isPlatformIntroductionLesson, platformTrialLessonIds } from '@cuberoot/shared/platform';
import './platform-commerce.css';

type Entry=Record<string,unknown>;
type Column={key:string;zh:string;en:string;kind?:'number'|'money'|'lines'|'textarea'|'datetime-local'|'url'|'boolean';required?:boolean;signed?:boolean;rows?:number};
const variantFields:Column[]=[{key:'sku',zh:'规格编号',en:'SKU',required:true},{key:'titleZh',zh:'中文名称',en:'Chinese name',required:true},{key:'titleEn',zh:'英文名称',en:'English name'},{key:'amountMinor',zh:'价格（元）',en:'Price (major units)',kind:'money',required:true},{key:'memberAmountMinor',zh:'会员价（元，可空）',en:'Member price (optional)',kind:'money'},{key:'currency',zh:'币种',en:'Currency',required:true},{key:'inventoryOnHand',zh:'库存总数',en:'Inventory on hand',kind:'number',required:true},{key:'weightGrams',zh:'重量（克）',en:'Weight (grams)',kind:'number'}];
const ticketFields:Column[]=[{key:'code',zh:'票种编号',en:'Ticket code',required:true},{key:'titleZh',zh:'中文名称',en:'Chinese name',required:true},{key:'titleEn',zh:'英文名称',en:'English name'},{key:'amountMinor',zh:'票价（元）',en:'Price (major units)',kind:'money',required:true},{key:'currency',zh:'币种',en:'Currency',required:true},{key:'capacity',zh:'名额',en:'Capacity',kind:'number',required:true},{key:'salesStartAt',zh:'开售时间（本地时间）',en:'Sales open (local time)',kind:'datetime-local'},{key:'salesEndAt',zh:'截止时间（本地时间）',en:'Sales close (local time)',kind:'datetime-local'}];
const venueFields:Column[]=[{key:'name',zh:'场地名称',en:'Venue name'},{key:'city',zh:'城市',en:'City'},{key:'address',zh:'地址',en:'Address'},{key:'url',zh:'场地网址',en:'Venue URL',kind:'url'}];
const productPresentation:Column[]=[{key:'brand',zh:'品牌',en:'Brand'},{key:'imageUrl',zh:'主图网址或站内路径',en:'Main image URL or site path'},{key:'imageUrls',zh:'其他图片（每行一个网址或路径）',en:'Additional images (one URL or path per line)',kind:'lines'},{key:'subtitleZh',zh:'中文简述',en:'Chinese subtitle'},{key:'subtitleEn',zh:'英文简述',en:'English subtitle'},{key:'shippingZh',zh:'中文配送说明',en:'Chinese delivery details',kind:'textarea'},{key:'shippingEn',zh:'英文配送说明',en:'English delivery details',kind:'textarea'},{key:'originalAmountMinor',zh:'原价（元，可空）',en:'Original price (optional)',kind:'money'},{key:'featuresZh',zh:'中文特性（每行一项）',en:'Chinese features (one per line)',kind:'lines'},{key:'featuresEn',zh:'英文特性（每行一项）',en:'English features (one per line)',kind:'lines'}];
const coursePresentation: Column[] = [
  { key: 'levelZh', zh: '中文适合人群', en: 'Audience in Chinese' },
  { key: 'levelEn', zh: '英文适合人群', en: 'Audience in English' },
  { key: 'targetZh', zh: '中文目标水平', en: 'Target level in Chinese' },
  { key: 'targetEn', zh: '英文目标水平', en: 'Target level in English' },
  { key: 'format', zh: '课程形式', en: 'Format' },
  { key: 'highlights', zh: '课程亮点（每行一项）', en: 'Highlights (one per line)', kind: 'lines' },
  { key: 'nextLiveAt', zh: '下次直播', en: 'Next live session', kind: 'datetime-local' },
];
const courseWcaEvents = new Set(ALL_EVENT_IDS);

function CourseCoverUpload({ label, portrait, value, onChange, onPending }: {
  label: string; portrait?: boolean; value: unknown; onChange: (value: string) => void; onPending?: (pending: boolean) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);
  const url = typeof value === 'string' && /^(?:https?:\/\/|\/(?![/\\]))/i.test(value) ? value : '';
  const stateChange = useRef(onPending);
  stateChange.current = onPending;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (pending.current) stateChange.current?.(false); }; }, []);
  useEffect(() => { setBroken(false); }, [url]);
  async function upload(file: File) {
    if (pending.current) return;
    pending.current = true;
    stateChange.current?.(true);
    setUploading(true); setError('');
    try {
      const prepared = await prepareImageUpload(file, 1920);
      if (!mounted.current) return;
      const image = await uploadImageBlob(prepared.dataB64, prepared.mime);
      if (mounted.current) onChange(image.url);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && cause.message === 'unsupported_image_type'
        ? t('请选择 PNG、JPEG 或 WebP 图片。', 'Choose a PNG, JPEG or WebP image.')
        : t('封面上传失败，请重新选择图片。', 'Cover upload failed. Choose the image again.'));
    } finally {
      pending.current = false;
      if (mounted.current) { setUploading(false); stateChange.current?.(false); }
    }
  }
  return <div className="platform-course-cover-upload">
    <span>{label}</span>
    <input ref={input} type="file" className="sr-only" aria-label={label} accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file);
    }} />
    <button type="button" className={`platform-cover-preview${portrait ? ' is-portrait' : ''}`} aria-label={`${label} — ${t('选择图片', 'Choose image')}`} disabled={uploading} onClick={() => input.current?.click()}>
      {url && !broken ? <img src={url} alt={label} onError={() => setBroken(true)} /> : <span><ImagePlus aria-hidden size={24} />{uploading ? t('上传中…', 'Uploading…') : t('选择图片', 'Choose image')}<small>{portrait ? '2:3' : '16:9'}</small></span>}
    </button>
    {url || value ? <div className="platform-cover-actions"><button type="button" className="platform-text-button" disabled={uploading} onClick={() => input.current?.click()}>{t('更换', 'Replace')}</button><button type="button" className="platform-text-button" disabled={uploading} onClick={() => { setError(''); onChange(''); }}>{t('移除', 'Remove')}</button></div> : null}
    {uploading && url ? <small role="status">{t('正在上传新封面…', 'Uploading new cover…')}</small> : null}
    {error ? <small className="platform-form-error" role="alert">{error}</small> : value && !url ? <small className="platform-form-error" role="alert">{t('原封面地址无效，请更换或移除。', 'The previous cover address is invalid. Replace or remove it.')}</small> : null}
  </div>;
}

function CourseTags({ value, onChange }: { value: unknown; onChange: (tags: string[]) => void }) {
  const t = useT(); const isZh = t('zh', 'en') === 'zh';
  const tags = Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
  const puzzles = new Set(tags.filter(tag => tag.startsWith('puzzle:') && isCourseCatalogTag(tag)).map(tag => tag.slice(7)));
  const custom = tags.filter(tag => !isCourseCatalogTag(tag));
  const toggle = (tag: string) => onChange(tags.includes(tag) ? tags.filter(value => value !== tag) : [...tags, tag]);
  return <div className="platform-course-tag-editor">
    <div><span>{t('课程项目', 'Course puzzles')}</span><div className="platform-course-tag-options"><PuzzlePicker isZh={isZh} wcaEvents={courseWcaEvents} availableEvents={CSTIMER_SOLVABLE_IDS} selectedEvents={puzzles} onToggle={id => toggle(`puzzle:${id}`)} placeholderLabel={t('选择项目', 'Choose puzzles')} showTriggerLabel showArrow triggerVariant="pill" />
      {[...puzzles].map(id => <button key={id} type="button" className="platform-filter-option" aria-pressed="true" onClick={() => toggle(`puzzle:${id}`)}>{eventDisplayName(id, isZh)} ×</button>)}</div></div>
    <div><span>{t('学习方向', 'Learning topics')}</span><div className="platform-filter-chips platform-course-tag-options">{COURSE_TOPIC_IDS.map(id => <button type="button" key={id} className="platform-filter-option" aria-pressed={tags.includes(`topic:${id}`)} onClick={() => toggle(`topic:${id}`)}>{t(COURSE_TOPICS[id].zh, COURSE_TOPICS[id].en)}</button>)}</div></div>
    <label><span>{t('其他标签（选填，每行一项）', 'Other tags (optional, one per line)')}</span><textarea autoComplete="off" className="platform-field-control" rows={2} value={custom.join('\n')} onChange={event => onChange([...tags.filter(isCourseCatalogTag), ...event.target.value.split('\n')])} /></label>
  </div>;
}

function Scalar({column,value,onChange}:{column:Column;value:unknown;onChange:(value:unknown)=>void}) {
  const t=useT();const label=t(column.zh,column.en);
  const external=column.kind==='money'?platformMinorToMajor(value):column.kind==='lines'&&Array.isArray(value)?value.join('\n'):column.kind==='datetime-local'?platformLocalDateTime(value):String(value??'');
  const [draft,setDraft]=useState(external);
  useEffect(()=>{setDraft(previous=>column.kind==='money' && Number(previous)===Number(external) && (previous!==''||external==='')?previous:external);},[external,column.kind]);
  if(column.kind==='boolean')return <BoolToggle value={value===true} label={label} onChange={onChange}/>;
  const edit=(next:string)=>{setDraft(next);if(column.kind==='money'){try{const negative=column.signed&&next.startsWith('-');const parsed=platformMajorToMinor(negative?next.slice(1):next);onChange(parsed==null?null:negative?-parsed:parsed);}catch{return;}}else if(column.kind==='lines')onChange(next.split('\n'));else if(column.kind==='number')onChange(next===''?null:Number(next));else if(column.kind==='datetime-local')onChange(next?new Date(next).toISOString():null);else onChange(next);};
  return <label><span>{label}</span>{column.kind==='lines'||column.kind==='textarea'?<textarea className="platform-field-control" rows={column.rows??4} value={draft} required={column.required} onChange={event=>edit(event.target.value)}/>:<input className="platform-field-control" type={column.kind==='money'||column.kind==='number'?'number':column.kind??'text'} min={!column.signed&&(column.kind==='money'||column.kind==='number')?0:undefined} step={column.kind==='money'?'0.01':column.kind==='number'?'1':undefined} value={draft} required={column.required} onChange={event=>edit(event.target.value)}/>}</label>;
}
function Fields({columns,row,onChange}:{columns:Column[];row:Entry;onChange:(row:Entry)=>void}) {return <div className="platform-structured-fields">{columns.map(column=><Scalar key={column.key} column={column} value={row[column.key]} onChange={value=>onChange({...row,[column.key]:value})}/>)}</div>;}

function PathItem({row,onChange,courses}:{row:Entry;onChange:(row:Entry)=>void;courses:Entry[]}) {
  const t=useT();const [lessons,setLessons]=useState<Entry[]>([]);const [error,setError]=useState('');
  useEffect(()=>{if(!row.courseId){setLessons([]);return;}const controller=new AbortController();void sessionFetch(apiUrl(`/v1/platform/admin/courses/${encodeURIComponent(String(row.courseId))}`),{headers:authHeaders(false),signal:controller.signal}).then(response=>handleApi<{course:Entry}>(response)).then(result=>{setLessons(Array.isArray(result.course.lessons)?result.course.lessons.map(commerceRecord):[]);setError('');}).catch(reason=>{if(!controller.signal.aborted)setError(String(reason));});return()=>controller.abort();},[row.courseId]);
  return <div className="platform-structured-fields"><label><span>{t('课程','Course')}</span><select className="platform-field-control" required value={String(row.courseId??'')} onChange={event=>onChange({...row,courseId:event.target.value,lessonId:null})}><option value="">{t('选择课程','Choose a course')}</option>{courses.map(course=><option key={String(course.id)} value={String(course.id)}>{commerceText(course,'title',t)}</option>)}</select></label><label><span>{t('课时','Lesson')}</span><select className="platform-field-control" value={String(row.lessonId??'')} onChange={event=>onChange({...row,lessonId:event.target.value||null})}><option value="">{t('整门课程','Whole course')}</option>{lessons.map(lesson=><option key={String(lesson.id)} value={String(lesson.id)}>{commerceText(lesson,'title',t)}</option>)}</select></label>{error?<p role="alert">{error}</p>:null}</div>;
}

function Question({row,onChange}:{row:Entry;onChange:(row:Entry)=>void}) {
  const t=useT();const choices=Array.isArray(row.choices)?row.choices.map(String):[];const type=String(row.type??'single_choice');const selected=Array.isArray(row.answerKey)?row.answerKey:[];
  return <div className="platform-structured-row"><label>{t('题型','Question type')}<select className="platform-field-control" value={type} onChange={event=>{const next=event.target.value;onChange({...row,type:next,choices:next.includes('choice')?['','']:[],answerKey:next==='boolean'?true:next==='text'?'':next==='multiple_choice'?[0]:0});}}><option value="single_choice">{t('单选','Single choice')}</option><option value="multiple_choice">{t('多选','Multiple choice')}</option><option value="boolean">{t('判断','True / false')}</option><option value="text">{t('填空','Text answer')}</option></select></label><Fields row={row} onChange={onChange} columns={[{key:'promptZh',zh:'中文题目',en:'Chinese question',kind:'textarea',required:true},{key:'promptEn',zh:'英文题目',en:'English question',kind:'textarea'},{key:'points',zh:'分值',en:'Points',kind:'number',required:true},{key:'explanation',zh:'答案解析（选填）',en:'Answer explanation (optional)',kind:'textarea'}]}/>
    {type.includes('choice')?<><h4>{t('选项与正确答案','Choices and correct answers')}</h4>{choices.map((choice,index)=><div className="platform-structured-fields" key={index}><input autoComplete="off" className="platform-field-control" required aria-label={t(`选项 ${index+1}`,`Choice ${index+1}`)} value={choice} onChange={event=>onChange({...row,choices:choices.map((value,i)=>i===index?event.target.value:value)})}/>{type==='single_choice'?<label><input type="radio" name={`correct-${String(row.editorKey??row.promptZh)}`} checked={row.answerKey===index} onChange={()=>onChange({...row,answerKey:index})}/>{t('正确答案','Correct answer')}</label>:<BoolToggle label={t('正确答案','Correct answer')} value={selected.includes(index)} onChange={checked=>onChange({...row,answerKey:checked?[...selected,index]:selected.filter(value=>value!==index)})}/>}</div>)}<button type="button" className="platform-button" onClick={()=>onChange({...row,choices:[...choices,'']})}>{t('添加选项','Add choice')}</button>{choices.length>2?<button type="button" className="platform-button" onClick={()=>onChange({...row,choices:choices.slice(0,-1),answerKey:type==='multiple_choice'?selected.filter(value=>Number(value)<choices.length-1):Math.min(Number(row.answerKey),choices.length-2)})}>{t('移除最后一个选项','Remove last choice')}</button>:null}</>:type==='boolean'?<BoolToggle label={t('正确答案为“对”','Correct answer is true')} value={row.answerKey===true} onChange={value=>onChange({...row,answerKey:value})}/>:<Scalar column={{key:'answerKey',zh:'正确答案',en:'Correct answer',required:true}} value={row.answerKey} onChange={value=>onChange({...row,answerKey:value})}/>}
  </div>;
}

export type CoursePresentationPart = 'positioning' | 'introduction' | 'cover' | 'outline';

function CourseTrialSelection({ lessons, trialIds, onChange }: {
  lessons: unknown[]; trialIds?: readonly string[]; onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const eligible = lessons.map(commerceRecord).filter(lesson => typeof lesson.id === 'string' && lesson.status !== 'archived'
    && !isPlatformIntroductionLesson(lesson.liveSection ? commerceRecord(lesson.liveSection) : lesson));
  const selected = new Set(trialIds ?? eligible.filter(lesson => (lesson.liveAccessScope ?? lesson.accessScope) === 'public').map(lesson => String(lesson.id)));
  return <section className="platform-course-trial-settings" aria-label={t('试听课选择', 'Trial lesson selection')}>
    <h3>{t('试听课', 'Trial lessons')}</h3>
    {eligible.length ? <>
      <p>{t('选中的课时发布后可免费试听，其余课时仍需课程权益。', 'Selected lessons are free to preview when published. Other lessons require course access.')}</p>
      <div className="platform-course-trial-options">
        {eligible.map(lesson => {
          const id = String(lesson.id);
          const title = t(String(lesson.titleZh || lesson.titleEn || id), String(lesson.titleEn || lesson.titleZh || id));
          return <BoolToggle key={id} label={title} ariaLabel={t(`设为试听课：${title}`, `Make ${title} a trial lesson`)} value={selected.has(id)} onChange={enabled => {
            const next = new Set(selected);
            if (enabled) next.add(id); else next.delete(id);
            onChange(eligible.map(item => String(item.id)).filter(item => next.has(item)));
          }} />;
        })}
      </div>
    </> : <p>{t('暂无可选课时，上传课时后可在这里设置试听。', 'Upload lessons before choosing which ones to offer as previews.')}</p>}
  </section>;
}

export function PlatformStructuredField({fieldKey,label,value,onChange,routeId,onUploadPending,coursePart,compactOutline=false,courseLessons,courseTrialCandidate,onCourseTrialChange}:{fieldKey:string;label:string;value:string;onChange:(value:string)=>void;routeId:string;onUploadPending?:(key:string,pending:boolean)=>void;coursePart?:CoursePresentationPart;compactOutline?:boolean;courseLessons?:unknown[];courseTrialCandidate?:boolean;onCourseTrialChange?:()=>void}) {
  const t=useT();let parsed:unknown;try{parsed=JSON.parse(value||(['venue','presentation','eligibility'].includes(fieldKey)?'{}':'[]'));}catch{parsed={};}
  const rows=Array.isArray(parsed)?parsed.map(commerceRecord):[];const object=commerceRecord(parsed);
  const currentObject = useRef(object);
  currentObject.current = object;
  const [courses,setCourses]=useState<Entry[]>([]);const [loadError,setLoadError]=useState('');
  const [outlineIndex,setOutlineIndex]=useState(0);
  const [trialEdited, setTrialEdited] = useState(false);
  useEffect(()=>{if(fieldKey!=='items')return;const controller=new AbortController();void(async()=>{try{const loaded:Entry[]=[];for(let page=1;page<=100;page++){const response=await sessionFetch(apiUrl(`/v1/platform/admin/courses?page=${page}&pageSize=100`),{headers:authHeaders(false),signal:controller.signal});const result=await handleApi<{courses:Entry[];total?:number}>(response);loaded.push(...result.courses);if(result.courses.length<100||(result.total!=null&&loaded.length>=result.total))break;}setCourses(loaded);setLoadError('');}catch(reason){if(!controller.signal.aborted)setLoadError(String(reason));}})();return()=>controller.abort();},[fieldKey]);
  const save=(next:unknown)=>onChange(JSON.stringify(next));
  const updateCourseField=(key:string,next:unknown)=>{ const updated={...currentObject.current,[key]:next}; currentObject.current=updated; save(updated); };
  const positioningValue = (key: string) => {
    const stem = key.replace(/(?:Zh|En)$/, '');
    if ((stem === 'level' || stem === 'target') && !object[`${stem}Zh`] && !object[`${stem}En`]) return object[stem];
    return object[key];
  };
  const updatePositioningField = (key: string, next: unknown) => {
    const stem = key.replace(/(?:Zh|En)$/, '');
    if (stem !== 'level' && stem !== 'target') { updateCourseField(key, next); return; }
    const previous = currentObject.current;
    const updated = { ...previous, [key]: next };
    if (previous[stem] && !previous[`${stem}Zh`] && !previous[`${stem}En`]) {
      const other = key.endsWith('Zh') ? 'En' : 'Zh';
      updated[`${stem}${other}`] = previous[stem];
    }
    delete updated[stem];
    currentObject.current = updated;
    save(updated);
  };
  const update=(index:number,next:Entry)=>save(rows.map((row,i)=>i===index?next:row));
  const editingCourse = fieldKey === 'presentation' && !routeId.includes('product');
  const objectColumns=fieldKey==='venue'?venueFields:fieldKey==='presentation'?(routeId.includes('product')?productPresentation:coursePresentation):null;
  if(editingCourse)return <fieldset className="platform-structured-editor platform-course-presentation"><legend className={coursePart ? 'sr-only' : undefined}>{label}</legend>
    {(!coursePart || coursePart === 'cover') && <div className="platform-course-cover-uploads">
      <CourseCoverUpload label={t('电脑横版封面','Desktop landscape cover')} value={object.coverUrl} onChange={next=>updateCourseField('coverUrl',next)} onPending={pending=>onUploadPending?.('coverUrl',pending)} />
      <CourseCoverUpload portrait label={t('手机竖版封面（选填）','Mobile portrait cover (optional)')} value={object.mobileCoverUrl} onChange={next=>updateCourseField('mobileCoverUrl',next)} onPending={pending=>onUploadPending?.('mobileCoverUrl',pending)} />
    </div>}
    {(!coursePart || coursePart === 'positioning') && <CourseTags value={object.tags} onChange={next=>updateCourseField('tags',next)} />}
    {(!coursePart || coursePart === 'positioning' || coursePart === 'introduction') && <div className="platform-structured-fields">{coursePresentation.filter(column=>!coursePart || (coursePart === 'introduction' ? column.key === 'highlights' : column.key !== 'highlights')).map(column=><Scalar key={column.key} column={coursePart === 'introduction' ? {...column,rows:2} : column} value={positioningValue(column.key)} onChange={next=>updatePositioningField(column.key,next)} />)}</div>}
    {(!coursePart || coursePart === 'outline') && <PlatformStructuredField fieldKey="outline" label={t('课程大纲','Course outline')} value={JSON.stringify(object.outline??[])} routeId={routeId} onChange={next=>updateCourseField('outline',JSON.parse(next))} compactOutline={Boolean(coursePart)} />}
    {courseLessons && <CourseTrialSelection lessons={courseLessons} trialIds={(courseTrialCandidate || trialEdited) ? platformTrialLessonIds(object) : undefined}
      onChange={ids => { setTrialEdited(true); onCourseTrialChange?.(); updateCourseField('trialLessonIds', ids); }} />}
  </fieldset>;
  if(objectColumns)return <fieldset className="platform-structured-editor"><legend>{label}</legend><Fields columns={objectColumns} row={object} onChange={save}/></fieldset>;
  if(fieldKey==='eligibility')return <fieldset className="platform-structured-editor"><legend>{label}</legend><BoolToggle label={t('仅限会员使用','Members only')} value={object.memberOnly===true} onChange={value=>save({...object,memberOnly:value})}/>{['courseIds','productIds','productVariantIds','eventIds','eventTicketTypeIds','membershipPlanIds'].map(key=><PlatformReferenceField key={key} source={key} label={t(({courseIds:'适用课程',productIds:'适用商品',productVariantIds:'适用规格',eventIds:'适用活动',eventTicketTypeIds:'适用票种',membershipPlanIds:'适用会员套餐'} as Record<string,string>)[key],({courseIds:'Courses',productIds:'Products',productVariantIds:'Variants',eventIds:'Events',eventTicketTypeIds:'Ticket types',membershipPlanIds:'Membership plans'} as Record<string,string>)[key])} selected={Array.isArray(object[key])?(object[key] as unknown[]).map(String):[]} onChange={values=>save({...object,[key]:values})}/>)}</fieldset>;
  const add=()=>{const row=fieldKey==='variants'?{sku:'',titleZh:'',titleEn:'',amountMinor:null,currency:'CNY',inventoryOnHand:0,status:'active'}:fieldKey==='tickets'?{code:'',titleZh:'',titleEn:'',amountMinor:0,currency:'CNY',capacity:1,status:'active'}:fieldKey==='records'?{providerTransactionId:'',amountMinor:0,currency:'CNY'}:fieldKey==='questions'?{type:'single_choice',promptZh:'',promptEn:'',choices:['',''],answerKey:0,points:1}:{};save([...rows,row]);};
  if(fieldKey==='outline' && compactOutline) {
    const index=Math.min(outlineIndex,Math.max(0,rows.length-1));
    const move=(offset:number)=>{const next=[...rows];[next[index],next[index+offset]]=[next[index+offset],next[index]];save(next);setOutlineIndex(index+offset);};
    const sections=rows.map((row,i)=>({value:String(i),label:`${i+1}. ${String(row.label || t('未命名章节','Untitled section'))}`}));
    return <div className="platform-wizard-outline">
      <div className="platform-wizard-outline-toolbar">
        {rows.length>0 && <div className="platform-form-select-field"><span>{t('编辑章节','Edit section')}</span><CompactSelect className="platform-form-select" triggerClassName="platform-field-control" unstyledTrigger showArrow label={sections[index].label} ariaLabel={t('编辑章节','Edit section')} value={String(index)} items={sections} onChange={next=>setOutlineIndex(Number(next))} /></div>}
        <button type="button" className="platform-button" onClick={()=>{add();setOutlineIndex(rows.length);}}>{t('添加章节','Add section')}</button>
      </div>
      {rows.length>0 && <><Fields key={index} row={rows[index]} onChange={next=>update(index,next)} columns={[{key:'label',zh:'章节',en:'Section',required:true},{key:'topic',zh:'内容',en:'Topic',kind:'textarea'}]}/><div className="platform-write-actions"><button type="button" className="platform-button" disabled={index===0} onClick={()=>move(-1)}>{t('上移','Move up')}</button><button type="button" className="platform-button" disabled={index===rows.length-1} onClick={()=>move(1)}>{t('下移','Move down')}</button><button type="button" className="platform-button" onClick={()=>save(rows.filter((_,i)=>i!==index))}>{t('移除此项','Remove item')}</button></div></>}
    </div>;
  }
  return <fieldset className="platform-structured-editor"><legend>{label}</legend>{loadError?<p role="alert">{loadError}</p>:null}{rows.map((row,index)=><section className="platform-structured-row" key={index}><strong>{index+1}</strong>{fieldKey==='items'?<PathItem row={row} onChange={next=>update(index,next)} courses={courses}/>:fieldKey==='questions'?<Question row={{...row,editorKey:`question-${index}`}} onChange={next=>update(index,next)}/>:<Fields row={row} onChange={next=>update(index,next)} columns={fieldKey==='variants'?variantFields:fieldKey==='tickets'?ticketFields:fieldKey==='records'?[{key:'providerTransactionId',zh:'渠道流水号',en:'Provider transaction reference',required:true},{key:'amountMinor',zh:'收付金额（元；退款填负数）',en:'Amount (major units; negative for refunds)',kind:'money',signed:true,required:true},{key:'currency',zh:'币种',en:'Currency',required:true}]:[{key:'label',zh:'章节',en:'Section',required:true},{key:'topic',zh:'内容',en:'Topic',kind:'textarea'}]}/>}{['variants','tickets'].includes(fieldKey)?<label>{t('状态','Status')}<select className="platform-field-control" value={String(row.status??'active')} onChange={event=>update(index,{...row,status:event.target.value})}><option value="active">{t('销售中','Available')}</option><option value="sold_out">{t('售罄','Sold out')}</option><option value="archived">{t('已归档','Archived')}</option></select></label>:null}<div className="platform-write-actions"><button type="button" className="platform-button" disabled={index===0} onClick={()=>{const next=[...rows];[next[index-1],next[index]]=[next[index],next[index-1]];save(next);}}>{t('上移','Move up')}</button><button type="button" className="platform-button" disabled={index===rows.length-1} onClick={()=>{const next=[...rows];[next[index],next[index+1]]=[next[index+1],next[index]];save(next);}}>{t('下移','Move down')}</button><button type="button" className="platform-button" onClick={()=>save(rows.filter((_,i)=>i!==index))}>{t('移除此项','Remove item')}</button></div></section>)}<button type="button" className="platform-button" onClick={add}>{t('添加一项','Add item')}</button></fieldset>;
}
