import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Mini Program runtime release information', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('uses the exact published runtime version', async () => {
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({
        miniProgram: { envVersion: 'release', version: '1.2.1' },
      }),
    });
    const { getMiniProgramReleaseView } = await import('../src/lib/release-info');

    expect(getMiniProgramReleaseView('zh')).toMatchObject({
      channel: '正式版',
      notesTitle: '更新日志',
      version: '1.2.1',
      versionLabel: '版本',
    });
  });

  it('labels a development build without inventing a version number', async () => {
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({
        miniProgram: { envVersion: 'develop', version: '' },
      }),
    });
    const { getMiniProgramReleaseView } = await import('../src/lib/release-info');

    expect(getMiniProgramReleaseView('zh')).toMatchObject({
      channel: '',
      version: '开发版',
    });
  });

  it('keeps the English changelog synchronized', async () => {
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({
        miniProgram: { envVersion: 'trial', version: '' },
      }),
    });
    const { getMiniProgramReleaseView } = await import('../src/lib/release-info');
    const release = getMiniProgramReleaseView('en');

    expect(release).toMatchObject({
      channel: '',
      notesTitle: 'Changelog',
      version: 'Preview',
      versionLabel: 'Version',
    });
    expect(release.notes).toHaveLength(3);
  });
});
