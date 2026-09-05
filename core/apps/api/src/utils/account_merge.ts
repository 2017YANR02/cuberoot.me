import { ownerKey } from '@cuberoot/shared/account';
import { withTransaction, type QueryRunner } from '../db/connection.js';
import { ANONYMIZE_TABLES, PURGE_TABLES } from './account_delete.js';

export type AccountMergeErrorCode =
  | 'not_found'
  | 'already_merged'
  | 'credential_conflict'
  | 'wca_conflict'
  | 'linked_data'
  | 'data_conflict';

export class AccountMergeError extends Error {
  constructor(public readonly code: AccountMergeErrorCode) {
    super(code);
  }
}

type MergeUser = {
  id: number | string;
  wca_id: string | null;
  password_hash: string | null;
  merged_into_user_id: number | string | null;
};

const OWNER_COLUMNS = [
  ...PURGE_TABLES.map(([table, column]) => [table, column] as const),
  ...ANONYMIZE_TABLES.map(({ table, idCol }) => [table, idCol] as const),
  ['memberships', 'wca_id'] as const,
  ['membership_orders', 'wca_id'] as const,
];

const MERGE_OWNED_DIRECT_TABLES = new Set([
  'auth_identities',
  'account_last_devices',
  'auth_web_session_tickets',
  'app_users',
]);

function quoteIdent(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('unsafe SQL identifier');
  return `"${value}"`;
}

/** 用户看到的合并码包含保留账号 UID，方向不会靠猜。 */
export function parseAccountMergeCode(raw: unknown): { targetUserId: number; code: string } | null {
  if (typeof raw !== 'string') return null;
  const match = /^([1-9]\d*)-([0-9]{6})$/.exec(raw.trim());
  if (!match) return null;
  const targetUserId = Number(match[1]);
  return Number.isSafeInteger(targetUserId) ? { targetUserId, code: match[2] } : null;
}

async function rejectUnsupportedDirectData(tx: QueryRunner, sourceUserId: number): Promise<void> {
  const refs = await tx<{ table_name: string; column_name: string }>(`
    SELECT child.relname AS table_name, child_col.attname AS column_name
    FROM pg_constraint constraint_row
    JOIN pg_class child ON child.oid = constraint_row.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_attribute child_col
      ON child_col.attrelid = child.oid AND child_col.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'app_users'::regclass
      AND array_length(constraint_row.conkey, 1) = 1
      AND child_ns.nspname = current_schema()
  `);
  for (const ref of refs) {
    if (MERGE_OWNED_DIRECT_TABLES.has(ref.table_name)) continue;
    const rows = await tx(
      `SELECT 1 FROM ${quoteIdent(ref.table_name)} WHERE ${quoteIdent(ref.column_name)} = ? LIMIT 1`,
      [sourceUserId],
    );
    if (rows.length) throw new AccountMergeError('linked_data');
  }
}

async function moveOwnerKey(tx: QueryRunner, from: string, to: string): Promise<void> {
  if (from === to) return;
  for (const [table, column] of OWNER_COLUMNS) {
    await tx(
      `UPDATE ${quoteIdent(table)} SET ${quoteIdent(column)} = ? WHERE ${quoteIdent(column)} = ?`,
      [to, from],
    );
  }
}

/**
 * source 并入 target。所有检查和迁移共用一个事务；唯一键冲突会整单回滚。
 * ponytail: 直接引用 app_users 的复杂业务域暂不猜合并策略，有真实需求时按域补规则。
 */
