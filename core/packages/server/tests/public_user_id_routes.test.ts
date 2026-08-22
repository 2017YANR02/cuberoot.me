import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireAuth: vi.fn(),
  publicUserIdsForOwnerKeys: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: mocks.requireAuth,
  checkRateLimit: vi.fn(),
  ADMIN_WCA_IDS: ['2017YANR02'],
}));
vi.mock('../src/utils/notify.js', () => ({
  notify: vi.fn(),
  adminRecipients: vi.fn(),
  rememberLang: vi.fn(),
  verifyUnsubToken: vi.fn(),
}));
vi.mock('../src/utils/account.js', () => ({
  publicUserIdsForOwnerKeys: mocks.publicUserIdsForOwnerKeys,
}));

import { notificationRoutes } from '../src/routes/notifications.js';
import { quizRoutes } from '../src/routes/quiz.js';

describe('public user IDs on user-authored routes', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.requireAuth.mockReset();
    mocks.publicUserIdsForOwnerKeys.mockReset();
    mocks.requireAuth.mockResolvedValue({ wcaId: '2017YANR02', name: '颜瑞民' });
    mocks.publicUserIdsForOwnerKeys.mockResolvedValue(new Map([['2017YANR02', 66]]));
  });

  it('includes the actor numeric ID in notifications', async () => {
    mocks.query.mockResolvedValueOnce([{
      id: 1,
      kind: 'forum_reply',
      actor_key: '2017YANR02',
      actor_name: '颜瑞民',
      title: 'A thread',
      excerpt: 'A reply',
      link: '/forum/t/1',
      created_at: '2026-08-22T00:00:00.000Z',
      read_at: null,
    }]);

    const response = await notificationRoutes.request('/notifications');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ actorName: '颜瑞民', actorUserId: 66 }]);
    expect(mocks.publicUserIdsForOwnerKeys).toHaveBeenCalledWith(['2017YANR02']);
  });

  it('includes the author numeric ID in public community questions', async () => {
    mocks.query.mockResolvedValueOnce([{
      id: 1,
      cat: 'history',
      level: 'easy',
      type: 'choice',
      q_zh: '问题', q_en: 'Question',
      why_zh: '', why_en: '',
      options: [{ zh: '甲', en: 'A' }, { zh: '乙', en: 'B' }],
      answer_idx: 0,
      answer_zh: '', answer_en: '',
      accept: [],
      author_key: '2017YANR02', author_name: '颜瑞民',
      status: 'published', hidden_note: null, report_count: 0,
      created_at: new Date('2026-08-22T00:00:00.000Z'),
      updated_at: new Date('2026-08-22T00:00:00.000Z'),
    }]);

    const response = await quizRoutes.request('/quiz/questions?level=easy');
    const body = await response.json() as { questions: Array<{ authorName: string; authorUserId: number }> };

    expect(response.status).toBe(200);
    expect(body.questions).toMatchObject([{ authorName: '颜瑞民', authorUserId: 66 }]);
    expect(mocks.publicUserIdsForOwnerKeys).toHaveBeenCalledWith(['2017YANR02']);
  });
});
