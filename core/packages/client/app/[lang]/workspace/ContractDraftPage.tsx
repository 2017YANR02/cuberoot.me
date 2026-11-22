'use client';

import { useEffect, useRef, useState } from 'react';
import { ErrorNotice, useResource, useWorkspace } from '@app-foundation/workspace-ui';
import { useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import PageBackLink from '@/components/PageBackLink';
import { DocumentCanvas, DocumentFormattingToolbar } from '@/components/collaboration/DocumentFormattingToolbar';
import { useT } from '@/hooks/useT';
import { CONTRACT_LIST_HREF } from '@/lib/contract-reader-route';
import { extractChineseName } from '@/lib/cuber-name-display';
import InternshipFieldForm from './InternshipFieldForm';
import { completeInternshipFields, fillInternshipTemplate, internshipDailyRateCents, prepareInternshipDraft, readInternshipTemplate, type InternshipFields } from './contract-template-fields';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';
import '../docs/edit/editor.css';
import './contract-draft.css';

type Member = { userId: number; name: string };
type Draft = { id: string; userId: number; title: string; version: number; content: JSONContent };
type DraftAction = 'save' | 'publish' | 'delete';

const extensions = [
  StarterKit.configure({link: {openOnClick: false, autolink: false}}),
  Highlight, Subscript, Superscript, TextAlign.configure({types: ['heading', 'paragraph']}), TextStyleKit,
];

export default function ContractDraftPage({id}: {id: string}) {
  const t = useT();
  const resource = useResource<Draft>(`contract-draft?id=${encodeURIComponent(id)}`);
  const contracts = useResource<{members: Member[]; canManage: boolean}>('contracts');
  const employee = contracts.data?.members.find(member => member.userId === resource.data?.userId);
  const error = resource.error ?? contracts.error;
  return <main className="staff-workspace doc-workspace contract-draft-page">
    {!error && resource.data && contracts.data?.canManage ? <DraftEditor draft={resource.data} employee={employee} /> : <>
      <header className="doc-topbar">
        <PageBackLink fallback={CONTRACT_LIST_HREF} className="doc-back" />
        <h1>{t('编辑合同草稿', 'Edit contract draft')}</h1>
      </header>
      <div className="doc-page-error">
        <ErrorNotice error={error} retry={() => { resource.reload(); contracts.reload(); }} />
        {!error && (resource.loading || contracts.loading) && <p role="status">{t('正在加载…', 'Loading…')}</p>}
        {!error && !resource.loading && !contracts.loading && <p role="alert">{t('合同草稿不可用', 'Contract draft unavailable')}</p>}
      </div>
    </>}
  </main>;
}

function DraftEditor({draft, employee}: {draft: Draft; employee?: Member}) {
  const t = useT();
  const {api, navigate} = useWorkspace();
  const [title, setTitle] = useState(draft.title);
  const [version, setVersion] = useState(draft.version);
  const [zoom, setZoom] = useState(100);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [confirming, setConfirming] = useState<'publish' | 'delete' | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [fields, setFields] = useState<InternshipFields | null>(null);
  const [fieldError, setFieldError] = useState('');
  const working = useRef(false);
  const mounted = useRef(false);
  const [initialContent] = useState(() => {
    if (draft.version !== 1) return draft.content;
    const name = employee?.name ?? '';
    return prepareInternshipDraft(draft.content, extractChineseName(name) ?? name, draft.title);
  });
  const [internship] = useState(() => Boolean(readInternshipTemplate(initialContent)));
  const label = t('合同正文', 'Contract body');
  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    enableContentCheck: true,
    onContentError: () => setInvalid(true),
    onUpdate: () => { setDirty(true); setSaved(false); },
    editorProps: {attributes: {role: 'textbox', 'aria-multiline': 'true', 'aria-label': label}},
  });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { editor?.setEditable(!busy && !invalid, false); }, [editor, busy, invalid]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function commit(action: DraftAction, draftContent?: JSONContent) {
    if (working.current || (action !== 'save' && action !== confirming)) return;
    if (action !== 'delete' && (!editor || invalid || !title.trim())) return;
    working.current = true;
    setBusy(true);
    setError(undefined);
    const name = title.trim();
    try {
      if (action === 'delete') {
        await api('contract-draft-delete', {id: draft.id, version});
        if (mounted.current) navigate(CONTRACT_LIST_HREF);
        return;
      }
      if (!editor) return;
      const content = draftContent ?? editor.getJSON();
      if (action === 'save') {
        const next = await api<{version: number}>('contract-draft-save', {id: draft.id, version, title: name, content});
        if (mounted.current) {
          if (draftContent) {
            editor.commands.setContent(content, {emitUpdate: false});
            setFields(null);
          }
          setVersion(next.version);
          setTitle(name);
          setDirty(false);
          setSaved(true);
        }
        return;
      }
      if (editor.isEmpty) throw new Error(t('请填写合同正文', 'Enter the contract body'));
      const terms = internship ? readInternshipTemplate(content)?.values : undefined;
      if (terms && !completeInternshipFields(terms)) {
        throw new Error(t('发布前请在「填写合同信息」确认计酬方式、实习期限及其他必填项，并填入正文。', 'Before publishing, confirm the pay calculation, internship period and other required fields, then apply them to the contract body.'));
      }
      const payroll = terms && {
        effectiveFrom: terms.start, endsOn: terms.end,
        dailyRateCents: terms.settlement === 'daily' ? internshipDailyRateCents(terms.allowance) : null,
      };
      const {buildDocumentDocx, documentExportFilename} = await import('@/lib/document-export');
      const file = await buildDocumentDocx(name, content);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (!mounted.current) return;
      await api('contract-draft-publish', {id: draft.id, version, title: name, filename: documentExportFilename(name, 'docx'), base64, payroll});
      if (mounted.current) navigate(CONTRACT_LIST_HREF);
    } catch (failure) {
      const requestError = failure instanceof Error ? failure : new Error(t('操作失败，请重试', 'Request failed. Try again.'));
      if (draftContent) throw requestError;
      if (mounted.current) setError(requestError);
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const canSave = Boolean(editor && !invalid && title.trim() && !busy);
  return <>
    <div className="contract-draft-chrome">
      <header className="doc-topbar">
        <PageBackLink fallback={CONTRACT_LIST_HREF} className="doc-back" onClick={event => {
          if (working.current || (dirty && !window.confirm(t('放弃未保存的更改？', 'Discard unsaved changes?')))) event.preventDefault();
        }} />
        <input autoComplete="off" className="doc-title-input" value={title} maxLength={120} required disabled={busy}
          aria-label={t('合同名称', 'Contract title')} onChange={event => { setTitle(event.target.value); setDirty(true); setSaved(false); }} />
        {employee && <span className="contract-draft-employee">{employee.name}</span>}
        <div className="contract-draft-actions">
          {confirming ? <>
            <Button variant="secondary" disabled={busy} onClick={() => { setConfirming(null); setError(undefined); }}>{t('取消', 'Cancel')}</Button>
            {confirming === 'publish'
              ? <Button disabled={!canSave} onClick={() => void commit('publish')}>{t('确认发布', 'Confirm publication')}</Button>
              : <Button disabled={busy} onClick={() => void commit('delete')}>{t('确认删除', 'Confirm deletion')}</Button>}
          </> : <>
            {internship && <Button variant="secondary" disabled={!editor || invalid || busy} onClick={() => {
              if (!editor) return;
              const current = readInternshipTemplate(editor.getJSON());
              setFieldError(current ? '' : t('正文的条款结构已变更，可以继续直接编辑正文。', 'The clause structure has changed. Continue editing the contract body directly.'));
              if (current) setFields(current.values);
            }}>{t('填写合同信息', 'Fill contract fields')}</Button>}
            <Button variant="secondary" disabled={!canSave} onClick={() => void commit('save')}>{t('保存草稿', 'Save draft')}</Button>
            <Button disabled={!canSave} onClick={() => setConfirming('publish')}>{t('发布给员工', 'Publish to employee')}</Button>
            <Button action="delete" variant="secondary" disabled={busy} onClick={() => setConfirming('delete')}>{t('删除草稿', 'Delete draft')}</Button>
          </>}
        </div>
      </header>
      {editor && <DocumentFormattingToolbar editor={editor} canEdit={!busy && !invalid} zoom={zoom} onZoomChange={setZoom} />}
      {(saved || busy || confirming || error || invalid || fieldError) && <div className="contract-draft-feedback">
        {busy ? <p role="status">{t('正在处理…', 'Working…')}</p> : saved && <p role="status">{t('草稿已保存', 'Draft saved')}</p>}
        {confirming === 'publish' && <p role="status">{t('发布后，该员工即可在「合同」查看和下载这份 Word 文件。', 'After publication, the employee can view and download this Word file in Contracts.')}</p>}
        {confirming === 'delete' && <p role="status">{t('确定删除这份草稿？', 'Delete this draft?')}</p>}
        {invalid && <p role="alert">{t('这份模板含有合同编辑器不支持的格式，请使用支持的模板。', 'This template contains formatting the contract editor does not support. Choose a supported template.')}</p>}
        {fieldError && <p role="status">{fieldError}</p>}
        <ErrorNotice error={error} />
      </div>}
    </div>
    {editor && <DocumentCanvas editor={editor} zoom={zoom} />}
    {fields && editor && <WorkspaceDialog wide title={t('填写合同信息', 'Fill contract fields')} onClose={() => setFields(null)}>
      <InternshipFieldForm initial={fields} title={title} canSave={canSave} onCancel={() => setFields(null)} onApply={values => {
        editor.commands.setContent(fillInternshipTemplate(editor.getJSON(), values));
        setFields(null);
      }} onSave={values => commit('save', fillInternshipTemplate(editor.getJSON(), values))} />
    </WorkspaceDialog>}
  </>;
}
