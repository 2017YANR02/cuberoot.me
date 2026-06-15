// Drive the global desk-pet (components/DeskPet.tsx) from anywhere on the site.
// DeskPet listens for the 'clawd:state' CustomEvent; this is the typed, SSR-safe
// sender so pages don't hand-roll dispatchEvent. Keep reactions to genuine
// high-points (PB / DNF / right / wrong) — the pet should feel alive, not noisy.
export type PetReaction =
  | 'happy'
  | 'thinking'
  | 'working'
  | 'building'
  | 'juggling'
  | 'error'
  | 'notification'
  | 'reading'
  | 'reactAnnoyed'
  | 'idle';

export function petReact(state: PetReaction): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('clawd:state', { detail: state }));
}
