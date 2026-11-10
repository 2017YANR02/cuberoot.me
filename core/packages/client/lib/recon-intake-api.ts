import type { ReconIntakeCase, ReconIntakeInput } from '@cuberoot/shared/recon-ground-truth';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';
import { getRecon } from './recon-api';

/** Only explicit source IDs may fill missing legacy display metadata. */
export async function resolveIntakeSource(source: ReconIntakeCase['sourceSnapshot']): Promise<ReconIntakeCase['sourceSnapshot']> {
  if (!source || source.metadata) return source;
  const value = await getRecon(source.id);
  return { ...source, metadataOrigin: 'current', metadata: {
    value: value.value ?? null, date: value.date ?? null, person: value.person ?? null, personId: value.personId ?? null,
    reconer: value.reconer ?? null, reconerId: value.reconerId ?? null, collector: value.addedBy ?? null,
    collectorId: value.addedById ?? null, competition: value.comp ?? null, competitionId: value.compWcaId ?? null, country: value.country ?? null,
  } };
}

export async function intakeRequest<T>(path = '', body?: unknown): Promise<T> {
  return handleApi<T>(await sessionFetch(apiUrl('/v1/recon-intake' + path), {
    method: body === undefined ? 'GET' : 'POST', headers: authHeaders(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
export const submitReconIntake = (id: string, input: ReconIntakeInput) =>
  intakeRequest<ReconIntakeCase>('', { id, input });
