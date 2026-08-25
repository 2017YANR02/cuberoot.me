import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeLiveScriptContent } from '@/lib/teacher-live-scripts-api';
import { workspaceFixturePath } from './workspace-fixture-path';

const SERVER_ROOT = workspaceFixturePath('@cuberoot/server');

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

  it('migration cascades with the parent profile and seeds the initial nine-section script', () => {
    const migration = readFileSync(join(SERVER_ROOT, 'migrations', '0160_teacher_live_scripts.sql'), 'utf8');
    expect(migration).toContain('REFERENCES teacher_directory_entries(id) ON DELETE CASCADE');
    expect(migration).toContain("'2017YANR02'");
    expect(migration.match(/\"number\":\"\d{2}\"/g)).toHaveLength(9);
  });

  it('expands the first script into a Chinese-only transcript-grounded edition', () => {
    const migration = readFileSync(join(SERVER_ROOT, 'migrations', '0161_expand_first_live_script.sql'), 'utf8');
    const json = migration.match(/\$script\$([\s\S]+?)\$script\$::jsonb/)?.[1];
    expect(json).toBeTruthy();

    const content = JSON.parse(json!) as {
      preparation: Array<{ zh: string; en: string }>;
      sections: Array<{ title: { zh: string; en: string }; beats: unknown[] }>;
      notes: Array<{ zh: string; en: string }>;
    };
    const serialized = JSON.stringify(content);
    const beatCount = content.sections.reduce((total, section) => total + section.beats.length, 0);

    expect(content.sections).toHaveLength(15);
    expect(beatCount).toBeGreaterThanOrEqual(90);
    expect(serialized).not.toMatch(/"en":"[^"]+"/);
    expect(serialized).toContain('105 场');
    expect(serialized).toContain('190,080 种');
    expect(serialized).toContain('六个三阶多盲');
    expect(serialized).toContain('C919');
    expect(serialized).toContain('乔治华盛顿大学');
    expect(serialized).toContain('Feliks Zemdegs');
    expect(serialized).toContain('安卓、iOS、Windows 和 macOS');
    expect(migration).toContain("t.wca_id = '2017YANR02'");
  });
});
