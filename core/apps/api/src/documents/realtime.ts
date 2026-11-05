import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { ADMIN_WCA_IDS, BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { query } from '../db/connection.js';
import { authenticateUser, type WcaUser } from '../utils/recon_helpers.js';
import { documentAccessFor, type DocumentRole } from './access.js';
import { assertCommentOnlyUpdate } from './comment-permissions.js';
import { notify } from '../utils/notify.js';

const accessTimers = new Map<string, ReturnType<typeof setInterval>>();

type DocumentContext = WcaUser & { role: DocumentRole; token: string };

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
      WHERE d.id = s.document_id
        AND d.id = ?
        AND (EXISTS (SELECT 1 FROM collaborative_document_members m WHERE m.document_id = d.id AND m.user_key = s.user_key)
          OR d.general_access = 'anyone'
          OR (d.general_access = 'admins' AND EXISTS (SELECT 1 FROM app_users u
            WHERE COALESCE(u.wca_id, 'u' || u.id::text) = s.user_key AND u.merged_into_user_id IS NULL
              AND (u.is_admin = TRUE OR u.wca_id = ANY(?::text[])))))
        AND NOT (s.user_key = ANY(?::text[]))
        AND s.subscribed
        AND s.user_key <> ?
        AND (s.last_notified_at IS NULL OR s.last_notified_at < NOW() - INTERVAL '15 minutes')
      RETURNING s.user_key, d.title, d.kind`,
    [id, [...ADMIN_WCA_IDS], [...BANNED_WCA_IDS], actor.wcaId],
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
    link: `/${resource.kind === 'spreadsheet' ? 'sheets' : 'docs'}/edit?id=${encodeURIComponent(id)}`,
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
    if (token && !user || user && BANNED_WCA_IDS.includes(user.wcaId)) throw new Error('Authentication required');
    const access = await documentAccessFor(id, user);
    if (!access) throw new Error('Document access denied');
    connectionConfig.readOnly = access.role === 'viewer';
    return { ...(user ?? { wcaId: '', name: 'Guest', isAdmin: false }), role: access.role, token: token || '' };
  },
  async beforeSync({ documentName, context, connection, document, type, payload }) {
    // Resolve the current account role for every sync, including after an admin
    // grant is revoked. The connection's initial role is never an authorization cache.
    const user = context.token ? await authenticateUser(`Bearer ${context.token}`) : null;
    if (context.token && !user) throw new Error('Authentication required');
    const access = await documentAccessFor(documentId(documentName), user);
    if (!access) throw new Error('Document access denied');
    context.role = access.role;
    connection.readOnly = access.role === 'viewer';
    if (access.role === 'commenter' && (type === 1 || type === 2)) assertCommentOnlyUpdate(document, payload);
  },
  async afterLoadDocument({ documentName, document }) {
    // Idle readers must also lose access after account/admin revocation.
    let checking = false;
    const timer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        await Promise.all(document.getConnections().map(async connection => {
          const context = connection.context as DocumentContext;
          try {
            const user = context.token ? await authenticateUser(`Bearer ${context.token}`) : null;
            const access = context.token && !user ? null : await documentAccessFor(documentId(documentName), user);
            if (!access || access.role !== context.role) connection.close();
          } catch { connection.close(); }
        }));
      } finally { checking = false; }
    }, 30_000);
    timer.unref();
    accessTimers.set(documentName, timer);
  },
  async afterUnloadDocument({ documentName }) {
    clearInterval(accessTimers.get(documentName)); accessTimers.delete(documentName);
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
