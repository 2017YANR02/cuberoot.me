import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

export type DocumentRole = 'owner' | 'editor' | 'viewer';

export interface CollaborativeDocument {
  id: string;
  title: string;
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

export interface DocumentDetails {
  document: CollaborativeDocument;
  canManage: boolean;
  members: DocumentMember[];
}

export async function fetchDocuments(): Promise<CollaborativeDocument[]> {
  const result = await handleApi<{ documents: CollaborativeDocument[] }>(
    await fetch(apiUrl('/v1/documents'), { headers: authHeaders(false), cache: 'no-store' }),
  );
  return result.documents;
}

export async function fetchDocument(id: string): Promise<DocumentDetails> {
  return handleApi(await fetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  }));
}

export async function createDocument(title: string): Promise<{ id: string }> {
  return handleApi(await fetch(apiUrl('/v1/documents'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  }));
}

export async function importDocument(file: File, title?: string): Promise<{ id: string; warnings: string[] }> {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  return handleApi(await fetch(apiUrl('/v1/documents/import'), {
    method: 'POST',
    headers: authHeaders(false),
    body: form,
  }));
}

export async function updateDocumentTitle(id: string, title: string): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  }));
}

export async function searchDocumentPeople(q: string): Promise<DocumentPerson[]> {
  const result = await handleApi<{ people: DocumentPerson[] }>(await fetch(
    apiUrl(`/v1/documents/people?q=${encodeURIComponent(q)}`),
    { headers: authHeaders(false), cache: 'no-store' },
  ));
  return result.people;
}

export async function addDocumentMember(id: string, userKey: string, role: Exclude<DocumentRole, 'owner'>): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/members`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userKey, role }),
  }));
}

export async function updateDocumentMember(id: string, userKey: string, role: Exclude<DocumentRole, 'owner'>): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/members/${encodeURIComponent(userKey)}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ role }),
  }));
}

export async function removeDocumentMember(id: string, userKey: string): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/documents/${encodeURIComponent(id)}/members/${encodeURIComponent(userKey)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  }));
}
