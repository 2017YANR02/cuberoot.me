'use client';

import { useEffect, useState } from 'react';
import { ErrorNotice, Field, Form, useResource, useWorkspace, value } from '@app-foundation/workspace-ui';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { useT } from '@/hooks/useT';
import { extractChineseName } from '@/lib/cuber-name-display';
import InternshipFieldForm from './InternshipFieldForm';
import { completeInternshipFields, fillInternshipTemplate, prepareInternshipDraft, readInternshipTemplate, type InternshipFields } from './contract-template-fields';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';

type Member = { userId: number; name: string };
type Template = { id: string; title: string };
type DraftSummary = { id: string; userId: number; title: string; version: number; name: string };
type Draft = Omit<DraftSummary, 'name'> & { content: JSONContent };

export default function ContractDrafts({members, onUpload, onPublished}: {members: Member[]; onUpload: () => void; onPublished: () => void}) {
  const t = useT();
  const {api} = useWorkspace();
  const resource = useResource<{drafts: DraftSummary[]; templates: Template[]}>('contract-drafts');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<'saved' | 'published' | 'deleted' | null>(null);
  return <>
    <div className="staff-actions workspace-toolbar">
      <Button action="add" iconOnly={false} disabled={!resource.data} onClick={() => { setCreating(true); setResult(null); }}>{t('从模板创建', 'Create from template')}</Button>
      <Button variant="secondary" onClick={onUpload}>{t('上传合同', 'Upload contract')}</Button>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {result === 'published' && <p role="status">{t('合同已发布，可在下方查看。', 'Contract published. You can open it below.')}</p>}
    {result === 'saved' && <p role="status">{t('草稿已保存', 'Draft saved')}</p>}
    {result === 'deleted' && <p role="status">{t('草稿已删除', 'Draft deleted')}</p>}
    {!!resource.data?.drafts.length && <section className="staff-feed">
      <h2>{t('合同草稿', 'Contract drafts')}</h2>
      {resource.data.drafts.map(draft => <article className="workspace-member-row" key={draft.id}>
        <div><h2>{draft.title}</h2><p className="staff-muted">{draft.name}</p></div>
        <Button variant="secondary" onClick={() => { setSelected(draft.id); setResult(null); }}>{t('继续编辑', 'Continue editing')}</Button>
      </article>)}
    </section>}
    {creating && <WorkspaceDialog title={t('从模板创建', 'Create from template')} onClose={() => setCreating(false)}>
      {resource.data?.templates.length ? <Form submit={async data => {
        const draft = await api<Draft>('contract-draft-create', {
          templateId: value(data, 'template'), userId: Number(value(data, 'employee')), title: value(data, 'title'),
        });
        resource.reload();
        setCreating(false);
        setSelected(draft.id);
      }}>
        <Field label={t('模板', 'Template')}><select name="template" required defaultValue="">
          <option value="">{t('选择协作文档', 'Choose a collaborative document')}</option>
          {resource.data.templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
        </select></Field>
        <Field label={t('归属员工', 'Employee')}><select name="employee" required defaultValue="">
          <option value="">{t('选择员工', 'Choose employee')}</option>
          {members.map(member => <option key={member.userId} value={member.userId}>{member.name} · {member.userId}</option>)}
        </select></Field>
        <Field label={t('合同名称', 'Contract title')}><input name="title" required maxLength={120} /></Field>
        <div className="staff-actions"><Button type="submit">{t('创建草稿', 'Create draft')}</Button></div>
      </Form> : <p>{t('请先在协作文档中准备一份自己拥有的受限文档作为模板。', 'First prepare a restricted collaborative document you own to use as a template.')}</p>}
    </WorkspaceDialog>}
    {selected && <DraftDialog key={selected} id={selected} members={members} onClose={() => setSelected(null)} onSaved={(outcome) => {
      setSelected(null);
      resource.reload();
      setResult(outcome);
    }} onPublished={() => {
      setSelected(null);
      resource.reload();
      onPublished();
      setResult('published');
    }} />}
  </>;
}

function DraftDialog({id, members, onClose, onSaved, onPublished}: {
  id: string; members: Member[]; onClose: () => void; onSaved: (outcome: 'saved' | 'deleted') => void; onPublished: () => void;
}) {
  const t = useT();
  const resource = useResource<Draft>(`contract-draft?id=${encodeURIComponent(id)}`);
  const draft = resource.data;
  const employee = members.find(member => member.userId === draft?.userId);
  return <WorkspaceDialog wide title={t('编辑合同草稿', 'Edit contract draft')} onClose={onClose}>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {draft && <DraftEditor draft={draft} employee={employee} onSaved={onSaved} onPublished={onPublished} />}
  </WorkspaceDialog>;
}

const extensions = [
  StarterKit.configure({link: {openOnClick: false, autolink: false}}),
  Highlight, Subscript, Superscript, TextAlign.configure({types: ['heading', 'paragraph']}), TextStyleKit,
];

function DraftEditor({draft, employee, onSaved, onPublished}: {
  draft: Draft; employee?: Member; onSaved: (outcome: 'saved' | 'deleted') => void; onPublished: () => void;
}) {
  const t = useT();
  const {api} = useWorkspace();
  const [confirming, setConfirming] = useState<'publish' | 'delete' | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [initialContent] = useState(() => {
    if (draft.version !== 1) return draft.content;
    const name = employee?.name ?? '';
    return prepareInternshipDraft(draft.content, extractChineseName(name) ?? name);
  });
  const [fields, setFields] = useState<InternshipFields | null>(null);
  const [fieldsApplied, setFieldsApplied] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [internship] = useState(() => Boolean(readInternshipTemplate(initialContent)));
  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,
    enableContentCheck: true,
    onContentError: () => setInvalid(true),
    editorProps: {attributes: {class: 'staff-input workspace-contract-editor', role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('合同正文', 'Contract body')}},
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { editor?.setEditable(!busy && !invalid); }, [editor, busy, invalid]);
  return <>
    {fields && <InternshipFieldForm initial={fields} onCancel={() => setFields(null)} onApply={values => {
      if (!editor) return;
      editor.commands.setContent(fillInternshipTemplate(editor.getJSON(), values));
      setFieldsApplied(true);
      setFields(null);
    }} />}
    <div hidden={Boolean(fields)}>
    <Form submit={async (data, action) => {
      const {id, version} = draft;
      setBusy(true);
      try {
        if (action === 'delete' && confirming === 'delete') {
          await api('contract-draft-delete', {id, version});
          onSaved('deleted');
          return;
        }
        if (!editor || invalid) return;
        const content = editor.getJSON();
        const title = value(data, 'title').trim();
        if (action === 'publish' && confirming === 'publish') {
          if (editor.isEmpty) throw new Error(t('请填写合同正文', 'Enter the contract body'));
          const current = internship ? readInternshipTemplate(content) : null;
          if (current && !completeInternshipFields(current.values)) {
            throw new Error(t('发布前请填写乙方姓名、岗位、工作内容、实习期限、每周安排和津贴标准。', 'Before publishing, enter the employee name, role, duties, internship period, weekly schedule and allowance.'));
          }
          const {buildDocumentDocx, documentExportFilename} = await import('@/lib/document-export');
          const file = await buildDocumentDocx(title, content);
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          await api('contract-draft-publish', {id, version, title, filename: documentExportFilename(title, 'docx'), base64});
          onPublished();
          return;
        }
        await api('contract-draft-save', {id, version, title, content});
        onSaved('saved');
      } finally { setBusy(false); }
    }}>
      <p className="staff-muted">{t('归属员工', 'Employee')} · {employee ? `${employee.name} · ${employee.userId}` : draft.userId}</p>
      <Field label={t('合同名称', 'Contract title')}><input name="title" defaultValue={draft.title} maxLength={120} required /></Field>
      {invalid && <p role="alert">{t('这份模板含有合同编辑器不支持的格式，请使用支持的模板。', 'This template contains formatting the contract editor does not support. Choose a supported template.')}</p>}
      {internship && <div className="staff-actions">
        <Button variant="secondary" disabled={invalid || !editor || Boolean(confirming)} onClick={() => {
          if (!editor) return;
          const current = readInternshipTemplate(editor.getJSON());
          setFieldError(current ? '' : t('正文的条款结构已变更，可以继续直接编辑正文。', 'The clause structure has changed. Continue editing the contract body directly.'));
          if (current) setFields(current.values);
        }}>{t('填写合同信息', 'Fill contract fields')}</Button>
      </div>}
      {fieldError && <p role="status">{fieldError}</p>}
      <input type="hidden" name="fieldsApplied" value={String(fieldsApplied)} />
      <EditorContent editor={editor} />
      {confirming === 'publish' && <p role="status">{t('发布后，该员工即可在「合同与协议」查看和下载这份 Word 文件。', 'After publication, the employee can view and download this Word file in Contracts & agreements.')}</p>}
      {confirming === 'delete' && <p role="status">{t('确定删除这份草稿？', 'Delete this draft?')}</p>}
      <div className="staff-actions">
        {confirming ? <>
          <Button type="button" variant="secondary" onClick={event => { event.preventDefault(); setConfirming(null); }}>{t('取消', 'Cancel')}</Button>
          {confirming === 'publish'
            ? <Button type="submit" value="publish" disabled={invalid || !editor}>{t('确认发布', 'Confirm publication')}</Button>
            : <Button type="submit" value="delete" formNoValidate>{t('确认删除', 'Confirm deletion')}</Button>}
        </> : <>
          <Button type="submit" value="save" variant="secondary" disabled={invalid || !editor}>{t('保存草稿', 'Save draft')}</Button>
          <Button type="button" disabled={invalid || !editor} onClick={event => { event.preventDefault(); setConfirming('publish'); }}>{t('发布给员工', 'Publish to employee')}</Button>
          <Button type="button" variant="secondary" onClick={event => { event.preventDefault(); setConfirming('delete'); }}>{t('删除草稿', 'Delete draft')}</Button>
        </>}
      </div>
    </Form>
    </div>
  </>;
}
