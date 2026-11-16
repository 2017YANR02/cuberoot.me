import { SITE_ASSISTANT_QUESTION_MAX_LENGTH } from '@cuberoot/shared/site-assistant';
import { safeNext } from './safe-next';

const KEY = 'cuberoot-assistant-auth-draft';
const MAX_AGE = 2 * 60 * 60 * 1000;
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface Draft {
  id: string;
  text: string;
  returnTo: string;
  scrollY: number;
  uid: number | null;
  expiresAt: number;
  phase: 'draft' | 'auth' | 'ready' | 'restored';
  send: boolean;
}
type Input = Pick<Draft, 'id' | 'text' | 'returnTo' | 'scrollY' | 'uid'>;

/** Text only, confined to the initiating tab. Auth completion is explicit: a
 * session appearing during password recovery must not submit a half-written draft. */
export function createAssistantAuthContinuation(storage: () => StorageAccess, now = Date.now) {
  const clear = () => { try { storage().removeItem(KEY); } catch { /* Unavailable storage. */ } };
  const read = (): Draft | null => {
    try {
      const value = JSON.parse(storage().getItem(KEY) || 'null') as Draft | null;
      if (!value) return null;
      if (!/^[0-9a-f-]{36}$/i.test(value.id) || typeof value.text !== 'string'
        || !value.text.trim() || value.text.length > SITE_ASSISTANT_QUESTION_MAX_LENGTH
        || !safeNext(value.returnTo) || /^\/(?:zh\/)?(?:auth|account)(?:\/|\?|$)/.test(value.returnTo)
        || !(value.uid === null || Number.isSafeInteger(value.uid) && value.uid > 0)
        || !Number.isFinite(value.scrollY) || value.scrollY < 0
        || !Number.isFinite(value.expiresAt) || value.expiresAt <= now() || value.expiresAt > now() + MAX_AGE
        || !['draft', 'auth', 'ready', 'restored'].includes(value.phase) || typeof value.send !== 'boolean') {
        clear(); return null;
      }
      return value;
    } catch { return null; }
  };
  const write = (value: Draft): boolean => {
    try {
      const serialized = JSON.stringify(value);
      storage().setItem(KEY, serialized);
      return storage().getItem(KEY) === serialized;
    } catch { return false; }
  };
  return {
    read,
    clear(id?: string) { if (!id || read()?.id === id) clear(); },
    save(input: Input, send = false) {
      if (!input.text.trim()) { if (read()?.id === input.id) clear(); return true; }
      const returnTo = safeNext(input.returnTo);
      if (!returnTo || input.text.length > SITE_ASSISTANT_QUESTION_MAX_LENGTH) return false;
      const previous = read();
      const restored = previous?.id === input.id && previous.uid === input.uid && previous.phase === 'restored';
      return write({ ...input, returnTo, expiresAt: now() + MAX_AGE, send, phase: send ? 'auth' : restored ? 'restored' : 'draft' });
    },
    matches(returnTo: string | null) { return !!returnTo && read()?.returnTo === safeNext(returnTo); },
    complete(returnTo: string | null, uid: number | undefined) {
      const draft = read();
      if (!draft || !uid || draft.returnTo !== safeNext(returnTo) || draft.uid !== null && draft.uid !== uid) return false;
      return write({ ...draft, uid, phase: 'ready' });
    },
    takeReturn(returnTo: string, uid: number) {
      const draft = read();
      if (!draft || draft.returnTo !== safeNext(returnTo) || draft.uid !== uid
        || (draft.phase !== 'ready' && draft.phase !== 'restored')) return null;
      // Persist the claim before dispatch. Reloads restore the text, never replay
      // an automatically sent message; the normal delivery ID supports retry.
      if (!write({ ...draft, send: false, phase: 'restored' })) return null;
      return { ...draft, send: draft.phase === 'ready' && draft.send };
    },
  };
}

export const assistantAuthContinuation = createAssistantAuthContinuation(() => window.sessionStorage);
export const assistantReturnPath = () => window.location.pathname + window.location.search + window.location.hash;
export const canUseAssistant = (user: { wcaId?: string | null } | null) => !!user && /^\d{4}[A-Z]{4}\d{2}$/.test(user.wcaId ?? '');
