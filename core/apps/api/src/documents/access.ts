import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { query } from '../db/connection.js';
import type { WcaUser } from '../utils/recon_helpers.js';

export type DocumentRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type DocumentAccess = {
  id: string; title: string; kind: 'document' | 'spreadsheet'; owner_key: string;
  created_at: Date | string; updated_at: Date | string;
  general_access: 'restricted' | 'admins' | 'anyone';
  general_role: Exclude<DocumentRole, 'owner'>;
  editors_can_share: boolean; editors_can_export: boolean; viewers_can_export: boolean;
  member_role: DocumentRole | null;
};
export const DOCUMENT_ACCESS_COLUMNS = `d.id, d.title, d.kind, d.owner_key, d.created_at, d.updated_at,
  d.general_access, d.general_role, d.editors_can_share, d.editors_can_export, d.viewers_can_export,
  m.role AS member_role`;
const rank: Record<DocumentRole, number> = { viewer: 1, commenter: 2, editor: 3, owner: 4 };
export function resolveDocumentAccess(row: DocumentAccess, user: WcaUser | null) {
  if (user && BANNED_WCA_IDS.includes(user.wcaId)) return null;
  const member = user ? row.member_role : null;
  const general = row.general_access === 'anyone' || (row.general_access === 'admins' && user?.isAdmin)
    ? row.general_role : null;
  const role = member && (!general || rank[member] >= rank[general]) ? member : general;
  if (!role) return null;
  return {
    ...row, role,
    canManage: !!user && (role === 'owner' || role === 'editor' && row.editors_can_share),
    canExport: role === 'owner' || (role === 'editor' ? row.editors_can_export : row.viewers_can_export),
  };
}
export async function documentAccessFor(id: string, user: WcaUser | null) {
  const rows = await query<DocumentAccess>(
    `SELECT ${DOCUMENT_ACCESS_COLUMNS} FROM collaborative_documents d
     LEFT JOIN collaborative_document_members m ON m.document_id = d.id AND m.user_key = ?
     WHERE d.id = ?`, [user?.wcaId ?? '', id],
  );
  return rows[0] ? resolveDocumentAccess(rows[0], user) : null;
}
export function sharingJson(row: DocumentAccess) {
  return { access: row.general_access, role: row.general_role, editorsCanShare: row.editors_can_share,
    editorsCanExport: row.editors_can_export, viewersCanExport: row.viewers_can_export };
}
