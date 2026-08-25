import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { query } from '../db/connection.js';
import { authenticateUser, type WcaUser } from '../utils/recon_helpers.js';
import { notify } from '../utils/notify.js';

type DocumentContext = WcaUser & { role: 'owner' | 'editor' | 'viewer' };

function documentId(name: string): string {
  return name.startsWith('document.') ? name.slice('document.'.length) : '';
}

type SubscriberRow = { user_key: string; title: string; kind: 'document' | 'spreadsheet' };

async function notifySubscribers(documentName: string, actor: DocumentContext): Promise<void> {
  const id = documentId(documentName);
  if (!id || !actor?.wcaId) return;
  const recipients = await query<SubscriberRow>(
    `UPDATE collaborative_document_subscriptions s
        SET last_notified_at = NOW()
       FROM collaborative_documents d
       JOIN collaborative_document_members m ON m.document_id = d.id
      WHERE d.id = s.document_id
        AND d.id = ?
        AND m.user_key = s.user_key
        AND s.subscribed
        AND s.user_key <> ?
        AND (s.last_notified_at IS NULL OR s.last_notified_at < NOW() - INTERVAL '15 minutes')
      RETURNING s.user_key, d.title, d.kind`,
    [id, actor.wcaId],
  );
  if (!recipients.length) return;
  const resource = recipients[0];
  await notify({
    recipients: recipients.map((row) => row.user_key),
    kind: 'document_change',
    actorKey: actor.wcaId,
    actorName: actor.name || actor.wcaId,
    title: resource.title,
    excerpt: '打开协作文件查看最新正文、批注、建议和修改记录。 Open the collaborative file to review its latest content, comments, suggestions, and activity.',
    link: `/${resource.kind === 'spreadsheet' ? 'spreadsheets' : 'docs'}/edit?id=${encodeURIComponent(id)}`,
  });
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
  async afterStoreDocument({ documentName, lastContext }) {
    void notifySubscribers(documentName, lastContext).catch((error) => {
      console.warn(`[documents] change notification failed:`, (error as Error).message);
    });
  },
});
