import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

export type DocumentRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type DocumentKind = 'document' | 'spreadsheet';

export interface CollaborativeDocument {
  id: string;
  title: string;
  kind: DocumentKind;
  ownerKey: string;
  role: DocumentRole;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMember {
  key: string;
  name: string;
  avatar: string;
  role: DocumentRole;
}

export interface DocumentPerson {
  key: string;
  name: string;
  avatar: string;
  wcaId: string;
}

export interface DocumentSharing {
  access: 'restricted' | 'admins' | 'anyone';
  role: Exclude<DocumentRole, 'owner'>;
  editorsCanShare: boolean;
  editorsCanExport: boolean;
  viewersCanExport: boolean;
}
export const DEFAULT_DOCUMENT_SHARING: DocumentSharing = {
  access: 'restricted', role: 'viewer', editorsCanShare: false, editorsCanExport: true, viewersCanExport: true,
};

export interface DocumentDetails {
  document: CollaborativeDocument;
  canManage: boolean;
  canExport?: boolean;
  sharing?: DocumentSharing;
  members: DocumentMember[];
  /** Optional while the frontend and API roll out independently. */
  subscription?: { subscribed: boolean; lastSeenAt: string | null };
}

export async function fetchDocuments(kind: DocumentKind | 'all' = 'document'): Promise<CollaborativeDocument[]> {
  const result = await handleApi<{ documents: CollaborativeDocument[] }>(
    await sessionFetch(apiUrl(`/v1/documents${kind === 'all' ? '' : `?kind=${kind}`}`), { headers: authHeaders(false), cache: 'no-store' }),
  );
  return result.documents;
}

export async function fetchDocument(id: string): Promise<DocumentDetails> {
  return handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  }));
}

export interface InitialSpreadsheet {
  sheets: Array<{ name: string; cells: Record<string, string> }>;
}

export async function createDocument(
  title: string,
  kind: DocumentKind = 'document',
  spreadsheet?: InitialSpreadsheet,
): Promise<{ id: string }> {
  return handleApi(await sessionFetch(apiUrl('/v1/documents'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, kind, spreadsheet }),
  }));
}

export async function importDocument(file: File, title?: string): Promise<{ id: string; warnings: string[] }> {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  return handleApi(await sessionFetch(apiUrl('/v1/documents/import'), {
    method: 'POST',
    headers: authHeaders(false),
    body: form,
  }));
}

export async function updateDocumentTitle(id: string, title: string): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  }));
}

export async function searchDocumentPeople(q: string): Promise<DocumentPerson[]> {
  const result = await handleApi<{ people: DocumentPerson[] }>(await sessionFetch(
    apiUrl(`/v1/documents/people?q=${encodeURIComponent(q)}`),
    { headers: authHeaders(false), cache: 'no-store' },
  ));
  return result.people;
}

export async function addDocumentMember(id: string, userKey: string, role: Exclude<DocumentRole, 'owner'>): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/members`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userKey, role }),
  }));
}

export async function updateDocumentSharing(id: string, sharing: DocumentSharing): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/sharing`), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(sharing),
  }));
}

export async function updateDocumentMember(id: string, userKey: string, role: Exclude<DocumentRole, 'owner'>): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/members/${encodeURIComponent(userKey)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ role }),
  }));
}

export async function removeDocumentMember(id: string, userKey: string): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/members/${encodeURIComponent(userKey)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}

export async function updateDocumentSubscription(id: string, subscribed: boolean): Promise<{ subscribed: boolean; lastSeenAt: string }> {
  return handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/subscription`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ subscribed }),
  }));
}

export async function markDocumentSeen(id: string): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/seen`), {
    method: 'POST',
    headers: authHeaders(false),
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}`), {
    method: 'DELETE', headers: authHeaders(false),
  }));
}
