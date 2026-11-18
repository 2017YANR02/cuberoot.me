import { describe, expect, it } from 'vitest';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { platformNavigationState, platformNavigationHref, platformSharedPathname } from '@/lib/platform-navigation';
import { matchPlatformRoute, resolvePlatformCanonicalPath, PLATFORM_CANONICAL_REWRITES } from '@/lib/platform-routes';

describe('Platform navigation context', () => {
  it('keeps learning paths and memberships under courses with distinct secondary selections', () => {
    expect(platformNavigationState('/zh/platform/paths')).toMatchObject({ primary: 'courses', secondary: 'paths' });
    expect(platformNavigationState('/platform/paths/beginner')).toMatchObject({ primary: 'courses', secondary: 'paths' });
    expect(platformNavigationState('/platform/membership')).toMatchObject({ primary: 'courses', secondary: 'membership' });
    expect(platformNavigationState('/platform/courses/beginner/sections/core')).toMatchObject({ primary: 'courses', secondary: 'courses' });
    expect(platformNavigationState('/platform/teachers/apply')).toMatchObject({ primary: 'teachers', secondary: 'teacher-apply' });
    expect(platformNavigationState('/platform/orders')).toMatchObject({ primary: null, secondary: null });
    expect(platformNavigationState('/platform/progress')).toMatchObject({ primary: null, secondary: null });
  });

  it('preserves language, filters and fragments for shared content links', () => {
    expect(platformNavigationHref('/zh/forum/t/123?page=2#post-9')).toBe('/zh/platform/community/posts/123?page=2#post-9');
    expect(platformNavigationHref('/forum/feed?q=cross')).toBe('/platform/community/feed?q=cross');
    expect(platformNavigationHref('/teachers?teacher=12&q=test')).toBe('/platform/teachers/12?q=test');
    expect(platformNavigationHref('/org/cube/students/alex/packages')).toBe('/platform/org/cube/students/alex/credits');
    expect(platformNavigationHref('/org/cube/training/assignments/one')).toBe('/platform/org/cube/training/assignments/one');
    expect(platformNavigationHref('/teachers/scripts/42')).toBe('/platform/teachers/scripts/42');
  });

  it('leaves unrelated, external, authentication and existing Platform links intact', () => {
    for (const href of ['/account?next=%2Fplatform', '/timer', '/', '/platform/courses', 'https://example.com/forum', '//example.com/forum', '#notes']) {
      expect(platformNavigationHref(href)).toBe(href);
    }
  });

  it('resolves shared subpages without treating static sections as a person or organization ID', () => {
    expect(matchPlatformRoute(['community', 'feed'])?.definition.id).toBe('community-feed');
    expect(resolvePlatformCanonicalPath(['teachers', 'scripts', '42'])?.path).toBe('/teachers/scripts/42');
    expect(resolvePlatformCanonicalPath(['org', 'cube', 'training', 'assignments', 'one'])?.path)
      .toBe('/org/cube/training/assignments/one');
    expect(matchPlatformRoute(['teachers', 'apply'])?.definition.id).toBe('teacher-apply');
    expect(matchPlatformRoute(['org', 'cube', 'classes', 'one'])?.definition.id).toBe('org-class');
  });

  it('exposes the original path to sentinel ID readers and organization active menus', () => {
    expect(platformSharedPathname('/zh/platform/community/posts/123')).toBe('/forum/t/123');
    expect(platformSharedPathname('/zh/platform/community/circles/beginners')).toBe('/forum/f/beginners');
    expect(platformSharedPathname('/platform/org/cube/schedule')).toBe('/org/cube/sessions');
    expect(platformSharedPathname('/zh/forum/t/123')).toBe('/forum/t/123');
  });

  it('does not rewrite the native instructor application as a teacher ID', () => {
    const matched = PLATFORM_CANONICAL_REWRITES.filter(rule => getPathMatch(rule.source)('/zh/platform/teachers/apply'));
    expect(matched).toEqual([]);
    expect(PLATFORM_CANONICAL_REWRITES.some(rule => getPathMatch(rule.source)('/zh/platform/teachers/12'))).toBe(true);
  });
});
