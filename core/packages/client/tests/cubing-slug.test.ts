import { describe, it, expect } from 'vitest';
import { nameToCubingSlug, wcaIdToCubingSlug } from '@/lib/cubing-slug';

describe('nameToCubingSlug', () => {
  it('keeps internal-caps words intact (the GraDUAL bug)', () => {
    // 真实比赛名有空格 → 词边界明确,"GraDUAL" 不被拆开
    expect(nameToCubingSlug('Guangzhou GraDUAL 3x3 I 2026')).toBe('Guangzhou-GraDUAL-3x3-I-2026');
  });

  it('strips apostrophes like the WCA id does (no 404)', () => {
    expect(nameToCubingSlug('Xi’an Cherry Blossom 2026')).toBe('Xian-Cherry-Blossom-2026');
    expect(nameToCubingSlug("Xi'an Cherry Blossom 2026")).toBe('Xian-Cherry-Blossom-2026');
  });

  it('handles plain names and existing hyphens', () => {
    expect(nameToCubingSlug('Hefei Cubing Open 2026')).toBe('Hefei-Cubing-Open-2026');
    expect(nameToCubingSlug('Pre-Worlds 2026')).toBe('Pre-Worlds-2026');
  });

  it('round-trips with aliasToWcaIdCandidates (slug.split("-").join("") === WCA id)', () => {
    const slug = nameToCubingSlug('Guangzhou GraDUAL 3x3 I 2026');
    expect(slug.split('-').join('')).toBe('GuangzhouGraDUAL3x3I2026');
  });
});

describe('wcaIdToCubingSlug (id heuristic fallback)', () => {
  it('splits ordinary multi-word ids', () => {
    expect(wcaIdToCubingSlug('HefeiCubingOpen2026')).toBe('Hefei-Cubing-Open-2026');
  });

  it('keeps NxN x intact', () => {
    expect(wcaIdToCubingSlug('League3x3IV2026')).toBe('League-3x3-IV-2026');
  });

  it('demonstrates the limitation it cannot recover (over-splits GraDUAL)', () => {
    // 无横杠 ID 丢了词边界 → 这就是为什么有真实比赛名时改用 nameToCubingSlug
    expect(wcaIdToCubingSlug('GuangzhouGraDUAL3x3I2026')).not.toBe('Guangzhou-GraDUAL-3x3-I-2026');
  });
});
