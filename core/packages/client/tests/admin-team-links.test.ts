import { expect, it } from 'vitest';
import { workspaceHref } from '../app/[lang]/workspace/WorkspaceContent';

it('maps shared workspace panel links to the team section of admin', () => {
  expect(workspaceHref('/workspace')).toBe('/admin/team');
  expect(workspaceHref('/workspace/updates')).toBe('/admin/team?section=updates');
  expect(workspaceHref('/workspace/updates/report-1')).toBe('/admin/team?section=detail&id=report-1');
  expect(workspaceHref('/account')).toBe('/account');
});
