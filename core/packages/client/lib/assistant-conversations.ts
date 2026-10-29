import type { AssistantImage } from '@cuberoot/shared/site-assistant';
import type { AssistantTurn } from '@/components/SiteAssistantDialog';
import { persistItem } from '@/lib/safe-storage';

export interface AssistantConversationSnapshot {
  draft: string;
  images: AssistantImage[];
  turns: AssistantTurn[];
  conversationId: string | null;
}
export interface AssistantConversation {
  id: string;
  title?: string;
  snapshot: AssistantConversationSnapshot;
  pinned?: boolean;
  unreadReply?: boolean;
  pending?: { question: string; images: AssistantImage[] };
}
interface Workspace { activeId: string; conversations: AssistantConversation[]; open: boolean; opened: boolean }
const empty: Workspace = { activeId: '', conversations: [], open: false, opened: false };
export const assistantOwner = (user: { uid?: number; wcaId?: string | null } | null) => user ? JSON.stringify([user.uid, user.wcaId]) : 'guest';

/** Page-session state, separate from server request logs. Closing the workspace
 * preserves chats; account changes select a different, isolated workspace. */
export function createAssistantConversations() {
  const workspaces = new Map<string, Workspace>();
  const restored = new Set<string>();
  const listeners = new Set<() => void>();
  const read = (owner: string) => workspaces.get(owner) ?? empty;
  const write = (owner: string, next: Workspace) => {
    workspaces.set(owner, next);
    try {
      const pinned = next.conversations.filter(item => item.pinned).map(item => ({ ...item, pending: undefined, snapshot: {
        ...item.snapshot, images: [], turns: item.snapshot.turns.map(turn => ({ ...turn, images: undefined, imagesExpired: !!turn.images?.length || turn.imagesExpired })),
      } }));
      if (restored.has(owner)) persistItem(`cuberoot-assistant-pinned:${owner}`, JSON.stringify(pinned));
    } catch { /* The current page session remains usable when storage is unavailable. */ }
    listeners.forEach(listener => listener());
  };
  return {
    read,
    serverSnapshot: () => empty,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    restorePinned(owner: string) {
      if (typeof window === 'undefined' || restored.has(owner)) return;
      restored.add(owner);
      try {
        const saved = JSON.parse(localStorage.getItem(`cuberoot-assistant-pinned:${owner}`) || '[]');
        if (!Array.isArray(saved)) return;
        const conversations = saved.filter(item => item && typeof item.id === 'string' && item.snapshot && Array.isArray(item.snapshot.turns)).map(item => ({ ...item, pinned: true, pending: undefined }));
        const current = read(owner);
        const existing = new Set(current.conversations.map(item => item.id));
        if (conversations.length) write(owner, { ...current, activeId: current.activeId || conversations[0].id, conversations: [...current.conversations, ...conversations.filter(item => !existing.has(item.id))] });
      } catch { /* Ignore unavailable or malformed storage. */ }
    },
    setPinned(owner: string, id: string, pinned: boolean) {
      const current = read(owner);
      if (!current.conversations.some(item => item.id === id)) return;
      write(owner, { ...current, conversations: current.conversations.map(item => item.id === id ? { ...item, pinned } : item) });
    },
    rename(owner: string, id: string, title: string) {
      const current = read(owner);
      const nextTitle = title.trim().slice(0, 120);
      const found = current.conversations.find(item => item.id === id);
      if (!found || !nextTitle || found.title === nextTitle) return;
      write(owner, { ...current, conversations: current.conversations.map(item => item.id === id ? { ...item, title: nextTitle } : item) });
    },
    create(owner: string, id: string) {
      const current = read(owner);
      if (current.conversations.some(item => item.id === id)) return;
      const conversation: AssistantConversation = { id, snapshot: { draft: '', images: [], turns: [], conversationId: null } };
      write(owner, { ...current, activeId: id, conversations: [...current.conversations, conversation] });
    },
    branch(owner: string, id: string, turns: AssistantTurn[]) {
      const current = read(owner);
      if (!turns.length || current.conversations.some(item => item.id === id)) return;
      const conversation: AssistantConversation = { id, snapshot: {
        draft: '', images: [], turns: structuredClone(turns), conversationId: null,
      } };
      write(owner, { ...current, activeId: id, open: true, opened: true, conversations: [...current.conversations, conversation] });
    },
    setOpen(owner: string, open: boolean) {
      const current = read(owner);
      if (current.open !== open) write(owner, { ...current, open, opened: current.opened || open });
    },
    patch(owner: string, id: string, patch: Partial<AssistantConversationSnapshot>) {
      const found = read(owner).conversations.find(item => item.id === id);
      if (found) this.update(owner, id, { ...found.snapshot, ...patch });
    },
    submit(owner: string, id: string, question: string, images: AssistantImage[]) {
      const current = read(owner);
      const found = current.conversations.find(item => item.id === id);
      if (!found || found.pending) return false;
      write(owner, { ...current, open: true, opened: true, conversations: current.conversations.map(item => item.id === id
        ? { ...item, pending: { question, images }, snapshot: { ...item.snapshot, draft: '', images: [] } } : item) });
      return true;
    },
    takeSubmission(owner: string, id: string) {
      const current = read(owner);
      const pending = current.conversations.find(item => item.id === id)?.pending;
      if (!pending) return null;
      write(owner, { ...current, conversations: current.conversations.map(item => item.id === id ? { ...item, pending: undefined } : item) });
      return pending;
    },
    select(owner: string, id: string) {
      const current = read(owner);
      if (current.activeId !== id && current.conversations.some(item => item.id === id)) write(owner, { ...current, activeId: id });
    },
    replyCompleted(owner: string, id: string) {
      const current = read(owner);
      const found = current.conversations.find(item => item.id === id);
      if (!found || found.unreadReply) return;
      write(owner, { ...current, conversations: current.conversations.map(item => item.id === id ? { ...item, unreadReply: true } : item) });
    },
    markReplyRead(owner: string, id: string) {
      const current = read(owner);
      if (!current.conversations.some(item => item.id === id && item.unreadReply)) return;
      write(owner, { ...current, conversations: current.conversations.map(item => item.id === id ? { ...item, unreadReply: false } : item) });
    },
    update(owner: string, id: string, snapshot: AssistantConversationSnapshot) {
      const current = read(owner);
      const found = current.conversations.find(item => item.id === id);
      if (!found || (found.snapshot.draft === snapshot.draft && found.snapshot.images === snapshot.images && found.snapshot.turns === snapshot.turns && found.snapshot.conversationId === snapshot.conversationId)) return;
      write(owner, { ...current, conversations: current.conversations.map(item => item.id === id ? { ...item, snapshot } : item) });
    },
  };
}
export const assistantConversations = createAssistantConversations();
