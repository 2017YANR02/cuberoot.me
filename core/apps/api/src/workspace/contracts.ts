import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Doc, applyUpdate } from 'yjs';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { isContractTemplateTitle } from '@cuberoot/shared/workspace-contracts';
import { PROJECT_MAX_CENTS, isPlanningDate } from '@cuberoot/shared/workspace-planning';
import type { QueryRunner } from '../db/connection.js';
import { saveWorkspaceDailyRate } from './payroll.js';
import { eligibleRecipient } from './project-recipient.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DRAFT_BYTES = 190 * 1024;
const MAX_TEMPLATE_STATE_BYTES = 2 * 1024 * 1024;
const uuid = z.string().uuid();
const ownerId = z.number().int().positive().safe();
const titleInput = z.string().trim().min(1).max(120);
const draftVersion = z.number().int().positive();
const fileBase64 = z.string().min(4).max(Math.ceil(MAX_BYTES / 3) * 4);
const fileName = z.string().trim().min(1).max(200).regex(/^[^/\\\x00-\x1f\x7f]+$/);
const newDraftInput = z.object({templateId: uuid, userId: ownerId, title: titleInput});
const draftRef = z.object({id: uuid, version: draftVersion});
const saveDraftInput = draftRef.extend({title: titleInput, content: z.json()});
const payrollInput = z.strictObject({
  effectiveFrom: z.string().refine(isPlanningDate),
  endsOn: z.string().refine(isPlanningDate),
  dailyRateCents: z.number().int().min(1).max(PROJECT_MAX_CENTS).nullable(),
}).refine(value => value.effectiveFrom <= value.endsOn);
const publishDraftInput = draftRef.extend({
  title: titleInput, filename: fileName.refine(value => /\.docx$/i.test(value)), base64: fileBase64,
  payroll: payrollInput.optional(),
});
const draftDocument = z.object({type: z.literal('doc'), content: z.array(z.json()).min(1)});
const draftColumns = 'id,user_id::int AS "userId",title,version';
const uploadInput = z.object({
  id: uuid.optional(),
  version: z.number().int().nonnegative(),
  userId: ownerId,
  title: titleInput,
  filename: fileName,
  base64: fileBase64,
});

