import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import type { QueryRunner } from '../db/connection.js';

const MAX_BYTES = 5 * 1024 * 1024;
const uploadInput = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().nonnegative(),
  userId: z.number().int().positive().safe(),
  title: z.string().trim().min(1).max(120),
  filename: z.string().trim().min(1).max(200).regex(/^[^/\\\x00-\x1f\x7f]+$/),
  base64: z.string().min(4).max(Math.ceil(MAX_BYTES / 3) * 4),
});

export function contractsService(q: QueryRunner, userId: number, fail: (message: string, status: number) => never) {
  async function isSuperAdmin() {
    const [user] = await q<{wca_id: string | null}>('SELECT wca_id FROM app_users WHERE id=? AND merged_into_user_id IS NULL AND NOT forum_banned', [userId]);
    return !!user && isAdminWcaId(user.wca_id);
  }
  return {
    async list() {
      const canManage = await isSuperAdmin();
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
        AND u.merged_into_user_id IS NULL AND NOT u.forum_banned ORDER BY m.name,m.id`) : [];
      return {contracts, canManage, members};
    },
    async file(search: URLSearchParams) {
      const id = z.string().uuid().parse(search.get('id'));
      const version = z.coerce.number().int().positive().parse(search.get('version'));
      const [file] = await q<{filename: string; mime: string; data: Buffer}>(`SELECT v.filename,v.mime,v.data
        FROM workspace_contract_versions v JOIN workspace_contracts c ON c.id=v.contract_id
        WHERE c.id=? AND v.version=? AND (c.user_id=? OR ?)`, [id, version, userId, await isSuperAdmin()]);
      if (!file) return fail('合同不存在或无权访问 / Contract unavailable', 404);
      return file;
    },
    async versions(search: URLSearchParams) {
      const id = z.string().uuid().parse(search.get('id'));
      const versions = await q(`SELECT v.version,v.filename,v.mime,v.created_at AS "createdAt"
        FROM workspace_contract_versions v JOIN workspace_contracts c ON c.id=v.contract_id
        WHERE c.id=? AND (c.user_id=? OR ?) ORDER BY v.version DESC`, [id, userId, await isSuperAdmin()]);
      if (!versions.length) return fail('合同不存在或无权访问 / Contract unavailable', 404);
      return {versions};
    },
    async upload(input: unknown) {
      if (!await isSuperAdmin()) return fail('需要超级管理员权限 / Super administrator required', 403);
      const data = uploadInput.parse(input);
      const bytes = Buffer.from(data.base64, 'base64');
      if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString('base64') !== data.base64) return fail('文件无效或超过 5 MB / Invalid file or over 5 MB', 400);
      const pdf = /\.pdf$/i.test(data.filename) && bytes.subarray(0,5).toString() === '%PDF-';
      const docx = /\.docx$/i.test(data.filename) && bytes.subarray(0,4).equals(Buffer.from('504b0304', 'hex'));
      if (!pdf && !docx) return fail('仅支持 PDF 或 DOCX / Only PDF or DOCX supported', 400);
      const mime = pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const id = data.id ?? randomUUID();
      if (data.id) {
        const [contract] = await q<{userId: number; title: string; version: number}>('SELECT user_id::int AS "userId",title,version FROM workspace_contracts WHERE id=? FOR UPDATE', [id]);
        if (!contract) return fail('合同不存在 / Contract unavailable', 404);
        if (contract.version !== data.version) return fail('合同已更新，请刷新 / Contract updated; refresh and retry', 409);
        // A revision cannot silently change who can read earlier versions.
        if (contract.userId !== data.userId || contract.title !== data.title) return fail('新版本必须保留合同归属和名称 / Revisions must keep the owner and title', 400);
      } else {
        if (data.version !== 0) return fail('版本无效 / Invalid version', 400);
        const [member] = await q(`SELECT m.id FROM workspace_members m JOIN app_users u ON u.id=m.user_id
          WHERE m.user_id=? AND u.merged_into_user_id IS NULL AND NOT u.forum_banned`, [data.userId]);
        if (!member) return fail('员工不存在 / Employee unavailable', 400);
        await q('INSERT INTO workspace_contracts(id,user_id,title,version) VALUES (?,?,?,0)', [id, data.userId, data.title]);
      }
      const version = data.version + 1;
      await q('INSERT INTO workspace_contract_versions(contract_id,version,filename,mime,data,created_at) VALUES (?,?,?,?,?,?)', [id, version, data.filename, mime, bytes, Math.floor(Date.now()/1000)]);
      await q('UPDATE workspace_contracts SET version=? WHERE id=?', [version,id]);
      await q('INSERT INTO workspace_audit(actor,action,target,created_at) VALUES (?,?,?,?)', [`admin:${userId}`, 'contract.upload', `${id}:${version}`, Math.floor(Date.now()/1000)]);
      return {id, version};
    },
  };
}
