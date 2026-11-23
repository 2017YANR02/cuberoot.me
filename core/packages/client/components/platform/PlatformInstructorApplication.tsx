'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CircleAlert, CircleCheck, CircleX, Clock3, Undo2 } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import type { PlatformEntity } from '@/lib/platform-types';
import { ActionButton, DomainForm } from './PlatformForm';
import { INSTRUCTOR_APPLICATION_FIELDS, text } from './PlatformFormDefinitions';
import { type CommonProps } from './PlatformActionTypes';
import { instructorApplicationStatus } from './PlatformRouteHelpers';
import { InstructorAdmissionIntro, INSTRUCTOR_APPLICATION_START } from './PlatformInstructorAdmission';
import { normalizeDirectoryImages } from '@/lib/teacher-directory-api';
import { CONTACT_FIELDS } from '@/lib/teacher-directory-presentation';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function valueText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function ApplicationOverview({ state, title, description, children }: { state: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'unavailable'; title: string; description?: string; children?: ReactNode }) {
  const Icon = state === 'approved' ? CircleCheck : state === 'pending' ? Clock3 : state === 'rejected' ? CircleX : state === 'withdrawn' ? Undo2 : CircleAlert;
  return <section className="platform-application-overview" data-application-state={state}>
    <div className="platform-application-overview-copy">
      <Icon className="platform-application-state-icon" size={24} aria-hidden />
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    </div>
    {children && <div className="platform-application-overview-actions">{children}</div>}
  </section>;
}