export async function mergeAccounts(sourceUserId: number, targetUserId: number): Promise<void> {
  if (sourceUserId === targetUserId) throw new AccountMergeError('already_merged');
  try {
    await withTransaction(async (tx) => {
      const users = await tx<MergeUser>(
        `SELECT id, wca_id, password_hash, merged_into_user_id FROM app_users
         WHERE id IN (?, ?) ORDER BY id FOR UPDATE`,
        [sourceUserId, targetUserId],
      );
      const source = users.find((user) => Number(user.id) === sourceUserId);
      const target = users.find((user) => Number(user.id) === targetUserId);
      if (!source || !target) throw new AccountMergeError('not_found');
      if (source.merged_into_user_id != null || target.merged_into_user_id != null) {
        throw new AccountMergeError('already_merged');
      }
      if (source.wca_id && target.wca_id && source.wca_id !== target.wca_id) {
        throw new AccountMergeError('wca_conflict');
      }
      if (source.password_hash && target.password_hash && source.password_hash !== target.password_hash) {
        throw new AccountMergeError('credential_conflict');
      }

      const credentialCounts = await tx<{ user_id: number | string; provider: string }>(
        `SELECT user_id, provider FROM auth_identities
         WHERE user_id IN (?, ?) AND provider IN ('email', 'phone') FOR UPDATE`,
        [sourceUserId, targetUserId],
      );
      for (const provider of ['email', 'phone']) {
        if (credentialCounts.some((row) => Number(row.user_id) === sourceUserId && row.provider === provider)
          && credentialCounts.some((row) => Number(row.user_id) === targetUserId && row.provider === provider)) {
          throw new AccountMergeError('credential_conflict');
        }
      }

      await rejectUnsupportedDirectData(tx, sourceUserId);

      const finalWcaId = target.wca_id ?? source.wca_id;
      const finalOwnerKey = ownerKey(targetUserId, finalWcaId);
      await moveOwnerKey(tx, ownerKey(targetUserId, target.wca_id), finalOwnerKey);
      await moveOwnerKey(tx, ownerKey(sourceUserId, source.wca_id), finalOwnerKey);

      await tx('DELETE FROM account_last_devices WHERE user_id = ?', [sourceUserId]);
      await tx('DELETE FROM auth_web_session_tickets WHERE user_id = ?', [sourceUserId]);
      await tx('UPDATE auth_identities SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);

      // 先释放 source 持有的唯一 WCA ID，再写入 target；仍在同一事务内，不会出现中间态。
      await tx('UPDATE app_users SET wca_id = NULL WHERE id = ?', [sourceUserId]);

      await tx(`
        UPDATE app_users AS target SET
          wca_id = ?,
          display_name = CASE
            WHEN target.wca_id IS NULL AND ? THEN source.display_name
            ELSE COALESCE(NULLIF(target.display_name, ''), source.display_name)
          END,
          avatar_url = CASE
            WHEN target.avatar_source = 'auto' AND ? THEN source.avatar_url
            ELSE target.avatar_url
          END,
          full_name = COALESCE(target.full_name, source.full_name),
          birth_date = COALESCE(target.birth_date, source.birth_date),
          gender = COALESCE(target.gender, source.gender),
          country_iso2 = CASE
            WHEN target.wca_id IS NULL AND ? THEN source.country_iso2
            ELSE COALESCE(target.country_iso2, source.country_iso2)
          END,
          region_code = COALESCE(target.region_code, source.region_code),
          city_name = COALESCE(target.city_name, source.city_name),
          public_intro = COALESCE(target.public_intro, source.public_intro),
          public_intro_image_ids = CASE
            WHEN target.public_intro_image_ids = '[]'::jsonb THEN source.public_intro_image_ids
            ELSE target.public_intro_image_ids
          END,
          password_hash = COALESCE(target.password_hash, source.password_hash),
          password_updated_at = COALESCE(target.password_updated_at, source.password_updated_at),
          is_admin = target.is_admin OR source.is_admin,
          show_in_member_list = target.show_in_member_list AND source.show_in_member_list,
          email_notify = target.email_notify AND source.email_notify,
          lang = COALESCE(target.lang, source.lang),
          created_at = LEAST(target.created_at, source.created_at)
        FROM app_users AS source
        WHERE target.id = ? AND source.id = ?
      `, [finalWcaId, !!source.wca_id, !!source.wca_id, !!source.wca_id, targetUserId, sourceUserId]);

      await tx(`
        UPDATE app_users SET
          display_name = '', avatar_url = NULL, avatar_source = 'auto', avatar_preset = NULL,
          wca_id = NULL, is_admin = FALSE, full_name = NULL, birth_date = NULL, gender = NULL,
          country_iso2 = NULL, region_code = NULL, city_name = NULL, public_intro = NULL,
          public_intro_image_ids = '[]'::jsonb, show_in_member_list = FALSE,
          password_hash = NULL, password_updated_at = NULL, email_notify = FALSE, lang = NULL,
          merged_into_user_id = ?
        WHERE id = ?
      `, [targetUserId, sourceUserId]);
      await tx(
        `UPDATE auth_codes SET consumed_at = NOW()
         WHERE channel = 'merge' AND target = ? AND consumed_at IS NULL`,
        [String(sourceUserId)],
      );
    });
  } catch (error) {
    if (error instanceof AccountMergeError) throw error;
    if ((error as { code?: string })?.code === '23505') throw new AccountMergeError('data_conflict');
    throw error;
  }
}
