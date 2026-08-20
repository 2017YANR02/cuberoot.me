import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECTIONS, TEXTS } from '@/lib/landing-sections';

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('public feedback UI contract', () => {
  it('exposes the bilingual feedback card from the canonical landing data', () => {
    const card = SECTIONS.flatMap((section) => section.cards).find((item) => item.id === 'feedback');
    expect(card).toMatchObject({ href: '/feedback', internal: true, nameKey: 'feedback' });
    expect(TEXTS.feedback).toEqual({ en: 'Feedback', zh: '反馈' });
  });

  it('loads the public feed and keeps pagination in URL state', () => {
    const page = read('app/[lang]/feedback/page.tsx');
    expect(page).toContain('fetchPublicFeedback(safePage, safeSize)');
    expect(page).toContain("parseAsInteger.withDefault(1).withOptions({ history: 'push' })");
    expect(page).toContain('<FeedbackConversation feedbackId={it.id}');
    expect(page).not.toContain('fetchMyFeedback');
  });

  it('shows public threads anonymously and asks for login only when replying', () => {
    const conversation = read('components/FeedbackConversation.tsx');
    const api = read('lib/feedback-api.ts');
    expect(api).toContain('/v1/feedback/public?${qs}');
    expect(conversation).toContain("t('登录后回复', 'Sign in to reply')");
    expect(conversation).toContain('fetchFeedbackThread(feedbackId)');
  });
});
