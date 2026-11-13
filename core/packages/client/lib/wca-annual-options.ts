import { apiUrl } from '@/lib/api-base';

export interface AnnualOptions {
  options?: { event: string; year: number }[];
  events?: string[];
  years: number[];
}

const isYear = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;

export async function loadAnnualParticipationOptions(scope: string, signal: AbortSignal): Promise<AnnualOptions> {
  const endpoint = '/v1/wca/fun/most-solves-person-year/years';
  try {
    const response = await fetch(apiUrl(`${endpoint}?v=3&scope=${encodeURIComponent(scope)}`), { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.options) || !Array.isArray(data?.events)
      || !data.options.every((row: unknown) => row !== null && typeof row === 'object'
        && 'event' in row && typeof row.event === 'string' && 'year' in row && isYear(row.year))
      || !data.events.every((event: unknown) => typeof event === 'string')) {
      throw new Error('Invalid annual options');
    }
    return { options: data.options, events: data.events, years: [] };
  } catch (error) {
    if (signal.aborted) throw error;
    // Keep year selection available before the first per-event data build.
    // Legacy metadata supplies years only; rankings still use the v3 contract.
    const response = await fetch(apiUrl(`${endpoint}?v=2&scope=${encodeURIComponent(scope)}`), { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.years) || !data.years.every(isYear)) throw new Error('Invalid annual years');
    return { years: data.years };
  }
}
