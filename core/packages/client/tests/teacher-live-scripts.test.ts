import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLiveScriptContent } from '@/lib/teacher-live-scripts-api';

const CLIENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ROOT = join(CLIENT_ROOT, '..', 'server');

describe('teacher livestream scripts', () => {
  it('normalizes malformed content without inventing unsupported cue types', () => {
    expect(normalizeLiveScriptContent({
      preparation: [{ zh: '补直播标题' }],
      sections: [{
        id: 'opening',
        title: { zh: '开场' },
        beats: [
          { kind: 'say', text: { zh: '大家好。' } },
          { kind: 'cue', cue: 'unknown', text: { zh: '展示魔方。' } },
          null,
        ],
      }],
      referenceLinks: [{ href: '/teachers', label: { zh: '老师目录' } }, { nope: true }],
    })).toMatchObject({
      preparation: [{ zh: '补直播标题', en: '' }],
      sections: [{
        id: 'opening',
        beats: [
          { kind: 'say', text: { zh: '大家好。', en: '' } },
          { kind: 'cue', cue: 'action', text: { zh: '展示魔方。', en: '' } },
        ],
      }],
      referenceLinks: [{ href: '/teachers', label: { zh: '老师目录', en: '' } }],
    });
  });

  it('requires both script and parent profile visibility for public reads', () => {
    const source = readFileSync(join(SERVER_ROOT, 'src', 'routes', 'teacher_directory.ts'), 'utf8');
    const publicRoutes = source.slice(
      source.indexOf("teacherDirectoryRoutes.get('/teachers/scripts'"),
      source.indexOf("teacherDirectoryRoutes.get('/teachers/scripts/mine'"),
    ) + source.slice(
      source.indexOf("teacherDirectoryRoutes.get('/teachers/scripts/:id'"),
      source.indexOf("teacherDirectoryRoutes.post('/teachers/scripts'"),
    );
    expect(publicRoutes.match(/s\.is_visible = TRUE AND t\.is_visible = TRUE/g)).toHaveLength(2);
  });

  it('keeps private preview behind ownership and stores structured content as JSONB', () => {
    const source = readFileSync(join(SERVER_ROOT, 'src', 'routes', 'teacher_directory.ts'), 'utf8');
    const ownedRoute = source.slice(
      source.indexOf("teacherDirectoryRoutes.get('/teachers/scripts/owned/:id'"),
      source.indexOf("teacherDirectoryRoutes.get('/teachers/scripts/:id'"),
    );
    expect(ownedRoute).toContain('requireDirectoryEditor(c)');
    expect(ownedRoute).toContain('rows[0].owner_key !== user.wcaId');
    expect(source).toContain('?::jsonb');
  });

  it('migration cascades with the parent profile and seeds the complete nine-section script', () => {
    const migration = readFileSync(join(SERVER_ROOT, 'migrations', '0160_teacher_live_scripts.sql'), 'utf8');
    expect(migration).toContain('REFERENCES teacher_directory_entries(id) ON DELETE CASCADE');
    expect(migration).toContain("'2017YANR02'");
    expect(migration.match(/\"number\":\"\d{2}\"/g)).toHaveLength(9);
  });
});
