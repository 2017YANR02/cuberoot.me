import { persistItem } from './safe-storage';
import { THEME_IDS, type ThemeId } from './deskpet-themes';

const STORAGE_KEY = 'clawd-deskpet-char';
const CHANGE_EVENT = 'deskpet-character-change';
let visitChoice: ThemeId | undefined;

export function getDeskPetSelection(): ThemeId | null {
  if (visitChoice !== undefined) return visitChoice;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEME_IDS.find(id => id === saved) ?? null;
  } catch { return null; }
}

export function getServerDeskPetSelection(): null { return null; }

export function subscribeDeskPetSelection(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    visitChoice = undefined;
    notify();
  };
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', sync);
  };
}

export function setDeskPetSelection(character: ThemeId) {
  visitChoice = persistItem(STORAGE_KEY, character) ? undefined : character;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
