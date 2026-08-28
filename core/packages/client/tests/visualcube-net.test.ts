import { describe, expect, it } from 'vitest';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';

describe('visualcube net view', () => {
  it('renders every 3x3 sticker and applies the scramble forward', () => {
    const solved = renderFromSimpleQuery({ view: 'net', cubeSize: 3, setup: '' });
    const afterR = renderFromSimpleQuery({ view: 'net', cubeSize: 3, setup: 'R' });

    expect(solved.match(/<rect\b/g)).toHaveLength(54);
    expect(afterR).not.toBe(solved);
  });

  it('rejects inverse-case and facelet inputs instead of silently changing semantics', () => {
    expect(() => renderFromSimpleQuery({ view: 'net', case: 'R' })).toThrow(
      'The net view accepts forward alg/setup input only',
    );
    expect(() => renderFromSimpleQuery({ view: 'net', fc: 'w'.repeat(54) })).toThrow(
      'The net view accepts forward alg/setup input only',
    );
  });
});
