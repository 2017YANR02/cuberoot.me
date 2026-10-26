import type { AssistantImage } from '@cuberoot/shared/site-assistant';
import type { AssistantTurn } from '@/components/SiteAssistantDialog';

export interface AssistantConversationSnapshot {
  draft: string;
  images: AssistantImage[];
  turns: AssistantTurn[];
  conversationId: string | null;
}
export interface AssistantConversation {
  id: string;
  snapshot: AssistantConversationSnapshot;
}
interface Workspace { activeId: string; conversations: AssistantConversation[] }
const empty: Workspace = { activeId: '', conversations: [] };

/** Page-session state, separate from server request logs. Closing the workspace
 * preserves chats; account changes select a different, isolated workspace. */
export function createAssistantConversations() {
  const workspaces = new Map<string, Workspace>();
  const listeners = new Set<() => void>();
  const read = (owner: string) => workspaces.get(owner) ?? empty;
  const write = (owner: string, next: Workspace) => {
    workspaces.set(owner, next);
    listeners.forEach(listener => listener());
  };
  return {
    read,
    serverSnapshot: () => empty,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    create(owner: string, id: string) {
      const current = read(owner);
      const conversation: AssistantConversation = { id, snapshot: { draft: '', images: [], turns: [], conversationId: null } };
      write(owner, { activeId: id, conversations: [...current.conversations, conversation] });
    },
    select(owner: string, id: string) {
      const current = read(owner);
      if (current.activeId !== id && current.conversations.some(item => item.id === id)) write(owner, { ...current, activeId: id });
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
