import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ADMIN_SECTIONS, DESTINATION_SECTIONS, SYSTEM_DESTINATION_VIEWS, SYSTEM_VIEWS, adminSectionForPath } from '../app/[lang]/admin/sections';

describe('admin navigation sections', () => {
  it('selects the current section for both languages and existing detail pages', () => {
    expect(adminSectionForPath('/admin', null)).toBe('overview');
    expect(adminSectionForPath('/zh/admin/', 'content')).toBe('content');
    expect(adminSectionForPath('/admin', 'unknown')).toBe('overview');
    expect(adminSectionForPath('/zh/admin/users', null)).toBe('users');
    expect(adminSectionForPath('/admin/releases', null)).toBe('system');
  });

  it('assigns every configured destination to a valid management section', () => {
    expect(Object.keys(DESTINATION_SECTIONS).length).toBeGreaterThan(20);
    expect(Object.values(DESTINATION_SECTIONS).every(section => ADMIN_SECTIONS.includes(section))).toBe(true);
    expect(new Set(Object.values(DESTINATION_SECTIONS)).size).toBe(4);
    const page = readFileSync(new URL('../app/[lang]/admin/page.tsx', import.meta.url), 'utf8');
    const destinations = [...page.matchAll(/\{ href: '([^']+)', Icon:/g)].map(match => match[1]).sort();
    expect(destinations).toEqual(Object.keys(DESTINATION_SECTIONS).sort());
    expect(Object.keys(SYSTEM_DESTINATION_VIEWS).sort()).toEqual(Object.keys(DESTINATION_SECTIONS).filter(href => DESTINATION_SECTIONS[href] === 'system').sort());
    expect(Object.values(SYSTEM_DESTINATION_VIEWS).every(view => SYSTEM_VIEWS.includes(view))).toBe(true);
  });
});
