import { installedPetAvailable } from '@/lib/installed-content';
import type { ChatExpressionPack } from '@cuberoot/app-ui/chat';
import { resolveDeskPets, type DeskPetCatalog } from '@cuberoot/shared/deskpet';
import { PET_GALLERY } from './deskpet-gallery';
import { THEMES, THEME_IDS } from './deskpet-themes';
// WeChat artwork is withheld pending distribution rights. Do not import its
// archived manifest: unknown legacy tokens already fall back to plain text.

/** Same visibility and asset manifests as the pet selector, without the admin bypass.
 * Tokens refer to stable character/file identities, never copied image URLs or versions.
 * A manifest/version update automatically updates both old messages and the picker.
 */
export function getPetExpressionPacks(catalog: DeskPetCatalog | null): ChatExpressionPack[] {
  if (!catalog) return [];
  return resolveDeskPets(THEME_IDS, catalog.entries).filter(entry => installedPetAvailable(entry.id) && !entry.locked && !entry.removed).flatMap(entry => {
    const group = PET_GALLERY.find(group => group.id === entry.id);
    const theme = THEMES[entry.id as keyof typeof THEMES];
    if (!group || !theme) return [];
    const label = entry.label ?? theme.label;
    // Script-driven cloud animations do not execute in an image; use their shared thumbnail.
    const items = group.scripted ? [{ token: `[pet:${entry.id}:idle]`, src: theme.thumb, ...label, large: true }]
      : group.anims.map(anim => ({
        token: `[pet:${entry.id}:${anim.file}]`,
        src: anim.src ?? `${group.base}${anim.file}${group.v ? `?v=${group.v}` : ''}`,
        zh: `${label.zh} · ${anim.zh}`, en: `${label.en} · ${anim.en}`, large: true,
      }));
    return [{ id: `pet:${entry.id}`, ...label, items }];
  });
}
