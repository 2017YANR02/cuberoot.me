/**
 * /memo/colpi backend API client. All word data lives in PG (colpi_words / colpi_votes).
 * Ported from packages/client/src/utils/colpi_api.ts.
 */
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/colpi';

export type Category =
  | 'unspecified' | 'object' | 'person' | 'action' | 'place' | 'other';

export type Language =
  | 'af' | 'ar' | 'bg' | 'ca' | 'cz' | 'da' | 'de' | 'en' | 'es' | 'eu'
  | 'fa' | 'fi' | 'fr' | 'gu' | 'he' | 'hi' | 'hr' | 'hu' | 'id' | 'it'
  | 'ja' | 'kr' | 'lt' | 'mk' | 'ms' | 'nl' | 'no' | 'pl' | 'pt' | 'ro'
  | 'ru' | 'se' | 'sk' | 'sl' | 'th' | 'tr' | 'uk' | 'uz' | 'vi' | 'zh' | 'zu'
  | 'other';

export interface Submitter {
  wcaId: string;
  name: string;
  country: string | null;
}

export interface ColpiWord {
  id: number;
  pair: string;
  word: string;
  category: Category;
  language: Language;
  offensive: boolean;
  score: number;
  note: string | null;
  submitter?: Submitter;
  myVote?: -1 | 1;
  createdAt: string;
  updatedAt: string;
}

export async function fetchWords(lang: string = 'all'): Promise<Record<string, ColpiWord[]>> {
  return handleApi(await fetch(`${BASE}/words?lang=${encodeURIComponent(lang)}`, { headers: authHeaders(false) }));
}

export async function fetchRecent(limit = 20): Promise<ColpiWord[]> {
  return handleApi(await fetch(`${BASE}/recent?limit=${limit}`, { headers: authHeaders(false) }));
}

export interface SubmitInput {
  pair: string;
  word: string;
  category: Category;
  language?: Language;
  country?: string | null;
  note?: string | null;
}

export async function submitWord(body: SubmitInput): Promise<ColpiWord> {
  return handleApi(await fetch(`${BASE}/words`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  }));
}

export interface PatchInput {
  word?: string;
  category?: Category;
  language?: Language;
  offensive?: boolean;
  note?: string | null;
}

export async function patchWord(id: number, body: PatchInput): Promise<ColpiWord> {
  return handleApi(await fetch(`${BASE}/words/${id}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
  }));
}

export async function deleteWord(id: number): Promise<void> {
  await handleApi<unknown>(await fetch(`${BASE}/words/${id}`, { method: 'DELETE', headers: authHeaders(false) }));
}

export async function setVote(id: number, dir: 1 | -1): Promise<{ score: number; myVote: 1 | -1 }> {
  return handleApi(await fetch(`${BASE}/words/${id}/vote`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ dir }),
  }));
}

export async function clearVote(id: number): Promise<{ score: number; myVote: null }> {
  return handleApi(await fetch(`${BASE}/words/${id}/vote`, {
    method: 'DELETE', headers: authHeaders(false),
  }));
}
