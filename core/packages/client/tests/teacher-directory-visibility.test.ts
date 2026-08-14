import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeTeacherDirectoryEntries,
  type TeacherDirectoryEntry,
} from '@/lib/teacher-directory-api';

const CLIENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ROOT = join(CLIENT_ROOT, '..', 'server');

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
    contact: '',
    website: 'https://cuberoot.me/',
    wcaId: '',
    isCurated: false,
    isVisible,
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
});
