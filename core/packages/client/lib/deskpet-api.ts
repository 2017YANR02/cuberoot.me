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
export async function getDeskPetCatalog(): Promise<DeskPetCatalog> {
  const value = await handleApi<unknown>(await fetch(apiUrl(PATH), { cache: 'no-store' }));
  if (!isDeskPetCatalog(value)) throw new Error('Invalid pet catalog');
  return value;
}
export async function saveDeskPetCatalog(catalog: DeskPetCatalog): Promise<DeskPetCatalog> {
  return handleApi(await fetch(apiUrl(PATH), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(catalog),
  }));
}
