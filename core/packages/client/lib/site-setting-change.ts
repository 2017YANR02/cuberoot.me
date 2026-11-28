import type { SiteSettings } from '@cuberoot/shared/appearance';

// Only an explicit preference edit enters the account queue. OS theme changes,
// route initialization, hover previews and restoring a snapshot are presentation.
export const SITE_SETTING_EDIT = 'cuberoot:site-setting-edit';
export function siteSettingEdited(patch: Partial<SiteSettings>) {
  window.dispatchEvent(new CustomEvent(SITE_SETTING_EDIT, { detail: patch }));
}
