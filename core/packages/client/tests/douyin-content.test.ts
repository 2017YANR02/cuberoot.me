import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { douyinContentAvailable } from '@cuberoot/shared/douyin-content';
import { DOUYIN_CONTENT_BOOTSTRAP } from '@/lib/douyin-content-bootstrap';

describe('Douyin public tool scope', () => {
  it.each(['/zh', '/timer?event=333&players=1', '/timer?source=manual', '/zh/timer?event=333bld', '/wca/comp/Test', '/account', '/privacy'])('keeps tool destination %s', path => {
    expect(douyinContentAvailable(path)).toBe(true);
  });
  it.each(['/alg/3x3/zbll/run', '/zh/learn', '/courses', '/predict', '/timer?training=home', '/timer?train.sets=oll', '/timer?trainingAssignment=1', '/timer?event=oll', '/timer?event=cross', '/timer?players=net', '/timer?hints=true', '/timer?room=123', '/%61lg/3x3/pll', 'https://other.example/learn',
    '/timer?content=zbll&source=cases', '/timer?content=zbll', '/timer?source=cases',
    '/timer?method=recall', '/timer?trainingRoom=123',
  ])('blocks removed functionality at %s', path => {
    expect(douyinContentAvailable(path)).toBe(false);
  });
  it('persists the native product marker through redirects without affecting WeChat or ordinary web sessions', () => {
    const storage = new Map<string, string>();
    const boot = (hash: string, userAgent: string) => {
      const document = { documentElement: { dataset: {} as Record<string, string> } };
      runInNewContext(DOUYIN_CONTENT_BOOTSTRAP, { document, location: { hash }, navigator: { userAgent }, sessionStorage: {
        getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value),
      } });
      return document.documentElement.dataset.douyinSurface;
    };
    expect(boot('', 'Safari')).toBeUndefined();
    expect(boot('#wechat_redirect', 'MicroMessenger miniProgram')).toBeUndefined();
    expect(boot('#douyin_redirect&ticket=test', 'Safari')).toBe('true');
    expect(boot('', 'Safari')).toBe('true');
  });
});
