import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mergeTeacherDirectoryEntries,
  normalizeDirectoryContacts,
  normalizeDirectoryImages,
  type TeacherDirectoryEntry,
} from '@/lib/teacher-directory-api';
import { workspaceFixturePath } from './workspace-fixture-path';

const SERVER_ROOT = workspaceFixturePath('@cuberoot/server');

function entry(id: number, isVisible: boolean, nameZh: string): TeacherDirectoryEntry {
  return {
    id,
    kind: 'teacher',
    nameZh,
    nameEn: '',
    locationZh: '',
    locationEn: '',
    specialtiesZh: [],
    specialtiesEn: [],
    teachingMode: 'both',
    descriptionZh: '介绍',
    descriptionEn: '',
    contacts: {},
    website: 'https://cuberoot.me/',
    wcaId: '',
    isCurated: false,
    isVisible,
    images: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('teacher directory visibility', () => {
  it('keeps private owner entries visible to the owner and prefers owner-fresh data', () => {
    const publicEntries = [entry(1, true, '旧名称'), entry(2, true, '公开资料')];
    const ownedEntries = [entry(1, false, '新名称'), entry(3, false, '隐藏资料')];

    expect(mergeTeacherDirectoryEntries(publicEntries, ownedEntries)).toEqual([
      ownedEntries[0],
      publicEntries[1],
      ownedEntries[1],
    ]);
  });

  it('filters hidden entries from the unauthenticated public route', () => {
    const source = readFileSync(join(SERVER_ROOT, 'src', 'routes', 'teacher_directory.ts'), 'utf8');
    const publicRoute = source.slice(
      source.indexOf("teacherDirectoryRoutes.get('/teachers'"),
      source.indexOf("teacherDirectoryRoutes.get('/teachers/mine'"),
    );
    expect(publicRoute).toContain('WHERE is_visible = TRUE');
  });

  it('normalizes supported contact methods and preserves legacy contact text', () => {
    expect(normalizeDirectoryContacts({
      wechat: ' cube-root ',
      youtube: 'https://youtube.com/@cuberoot',
      unknownPlatform: 'ignored',
      qq: '',
    })).toEqual({
      wechat: 'cube-root',
      youtube: 'https://youtube.com/@cuberoot',
    });
    expect(normalizeDirectoryContacts(undefined, 'legacy contact')).toEqual({
      other: 'legacy contact',
    });
  });

  it('normalizes, deduplicates, and caps profile photos', () => {
    const images = normalizeDirectoryImages([
      { id: 7, kind: 'portrait', captionZh: '形象照', captionEn: 'Portrait' },
      { id: 7, kind: 'teaching' },
      { id: -1, kind: 'other' },
      ...Array.from({ length: 10 }, (_, index) => ({ id: index + 10, kind: 'unknown' })),
    ]);
    expect(images).toHaveLength(8);
    expect(images[0]).toMatchObject({ id: 7, kind: 'portrait', captionZh: '形象照', captionEn: 'Portrait' });
    expect(images[1]).toMatchObject({ id: 10, kind: 'other' });
    expect(images[0].url).toContain('/v1/article/img/7');
  });

  it('selects photos in the public query and checks uploaded-image ownership before writes', () => {
    const source = readFileSync(join(SERVER_ROOT, 'src', 'routes', 'teacher_directory.ts'), 'utf8');
    expect(source).toContain('contacts, images, contact');
    expect(source).toContain('validateImageOwnership(draft.images, user, admin)');
    expect(source).toContain("SELECT id, owner_wca_id FROM article_image");
    expect(source).toContain("return 'image_not_owned'");
  });
});
