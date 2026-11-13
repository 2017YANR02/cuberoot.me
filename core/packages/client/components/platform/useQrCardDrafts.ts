import { useEffect, useRef, useState } from 'react';
import { DEFAULT_QR_CARD, normalizeQrCard, type PlatformQrCard } from '@/lib/platform-qr-card';

interface SaveToken {
  epoch: number;
  revision: number;
}

/** Saved cards and editable drafts have separate lifetimes, including during a save. */
export function useQrCardDrafts() {
  const [cards, setCards] = useState<Record<string, PlatformQrCard>>({});
  const [drafts, setDrafts] = useState<Record<string, PlatformQrCard>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const revisions = useRef<Record<string, number>>({});
  const scope = useRef({ active: false, epoch: 0 });

  useEffect(() => {
    const current = scope.current;
    current.active = true;
    current.epoch += 1;
    return () => { current.active = false; current.epoch += 1; };
  }, []);

  const saveToken = (id: string): SaveToken => ({
    epoch: scope.current.epoch,
    revision: revisions.current[id] ?? 0,
  });
  const isCurrent = (id: string, token: SaveToken): boolean => scope.current.active
    && token.epoch === scope.current.epoch && token.revision === (revisions.current[id] ?? 0);

  const hydrate = (loaded: Record<string, PlatformQrCard>) => {
    if (!scope.current.active) return;
    setCards(current => ({ ...current, ...loaded }));
    setDrafts(current => {
      const next = { ...current };
      for (const [id, card] of Object.entries(loaded)) {
        if (!next[id]) next[id] = normalizeQrCard(card);
      }
      return next;
    });
  };

  const edit = (id: string, updater: (card: PlatformQrCard) => PlatformQrCard) => {
    revisions.current[id] = (revisions.current[id] ?? 0) + 1;
    setDrafts(current => ({ ...current, [id]: updater(current[id] ?? cards[id] ?? DEFAULT_QR_CARD) }));
    setDirtyIds(current => new Set(current).add(id));
  };

  const acceptSaved = (id: string, card: PlatformQrCard, token: SaveToken): boolean => {
    if (!scope.current.active || token.epoch !== scope.current.epoch) return false;
    setCards(current => ({ ...current, [id]: card }));
    // A newer edit remains visible and dirty; the returned server snapshot is only
    // the saved baseline. Export/print callers must stop when this returns false.
    if (!isCurrent(id, token)) {
      // Reset can have restored the previous baseline while this request was in
      // flight. That baseline is now an unsaved draft against the newer server copy.
      setDirtyIds(current => new Set(current).add(id));
      return false;
    }
    setDrafts(current => ({ ...current, [id]: normalizeQrCard(card) }));
    setDirtyIds(current => { const next = new Set(current); next.delete(id); return next; });
    return true;
  };

  const reset = (id: string) => {
    if (!cards[id]) return;
    revisions.current[id] = (revisions.current[id] ?? 0) + 1;
    setDrafts(current => ({ ...current, [id]: normalizeQrCard(cards[id]) }));
    setDirtyIds(current => { const next = new Set(current); next.delete(id); return next; });
  };

  return { cards, drafts, dirtyIds, hydrate, edit, saveToken, isCurrent, acceptSaved, reset };
}
