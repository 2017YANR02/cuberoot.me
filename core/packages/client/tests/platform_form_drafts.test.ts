// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import type { DomainFormSpec } from '@/components/platform/PlatformActionTypes';
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/platform/PlatformReferenceField', () => ({ PlatformReferenceField: () => null }));
vi.mock('@/components/platform/PlatformStructuredField', () => ({ PlatformStructuredField: () => null }));
vi.mock('@/lib/platform-gateway', () => ({ PLATFORM_ACTION_LABELS: { 'admin-save': { zh: '保存', en: 'Save' } } }));
vi.mock('@/lib/article-markdown', () => ({ renderArticleMarkdown: (value: string) => value }));
import { DomainForm } from '@/components/platform/PlatformForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it('preserves a field reverted during saving while refreshing untouched and subsequently saved fields', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  let finish!: (value: { id: string }) => void;
  const runAction = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ id: 'news' });
  const spec: DomainFormSpec = { title: { zh: '资讯', en: 'News' }, action: 'admin-save', fields: [
    { key: 'titleZh', label: { zh: '标题', en: 'Title' } },
    { key: 'summaryZh', label: { zh: '摘要', en: 'Summary' } },
  ] };
  const render = (titleZh: string, summaryZh: string) => root.render(createElement(DomainForm, {
    definition: { id: 'admin-news' } as PlatformRouteDefinition, entity: { id: 'news', title: titleZh, data: { titleZh, summaryZh } } as PlatformEntity,
    spec, runAction, busy: null,
  }));
  const changeTitle = async (value: string) => act(async () => {
    const input = host.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submit = async () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  try {
    await act(async () => render('原标题', '原摘要'));
    await changeTitle('已提交标题');
    await submit();
    await changeTitle('原标题');
    await act(async () => { render('已提交标题', '服务端新摘要'); finish({ id: 'news' }); });
    expect(Array.from(host.querySelectorAll('input'), input => input.value)).toEqual(['原标题', '服务端新摘要']);
    await submit();
    expect(runAction.mock.calls[1][2]).toEqual({ titleZh: '原标题', summaryZh: '服务端新摘要' });
    await act(async () => render('服务端规范标题', '服务端新摘要'));
    expect(host.querySelector('input')!.value).toBe('服务端规范标题');
  } finally { await act(async () => root.unmount()); }
});
