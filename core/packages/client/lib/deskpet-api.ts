import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { isDeskPetCatalog, type DeskPetCatalog } from '@cuberoot/shared/deskpet';
import type { CareAction, PetCare } from './deskpet-care';

export interface AdoptedPet { id: string; adoptedAt: string; care: PetCare }
export function getMyPets(): Promise<AdoptedPet[]> {
  return fetch(apiUrl('/v1/pets/mine'), { headers: authHeaders(), cache: 'no-store' }).then(handleApi<AdoptedPet[]>);
}
export function adoptPet(id: string): Promise<AdoptedPet> {
  return fetch(apiUrl(`/v1/pets/${encodeURIComponent(id)}/adopt`), { method: 'POST', headers: authHeaders() }).then(handleApi<AdoptedPet>);
}
export function careForPet(id: string, action: CareAction): Promise<{ pet: AdoptedPet; accepted: boolean; gained: boolean }> {
  return fetch(apiUrl(`/v1/pets/${encodeURIComponent(id)}/care`), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
  }).then(handleApi<{ pet: AdoptedPet; accepted: boolean; gained: boolean }>);
}

const PATH = '/v1/nav/deskpet-catalog';
let catalogRequest: Promise<DeskPetCatalog> | undefined;

async function fetchDeskPetCatalog(retry = true): Promise<DeskPetCatalog> {
  const controller = new AbortController();
  // Bound headers and body reads; retry this public GET once if it stalls.
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const value = await handleApi<unknown>(await fetch(apiUrl(PATH), { cache: 'no-store', signal: controller.signal }));
    if (!isDeskPetCatalog(value)) throw new Error('Invalid pet catalog');
    return value;
  } catch (error) {
    if (!retry || !controller.signal.aborted) throw error;
  } finally {
    clearTimeout(timer);
  }
  return fetchDeskPetCatalog(false);
}

export function getDeskPetCatalog(): Promise<DeskPetCatalog> {
  // The page and floating pet share pending work, but never cache old visibility settings.
  return catalogRequest ??= fetchDeskPetCatalog().finally(() => { catalogRequest = undefined; });
}
export async function saveDeskPetCatalog(catalog: DeskPetCatalog): Promise<DeskPetCatalog> {
  return handleApi(await fetch(apiUrl(PATH), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(catalog),
  }));
}