export function InstructorApplicationDetails({ entity, admin = false, embedded = false, showFeedback = true }: { entity: PlatformEntity; admin?: boolean; embedded?: boolean; showFeedback?: boolean }) {
  const t = useT();
  const data = entity.data ?? {};
  const application = record(data.application);
  const homepage=record(application.homepage), photos=normalizeDirectoryImages(homepage.images);
  const publicContacts=record(homepage.contacts);
  const list = (value: unknown) => Array.isArray(value) ? value.filter(item => typeof item === 'string').join(t('、', ', ')) : valueText(value);
  const teachingMode = application.teachingMode === 'online' ? t('线上', 'Online') : application.teachingMode === 'in_person' ? t('线下', 'In person') : application.teachingMode === 'both' ? t('线上及线下', 'Both') : list(application.formats);
  const groups = [
    { title: t('讲师公开资料', 'Public teaching profile'), fields: [[t('公开姓名', 'Public name'), valueText(application.publicName)], [t('英文姓名', 'English name'), valueText(application.publicNameEn)], [t('公开简介', 'Public biography'), valueText(application.publicBio)], [t('英文简介','English biography'),valueText(homepage.descriptionEn)],[t('英文地点','Location in English'),valueText(homepage.locationEn)],[t('英文擅长方向','English specialties'),list(homepage.specialtiesEn)],[t('个人网站','Website'),valueText(homepage.website)],...CONTACT_FIELDS.map(field=>[t(field.label.zh,field.label.en),valueText(publicContacts[field.key])]), [t('名录展示', 'Directory visibility'), application.profileDeferred===true?t('以后再设置，暂不公开','Set up later; hidden for now'):typeof application.profileVisible === 'boolean' ? application.profileVisible ? t('公开', 'Public') : t('隐藏', 'Hidden') : '']] },
    { title: t('授课信息', 'Teaching details'), fields: [[t('所在城市', 'City'), valueText(application.city)], [t('授课方式', 'Teaching mode'), teachingMode]] },
    { title: t('教学能力', 'Teaching experience'), fields: [[t('擅长方向', 'Specialties'), list(application.specialties)], [t('教学经历', 'Teaching experience'), valueText(application.experience) || valueText(application.introduction)], [t('教学成果及作品', 'Achievements and portfolio'), valueText(application.achievements)]] },
    { title: t('审核联系方式', 'Contact for review'), fields: [[t('联系方式', 'Contact details'), valueText(application.contact)]] },
  ];
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(t('zh-CN', 'en-US'), { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const submitted = date(data.createdAt), reviewed = date(data.decidedAt);
  return <section className="platform-domain-content platform-application-details">
    {!embedded && <div className="platform-application-detail-head">
      <h2>{admin ? valueText(data.applicantDisplayName) || t('未知申请人', 'Unknown applicant') : t('申请资料', 'Application details')}</h2>
      {admin && <span className="platform-status platform-application-status" data-application-state={entity.status}>{instructorApplicationStatus(entity.status ?? '', t)}</span>}
    </div>}
    <div className="platform-application-meta">
      {admin && valueText(data.wcaId) && <span>WCA ID: {valueText(data.wcaId)}</span>}
      {submitted && <span>{t('申请时间', 'Submitted')} <time dateTime={String(data.createdAt)}>{submitted}</time></span>}
      {reviewed && <span>{t('处理时间', 'Reviewed')} <time dateTime={String(data.decidedAt)}>{reviewed}</time></span>}
    </div>
    {groups.map(group => {
      const fields = group.fields.filter(([, value]) => value);
      return fields.length ? <section className="platform-application-detail-group" key={group.title}>
        <h3>{group.title}</h3>
        <dl className="platform-application-fields" data-layout={group === groups[0] ? 'paired' : 'stacked'}>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section> : null;
    })}
    {photos.length>0&&<section className="platform-application-detail-group"><h3>{t('公开主页照片','Public profile photos')}</h3><div className="directory-gallery">{photos.map(photo=><figure key={photo.id}><img src={photo.url} alt={t(photo.captionZh||photo.captionEn,photo.captionEn||photo.captionZh)} loading="lazy"/>{(photo.captionZh||photo.captionEn)&&<figcaption>{t(photo.captionZh||photo.captionEn,photo.captionEn||photo.captionZh)}</figcaption>}</figure>)}</div></section>}
    {showFeedback && valueText(data.decisionNote) && <section className="platform-application-detail-group"><h3>{t('审核意见', 'Review feedback')}</h3><p className="platform-application-feedback">{valueText(data.decisionNote)}</p></section>}
    {admin && <>
      <section className="platform-application-detail-group"><h3>{t('已有讲师资料', 'Existing teaching profiles')}</h3>
        {Array.isArray(data.profiles) && data.profiles.length ? data.profiles.map((raw, index) => { const profile = record(raw); return <div className="platform-application-profile" key={index}><span>{t(valueText(profile.nameZh) || valueText(profile.nameEn), valueText(profile.nameEn) || valueText(profile.nameZh))}</span><span className="platform-application-meta">{profile.isVisible === true ? t('公开设置', 'Public preference') : t('隐藏设置', 'Hidden preference')}</span></div>; }) : <p>{t('审核通过时自动建立讲师资料。', 'A teaching profile is created automatically on approval.')}</p>}
      </section>
      {Array.isArray(data.history) && data.history.length > 0 && <details className="platform-application-history"><MoreToggle as="summary">{t('历史申请', 'Previous applications')}</MoreToggle>{data.history.map((raw, index) => { const entry = record(raw); return <div className="platform-application-history-row" key={index}><div className="platform-application-meta"><span>{date(entry.createdAt)}</span><span>{instructorApplicationStatus(String(entry.status), t)}</span></div>{valueText(entry.decisionNote) && <p>{valueText(entry.decisionNote)}</p>}</div>; })}</details>}
    </>}
  </section>;
}

export function PlatformInstructorApplication(props: CommonProps) {
  const { entity, definition, runAction, busy } = props;
  const t = useT();
  const user = useAuthUser();
  const router=useEntryRouter();
  const editing=definition.id==='teacher-apply-start';
  const data = entity?.data ?? {};
  const status = entity?.status;
  const role = data.instructorStatus;
  const linked = data.teacherEntryId;
  const formEntity = useMemo(() => {
    const accountName=valueText(user?.name).trim();
    const defaultName=/^\d+$/.test(accountName)?'':accountName;
    const entries = Array.isArray(entity?.data?.directoryProfiles) ? entity.data.directoryProfiles.map(record) : [];
    const existing = entries.length === 1 ? entries[0] : {};
    const previous=record(entity?.data?.application);
    const existingHomepage=entries.length===1?existing:undefined;
    return { ...entity, id:entity?.id??'application', title:entity?.title??'', data: {
      publicName: valueText(existing.nameZh) || valueText(existing.nameEn) || defaultName,
      publicNameEn: valueText(existing.nameEn),
      publicBio: valueText(existing.descriptionZh) || valueText(existing.descriptionEn),
      profileVisible: existing.isVisible === true,
      city: valueText(existing.locationZh), specialties: existing.specialtiesZh, teachingMode: existing.teachingMode,
      ...previous,
      homepage:role==='archived'&&existingHomepage?existingHomepage:previous.homepage??existingHomepage,
      wcaId:user?.wcaId??'',
    } };
  }, [entity,user?.name,user?.wcaId,role]);

  if (role === 'suspended') return <div className="platform-application-flow"><ApplicationOverview state="unavailable" title={t('讲师权限已暂停', 'Instructor access is suspended')} description={t('请联系管理员恢复权限。', 'Contact an administrator to restore access.')} /></div>;
  if (role === 'active') return <div className="platform-domain-stack platform-application-flow">
    <ApplicationOverview state="approved" title={t('已成为讲师', 'You are an instructor')} description={t('你可以管理课程、学员及收益。', 'Manage your courses, learners and earnings.')}>
      <AppLink className="platform-button platform-button-primary" href="/platform/instructor" prefetch={false}>{t('进入讲师工作台', 'Open instructor workspace')}<ArrowRight aria-hidden /></AppLink>
    </ApplicationOverview>
    <section className="platform-application-profile-section"><h2>{t('讲师身份管理', 'Instructor account')}</h2><AppLink className="platform-button" href="/platform/instructor/profile" prefetch={false}>{t('编辑公开资料', 'Edit public profile')}</AppLink>
      <button type="button" className="platform-button" disabled={Boolean(busy)} onClick={() => {
        if (!window.confirm(t('确定注销讲师身份吗？注销后将关闭讲师工作台权限、隐藏公开讲师资料并停用课程归属权限，历史记录不会删除。请先处理未结算收益；再次入驻需要重新审核。', 'Deactivate your instructor account? Workspace access and course ownership permissions will be revoked, and your public profile will be hidden. History is preserved. Settle outstanding earnings first; rejoining requires approval.'))) return;
        void runAction('archive-instructor');
      }}>{busy === 'archive-instructor' ? t('处理中…', 'Working…') : t('注销讲师身份', 'Deactivate instructor account')}</button>
    </section>
    {data.instructorProfileKnown !== false && <section className="platform-application-profile-section">
      <h2>{t('公开讲师资料', 'Public teaching profile')}</h2>
      {linked != null ? <div className="platform-application-profile"><p>{data.profileVisible === true ? t('已在讲师名录公开展示', 'Visible in the teacher directory') : t('当前资料已隐藏', 'Profile is hidden')}</p></div> : <>
        <p>{t('申请中的私人联系信息不会自动公开。', 'Private application contact details are not published automatically.')}</p>
        <p>{t('请在讲师工作台的讲师资料中确认历史资料。', 'Resolve legacy teaching profiles in the instructor workspace.')}</p>
      </>}
    </section>}
    {entity && status && <details className="platform-application-history"><MoreToggle as="summary">{t('查看原申请资料', 'View original application')}</MoreToggle><InstructorApplicationDetails entity={entity} embedded /></details>}
  </div>;

  if (entity && status === 'pending') return <div className="platform-domain-stack platform-application-flow">
    <ApplicationOverview state="pending" title={t('申请已提交，等待审核', 'Application submitted — pending review')} description={t('审核结果会通过站内消息通知你。', 'You will receive an in-site notification with the result.')}>
      <button type="button" className="platform-button" disabled={Boolean(busy)} onClick={props.onSaved}>{t('刷新审核状态', 'Refresh status')}</button>
      <ActionButton action="withdraw-instructor-application" resourceId={entity.id} label={text('撤回申请', 'Withdraw application')} secondary confirm={text('撤回后可以重新提交申请。确认撤回？', 'You can apply again after withdrawing. Withdraw now?')} busy={busy} runAction={runAction} />
    </ApplicationOverview>
    <InstructorApplicationDetails entity={entity} />
  </div>;

  if (entity && (status === 'rejected' || status === 'withdrawn') && !editing) return <div className="platform-domain-stack platform-application-flow">
    <ApplicationOverview state={status} title={status === 'rejected' ? t('申请未通过', 'Application not approved') : t('申请已撤回', 'Application withdrawn')} description={valueText(data.decisionNote) || (status === 'withdrawn' ? t('你可以修改资料后重新申请。', 'You can update the details and apply again.') : undefined)}>
      <AppLink className="platform-button platform-button-primary" href={INSTRUCTOR_APPLICATION_START} prefetch={false}>{t('修改并重新申请', 'Edit and apply again')}<ArrowRight aria-hidden /></AppLink>
    </ApplicationOverview>
    <InstructorApplicationDetails entity={entity} showFeedback={false} />
  </div>;

  if (entity && !editing && (role === 'archived' || (status === 'approved' && role === null))) return <div className="platform-domain-stack platform-application-flow">
    <ApplicationOverview state="unavailable" title={t('讲师身份已结束', 'Instructor access has ended')} description={t('你可以重新提交申请，审核通过后恢复讲师权限。', 'Apply again to restore instructor access after approval.')}>
      <AppLink className="platform-button platform-button-primary" href={INSTRUCTOR_APPLICATION_START} prefetch={false}>{t('修改并重新申请', 'Edit and apply again')}<ArrowRight aria-hidden /></AppLink>
    </ApplicationOverview>
    {status && <InstructorApplicationDetails entity={entity} showFeedback={false} />}
  </div>;

  if (entity && status === 'approved' && role !== 'archived' && role !== null) return <div className="platform-application-flow"><ApplicationOverview state="unavailable" title={t('暂无法确认讲师权限', 'Instructor access could not be confirmed')} description={t('请刷新状态，或联系管理员。', 'Refresh your status or contact an administrator.')}><button className="platform-button" type="button" onClick={props.onSaved}>{t('刷新状态', 'Refresh status')}</button></ApplicationOverview></div>;

  if(!editing)return <InstructorAdmissionIntro signedIn/>;
  return <div className="platform-application-flow platform-application-edit">
    <header className="platform-application-edit-header"><h2>{status?t('重新申请','Apply again'):t('申请成为讲师','Apply as an instructor')}</h2><div className="platform-application-applicant"><span>{t('已登录账号','Signed-in account')}</span>{user?.name&&!/^\d+$/.test(user.name.trim())&&<strong>{user.name}</strong>}{user?.wcaId && <span>WCA ID: {user.wcaId}</span>}</div></header>
    <DomainForm definition={definition} entity={formEntity} busy={busy} runAction={runAction} spec={{ title: text('申请资料', 'Application'), titleHidden: true, action: 'apply-instructor', fields: INSTRUCTOR_APPLICATION_FIELDS }} onResult={()=>router.replace('/platform/teachers/apply')} />
  </div>;
}

export function PlatformInstructorReview({ entity, params, busy, runAction }: CommonProps) {
  const t = useT();
  const [note, setNote] = useState('');
  const [validation, setValidation] = useState('');
  const [decisionPending, setDecisionPending] = useState<'approved' | 'rejected' | null>(null);
  const [selectedProfile, setSelectedProfile] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  useEffect(() => {setSelectedProfile('');setNote('');setValidation('');},[entity?.id]);
  if (!entity) return null;
  if (entity.status !== 'pending') return <div className="platform-write-actions"><AppLink href="/platform/admin/teacher-applications" className="platform-button" prefetch={false}>{t('返回申请列表', 'Back to applications')}</AppLink>{typeof entity.data?.approvedInstructorId === 'string' && <AppLink href={`/platform/admin/teachers/${encodeURIComponent(entity.data.approvedInstructorId)}`} className="platform-button" prefetch={false}>{t('查看讲师资料', 'View instructor')}</AppLink>}</div>;
  const profiles = Array.isArray(entity.data?.profiles) ? entity.data.profiles.map(record) : [];
  const chooseProfile = entity.data?.currentTeacherEntryId == null && (profiles.length > 1 || profiles.some(profile => profile.owned === false));
  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !note.trim()) { setValidation(t('请填写拒绝原因。', 'Enter a reason for rejection.')); noteRef.current?.focus(); return; }
    if (decision === 'approved' && chooseProfile && !selectedProfile) { setValidation(t('请先确认要关联的历史讲师资料。', 'Confirm the legacy teaching profile first.')); return; }
    setValidation('');
    if (!window.confirm(decision === 'approved' ? t('确认通过申请并开通讲师权限？', 'Approve and grant instructor access?') : t('确认拒绝这次申请？', 'Reject this application?'))) return;
    setDecisionPending(decision);
    try { await runAction('admin-review', params.id, { decision, note: note.trim(), ...(chooseProfile && selectedProfile ? { teacherEntryId: Number(selectedProfile) } : {}) }); }
    finally { setDecisionPending(null); }
  };
  return <section className="platform-domain-form platform-application-review">
    <h2>{t('审核决定', 'Review decision')}</h2>
    {chooseProfile && <label className="platform-application-note"><span>{t('确认历史讲师资料归属', 'Confirm legacy teaching profile')}</span><CompactSelect label={t('选择资料', 'Select profile')} ariaLabel={t('选择历史讲师资料', 'Select legacy teaching profile')} value={selectedProfile} items={profiles.map(profile => ({ value: String(profile.id), label: t(valueText(profile.nameZh) || valueText(profile.nameEn), valueText(profile.nameEn) || valueText(profile.nameZh)) }))} onChange={setSelectedProfile} /></label>}
    <label className="platform-application-note"><span>{t('审核意见（拒绝时必填）', 'Review feedback (required for rejection)')}</span><textarea autoComplete="off" ref={noteRef} className="platform-field-control platform-field-textarea" rows={3} maxLength={10000} value={note} aria-invalid={Boolean(validation)} aria-describedby={validation ? errorId : undefined} onChange={event => { setNote(event.target.value); setValidation(''); }} /></label>
    {validation && <p id={errorId} className="platform-form-error" role="alert">{validation}</p>}
    <div className="platform-write-actions"><button className="platform-button platform-button-primary" type="button" disabled={Boolean(busy || decisionPending)} onClick={() => void decide('approved')}>{decisionPending === 'approved' ? t('正在通过…', 'Approving…') : t('通过申请', 'Approve application')}</button><button className="platform-button" type="button" disabled={Boolean(busy || decisionPending)} onClick={() => void decide('rejected')}>{decisionPending === 'rejected' ? t('正在拒绝…', 'Rejecting…') : t('拒绝申请', 'Reject application')}</button></div>
  </section>;
}
