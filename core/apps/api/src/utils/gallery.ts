import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';

// An image must still belong to the owner's saved profile to be published/reviewed.
export const GALLERY_OWNER_JOIN = `UPPER(COALESCE(u.wca_id, 'u' || u.id::text)) = UPPER(i.owner_wca_id)
  AND u.public_intro_image_ids @> jsonb_build_array(i.id)`;

const rootAdmins = ADMIN_WCA_IDS.map(id => `'${id.toUpperCase().replaceAll("'", "''")}'`).join(', ');
export const GALLERY_ACTIVE_OWNER = `(u.is_admin = TRUE
  ${rootAdmins ? `OR UPPER(u.wca_id) IN (${rootAdmins})` : ''}
  OR EXISTS (SELECT 1 FROM effective_memberships m
    WHERE UPPER(m.wca_id) = UPPER(i.owner_wca_id)
      AND (m.expires_at IS NULL OR m.expires_at > NOW())))`;

export const GALLERY_IS_PUBLIC = `(i.gallery_status = 'public' AND EXISTS (
  SELECT 1 FROM app_users u WHERE ${GALLERY_OWNER_JOIN} AND ${GALLERY_ACTIVE_OWNER}
))`;
