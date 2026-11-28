import { BlockList, isIP } from 'node:net';

const CRAWLER_RANGES = 'https://developers.google.com/static/crawling/ipranges/common-crawlers.json';
const CRAWLER_RANGES_CN = 'https://developers.google.cn/static/crawling/ipranges/common-crawlers.json';
const HOUR = 3_600_000;
let cache: { ranges: BlockList | null; refreshAt: number; expiresAt: number } = {
  ranges: null, refreshAt: 0, expiresAt: 0,
};
let loading: Promise<void> | undefined;

async function refreshRanges() {
  try {
    const options = { redirect: 'error' } as const;
    const primary = await fetch(CRAWLER_RANGES, { ...options, signal: AbortSignal.timeout(1200) }).catch(() => null);
    const response = primary?.ok ? primary
      : await fetch(CRAWLER_RANGES_CN, { ...options, signal: AbortSignal.timeout(1200) });
    if (!response.ok) throw new Error('Crawler ranges unavailable');
    const { prefixes } = await response.json() as { prefixes: { ipv4Prefix?: string; ipv6Prefix?: string }[] };
    if (!Array.isArray(prefixes) || !prefixes.length) throw new Error('Missing crawler ranges');
    const ranges = new BlockList();
    for (const { ipv4Prefix, ipv6Prefix } of prefixes) {
      const [address, length] = (ipv4Prefix ?? ipv6Prefix ?? '').split('/');
      const family = isIP(address);
      const bits = Number(length);
      if (!family || !Number.isInteger(bits) || bits <= 0) throw new Error('Invalid crawler range');
      ranges.addSubnet(address, bits, family === 6 ? 'ipv6' : 'ipv4');
    }
    cache = { ranges, refreshAt: Date.now() + HOUR, expiresAt: Date.now() + 24 * HOUR };
  } catch {
    cache.refreshAt = Date.now() + 60_000;
  }
}

/** The caller supplies the IP from its trusted ingress, never a visitor-supplied header. */
export async function isVerifiedGooglebot(userAgent: string | null | undefined, address: string | null | undefined) {
  if (!userAgent || !/\b(?:Googlebot|Google-InspectionTool)\b/i.test(userAgent) || !address) return false;
  const ip = address.replace(/^::ffff:(?=\d)/i, '');
  const family = isIP(ip);
  if (!family) return false;
  if (Date.now() >= cache.refreshAt) {
    loading ??= refreshRanges().finally(() => { loading = undefined; });
    if (Date.now() >= cache.expiresAt) await loading;
  }
  return Date.now() < cache.expiresAt && (cache.ranges?.check(ip, family === 6 ? 'ipv6' : 'ipv4') ?? false);
}
