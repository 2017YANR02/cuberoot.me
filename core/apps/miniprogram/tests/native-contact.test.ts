import { afterEach, expect, it, vi } from 'vitest';
import { createContactView } from '../src/lib/native-contact';

vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('uses platform feedback for all Douyin users without external community actions', async () => {
  vi.stubGlobal('__MINI_PROGRAM_TARGET__', 'douyin');
  const previewImage = vi.fn(), setClipboardData = vi.fn();
  vi.stubGlobal('tt', { getStorageSync: () => 'zh', previewImage, setClipboardData, setNavigationBarTitle: vi.fn() });
  let options: any;
  vi.stubGlobal('Page', (value: unknown) => { options = value; });
  await import('../src/pages/contact/index');
  const page = { ...options, data: { ...options.data }, setData(value: unknown) { Object.assign(this.data, value); } };
  page.onShow();
  expect(page.data.contact).toMatchObject({ platformFeedback: true, platforms: [], details: [], sections: [], qrPath: '', website: '' });
  expect(page.data.contact.feedbackInstruction).toContain('右上角');
  page.openContactWebsite();
  page.previewWechatQr();
  page.copyContactValue({ currentTarget: { dataset: { value: 'https://cuberoot.me' } } });
  expect(previewImage).not.toHaveBeenCalled();
  expect(setClipboardData).not.toHaveBeenCalled();
});

it('shows the full contact directory without signing in and restricts copied values', async () => {
  let options: any;
  const setClipboardData = vi.fn();
  const previewImage = vi.fn();
  vi.stubGlobal('wx', {
    getStorageSync: () => 'en', getAppBaseInfo: () => ({ language: 'en' }),
    setNavigationBarTitle: vi.fn(), setClipboardData, previewImage,
  });
  vi.stubGlobal('Page', (value: unknown) => { options = value; });
  await import('../src/pages/contact/index');
  const page = { ...options, data: { ...options.data }, setData(value: unknown) { Object.assign(this.data, value); } };
  page.onShow();
  expect(page.data.contact.sections).toEqual(createContactView().sections);
  expect(page.data.contact.platforms).toHaveLength(8);
  expect(page.data.contact.details).toHaveLength(5);
  page.copyContactValue({ currentTarget: { dataset: { value: 'unexpected data' } } });
  expect(setClipboardData).not.toHaveBeenCalled();
  page.openContactWebsite();
  expect(setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'https://cuberoot.me' }));
  setClipboardData.mock.calls[0][0].fail();
  expect(page.data.accountError).toBe('Unable to copy. Please retry.');
  page.previewWechatQr();
  expect(previewImage).toHaveBeenCalledWith(expect.objectContaining({ current: page.data.contact.qrPath, urls: [page.data.contact.qrPath] }));
  expect(page.onShareAppMessage().path).toBe('/pages/contact/index');
});
