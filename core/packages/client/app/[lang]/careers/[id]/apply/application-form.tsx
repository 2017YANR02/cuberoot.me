'use client';

import PageBackLink from '@/components/PageBackLink';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { CAREER_WORK_ARRANGEMENTS, CAREER_WORK_ARRANGEMENT_IDS, type CareerWorkArrangementId } from '@cuberoot/shared/careers';
import { CONTACT_WECHAT_ID } from '@cuberoot/shared/contact';
import { apiUrl } from '@/lib/api-base';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { careerLocation, type CareerPosition } from '../../positions';

export default function ApplicationForm({ position }: { position: CareerPosition }) {
  const [workArrangement, setWorkArrangement] = useState<CareerWorkArrangementId | ''>('');
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
  const [values, setValues] = useState({ name: '', phone: '', email: '', education: '', experience: '', channel: '', computer: '', mobile: '', aiTools: '', aiSubscriptionCost: '', github: '', website: '' });
  const update = (field: keyof typeof values, value: string) => setValues(current => ({ ...current, [field]: value }));
  const showPreview = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!consent) { setConsentError(true); return; } setConsentError(false); setPreview(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submitApplication = async () => {
    if (!resume || !workArrangement || sending.current || available !== 'yes') return;
    sending.current = true; setStatus('sending');
    const body = new FormData();
    requestId.current ??= crypto.randomUUID();
    for (const [key, value] of Object.entries({ id: requestId.current, position: position.id, city: workArrangement, ...values, consent: 'yes' })) body.set(key, value);
    body.set('resume', resume); if (photo) body.set('photo', photo);
    try {
      const response = await fetch(apiUrl('/v1/career-applications'), { method: 'POST', body, cache: 'no-store' });
      if (!response.ok) throw new Error('Submission failed');
      setStatus('success');
      setResume(null); setPhoto(null);
      setValues({ name: '', phone: '', email: '', education: '', experience: '', channel: '', computer: '', mobile: '', aiTools: '', aiSubscriptionCost: '', github: '', website: '' });
    } catch { setStatus('error'); } finally { sending.current = false; }
  };
  return <main className="careers-page careers-application">
    <PageBackLink className="back-home" fallback={`/careers/${position.id}`} prefetch={false} />
    <article className="careers-application-card" data-site-surface="panel">
      <header className="careers-application-header"><p>CubeRoot</p><h1>{tr(position.title)}</h1><p>{tr(position.category)} · {tr(careerLocation)}</p></header>
      <div className="careers-application-body">
        <div className="careers-application-content">
          <p className="careers-application-notice">{tr({ zh: '提交后，申请信息和附件将保存至 CubeRoot 管理后台，用于招聘评估。', en: 'After submission, your application and attachments will be stored in the CubeRoot administration system for recruitment review.' })}</p>
          {available !== 'yes' && <p role="status">{available === 'checking' ? tr({ zh: '正在检查投递服务…', en: 'Checking application service…' }) : <>{tr({ zh: '在线投递暂不可用，请稍后重试或通过微信联系', en: 'Online applications are unavailable. Please try again later or contact us on WeChat:' })} <strong>{CONTACT_WECHAT_ID}</strong>。</>}</p>}
          {status === 'success' ? <p role="status">{tr({ zh: '申请已提交，我们会通过你提供的联系方式联系你。', en: 'Your application has been submitted. We will contact you using the details provided.' })}</p> : <>
          {preview ? <section><h2>{tr({ zh: '申请预览', en: 'Application preview' })}</h2>
            <dl className="careers-preview"><dt>{tr({ zh: '工作方式', en: 'Work arrangement' })}</dt><dd>{workArrangement ? tr(CAREER_WORK_ARRANGEMENTS[workArrangement]) : ''}</dd><dt>{tr({ zh: '简历', en: 'Resume' })}</dt><dd>{resume?.name}</dd>{photo && <><dt>{tr({ zh: '照片', en: 'Photo' })}</dt><dd>{photo?.name}</dd></>}{Object.entries({ [tr({ zh: '姓名', en: 'Name' })]: values.name, [tr({ zh: '手机号码', en: 'Phone' })]: values.phone, [tr({ zh: '邮箱', en: 'Email' })]: values.email, [tr({ zh: '最高学历', en: 'Education' })]: values.education, [tr({ zh: '工作经历', en: 'Experience' })]: values.experience, [tr({ zh: '招聘渠道', en: 'Source' })]: values.channel, [tr({ zh: '电脑系统与型号', en: 'Computer OS and model' })]: values.computer, [tr({ zh: '手机系统与型号', en: 'Phone OS and model' })]: values.mobile, [tr({ zh: '使用的 AI 模型或工具', en: 'AI models or tools used' })]: values.aiTools, [tr({ zh: '套餐总费用', en: 'Total subscription cost' })]: values.aiSubscriptionCost, [tr({ zh: 'GitHub 仓库', en: 'GitHub repository' })]: values.github, [tr({ zh: '个人网站', en: 'Personal website' })]: values.website }).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {status === 'error' && <p role="alert">{tr({ zh: '提交结果暂未确认，请检查文件格式和大小后重试。', en: 'The submission could not be confirmed. Check file type and size, then retry.' })}</p>}
            <button className="careers-apply" type="button" disabled={status === 'sending' || available !== 'yes'} onClick={() => void submitApplication()}>{tr({ zh: '提交申请', en: 'Submit application' })}</button>{' '}
            <button className="careers-apply" type="button" disabled={status === 'sending'} onClick={() => { requestId.current = null; setStatus('idle'); setPreview(false); }}>{tr({ zh: '返回修改', en: 'Edit application' })}</button>
          </section> : null}
          <div hidden={preview}><form onSubmit={showPreview}>
            <section id="career-application-info"><h2>{tr({ zh: '申请信息', en: 'Application' })}</h2><label>{tr({ zh: '工作方式', en: 'Work arrangement' })}<select className="careers-field" required value={workArrangement} onChange={event => setWorkArrangement(event.target.value as CareerWorkArrangementId)}><option value="" disabled>{tr({ zh: '选择工作方式', en: 'Select a work arrangement' })}</option>{CAREER_WORK_ARRANGEMENT_IDS.map(id => <option key={id} value={id}>{tr(CAREER_WORK_ARRANGEMENTS[id])}</option>)}</select></label></section>
            <section id="career-application-uploads"><h2>{tr({ zh: '上传', en: 'Uploads' })}</h2><label>{tr({ zh: '上传简历', en: 'Resume' })}<input className="careers-field careers-field--file" type="file" required accept=".pdf,.doc,.docx,.txt" onChange={event => setResume(event.currentTarget.files?.[0] ?? null)} /></label><small>{tr({ zh: '简历支持 PDF、DOC、DOCX 或 TXT，不超过 5 MB。照片支持 JPG 或 PNG，不超过 2 MB。', en: 'Resume: PDF, DOC, DOCX or TXT up to 5 MB. Photo: JPG or PNG up to 2 MB.' })}</small><label>{tr({ zh: '上传照片（选填）', en: 'Photo (optional)' })}<input className="careers-field careers-field--file" type="file" accept="image/jpeg,image/png" onChange={event => setPhoto(event.currentTarget.files?.[0] ?? null)} /></label></section>
            <section id="career-application-personal"><h2>{tr({ zh: '个人信息', en: 'Personal information' })}</h2><div className="careers-form-grid">
              <label>{tr({ zh: '姓名', en: 'Name' })}<input className="careers-field" required maxLength={100} value={values.name} onChange={event => update('name', event.target.value)} /></label>
              <label>{tr({ zh: '手机号码', en: 'Phone' })}<input className="careers-field" required type="tel" maxLength={32} value={values.phone} onChange={event => update('phone', event.target.value)} /></label>
              <label>{tr({ zh: '邮箱', en: 'Email' })}<input className="careers-field" required type="email" maxLength={254} value={values.email} onChange={event => update('email', event.target.value)} /></label>
              <label>{tr({ zh: '最高学历（选填）', en: 'Education (optional)' })}<input className="careers-field" maxLength={100} value={values.education} onChange={event => update('education', event.target.value)} /></label>
              <label>{tr({ zh: '工作经历（选填）', en: 'Experience (optional)' })}<input className="careers-field" maxLength={200} value={values.experience} onChange={event => update('experience', event.target.value)} /></label>
              <label>{tr({ zh: '招聘渠道（选填）', en: 'How you found us (optional)' })}<input className="careers-field" maxLength={100} value={values.channel} onChange={event => update('channel', event.target.value)} /></label>
            </div></section>
            <section id="career-application-links"><h2>{tr({ zh: '个人作品', en: 'Your work' })}</h2><div className="careers-form-grid">
              <label>{tr({ zh: 'GitHub 仓库（选填）', en: 'GitHub repository (optional)' })}<input className="careers-field" type="url" maxLength={2000} placeholder="https://github.com/username/repository" value={values.github} onChange={event => update('github', event.target.value)} /></label>
              <label>{tr({ zh: '个人网站（选填）', en: 'Personal website (optional)' })}<input className="careers-field" type="url" maxLength={2000} placeholder="https://example.com" value={values.website} onChange={event => update('website', event.target.value)} /></label>
            </div></section>
            <section id="career-application-devices"><h2>{tr({ zh: '使用设备', en: 'Your devices' })}</h2><div className="careers-form-grid">
              <label>{tr({ zh: '电脑系统与具体型号（没有请填“无”）', en: 'Computer OS and exact model (enter “None” if unavailable)' })}<input className="careers-field" required maxLength={200} placeholder={tr({ zh: '如 Windows 11 · 联想小新 Pro 16 2024；macOS · MacBook Air M3 13 英寸', en: 'e.g. Windows 11 · Lenovo Yoga Pro 7 14IMH9; macOS · MacBook Air M3 13-inch' })} value={values.computer} onChange={event => update('computer', event.target.value)} /></label>
              <label>{tr({ zh: '手机系统与具体型号（没有请填“无”）', en: 'Phone OS and exact model (enter “None” if unavailable)' })}<input className="careers-field" required maxLength={200} placeholder={tr({ zh: '如 iOS · iPhone 16 Pro；Android · 小米 15', en: 'e.g. iOS · iPhone 16 Pro; Android · Xiaomi 15' })} value={values.mobile} onChange={event => update('mobile', event.target.value)} /></label>
            </div></section>
            <section id="career-application-ai"><h2>{tr({ zh: 'AI 使用情况', en: 'AI usage' })}</h2><div className="careers-form-grid">
              <label>{tr({ zh: '使用的 AI 模型或工具（可填多个）', en: 'AI models or tools used (multiple allowed)' })}<textarea className="careers-field" required rows={3} maxLength={500} placeholder={tr({ zh: '如 Claude、Codex、ChatGPT，可用顿号或换行分隔；未使用请填“无”', en: 'e.g. Claude, Codex, ChatGPT. Separate with commas or new lines; enter “None” if unused.' })} value={values.aiTools} onChange={event => update('aiTools', event.target.value)} /></label>
              <label>{tr({ zh: '套餐总费用（金额、币种及计费周期）', en: 'Total subscription cost (amount, currency and billing period)' })}<input className="careers-field" required maxLength={200} placeholder={tr({ zh: '填写所有套餐合计，如 300 元/月或 40 美元/月；免费使用填 0', en: 'Total across all subscriptions, e.g. CNY 300/month or USD 40/month; enter 0 for free use.' })} value={values.aiSubscriptionCost} onChange={event => update('aiSubscriptionCost', event.target.value)} /></label>
            </div></section>
            <section id="career-application-declaration"><h2>{tr({ zh: '声明', en: 'Declaration' })}</h2><BoolToggle label={tr({ zh: '本人确认以上信息真实有效，并同意为招聘评估保存和使用所提交的资料。', en: 'I confirm the information is accurate and consent to its storage and use for recruitment review.' })} value={consent} onChange={value => { setConsent(value); setConsentError(false); }} />{consentError && <p role="alert">{tr({ zh: '请先确认声明。', en: 'Please confirm the declaration.' })}</p>}</section>
            <button className="careers-apply" type="submit">{tr({ zh: '预览申请', en: 'Preview application' })}</button>
          </form></div></> }
        </div>
        {!preview && status !== 'success' && <nav className="careers-application-nav" aria-label={tr({ zh: '申请表目录', en: 'Application sections' })}><a href="#career-application-info">{tr({ zh: '申请信息', en: 'Application' })}</a><a href="#career-application-uploads">{tr({ zh: '上传', en: 'Uploads' })}</a><a href="#career-application-personal">{tr({ zh: '个人信息', en: 'Personal information' })}</a><a href="#career-application-links">{tr({ zh: '个人作品', en: 'Your work' })}</a><a href="#career-application-devices">{tr({ zh: '使用设备', en: 'Your devices' })}</a><a href="#career-application-ai">{tr({ zh: 'AI 使用情况', en: 'AI usage' })}</a><a href="#career-application-declaration">{tr({ zh: '声明', en: 'Declaration' })}</a></nav>}
      </div>
    </article>
  </main>;
}