export function contractsService(q: QueryRunner, userId: number, fail: (message: string, status: number) => never) {
  async function superAdminKey() {
    const [user] = await q<{wca_id: string | null}>('SELECT wca_id FROM app_users WHERE id=? AND merged_into_user_id IS NULL AND NOT forum_banned', [userId]);
    return user && isAdminWcaId(user.wca_id) ? user.wca_id : null;
  }
  async function requireSuperAdmin() {
    return await superAdminKey() ?? fail('需要超级管理员权限 / Super administrator required', 403);
  }
  async function requireMember(memberId: number) {
    const [member] = await q(`SELECT m.id FROM workspace_members m JOIN app_users u ON u.id=m.user_id
      WHERE m.user_id=? AND ${eligibleRecipient}`, [memberId]);
    if (!member) return fail('员工不存在 / Employee unavailable', 400);
  }
  function checkDraftContent(input: unknown) {
    const content = draftDocument.parse(input);
    if (Buffer.byteLength(JSON.stringify(content)) > MAX_DRAFT_BYTES) return fail('草稿内容过大 / Draft is too large', 400);
    return content;
  }
  async function storeFile(data: z.infer<typeof uploadInput>, newId: string = randomUUID()) {
    const bytes = Buffer.from(data.base64, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString('base64') !== data.base64) return fail('文件无效或超过 5 MB / Invalid file or over 5 MB', 400);
    const pdf = /\.pdf$/i.test(data.filename) && bytes.subarray(0,5).toString() === '%PDF-';
    const docx = /\.docx$/i.test(data.filename) && bytes.subarray(0,4).equals(Buffer.from('504b0304', 'hex'));
    if (!pdf && !docx) return fail('仅支持 PDF 或 DOCX / Only PDF or DOCX supported', 400);
    const mime = pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const id = data.id ?? newId;
    if (data.id) {
      const [contract] = await q<{userId: number; title: string; version: number}>('SELECT user_id::int AS "userId",title,version FROM workspace_contracts WHERE id=? FOR UPDATE', [id]);
      if (!contract) return fail('合同不存在 / Contract unavailable', 404);
      if (contract.version !== data.version) return fail('合同已更新，请刷新 / Contract updated; refresh and retry', 409);
      // A revision cannot silently change who can read earlier versions.
      if (contract.userId !== data.userId || contract.title !== data.title) return fail('新版本必须保留合同归属和名称 / Revisions must keep the owner and title', 400);
    } else {
      if (data.version !== 0) return fail('版本无效 / Invalid version', 400);
      await requireMember(data.userId);
      await q('INSERT INTO workspace_contracts(id,user_id,title,version) VALUES (?,?,?,0)', [id, data.userId, data.title]);
    }
    const version = data.version + 1;
    await q('INSERT INTO workspace_contract_versions(contract_id,version,filename,mime,data,created_at) VALUES (?,?,?,?,?,?)', [id, version, data.filename, mime, bytes, Math.floor(Date.now()/1000)]);
    await q('UPDATE workspace_contracts SET version=? WHERE id=?', [version,id]);
    await q('INSERT INTO workspace_audit(actor,action,target,created_at) VALUES (?,?,?,?)', [`admin:${userId}`, 'contract.upload', `${id}:${version}`, Math.floor(Date.now()/1000)]);
    return {id, version};
  }
  return {
    async list() {
      const canManage = Boolean(await superAdminKey());
      const contracts = await q(`SELECT c.id,c.user_id::int AS "userId",c.title,c.version,
        COALESCE(NULLIF(m.name,''),u.display_name,u.id::text) AS name,
        v.filename,v.mime,v.created_at AS "createdAt"
        FROM workspace_contracts c JOIN app_users u ON u.id=c.user_id
        LEFT JOIN workspace_members m ON m.user_id=c.user_id
        JOIN workspace_contract_versions v ON v.contract_id=c.id
        WHERE v.version=c.version AND (c.user_id=? OR ?)
        ORDER BY v.created_at DESC,c.id`, [userId, canManage]);
      const members = canManage ? await q(`SELECT m.user_id::int AS "userId",m.name FROM workspace_members m
        JOIN app_users u ON u.id=m.user_id WHERE m.user_id IS NOT NULL
        AND ${eligibleRecipient} ORDER BY m.name,m.id`) : [];
      return {contracts, canManage, members};
    },
    async file(search: URLSearchParams) {
      const id = z.string().uuid().parse(search.get('id'));
      const version = z.coerce.number().int().positive().parse(search.get('version'));
      const [file] = await q<{filename: string; mime: string; data: Buffer}>(`SELECT v.filename,v.mime,v.data
        FROM workspace_contract_versions v JOIN workspace_contracts c ON c.id=v.contract_id
        WHERE c.id=? AND v.version=? AND (c.user_id=? OR ?)`, [id, version, userId, Boolean(await superAdminKey())]);
      if (!file) return fail('合同不存在或无权访问 / Contract unavailable', 404);
      return file;
    },
    async versions(search: URLSearchParams) {
      const id = z.string().uuid().parse(search.get('id'));
      const versions = await q(`SELECT v.version,v.filename,v.mime,v.created_at AS "createdAt"
        FROM workspace_contract_versions v JOIN workspace_contracts c ON c.id=v.contract_id
        WHERE c.id=? AND (c.user_id=? OR ?) ORDER BY v.version DESC`, [id, userId, Boolean(await superAdminKey())]);
      if (!versions.length) return fail('合同不存在或无权访问 / Contract unavailable', 404);
      return {versions};
    },
    async upload(input: unknown) {
      await requireSuperAdmin();
      return storeFile(uploadInput.parse(input));
    },
    async drafts() {
      const key = await requireSuperAdmin();
      const drafts = await q(`SELECT d.id,d.user_id::int AS "userId",d.title,d.version,m.name
        FROM workspace_contract_drafts d JOIN workspace_members m ON m.user_id=d.user_id
        ORDER BY d.updated_at DESC,d.id`);
      const documents = await q<{id: string; title: string}>(`SELECT id,title FROM collaborative_documents
        WHERE owner_key=? AND kind='document' AND general_access='restricted'
        AND octet_length(ydoc_state)<=? ORDER BY updated_at DESC,id`, [key, MAX_TEMPLATE_STATE_BYTES]);
      return {drafts, templates: documents.filter(document => isContractTemplateTitle(document.title))};
    },
    async draft(search: URLSearchParams) {
      await requireSuperAdmin();
      const [draft] = await q(`SELECT ${draftColumns},content FROM workspace_contract_drafts WHERE id=?`, [uuid.parse(search.get('id'))]);
      if (!draft) return fail('草稿不存在 / Draft unavailable', 404);
      return draft;
    },
    async createDraft(input: unknown) {
      const key = await requireSuperAdmin();
      const {templateId, userId, title} = newDraftInput.parse(input);
      await requireMember(userId);
      const [template] = await q<{title: string; ydoc_state: Uint8Array}>(`SELECT title,ydoc_state FROM collaborative_documents
        WHERE id=? AND owner_key=? AND kind='document' AND general_access='restricted'
        AND octet_length(ydoc_state)<=?`, [templateId, key, MAX_TEMPLATE_STATE_BYTES]);
      if (!template || !isContractTemplateTitle(template.title)) return fail('模板不可用 / Template unavailable', 404);
      const document = new Doc();
      let content: ReturnType<typeof checkDraftContent>;
      try {
        applyUpdate(document, template.ydoc_state);
        content = checkDraftContent(TiptapTransformer.fromYdoc(document, 'default'));
      } finally { document.destroy(); }
      const [draft] = await q(`INSERT INTO workspace_contract_drafts(id,user_id,title,content) VALUES (?,?,?,?)
        RETURNING ${draftColumns},content`, [randomUUID(), userId, title, content]);
      return draft;
    },
    async saveDraft(input: unknown) {
      await requireSuperAdmin();
      const {id, version, title, content} = saveDraftInput.parse(input);
      const [saved] = await q(`UPDATE workspace_contract_drafts SET title=?,content=?,version=version+1,updated_at=NOW()
        WHERE id=? AND version=? RETURNING version`, [title, checkDraftContent(content), id, version]);
      if (!saved) return fail('草稿已更新，请重新打开 / Draft changed; reopen it', 409);
      return saved;
    },
    async deleteDraft(input: unknown) {
      await requireSuperAdmin();
      const {id, version} = draftRef.parse(input);
      const [deleted] = await q('DELETE FROM workspace_contract_drafts WHERE id=? AND version=? RETURNING id', [id, version]);
      if (!deleted) return fail('草稿已更新或不存在 / Draft changed or is unavailable', 409);
      return {id};
    },
    async publishDraft(input: unknown) {
      await requireSuperAdmin();
      const {id, version, title, filename, base64, payroll} = publishDraftInput.parse(input);
      const [draft] = await q<{userId: number; version: number}>(`SELECT user_id::int AS "userId",version FROM workspace_contract_drafts WHERE id=? FOR UPDATE`, [id]);
      if (!draft) {
        const [published] = await q<{id: string}>('SELECT id FROM workspace_contracts WHERE id=?', [id]);
        if (published) return {id, version: 1};
        return fail('草稿不存在 / Draft unavailable', 404);
      }
      if (draft.version !== version) return fail('草稿已更新，请重新打开 / Draft changed; reopen it', 409);
      const published = await storeFile({userId: draft.userId, title, filename, base64, version: 0}, id);
      if (payroll) await saveWorkspaceDailyRate(q, {...payroll, userId: draft.userId});
      await q('DELETE FROM workspace_contract_drafts WHERE id=?', [id]);
      return published;
    },
  };
}
