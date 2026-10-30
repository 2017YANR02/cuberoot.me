// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PetAccountCard from '@/components/PetAccountCard';
import { setDeskPetSelection } from '@/lib/deskpet-selection';
import { THEMES } from '@/lib/deskpet-themes';

const { getMyPets, getDeskPetCatalog } = vi.hoisted(() => ({ getMyPets: vi.fn(), getDeskPetCatalog: vi.fn() }));
vi.mock('@/lib/deskpet-api', () => ({ getMyPets, getDeskPetCatalog }));
const auth = vi.hoisted(() => ({ admin: false }));
vi.mock('@/lib/auth-store', () => ({ hasAdminAccess: () => auth.admin, useAuthStore: (select: (state: unknown) => unknown) => select({ user: { uid: 66 } }) }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, prefetch: _, ...props }: { children: ReactNode; prefetch?: boolean }) => createElement('a', props, children) }));
vi.mock('@/components/PetLevelBadge', () => ({ default: ({ bond }: { bond: number }) => createElement('span', { 'data-bond': bond }) }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  auth.admin=false;
  getMyPets.mockReset().mockResolvedValue([{ id: 'rootbeast', care: { bond: 8 } }, { id: 'clawd', care: { bond: 2 } }]);
  getDeskPetCatalog.mockReset().mockResolvedValue({ revision: 1, entries: [] });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function render() { await act(async () => root.render(createElement(PetAccountCard))); }
function expectPet(id: 'rootbeast' | 'clawd', bond: string | null) {
  expect(host.querySelector('a')?.getAttribute('href')).toBe(`/pets?pet=${id}`);
  expect(host.querySelector('img')?.getAttribute('src')).toBe(THEMES[id].thumb);
  expect(host.querySelector('.account-card-title')?.textContent).toBe(THEMES[id].label.en);
  expect(host.querySelector('[data-bond]')?.getAttribute('data-bond') ?? null).toBe(bond);
}

it('uses the selected pet instead of the first adoption on initial load', async () => {
  localStorage.setItem('clawd-deskpet-char', 'clawd');
  await render();
  expectPet('clawd', '2');
});

it('updates mounted cards on same-tab and cross-tab selection without refetching care data', async () => {
  await render();
  expectPet('rootbeast', '8');
  await act(async () => setDeskPetSelection('clawd'));
  expectPet('clawd', '2');
  await act(async () => {
    localStorage.setItem('clawd-deskpet-char', 'rootbeast');
    window.dispatchEvent(new StorageEvent('storage', { key: 'clawd-deskpet-char', newValue: 'rootbeast' }));
  });
  expectPet('rootbeast', '8');
  expect(getMyPets).toHaveBeenCalledOnce();
});

it('shows the selected unadopted pet without another pet’s level', async () => {
  getMyPets.mockResolvedValue([{ id: 'rootbeast', care: { bond: 8 } }]);
  localStorage.setItem('clawd-deskpet-char', 'clawd');
  await render();
  expectPet('clawd', null);
});

it('keeps the selected companion when its care data is unavailable', async () => {
  getMyPets.mockRejectedValue(new Error('offline'));
  localStorage.setItem('clawd-deskpet-char', 'clawd');
  await render();
  expectPet('clawd', null);
});

it('falls back to an available pet when the saved selection is removed', async () => {
  localStorage.setItem('clawd-deskpet-char', 'clawd');
  getDeskPetCatalog.mockResolvedValue({ revision: 2, entries: [{ id: 'clawd', locked: false, removed: true }] });
  await render();
  expectPet('rootbeast', '8');
});

it('retains an administrator’s selected hidden companion', async () => {
  auth.admin=true;
  localStorage.setItem('clawd-deskpet-char', 'clawd');
  getDeskPetCatalog.mockResolvedValue({ revision: 2, entries: [{ id: 'clawd', locked: true, removed: true }] });
  await render();
  expectPet('clawd', '2');
});
