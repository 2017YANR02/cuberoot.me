import { expect, it } from 'vitest';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { prepareDestination } from 'next/dist/shared/lib/router/utils/prepare-destination';
import config from '../next.config';

it('preserves localized administrator links and their query parameters', async () => {
  const redirects = await config.redirects!();
  for (const [pathname, expected] of [
    ['/admin', '/workspace/admin'],
    ['/admin/users', '/workspace/admin/users'],
    ['/zh/admin/disk', '/zh/workspace/admin/disk'],
    ['/en/admin/releases', '/en/workspace/admin/releases'],
  ]) {
    const match = redirects.map(rule => ({ rule, params: getPathMatch(rule.source)(pathname) })).find(entry => entry.params && entry.rule.destination.includes('/workspace/admin'));
    expect(match, pathname).toBeDefined();
    const result = prepareDestination({ destination: match!.rule.destination, params: match!.params as Record<string, string | string[]>, query: { path: '/tmp', section: 'system', view: 'monitoring' }, appendParamsToQuery: false });
    expect(result.parsedDestination.pathname).toBe(expected);
    expect(result.parsedDestination.query).toMatchObject({ path: '/tmp', section: 'system', view: 'monitoring' });
  }
});
