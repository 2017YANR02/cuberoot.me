'use client';

import { useState } from 'react';
import { ErrorNotice, Field, Form, useResource, useWorkspace, value } from '@app-foundation/workspace-ui';
import { contractTitleFromTemplate, isContractTemplateTitle } from '@cuberoot/shared/workspace-contracts';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { contractDraftHref } from '@/lib/contract-reader-route';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';

type Member = { userId: number; name: string };
type Template = { id: string; title: string };
type DraftSummary = { id: string; userId: number; title: string; version: number; name: string };

export default function ContractDrafts({members, onUpload}: {members: Member[]; onUpload: () => void}) {
  const t = useT();
  const {api, navigate} = useWorkspace();
  const resource = useResource<{drafts: DraftSummary[]; templates: Template[]}>('contract-drafts');
  const [creating, setCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const templates = resource.data?.templates.filter(template => isContractTemplateTitle(template.title)) ?? [];
  const templateId = templates.length === 1 ? templates[0].id : selectedTemplateId;
  const suggestedTitle = contractTitleFromTemplate(templates.find(template => template.id === templateId)?.title ?? '');
  return <>
    <div className="staff-actions workspace-toolbar">
      <Button action="add" iconOnly={false} disabled={!resource.data} onClick={() => {
        setSelectedTemplateId('');
        setCustomTitle(null);
        setCreating(true);
      }}>{t('从模板创建', 'Create from template')}</Button>
      <Button variant="secondary" onClick={onUpload}>{t('上传合同', 'Upload contract')}</Button>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {!!resource.data?.drafts.length && <section className="staff-feed">
      <h2>{t('合同草稿', 'Contract drafts')}</h2>
      {resource.data.drafts.map(draft => <article className="workspace-member-row" key={draft.id}>
        <div><h2>{draft.title}</h2><p className="staff-muted">{draft.name}</p></div>
        <AppLink href={contractDraftHref(draft.id)} prefetch={false} className="btn btn-secondary workspace-action">{t('继续编辑', 'Continue editing')}</AppLink>
      </article>)}
    </section>}
    {creating && <WorkspaceDialog title={t('从模板创建', 'Create from template')} onClose={() => setCreating(false)}>
      {templates.length ? <Form submit={async data => {
        const draft = await api<{id: string}>('contract-draft-create', {
          templateId: value(data, 'template'), userId: Number(value(data, 'employee')), title: value(data, 'title'),
        });
        resource.reload();
        setCreating(false);
        navigate(contractDraftHref(draft.id));
      }}>
        {templates.length > 1 ? <Field label={t('模板', 'Template')}><select name="template" required value={templateId} onChange={event => setSelectedTemplateId(event.target.value)}>
          <option value="" disabled hidden>{t('请选择', 'Select')}</option>
          {templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
        </select></Field> : <input type="hidden" name="template" value={templateId} />}
        <Field label={t('员工', 'Employee')}><select name="employee" required defaultValue="">
          <option value="">{t('选择员工', 'Choose employee')}</option>
          {members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}
        </select></Field>
        <Field label={t('合同名称', 'Contract title')}><input name="title" required maxLength={120} value={customTitle ?? suggestedTitle} onChange={event => setCustomTitle(event.target.value)} /></Field>
        <div className="staff-actions"><Button type="submit">{t('创建草稿', 'Create draft')}</Button></div>
      </Form> : <p>{t('请将自己拥有的受限文档命名为「合同模板」或「协议模板」，例如「网站开发实习协议模板」。', 'Name a restricted document you own as a contract or agreement template, such as “Web Development Internship Agreement Template”.')}</p>}
    </WorkspaceDialog>}
  </>;
}
