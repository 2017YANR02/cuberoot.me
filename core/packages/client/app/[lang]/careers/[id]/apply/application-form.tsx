'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import { CONTACT_WECHAT_ID } from '@cuberoot/shared/contact';
import { apiUrl } from '@/lib/api-base';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import type { CareerPosition } from '../../positions';

export default function ApplicationForm({ position }: { position: CareerPosition }) {
  const [preview, setPreview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [resume, setResume] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [available, setAvailable] = useState<'checking' | 'yes' | 'no'>('checking');
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl('/v1/career-applications/status'), { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok && (await response.json()).available === true)
      .then(ready => { if (!controller.signal.aborted) setAvailable(ready ? 'yes' : 'no'); })
      .catch(() => { if (!controller.signal.aborted) setAvailable('no'); });
    return () => controller.abort();
  }, []);
  const [values, setValues] = useState({ name: '', phone: '', email: '', education: '', experience: '', channel: '' });
  const update = (field: keyof typeof values, value: string) => setValues(current => ({ ...current, [field]: value }));
  const showPreview = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!consent) { setConsentError(true); return; } setConsentError(false); setPreview(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submitApplication = async () => {
    if (!resume || sending.current || available !== 'yes') return;
    sending.current = true; setStatus('sending');
    const body = new FormData();
    requestId.current ??= crypto.randomUUID();
    for (const [key, value] of Object.entries({ id: requestId.current, position: position.id, city: 'shanghai', ...values, consent: 'yes' })) body.set(key, value);
    body.set('resume', resume); if (photo) body.set('photo', photo);
    try {
      const response = await fetch(apiUrl('/v1/career-applications'), { method: 'POST', body, cache: 'no-store' });
      if (!response.ok) throw new Error('Submission failed');
      setStatus('success');
      setResume(null); setPhoto(null);
      setValues({ name: '', phone: '', email: '', education: '', experience: '', channel: '' });
    } catch { setStatus('error'); } finally { sending.current = false; }
  };
  return <main className="careers-page careers-application">
    <AppLink className="back-home" href={`/careers/${position.id}`} prefetch={false} aria-label={tr({ zh: '返回职位详情', en: 'Back to position' })}><ChevronLeft size={16} aria-hidden /></AppLink>
    <article className="careers-application-card" data-site-surface="panel">
      <header className="careers-application-header"><p>CubeRoot</p><h1>{tr(position.title)}</h1><p>{tr(position.category)} · {tr({ zh: '上海', en: 'Shanghai' })}</p></header>
      <div className="careers-application-body">
        <div className="careers-application-content">
          <p className="careers-application-notice">{tr({ zh: '提交后，申请信息和附件将保存至 CubeRoot 管理后台，用于招聘评估。', en: 'After submission, your application and attachments will be stored in the CubeRoot administration system for recruitment review.' })}</p>
          {available !== 'yes' && <p role="status">{available === 'checking' ? tr({ zh: '正在检查投递服务…', en: 'Checking application service…' }) : <>{tr({ zh: '在线投递暂不可用，请稍后重试或通过微信联系', en: 'Online applications are unavailable. Please try again later or contact us on WeChat:' })} <strong>{CONTACT_WECHAT_ID}</strong>。</>}</p>}
          {status === 'success' ? <p role="status">{tr({ zh: '申请已提交，我们会通过你提供的联系方式联系你。', en: 'Your application has been submitted. We will contact you using the details provided.' })}</p> : <>
          {preview ? <section><h2>{tr({ zh: '申请预览', en: 'Application preview' })}</h2>
            <dl className="careers-preview"><dt>{tr({ zh: '意向工作城市', en: 'Preferred city' })}</dt><dd>{tr({ zh: '上海', en: 'Shanghai' })}</dd><dt>{tr({ zh: '简历', en: 'Resume' })}</dt><dd>{resume?.name}</dd>{photo && <><dt>{tr({ zh: '照片', en: 'Photo' })}</dt><dd>{photo?.name}</dd></>}{Object.entries({ [tr({ zh: '姓名', en: 'Name' })]: values.name, [tr({ zh: '手机号码', en: 'Phone' })]: values.phone, [tr({ zh: '邮箱', en: 'Email' })]: values.email, [tr({ zh: '最高学历', en: 'Education' })]: values.education, [tr({ zh: '工作经历', en: 'Experience' })]: values.experience, [tr({ zh: '招聘渠道', en: 'Source' })]: values.channel }).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {status === 'error' && <p role="alert">{tr({ zh: '提交结果暂未确认，请检查文件格式和大小后重试。', en: 'The submission could not be confirmed. Check file type and size, then retry.' })}</p>}
            <button className="careers-apply" type="button" disabled={status === 'sending' || available !== 'yes'} onClick={() => void submitApplication()}>{tr({ zh: '提交申请', en: 'Submit application' })}</button>{' '}
            <button className="careers-apply" type="button" disabled={status === 'sending'} onClick={() => { requestId.current = null; setStatus('idle'); setPreview(false); }}>{tr({ zh: '返回修改', en: 'Edit application' })}</button>
          </section> : null}
          <div hidden={preview}><form onSubmit={showPreview}>
            <section id="career-application-info"><h2>{tr({ zh: '申请信息', en: 'Application' })}</h2><label>{tr({ zh: '意向工作城市', en: 'Preferred city' })}<select className="careers-field" required defaultValue=""><option value="" disabled>{tr({ zh: '选择意向工作城市', en: 'Select a city' })}</option><option value="shanghai">{tr({ zh: '上海', en: 'Shanghai' })}</option></select></label></section>
            <section id="career-application-uploads"><h2>{tr({ zh: '上传', en: 'Uploads' })}</h2><label>{tr({ zh: '上传简历', en: 'Resume' })}<input className="careers-field careers-field--file" type="file" required accept=".pdf,.doc,.docx,.txt" onChange={event => setResume(event.currentTarget.files?.[0] ?? null)} /></label><small>{tr({ zh: '简历支持 PDF、DOC、DOCX 或 TXT，不超过 5 MB。照片支持 JPG 或 PNG，不超过 2 MB。', en: 'Resume: PDF, DOC, DOCX or TXT up to 5 MB. Photo: JPG or PNG up to 2 MB.' })}</small><label>{tr({ zh: '上传照片（选填）', en: 'Photo (optional)' })}<input className="careers-field careers-field--file" type="file" accept="image/jpeg,image/png" onChange={event => setPhoto(event.currentTarget.files?.[0] ?? null)} /></label></section>
            <section id="career-application-personal"><h2>{tr({ zh: '个人信息', en: 'Personal information' })}</h2><div className="careers-form-grid">
              <label>{tr({ zh: '姓名', en: 'Name' })}<input className="careers-field" required maxLength={100} value={values.name} onChange={event => update('name', event.target.value)} /></label>
              <label>{tr({ zh: '手机号码', en: 'Phone' })}<input className="careers-field" required type="tel" maxLength={32} value={values.phone} onChange={event => update('phone', event.target.value)} /></label>
              <label>{tr({ zh: '邮箱', en: 'Email' })}<input className="careers-field" required type="email" maxLength={254} value={values.email} onChange={event => update('email', event.target.value)} /></label>
              <label>{tr({ zh: '最高学历（选填）', en: 'Education (optional)' })}<input className="careers-field" maxLength={100} value={values.education} onChange={event => update('education', event.target.value)} /></label>
              <label>{tr({ zh: '工作经历（选填）', en: 'Experience (optional)' })}<input className="careers-field" maxLength={200} value={values.experience} onChange={event => update('experience', event.target.value)} /></label>
              <label>{tr({ zh: '招聘渠道（选填）', en: 'How you found us (optional)' })}<input className="careers-field" maxLength={100} value={values.channel} onChange={event => update('channel', event.target.value)} /></label>
            </div></section>
            <section id="career-application-declaration"><h2>{tr({ zh: '声明', en: 'Declaration' })}</h2><BoolToggle label={tr({ zh: '本人确认以上信息真实有效，并同意为招聘评估保存和使用所提交的资料。', en: 'I confirm the information is accurate and consent to its storage and use for recruitment review.' })} value={consent} onChange={value => { setConsent(value); setConsentError(false); }} />{consentError && <p role="alert">{tr({ zh: '请先确认声明。', en: 'Please confirm the declaration.' })}</p>}</section>
            <button className="careers-apply" type="submit">{tr({ zh: '预览申请', en: 'Preview application' })}</button>
          </form></div></> }
        </div>
        {!preview && status !== 'success' && <nav className="careers-application-nav" aria-label={tr({ zh: '申请表目录', en: 'Application sections' })}><a href="#career-application-info">{tr({ zh: '申请信息', en: 'Application' })}</a><a href="#career-application-uploads">{tr({ zh: '上传', en: 'Uploads' })}</a><a href="#career-application-personal">{tr({ zh: '个人信息', en: 'Personal information' })}</a><a href="#career-application-declaration">{tr({ zh: '声明', en: 'Declaration' })}</a></nav>}
      </div>
    </article>
  </main>;
}
