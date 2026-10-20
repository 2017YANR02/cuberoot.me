import { apiUrl } from './api-base';

export interface ContestEvent {
  eventId: string; name: string; format: 'time' | 'time-3d' | 'number' | 'multi';
  category: { categoryId: string; name: string; videoBased: boolean };
  description?: string | null; rule?: string | null;
}
export interface ContestPerson { id: number; name: string; localizedName: string | null; regionCode: string; wcaId: string | null }
export interface ContestSummary {
  competitionId: string; shortName: string; regionCode: string; type: string;
  startDate?: string; endDate?: string; city?: string; participants?: number;
}
export interface ContestResult {
  id?: number; rankingId?: string; ranking?: number; type?: 'single' | 'average' | 'single-and-avg';
  eventId: string; date: string; personIds?: number[]; persons?: ContestPerson[];
  best: number; average: number; result?: number; resultText?: string; bestText?: string; averageText?: string;
  attemptsText: string[]; memoText?: (string | null)[]; roundId?: number;
  contest?: ContestSummary; competitionId?: string; videoLink?: string | null; discussionLink?: string | null;
}
export interface ContestCatalog { events: ContestEvent[]; regions: { code: string; name: string; type: string }[] }
export interface ContestDetail {
  contest: ContestSummary & { name: string; state: string; venue?: string; address?: string; description?: string; contact?: string; organizerIds: number[]; schedule?: unknown };
  events: ContestEvent[]; persons: ContestPerson[]; results: ContestResult[];
  rounds: { id: number; eventId: string; roundNumber: number; roundTypeId: string; format: string; timeLimitCentiseconds?: number; cutoffAttemptResult?: number }[];
}
export interface ContestPersonDetail { person: ContestPerson; persons: ContestPerson[]; contests: ContestSummary[]; results: ContestResult[]; hasMore: boolean }

export class ContestsError extends Error { constructor(public status: number) { super('Contests request failed'); } }
export async function getContestsData<T>(params: Record<string, string | number | undefined>, signal: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ v: '1' });
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
  const response = await fetch(apiUrl(`/v1/contests?${query}`), { signal });
  if (!response.ok) throw new ContestsError(response.status);
  return (await response.json()).data;
}

/** Keep every public detail/filter shareable without high-cardinality SSG routes. */
export function contestsHref(params: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
  return `/contests${query.size ? `?${query}` : ''}`;
}
