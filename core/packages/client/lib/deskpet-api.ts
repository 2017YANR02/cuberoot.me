import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { isDeskPetCatalog, type DeskPetCatalog } from '@cuberoot/shared/deskpet';

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
