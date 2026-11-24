// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AssistantMonitoring from '../app/[lang]/admin/AssistantMonitoring';

vi.mock('../app/[lang]/admin/Dashboard', () => ({ DashboardChart: () => null }));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }) }));
vi.mock('@/lib/admin-assistant-api', () => ({
  fetchChatMonitoring: async (path: string) => {
    const row = { id: 'internal-request', user_id: 'internal-user', question: 'Example question', status: 'success',
      started_at: '2026-11-20T09:00:00Z', duration_ms: 1500 };
    if (path === 'requests') return { rows: [row], total: 1, pageSize: 25 };
    if (path === 'requests/' + row.id) return { ...row, answer: 'Readable reply [[unknown:internal-marker]]',
      retry_of: 'internal-retry', metrics: {}, review_status: 'open' };
    return null;
  },
}));

it('opens and dismisses a readable review window twice from the same list', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  const close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
  Object.assign(HTMLDialogElement.prototype, { showModal, close });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(AssistantMonitoring)));
    const question = [...host.querySelectorAll('button')].find(button => button.textContent === 'Example question')!;
    for (let i = 0; i < 2; i++) {
      await act(async () => question.click());
      const dialog = host.querySelector('dialog[open]')!;
      expect(dialog.textContent).toContain('Readable reply');
      expect(host.textContent).not.toMatch(/internal-(request|retry|user|marker)/);
      await act(async () => dialog.querySelector('header button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      expect(host.querySelector('dialog')).toBeNull();
    }
    expect(showModal).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  }
});
