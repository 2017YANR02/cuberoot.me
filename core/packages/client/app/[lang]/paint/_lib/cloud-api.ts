// Cloud library client for /paint — talks to /v1/paint/drawings (server routes/paint.ts).
// Identity is the Bearer JWT (authHeaders); the client never sends a wca_id.
// `doc` is JSON.stringify(PaintDoc) on the wire; parsed back to PaintDoc on read.
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import type { PaintDoc } from './types';
import { DEFAULT_PAPER } from './paper';

const ENDPOINT = '/v1/paint/drawings';

export interface DrawingMeta {
  id: number;
  title: string;
  thumbnail: string | null;
  byteSize: number;
  createdAt: number;
  updatedAt: number;
}
export interface DrawingFull extends DrawingMeta {
  doc: PaintDoc;
}

function normalizeDoc(raw: string): PaintDoc {
  const d = JSON.parse(raw) as Partial<PaintDoc>;
  return {
    shapes: d.shapes ?? {},
    order: Array.isArray(d.order) ? d.order : [],
    paper: typeof d.paper === 'string' ? d.paper : DEFAULT_PAPER,
  };
}

export async function listDrawings(): Promise<DrawingMeta[]> {
  const r = await fetch(apiUrl(ENDPOINT), { headers: authHeaders(false) });
  const d = await handleApi<{ drawings?: DrawingMeta[] }>(r);
  return d.drawings ?? [];
}

export async function getDrawing(id: number): Promise<DrawingFull> {
  const r = await fetch(apiUrl(`${ENDPOINT}/${id}`), { headers: authHeaders(false) });
  const d = await handleApi<{ drawing: DrawingMeta & { doc: string } }>(r);
  return { ...d.drawing, doc: normalizeDoc(d.drawing.doc) };
}

export async function createDrawing(
  title: string,
  doc: PaintDoc,
  thumbnail: string | null,
): Promise<{ id: number; title: string; createdAt: number; updatedAt: number }> {
  const r = await fetch(apiUrl(ENDPOINT), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ title, doc: JSON.stringify(doc), thumbnail }),
  });
  return handleApi(r);
}

export async function updateDrawing(
  id: number,
  patch: { title?: string; doc?: PaintDoc; thumbnail?: string | null },
): Promise<{ ok: boolean; updatedAt: number }> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.doc !== undefined) body.doc = JSON.stringify(patch.doc);
  if (patch.thumbnail !== undefined) body.thumbnail = patch.thumbnail;
  const r = await fetch(apiUrl(`${ENDPOINT}/${id}`), {
    method: 'PUT',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  return handleApi(r);
}

export async function deleteDrawing(id: number): Promise<void> {
  const r = await fetch(apiUrl(`${ENDPOINT}/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}
