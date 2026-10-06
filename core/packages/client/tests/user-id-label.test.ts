import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UserContactLink, UserIdLabel } from '@/components/UserIdLabel';
import { AuthorName, UserAvatarFallback } from '@/components/Discussion';

vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'zh' }) }));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (select: (state: { user: { uid: number } }) => unknown) => select({ user: { uid: 66 } }),
}));

describe('UserIdLabel', () => {
  it('renders the compact public ID beside authored content', () => {
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 66 }))).toContain('ID 66');
  });

  it('renders the full account label and hides invalid IDs', () => {
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 66, full: true }))).toContain('CubeRoot ID 66');
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: null }))).toBe('');
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 0 }))).toBe('');
  });

  it('opens the existing friend entry from both an unlinked author name and avatar', () => {
    const author = renderToStaticMarkup(createElement(AuthorName, { id: 'u547', name: 'Comment author', userId: 547 }));
    const avatar = renderToStaticMarkup(createElement(UserAvatarFallback, { userId: 547, name: 'Comment author' }));
    expect(author).toContain('href="/zh/friends?q=547"');
    expect(avatar).toContain('href="/zh/friends?q=547"');
    expect(author).not.toContain('/persons/u547');
  });

  it('keeps controls non-interactive by default, and routes self to the account', () => {
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 547 }))).not.toContain('<a');
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 547, contact: true }))).toContain('/zh/friends?q=547');
    expect(renderToStaticMarkup(createElement(UserContactLink, { userId: 66, children: 'Me' }))).toContain('href="/zh/account"');
    expect(renderToStaticMarkup(createElement(UserContactLink, { userId: null, children: 'Unknown' }))).not.toContain('<a');
  });
});
