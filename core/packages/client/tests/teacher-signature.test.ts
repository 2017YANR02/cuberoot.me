import { describe, expect, it } from 'vitest';
import { formatTeacherSignature, parseTeacherSignature } from '@cuberoot/shared/account';

describe('teacher public signature', () => {
  it('defaults to the name and falls back to it when no organization is set', () => {
    expect(formatTeacherSignature('颜瑞民')).toBe('颜瑞民');
    expect(formatTeacherSignature('颜瑞民', { mode: 'both', organization: '  ' })).toBe('颜瑞民');
    expect(formatTeacherSignature('颜瑞民', { mode: 'organization', organization: '' })).toBe('颜瑞民');
  });
  it('uses only the selected public attribution', () => {
    expect(formatTeacherSignature('颜瑞民', { mode: 'name', organization: '魔方根' })).toBe('颜瑞民');
    expect(formatTeacherSignature('颜瑞民', { mode: 'organization', organization: '魔方根' })).toBe('魔方根');
    expect(formatTeacherSignature('颜瑞民', { mode: 'both', organization: '魔方根' })).toBe('颜瑞民 · 魔方根');
  });
  it('normalizes short names and rejects ambiguous or oversized input', () => {
    expect(parseTeacherSignature({ mode: 'both', organization: ' 魔方根 ' })).toEqual({ mode: 'both', organization: '魔方根' });
    for (const value of [null, { mode: 'other', organization: '' }, { mode: 'name', organization: 'a\nb' },
      { mode: 'both', organization: '字'.repeat(41) }, { mode: 'name', organization: '', teacherId: 'someone-else' }]) {
      expect(parseTeacherSignature(value)).toBe(null);
    }
  });
});
