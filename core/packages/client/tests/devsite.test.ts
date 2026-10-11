import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { register, projects, wrapper } from '../../../scripts/devsite';

describe('devsite host settings protection', () => {
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), 'cuberoot-devsite-'));
    return { root, file: join(root, 'projects.json'), bin: join(root, 'bin') };
  };
  it('refuses to replace an existing project and preserves other registrations', () => {
    const { root, file, bin } = fixture();
    const original = { cuberoot: { directory: root, url: 'https://dev.cuberoot.me', command: ['existing'] }, mira: { directory: root, url: 'https://example.com', command: ['existing'] } };
    writeFileSync(file, JSON.stringify(original));
    expect(() => register('cuberoot', { directory: root, url: 'http://127.0.0.1:3000', command: ['node'] }, file, bin)).toThrow('already registered');
    expect(projects(file)).toEqual(original);
  });
  it('refuses a command collision without changing the registry or the command', () => {
    const { root, file, bin } = fixture();
    mkdirSync(bin);
    const shortcut = join(bin, process.platform === 'win32' ? 'cuberoot.cmd' : 'cuberoot');
    writeFileSync(shortcut, 'someone else owns this');
    writeFileSync(file, '{}');
    expect(() => register('cuberoot', { directory: root, url: 'http://127.0.0.1:3000', command: ['node'] }, file, bin)).toThrow('Command already exists');
    expect(readFileSync(shortcut, 'utf8')).toBe('someone else owns this');
    expect(projects(file)).toEqual({});
  });
  it('preserves other projects when adding a shortcut', () => {
    const { root, file, bin } = fixture();
    const other = { directory: root, url: 'https://example.com', command: ['other'] };
    writeFileSync(file, JSON.stringify({ other }));
    register('cuberoot', { directory: root, url: 'http://127.0.0.1:3000', command: ['node', 'local-dev.ts'] }, file, bin);
    expect(projects(file).other).toEqual(other);
    expect(projects(file).cuberoot.command).toEqual(['node', 'local-dev.ts']);
  });
  it('rejects Windows command expansion characters', () => {
    expect(() => wrapper('C:\\%BAD%\\devsite.ts', 'node', true)).toThrow('Unsupported');
    expect(() => wrapper('C:\\!BAD!\\devsite.ts', 'node', true)).toThrow('Unsupported');
  });
});
