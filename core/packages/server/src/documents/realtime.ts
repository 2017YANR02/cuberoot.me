import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { query } from '../db/connection.js';
import { authenticateUser, type WcaUser } from '../utils/recon_helpers.js';

type DocumentContext = WcaUser & { role: 'owner' | 'editor' | 'viewer' };

function documentId(name: string): string {
  return name.startsWith('document.') ? name.slice('document.'.length) : '';
}

export const collaborativeDocuments = new Hocuspocus<DocumentContext>({
  debounce: 1200,
  maxDebounce: 5000,
  quiet: true,
  extensions: [
    new Database({
      async fetch({ documentName }) {
        const id = documentId(documentName);
        if (!id) return null;
        const rows = await query<{ ydoc_state: Uint8Array }>(
          'SELECT ydoc_state FROM collaborative_documents WHERE id = ?',
          [id],
        );
        return rows[0]?.ydoc_state ? new Uint8Array(rows[0].ydoc_state) : null;
      },
      async store({ documentName, state }) {
        const id = documentId(documentName);
        if (!id) return;
        await query(
          'UPDATE collaborative_documents SET ydoc_state = ?, updated_at = NOW() WHERE id = ?',
          [state, id],
        );
      },
    }),
  ],
  async onAuthenticate({ documentName, token, connectionConfig }) {
    const id = documentId(documentName);
    const user = id ? await authenticateUser(token ? `Bearer ${token}` : undefined) : null;
    if (!user || BANNED_WCA_IDS.includes(user.wcaId)) throw new Error('Authentication required');
    const rows = await query<{ role: DocumentContext['role'] }>(
      'SELECT role FROM collaborative_document_members WHERE document_id = ? AND user_key = ?',
      [id, user.wcaId],
    );
    const role = rows[0]?.role;
    if (!role) throw new Error('Document access denied');
    connectionConfig.readOnly = role === 'viewer';
    return { ...user, role };
  },
  async beforeHandleAwareness({ context, states }) {
    if (!context) return;
    for (const [clientId, state] of states) {
      states.set(clientId, {
        ...state,
        user: {
          ...(typeof state.user === 'object' && state.user ? state.user : {}),
          key: context.wcaId,
          name: context.name || context.wcaId,
        },
      });
    }
  },
});
