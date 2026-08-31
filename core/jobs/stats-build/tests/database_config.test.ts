import { describe, expect, it } from 'vitest';
import { validateDbConfig } from '../src/core/database.js';

describe('validateDbConfig', () => {
  it('accepts a complete string-valued config', () => {
    expect(validateDbConfig({
      database: 'wca',
      username: 'user',
      password: '',
      host: '127.0.0.1',
    })).toEqual({
      database: 'wca',
      username: 'user',
      password: '',
      host: '127.0.0.1',
    });
  });

  it.each([
    null,
    [],
    { database: 'wca', username: 'user', password: '', host: 127001 },
    { database: 'wca', username: 'user', host: '127.0.0.1' },
  ])('rejects an invalid config boundary: %j', (config) => {
    expect(() => validateDbConfig(config)).toThrow(/database\.yml/);
  });
});
