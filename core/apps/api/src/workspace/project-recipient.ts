/** SQL predicates shared by private project, payroll and contract recipients. */
export const eligibleRecipient = `u.merged_into_user_id IS NULL AND NOT u.forum_banned
  AND NOT EXISTS (SELECT 1 FROM role_preview_profiles p WHERE p.user_id=u.id)`;
export const activeRecipients = `FROM workspace_members m JOIN app_users u ON u.id=m.user_id
  WHERE (m.active OR m.admin_access) AND ${eligibleRecipient}`;
