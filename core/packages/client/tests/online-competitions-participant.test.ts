// @vitest-environment jsdom
import { act, createElement, useEffect, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionDuelArena } from '@/components/competitions/CompetitionArena';
import { OnlineCompetitions } from '@/components/competitions/OnlineCompetitions';
import { CompetitionReportShare } from '@/components/competitions/CompetitionReport';
import CompetitionCenter from '@/app/[lang]/competitions/page';
import { CompetitionHostShell } from '@/app/[lang]/competitions/workspace/_components/CompetitionHostShell';
import { CompetitionHostOverview } from '@/app/[lang]/competitions/workspace/_components/CompetitionHostOverview';
import type { CompetitionBracketMatch, CompetitionRegistration, MyCompetitionEntry, OnlineCompetition, OrganizerApplication } from '@/lib/online-competition-api';
import { matchCompetitionHostRoute, matchCompetitionRoute } from '@/lib/competition-links';

const api = vi.hoisted(() => ({
  user: null as { uid: number; isAdmin?: boolean } | null,
  pathname: '/zh/competitions/workspace',
  listOnlineCompetitions: vi.fn(),
  listOrganizerApplications: vi.fn(),
  listOrganizerReviewQueue: vi.fn(),
  listCompetitionReviewQueue: vi.fn(),
  competitionSupervisors: vi.fn(),
  getCompetitionHostOverview: vi.fn(),
  submitOrganizerApplication: vi.fn(),
  listSupervisedCompetitions: vi.fn(),
  listMyCompetitionEntries: vi.fn(),
  checkInCompetition: vi.fn(),
  push: vi.fn(),
  getOnlineCompetition: vi.fn(),
  listCompetitionRegistrations: vi.fn(),
  getCompetitionBrackets: vi.fn(),
  getCompetitionDuel: vi.fn(),
  getCompetitionArena: vi.fn(),
  readyCompetitionArena: vi.fn(),
  readyCompetitionDuel: vi.fn(),
  listCompetitionResults: vi.fn(),
  getCompetitionAttemptReplay: vi.fn(),
  getCompetitionAttempts: vi.fn(),
  listCompetitionDisputes: vi.fn(),
  getCompetitionSettlement: vi.fn(),
  reviewCompetitionSelfAttempt: vi.fn(),
  uploadCompetitionEvidence: vi.fn(),
  completeCompetitionSelfAttempt: vi.fn(),
  listCompetitionEvidence: vi.fn(),
  raiseCompetitionDispute: vi.fn(),
  listTeachingOrganizations: vi.fn(),
  createOnlineCompetition: vi.fn(),
  updateCompetitionDraft: vi.fn(),
  publishOnlineCompetition: vi.fn(),
}));

vi.mock('@/lib/online-competition-api', () => api);
vi.mock('@/lib/auth-store', () => ({
  useAuthUser: () => api.user,
  useIsAdmin: () => false,
  useOwnerKey: () => String(api.user?.uid ?? ''),
  hasAdminAccess: (user: typeof api.user) => Boolean(user?.isAdmin),
  nextQuery: (value: string) => '?next=' + encodeURIComponent(value),
}));
vi.mock('@/lib/teaching-saas-api', () => ({
  listTeachingOrganizations: api.listTeachingOrganizations,
  listTeachingMembers: async () => ({ items: [], total: 0 }),
}));
vi.mock('@/app/[lang]/competitions/_components/CompetitionHeader', () => ({
  CompetitionHeader: ({ actions, title }: { actions?: ReactNode; title?: string }) => createElement('header', null, title, actions),
}));
vi.mock('@/hooks/useEntryRouter', () => ({ useEntryRouter: () => ({ push: api.push }) }));
vi.mock('next/navigation', async original => ({ ...await original<object>(), usePathname: () => api.pathname }));
vi.mock('@/components/HeaderToggles', () => ({ default: () => null }));
vi.mock('@/components/PageBackLink', () => ({ default: ({ fallback }: { fallback: string }) => createElement('a', { href: fallback }, '返回') }));
vi.mock('@/components/CompactSelect', () => ({
  CompactSelect: ({ value, onChange, items, ariaLabel }: {
    value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }>; ariaLabel: string;
  }) => createElement('select', { value, 'aria-label': ariaLabel, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value) },
    items.map(item => createElement('option', { key: item.value, value: item.value }, item.label))),
}));
vi.mock('@/components/PuzzlePicker/PuzzlePicker', () => ({
  default: ({ selectedEvent, wcaEvents, onSelect, placeholderLabel }: {
    selectedEvent?: string; wcaEvents: ReadonlySet<string>; onSelect: (value: string) => void; placeholderLabel?: string;
  }) => createElement('select', {
    value: selectedEvent ?? '', 'aria-label': placeholderLabel,
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onSelect(event.target.value),
  }, [
    createElement('option', { key: '', value: '' }, placeholderLabel),
    ...[...wcaEvents].map(value => createElement('option', { key: value, value }, value)),
  ]),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => translate }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh, T: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/use-web-reconstruct-host', () => ({ useWebReconstructHost: () => ({ localize: ({ zh }: { zh: string }) => zh }) }));
vi.mock('@cuberoot/timer-ui', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/timer-ui')>(),
  TimerCubePreview: () => createElement('span', { role: 'img' }),
}));
const cubeFixture = vi.hoisted(() => ({
  connected: false, facelets: null as string | null, connect: vi.fn(), mounted: vi.fn(), unmounted: vi.fn(),
  version: 0, listeners: new Set<() => void>(),
}));
function subscribeCube(listener: () => void) {
  cubeFixture.listeners.add(listener);
  return () => { cubeFixture.listeners.delete(listener); };
}
function publishCubeState(connected: boolean, facelets: string | null) {
  cubeFixture.connected = connected;
  cubeFixture.facelets = facelets;
  cubeFixture.version++;
  for (const listener of cubeFixture.listeners) listener();
}
vi.mock('@/components/competitions/useCompetitionCube', () => ({
  useCompetitionCube: () => {
    useSyncExternalStore(subscribeCube, () => cubeFixture.version);
    useEffect(() => { cubeFixture.mounted(); return () => { cubeFixture.unmounted(); }; }, []);
    return {
      cube: {
        status: { connected: cubeFixture.connected, brand: 'gan', deviceName: 'GAN 16 test', battery: null },
        facelets: cubeFixture.facelets,
      },
      connect: cubeFixture.connect,
      anchor: { moves: [], algAnchored: false },
      guidance: { correctionActive: false }, phase: null, moves: 0, recap: null, live: { players: {} },
    };
  },
}));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props),
}));

const translate = (zh: string) => zh;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rejectedApplication: OrganizerApplication = {
  id: 'declined', name: '线上赛事组', slug: 'online-events', contact: '联系人',
  description: '线上比赛计划', status: 'rejected', reviewNote: '请补充监督排班',
  createdAt: '2026-01-01T00:00:00.000Z', reviewedAt: '2026-01-02T00:00:00.000Z',
  organizationId: null, organizationSlug: null,
};

function fixture(id: string, options: Partial<OnlineCompetition> = {}): OnlineCompetition {
  const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
  return {
    id, slug: id, titleZh: id, titleEn: id, status: 'published',
    startsAt: hoursFromNow(24), endsAt: hoursFromNow(26),
    registrationOpensAt: hoursFromNow(-24), registrationClosesAt: hoursFromNow(12),
    organizationId: 'org', organizationSlug: 'org', organizationName: '主办方',
    refundPolicy: '', recordingPolicy: '', commissionBps: null, settlementAnchor: null, settlementDays: null,
    projects: [{ id: 'ticket', project: '333', device: 'ordinary', amountMinor: 2000, currency: 'CNY', capacity: 10 }],
    sessions: [{ id: 'session', startsAt: hoursFromNow(24), endsAt: hoursFromNow(26),
      staffed: true, capacity: 10, available: 9, supervisorUserId: null, assistanceRequested: false }],
    ...options,
  };
}

describe('online competition views', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.user = null;
    cubeFixture.connected = false;
    cubeFixture.facelets = null;
    cubeFixture.connect.mockReset().mockResolvedValue(undefined);
    cubeFixture.mounted.mockClear();
    cubeFixture.unmounted.mockClear();
    api.readyCompetitionArena.mockReset().mockResolvedValue({});
    api.readyCompetitionDuel.mockReset().mockResolvedValue({});
    api.pathname = '/zh/competitions/workspace';
    api.listOnlineCompetitions.mockReset().mockResolvedValue({ competitions: [] });
    api.listOrganizerApplications.mockReset().mockResolvedValue({ applications: [], eligibleOrganizationIds: [] });
    api.submitOrganizerApplication.mockReset();
    api.listSupervisedCompetitions.mockReset().mockResolvedValue({ competitions: [] });
    api.listMyCompetitionEntries.mockReset().mockResolvedValue({ entries: [] });
    api.competitionSupervisors.mockReset().mockResolvedValue({ supervisors: [{ id: 8, name: '监督员' }] });
    api.listCompetitionReviewQueue.mockReset().mockResolvedValue({ competitions: [], supervisors: [] });
    api.listOrganizerReviewQueue.mockReset().mockResolvedValue({ applications: [] });
    api.getCompetitionHostOverview.mockReset();
    api.listTeachingOrganizations.mockReset().mockResolvedValue([]);
    api.createOnlineCompetition.mockReset();
    api.updateCompetitionDraft.mockReset().mockResolvedValue({ id: 'draft', status: 'draft' });
    api.publishOnlineCompetition.mockReset().mockResolvedValue({ id: 'draft', status: 'published' });
    api.checkInCompetition.mockReset().mockResolvedValue({ checkedIn: true });
    api.push.mockReset();
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [] });
    api.getCompetitionArena.mockReset().mockResolvedValue({ serverNow: new Date().toISOString(), legacy: true, roomId: null, players: [] });
    api.getCompetitionBrackets.mockReset().mockResolvedValue({ generated: true, matches: [], standings: [] });
    api.listCompetitionResults.mockReset().mockResolvedValue({ results: [] });
    api.getCompetitionAttemptReplay.mockReset().mockResolvedValue({ report: null });
    api.getCompetitionAttempts.mockReset().mockResolvedValue({ attempts: [] });
    api.listCompetitionDisputes.mockReset().mockResolvedValue({ disputes: [] });
    api.getCompetitionSettlement.mockReset().mockResolvedValue({ settlement: null });
    api.reviewCompetitionSelfAttempt.mockReset().mockResolvedValue({ reviewRequired: false });
    api.uploadCompetitionEvidence.mockReset();
    api.completeCompetitionSelfAttempt.mockReset().mockResolvedValue({ finished: false });
    api.listCompetitionEvidence.mockReset().mockResolvedValue({ evidence: [] });
    api.raiseCompetitionDispute.mockReset().mockResolvedValue({ status: 'open' });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  async function render(id?: string) {
    await act(async () => root.render(
      createElement(NuqsTestingAdapter, null, createElement(OnlineCompetitions, { id })),
    ));
  }

  function button(label: string) {
    return [...host.querySelectorAll('button')].find(element => element.textContent?.trim() === label)!;
  }

  function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function select(input: HTMLSelectElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('puts real open entries before past events and shows their equipment', async () => {
    api.listOnlineCompetitions.mockResolvedValue({ competitions: [fixture('past', { status: 'completed' }), fixture('open')] });
    await render();
    expect([...host.querySelectorAll('.competition-list-row')].map(row => row.getAttribute('href')))
      .toEqual(['/competitions/open', '/competitions/past']);
    expect(host.querySelector('.competition-list-row')?.textContent).toContain('普通魔方');
    expect(host.querySelector('details.competition-archive > summary')?.textContent).toContain('已结束的比赛');
    expect(host.querySelector('details.competition-archive a')?.textContent).toContain('查看成绩');
  });

  it('shows registration controls only during registration', async () => {
    api.getOnlineCompetition.mockResolvedValueOnce({ competition: fixture('open') })
      .mockResolvedValueOnce({ competition: fixture('upcoming', { registrationOpensAt: new Date(Date.now() + 3600000).toISOString() }) });
    await render('open');
    expect(host.textContent).toContain('登录报名');
    await render('upcoming');
    expect(host.textContent).toContain('报名开始');
    expect(host.textContent).not.toContain('登录报名');
  });

  it('shows the matching payment action and omits a duplicate single-project form', async () => {
    api.user = { uid: 7 };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('entered') });
    const entry: CompetitionRegistration = {
      id: 'entry', userId: 7, displayName: '选手', project: '333', device: 'ordinary', sessionId: 'session',
      orderId: 'existing-order', status: 'reserved', canCheckIn: false, canRecordResult: false, resultRecordedAt: null,
    };
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [entry] });
    await render('entered');
    const order = host.querySelector('a[href="/platform/orders/existing-order"]');
    expect(order?.textContent).toBe('继续付款');
    expect(host.textContent).not.toContain('选择参赛项目');
  });

  it('loads the managed list for an administrator without waiting for organizer access', async () => {
    api.user = { uid: 7, isAdmin: true };
    api.listOnlineCompetitions.mockResolvedValue({ competitions: [fixture('draft', { status: 'draft' })] });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null, createElement(OnlineCompetitions, { mode: 'manage' }))));
    expect(api.listOnlineCompetitions).toHaveBeenCalledWith(true);
    expect(host.querySelector('a[href="/competitions/workspace/manage/draft"]')).not.toBeNull();
  });

  it.each([['manage', false], ['supervise', true]] as const)('keeps the %s assignment guard', async (mode, isAdmin) => {
    api.user = { uid: 7, isAdmin };
    await act(async () => root.render(createElement(OnlineCompetitions, { mode })));
    expect(host.textContent).toContain('当前账号没有此赛事工作台的权限');
    expect(api.listOnlineCompetitions).not.toHaveBeenCalled();
  });

  it.each([
    ['guest', null, [], false],
    ['member', { uid: 7 }, [], false],
    ['organizer', { uid: 7 }, ['approved'], true],
    ['admin', { uid: 7, isAdmin: true }, [], true],
  ] as const)('shows hosting only to authorized %s accounts', async (role, user, eligibleOrganizationIds, visible) => {
    api.user = user;
    api.listOrganizerApplications.mockResolvedValue({ applications: [], eligibleOrganizationIds });
    await act(async () => root.render(createElement(CompetitionCenter)));
    expect(Boolean(host.querySelector('a[href="/competitions/workspace"]'))).toBe(visible);
    expect(host.querySelector('a[href="/competitions/workspace/create"]')).toBeNull();
    expect(host.querySelector('a[href="/competitions/workspace/organizer-applications"]')).toBeNull();
    expect(Boolean(host.querySelector('a[href="/competitions/admin/review"]'))).toBe(role === 'admin');
    expect(host.querySelector('.my-competitions')).toBeNull();
    if (!user) expect(api.listMyCompetitionEntries).not.toHaveBeenCalled();
  });

  it('reserves workspaces within the competition area alongside public details', () => {
    expect(matchCompetitionHostRoute([])).toMatchObject({ mode: 'overview' });
    expect(matchCompetitionHostRoute(['create'])).toMatchObject({ mode: 'create' });
    expect(matchCompetitionHostRoute(['manage', 'draft'])).toEqual({ mode: 'manage', id: 'draft' });
    expect(matchCompetitionRoute(['supervise', 'session'])).toEqual({ mode: 'supervise', id: 'session' });
    expect(matchCompetitionHostRoute(['organizer-applications'])).toBeNull();
    expect(matchCompetitionHostRoute(['activities', 'new'])).toEqual({ mode: 'activities', id: 'new' });
    expect(matchCompetitionHostRoute(['activities', 'event'])).toEqual({ mode: 'activities', id: 'event' });
    expect(matchCompetitionRoute(['admin', 'organizer-applications'])).toEqual({ mode: 'review' });
    expect(matchCompetitionRoute(['sample'])).toEqual({ mode: 'browse', id: 'sample' });
    expect(matchCompetitionRoute(['create'])).toBeNull();
    expect(matchCompetitionHostRoute(['create', 'unexpected'])).toBeNull();
  });

  it.each([
    ['guest', null, [], false],
    ['member', { uid: 7 }, [], false],
    ['organizer', { uid: 7 }, ['approved'], true],
    ['admin', { uid: 7, isAdmin: true }, [], true],
  ] as const)('guards the host workspace and its administrator navigation for %s', async (role, user, eligibleOrganizationIds, visible) => {
    api.user = user;
    api.pathname = '/zh/competitions/workspace/manage/draft';
    api.listOrganizerApplications.mockResolvedValue({ applications: [], eligibleOrganizationIds });
    await act(async () => root.render(createElement(CompetitionHostShell, null, createElement('article', { id: 'protected-content' }, '草稿'))));
    expect(Boolean(host.querySelector('#protected-content'))).toBe(visible);
    expect(Boolean(host.querySelector('nav a[href="/competitions/workspace/create"]'))).toBe(visible);
    expect(Boolean(host.querySelector('nav a[href="/competitions/workspace/activities"]'))).toBe(role === 'admin');
    expect(host.querySelector('nav a[href^="/platform"]')).toBeNull();
    expect(host.querySelector('nav a[href$="/organizer-applications"]')).toBeNull();
    if (visible) expect(host.querySelector('nav a[aria-current="page"]')?.getAttribute('href')).toBe('/competitions/workspace/manage');
  });

  it('prevents approved organizers from opening the activity editor directly', async () => {
    api.user = { uid: 7 };
    api.pathname = '/zh/competitions/workspace/activities/new';
    api.listOrganizerApplications.mockResolvedValue({ applications: [], eligibleOrganizationIds: ['approved'] });
    await act(async () => root.render(createElement(CompetitionHostShell, null, createElement('article', { id: 'protected-content' }))));
    expect(host.querySelector('#protected-content')).toBeNull();
    expect(host.textContent).toContain('只有网站管理员可以管理活动');
  });

  it('loads the organizer queue only for site administrators', async () => {
    api.user = { uid: 7 };
    await act(async () => root.render(createElement(OnlineCompetitions, { mode: 'review' })));
    expect(host.textContent).toContain('只有网站管理员可以审核主办方申请');
    expect(api.listOrganizerReviewQueue).not.toHaveBeenCalled();
    api.user = { uid: 7, isAdmin: true };
    await act(async () => root.render(createElement(OnlineCompetitions, { mode: 'review' })));
    expect(api.listCompetitionReviewQueue).toHaveBeenCalledOnce();
    expect(api.listOrganizerReviewQueue).not.toHaveBeenCalled();
    await act(async () => button('主办方资质申请').click());
    expect(api.listOrganizerReviewQueue).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('暂无待审核申请');
  });

  it('shows confirmed entries, money and per-competition links in the overview', async () => {
    const totals = { registered: 17, netCollectedMinor: '12345', refundedMinor: '500', organizerAmountMinor: null };
    api.getCompetitionHostOverview.mockResolvedValue({
      currency: 'CNY', competitionCount: 1, totals,
      competitions: [{ id: 'paid', titleZh: '周末比赛', titleEn: 'Weekend competition', organizationName: '线上赛事组', ...totals }],
    });
    await act(async () => root.render(createElement(CompetitionHostOverview)));
    expect([...host.querySelectorAll('dl dd')].map(value => value.textContent)).toEqual(['17', '¥123.45', '¥5.00', '待确认']);
    expect(host.querySelector('table a')?.getAttribute('href')).toBe('/competitions/workspace/manage/paid');
  });

  it('shows an error rather than zero if the summary service is unavailable and retries', async () => {
    api.getCompetitionHostOverview.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({
      currency: 'CNY', competitionCount: 0, competitions: [],
      totals: { registered: 0, netCollectedMinor: '0', refundedMinor: '0', organizerAmountMinor: '0' },
    });
    await act(async () => root.render(createElement(CompetitionHostOverview)));
    expect(host.querySelector('dl')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('赛事数据暂不可用');
    await act(async () => button('重试').click());
    expect(host.textContent).toContain('还没有可管理的赛事');
  });

  it('collects three setup steps and retries the same draft safely', async () => {
    api.user = { uid: 7, isAdmin: true };
    api.listOrganizerApplications.mockResolvedValue({ applications: [], eligibleOrganizationIds: ['org'] });
    api.listTeachingOrganizations.mockResolvedValue([{ id: 'org', role: 'owner', status: 'active', name: '主办方' }]);
    api.createOnlineCompetition.mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({ id: 'new-draft', status: 'draft' });
    await act(async () => root.render(createElement(OnlineCompetitions, { mode: 'create' })));
    expect(host.querySelector('.competition-setup-panel h2')?.textContent).toBe('比赛与项目');
    expect(host.querySelector('input[type="datetime-local"]')).toBeNull();
    await act(async () => button('下一步').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('请填写比赛名称');
    await act(async () => {
      fill(host.querySelector('input[maxlength="160"]')!, '本站线上赛');
      const [mode, format] = host.querySelectorAll('select');
      select(mode, 'self_service');
      select(format, 'advancement');
      select(host.querySelector('.competition-project-editor > label > select')!, 'smart');
    });
    const project = host.querySelector<HTMLSelectElement>('select[aria-label="选择比赛项目"]')!;
    expect([...project.options].map(option => option.value)).toEqual(['', '333']);
    await act(async () => button('下一步').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('免费比赛填 0');
    await act(async () => {
      const [fee, capacity] = host.querySelectorAll<HTMLInputElement>('input[type="number"]');
      fill(fee, '19.90'); fill(capacity, '32');
    });
    await act(async () => button('下一步').click());
    expect(host.querySelector('.competition-setup-panel h2')?.textContent).toBe('时间与场次');
    await act(async () => button('下一步').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('请填写报名和比赛的四个时间');
    const times = ['2030-04-01T12:00', '2030-04-03T12:00', '2030-04-04T12:00', '2030-04-04T15:00'];
    await act(async () => host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]').forEach((input, index) => fill(input, times[index])));
    await act(async () => button('下一步').click());
    expect(host.querySelector('.competition-setup-panel h2')?.textContent).toBe('规则与提交');
    await act(async () => host.querySelector<HTMLButtonElement>('.competition-draft-progress button')!.click());
    expect(host.querySelector('.competition-setup-panel h2')?.textContent).toBe('比赛与项目');
    expect(host.querySelector<HTMLInputElement>('input[maxlength="160"]')?.value).toBe('本站线上赛');
    await act(async () => button('下一步').click());
    await act(async () => button('下一步').click());
    const template = host.querySelector<HTMLSelectElement>('.competition-policy-fields select')!;
    const refund = host.querySelector<HTMLTextAreaElement>('.competition-policy-fields textarea')!;
    await act(async () => select(template, 'before_start'));
    expect(refund.value).toBe('开赛前可申请全额退款');
    await act(async () => select(template, 'before_24h'));
    expect(refund.value).toBe('开赛前 24 小时可申请全额退款');

    await act(async () => button('保存草稿').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Connection lost');
    await act(async () => button('保存草稿').click());
    expect(api.createOnlineCompetition).toHaveBeenCalledTimes(2);
    expect(api.createOnlineCompetition.mock.calls[0]).toEqual(api.createOnlineCompetition.mock.calls[1]);
    expect(api.createOnlineCompetition.mock.calls[0][0]).toMatchObject({
      organizationId: 'org', titleZh: '本站线上赛', format: 'advancement', supervisionMode: 'self_service',
      projects: [{ project: '333', device: 'smart', amountMinor: 1990, capacity: 32 }],
      registrationOpensAt: '2030-04-01T04:00:00.000Z', registrationClosesAt: '2030-04-03T04:00:00.000Z',
      startsAt: '2030-04-04T04:00:00.000Z', endsAt: '2030-04-04T07:00:00.000Z',
    });
    expect(api.push).toHaveBeenCalledWith('/zh/competitions/workspace/manage/new-draft');
  });

  it('keeps an unstaffed competition editable and blocks direct publication', async () => {
    api.user = { uid: 7, isAdmin: true };
    const competition = fixture('draft', { status: 'draft', canManage: true, canPublish: true,
      refundPolicy: '报名规则', recordingPolicy: '录像规则', commissionBps: 0, settlementDays: 0, settlementAnchor: 'ended',
    });
    api.getOnlineCompetition.mockResolvedValue({ competition });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null, createElement(OnlineCompetitions, { mode: 'manage', id: 'draft' }))));
    await act(async () => button('下一步').click());
    await act(async () => button('下一步').click());
    await act(async () => button('立即发布').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('安排监督员或申请协助');
    expect(api.publishOnlineCompetition).not.toHaveBeenCalled();
  });

  it('shows the rejection reason and opens an editable resubmission with the previous details', async () => {
    api.user = { uid: 7 };
    const pending = { ...rejectedApplication, id: 'pending', status: 'pending', reviewNote: null };
    api.listOrganizerApplications.mockResolvedValueOnce({ applications: [rejectedApplication], eligibleOrganizationIds: [] })
      .mockResolvedValue({ applications: [pending, rejectedApplication], eligibleOrganizationIds: [] });
    api.submitOrganizerApplication.mockResolvedValue({ application: pending });
    await act(async () => root.render(createElement(OnlineCompetitions, { mode: 'apply' })));
    expect(host.textContent).toContain('主办资格申请未通过');
    expect(host.textContent).toContain('请补充监督排班');
    await act(async () => button('修改并重新提交').click());
    expect(host.querySelector<HTMLDetailsElement>('.competition-onboarding details')?.open).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[maxlength="160"]')?.value).toBe(rejectedApplication.name);
    expect(host.querySelector<HTMLInputElement>('input[maxlength="500"]')?.value).toBe(rejectedApplication.contact);
    await act(async () => fill(host.querySelector('textarea')!, '已安排两名监督员'));
    await act(async () => button('重新提交主办申请').click());
    expect(api.submitOrganizerApplication).toHaveBeenCalledWith({
      name: rejectedApplication.name, slug: rejectedApplication.slug, contact: rejectedApplication.contact,
      description: '已安排两名监督员',
    }, expect.any(String));
    expect(host.textContent).toContain('主办资格待审核');
    expect(button('修改并重新提交')).toBeUndefined();
  });

  it('lets an admin create under an approved organization despite a rejected prior application and no teaching membership', async () => {
    api.user = { uid: 7, isAdmin: true };
    api.listOrganizerApplications.mockResolvedValue({
      applications: [rejectedApplication], eligibleOrganizationIds: ['approved-org'],
      eligibleOrganizations: [{ id: 'approved-org', name: '已获准的主办组织' }],
    });
    await act(async () => root.render(createElement(OnlineCompetitions, { mode: 'create' })));
    expect(host.querySelector('.competition-setup-panel h2')?.textContent).toBe('比赛与项目');
    expect(host.textContent).toContain('已获准的主办组织');
    expect(host.textContent).not.toContain('主办资格申请未通过');
  });

  it('restores old single-project drafts in the three-step editor', async () => {
    api.user = { uid: 7, isAdmin: true };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('draft', {
      status: 'draft', canManage: true, canPublish: true, setup: { format: 'average', device: 'ordinary', capacity: 12, project: '444', feeMinor: 3250 },
      projects: [], sessions: [],
    }) });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null, createElement(OnlineCompetitions, { mode: 'manage', id: 'draft' }))));
    expect(host.querySelector('select[aria-label="选择比赛项目"]')?.getAttribute('aria-label')).toBe('选择比赛项目');
    const [fee, capacity] = host.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(fee.value).toBe('32.5');
    await act(async () => {
      select(host.querySelector('select[aria-label="选择比赛项目"]')!, 'pyram');
      fill(fee, '0'); fill(capacity, '24');
    });
    await act(async () => button('下一步').click());
    await act(async () => button('下一步').click());
    await act(async () => button('保存草稿').click());
    expect(api.updateCompetitionDraft).toHaveBeenCalledWith('draft', expect.objectContaining({
      format: 'average', projects: [{ project: 'pyram', device: 'ordinary', amountMinor: 0, capacity: 24 }],
    }), expect.any(String));
  });

  it('allows a signed-in user to request organizer access from Create and omits URL fields for an existing organization', async () => {
    api.user = { uid: 7 };
    const pending = { ...rejectedApplication, id: 'pending', status: 'pending', reviewNote: null, organizationId: 'org' };
    api.listOrganizerApplications.mockResolvedValueOnce({ applications: [], eligibleOrganizationIds: [] })
      .mockResolvedValue({ applications: [pending], eligibleOrganizationIds: [] });
    api.listTeachingOrganizations.mockResolvedValue([{ id: 'org', role: 'owner', status: 'active', name: '主办方' }]);
    api.submitOrganizerApplication.mockResolvedValue({ application: pending });
    await act(async () => root.render(createElement(OnlineCompetitions, { mode: 'create' })));
    expect(host.querySelector('.competition-setup-panel h2')?.textContent).toBe('主办资格');
    expect(host.textContent).not.toContain('组织网址名称');
    await act(async () => button('提交主办申请').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('请填写主办方名称');
    const organizations = host.querySelector<HTMLSelectElement>('select[aria-label="申请组织"]')!;
    await act(async () => {
      organizations.value = 'org';
      organizations.dispatchEvent(new Event('change', { bubbles: true }));
      fill(host.querySelector('input[maxlength="500"]')!, '联系人');
      fill(host.querySelector('textarea')!, '已安排监督员');
    });
    await act(async () => button('提交主办申请').click());
    expect(api.submitOrganizerApplication).toHaveBeenCalledWith({
      organizationId: 'org', contact: '联系人', description: '已安排监督员',
    }, expect.any(String));
    expect(host.textContent).toContain('主办资格待审核');
    expect(api.createOnlineCompetition).not.toHaveBeenCalled();
  });

  it('saves the complete draft before submitting without organizer-entered settlement terms', async () => {
    api.user = { uid: 7 };
    api.listOrganizerApplications.mockResolvedValue({ applications: [], eligibleOrganizationIds: ['org'] });
    api.getOnlineCompetition.mockResolvedValue({
      competition: fixture('draft', { status: 'draft', canManage: true, reviewStatus: 'rejected',
        reviewNote: '请补充规则', supervisionMode: 'self_service', sessions: [] }),
    });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null, createElement(OnlineCompetitions, { mode: 'manage', id: 'draft' }))));
    expect(host.textContent).toContain('请补充规则');
    await act(async () => button('下一步').click());
    await act(async () => button('下一步').click());
    expect(host.textContent).not.toContain('平台抽成比例');
    const [refund, recording] = host.querySelectorAll<HTMLTextAreaElement>('.competition-setup-panel textarea');
    await act(async () => { fill(refund, '报名可取消'); fill(recording, '录像用于异议处理'); });
    await act(async () => button('提交平台审核').click());
    expect(api.updateCompetitionDraft).toHaveBeenLastCalledWith('draft', expect.objectContaining({
      refundPolicy: '报名可取消', recordingPolicy: '录像用于异议处理', supervisionMode: 'self_service',
    }), expect.any(String));
    expect(api.publishOnlineCompetition).toHaveBeenCalledWith('draft', undefined, expect.any(String));
  });

  it('sets Beijing schedule presets and carries the default supervision session forward', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T03:00:00Z'));
    api.user = { uid: 7 };
    api.listOrganizerApplications.mockResolvedValue({ applications: [], eligibleOrganizationIds: ['org'] });
    const competition = fixture('schedule', { status: 'draft', canManage: true });
    competition.sessions = [{ ...competition.sessions[0], startsAt: competition.startsAt, endsAt: competition.endsAt }];
    api.getOnlineCompetition.mockResolvedValue({ competition });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null,
      createElement(OnlineCompetitions, { mode: 'manage', id: 'schedule' }))));
    await act(async () => button('下一步').click());
    const inputs = () => [...host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')].map(input => input.value);
    await act(async () => button('今晚快赛（2 小时）').click());
    expect(inputs()).toEqual(['2026-11-25T11:00', '2026-11-25T18:45', '2026-11-25T19:00', '2026-11-25T21:00', '2026-11-25T19:00', '2026-11-25T21:00']);
    await act(async () => button('本周末两日赛').click());
    expect(inputs().slice(2)).toEqual(['2026-11-28T10:00', '2026-11-29T18:00', '2026-11-28T10:00', '2026-11-29T18:00']);
    await act(async () => button('下周常规赛').click());
    expect(inputs().slice(2)).toEqual(['2026-11-30T19:00', '2026-12-06T22:00', '2026-11-30T19:00', '2026-12-06T22:00']);
  });

  it('allows an entrant to dispute a provisional bracket result', async () => {
    api.user = { uid: 7 };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('ended-bracket', {
      format: 'advancement', startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() - 1000).toISOString(),
    }) });
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [{
      id: 'my-bracket-entry', userId: 7, displayName: '选手', project: '333', device: 'ordinary', status: 'confirmed',
      sessionId: 'session', orderId: 'order', canCheckIn: false, canRecordResult: false, resultRecordedAt: null,
    }] });
    await render('ended-bracket');
    expect(host.textContent).toContain('成绩公示');
    const form = host.querySelector<HTMLDetailsElement>('.competition-bracket-dispute details')!;
    await act(async () => {
      form.open = true;
      fill(form.querySelector('textarea')!, '小局罚时需要复核');
    });
    await act(async () => button('提交异议').click());
    expect(api.raiseCompetitionDispute).toHaveBeenCalledWith('my-bracket-entry', '小局罚时需要复核');
    expect(form.textContent).toContain('异议已提交');
  });

  it('links directly to the bracket and updates a payment reservation countdown', async () => {
    vi.useFakeTimers();
    api.user = { uid: 7 };
    const start = new Date().toISOString();
    const entry = { registrationId: 'bracket-entry', competitionId: 'my-bracket', titleZh: '淘汰赛', titleEn: 'Bracket',
      status: 'confirmed', device: 'ordinary', orderId: 'order', sessionStartsAt: start, action: 'enter_bracket' } satisfies MyCompetitionEntry;
    api.listMyCompetitionEntries.mockResolvedValue({ entries: [entry, {
      ...entry, registrationId: 'pay-entry', titleZh: '待支付场次', status: 'reserved', action: 'pay',
      reservationExpiresAt: new Date(Date.now() + 65_000).toISOString(),
    }] });
    await act(async () => root.render(createElement(CompetitionCenter)));
    expect(host.querySelector('header')?.textContent).toContain('线上比赛与线下合作赛');
    expect(host.querySelector('a.competition-primary[href="/competitions/my-bracket#competition-bracket"]')?.textContent).toBe('进入对阵');
    expect(host.querySelector('.competition-reservation-remaining')?.textContent).toBe('锁位剩余 1:05');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(host.querySelector('.competition-reservation-remaining')?.textContent).toBe('锁位剩余 1:02');
  });

  function smartEntry(id: string): CompetitionRegistration {
    return {
      id, userId: 7, displayName: '选手甲', project: '333', device: 'smart', status: 'confirmed',
      sessionId: 'session', sessionKind: 'self_service', orderId: 'order', canCheckIn: true,
      canRecordResult: false, resultRecordedAt: null,
    };
  }

  it('checks in a paired Ao5 late entrant and calls POST to join an already open arena', async () => {
    api.user = { uid: 7 };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('late-check-in', { format: 'average' }) });
    const entry = smartEntry('late');
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [entry] });
    let checkedIn = false;
    let seated = false;
    const startsAt = new Date(Date.now() - 20_000).toISOString();
    api.getCompetitionArena.mockImplementation(async () => ({
      serverNow: new Date().toISOString(), checkedIn, seated, completed: false,
      roomId: checkedIn ? 'already-open-room' : null, roundNumber: checkedIn ? 1 : null,
      startsAt: checkedIn ? startsAt : null, scramble: seated ? 'R U F2' : null,
      inspectAt: null, solveAt: null, credentials: null, players: [],
    }));
    api.checkInCompetition.mockImplementation(async () => { checkedIn = true; });
    api.readyCompetitionArena.mockImplementation(async () => { seated = true; });
    const draw = () => createElement(NuqsTestingAdapter, {
      hasMemory: true, children: createElement(OnlineCompetitions, { id: 'late-check-in' }),
    });

    await act(async () => root.render(draw()));
    await act(async () => button('连接魔方检录').click());
    await act(async () => { await vi.waitFor(() => expect(host.textContent).toContain('连接魔方并检录')); });
    expect(api.checkInCompetition).not.toHaveBeenCalled();
    expect(api.readyCompetitionArena).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('R U F2');
    await act(async () => button('连接魔方并检录').click());
    expect(cubeFixture.connect).toHaveBeenCalledOnce();

    await act(async () => publishCubeState(true, 'U'.repeat(54)));
    expect(api.checkInCompetition).not.toHaveBeenCalled();

    await act(async () => publishCubeState(true, SOLVED_SMART_CUBE_FACELETS));
    expect(api.checkInCompetition).toHaveBeenCalledExactlyOnceWith('late', {
      deviceBrand: 'gan', deviceName: 'GAN 16 test', facelets: SOLVED_SMART_CUBE_FACELETS,
    });
    expect(api.readyCompetitionArena).toHaveBeenCalledExactlyOnceWith('late', expect.any(String));
    expect((host.querySelector('.competition-arena-scramble')?.textContent ?? '').replace(/\s+/g, '')).toContain('RUF2');
    expect(api.checkInCompetition.mock.invocationCallOrder[0]).toBeLessThan(api.readyCompetitionArena.mock.invocationCallOrder[0]);
    expect(cubeFixture.mounted).toHaveBeenCalledOnce();
    expect(cubeFixture.unmounted).not.toHaveBeenCalled();
  });

  it('checks in before a duel exists and keeps the connected cube when the match becomes available', async () => {
    api.user = { uid: 7 };
    const competition = fixture('duel-check-in', { format: 'advancement' });
    const entry = smartEntry('duelist');
    api.getOnlineCompetition.mockResolvedValue({ competition });
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [entry] });
    api.getCompetitionBrackets.mockResolvedValue({ generated: false, matches: [], standings: [] });

    await act(async () => root.render(createElement(NuqsTestingAdapter, {
      hasMemory: true, children: createElement(OnlineCompetitions, { id: competition.id }),
    })));
    await act(async () => button('连接魔方检录').click());
    await act(async () => { await vi.waitFor(() => expect(host.textContent).toContain('等待检录')); });
    await act(async () => button('连接魔方并检录').click());
    expect(cubeFixture.connect).toHaveBeenCalledOnce();
    expect(api.checkInCompetition).not.toHaveBeenCalled();

    let finishCheckIn!: () => void;
    api.checkInCompetition.mockImplementation(() => new Promise<void>(resolve => { finishCheckIn = resolve; }));
    await act(async () => publishCubeState(true, SOLVED_SMART_CUBE_FACELETS));
    expect(api.checkInCompetition).toHaveBeenCalledExactlyOnceWith('duelist', {
      deviceBrand: 'gan', deviceName: 'GAN 16 test', facelets: SOLVED_SMART_CUBE_FACELETS,
    });
    expect(api.readyCompetitionDuel).not.toHaveBeenCalled();

    api.getCompetitionBrackets.mockResolvedValue({ generated: true, standings: [], matches: [
      { id: 'match', ticketId: 'ticket', project: '333', device: 'smart', status: 'ready', playerA: entry.id, playerB: 'other' },
    ] });
    api.getCompetitionDuel.mockResolvedValue({
      id: 'match', eventId: competition.id, project: '333', device: 'smart', registrationId: entry.id,
      status: 'ready', gameNumber: 1, ownName: '甲', opponentName: '乙', ownScore: 0, opponentScore: 0,
      supervisionMode: 'self_service', serverNow: new Date().toISOString(), canPlay: true, checkedIn: true,
      ownReady: false, startAt: null, scramble: null,
    });
    await act(async () => finishCheckIn());
    expect(api.readyCompetitionDuel).toHaveBeenCalledExactlyOnceWith('match', 1, expect.any(String));
    expect(cubeFixture.connect).toHaveBeenCalledOnce();
    expect(cubeFixture.mounted).toHaveBeenCalledOnce();
    expect(cubeFixture.unmounted).not.toHaveBeenCalled();
  });

  it('keeps the last game score visible when the active duel advances', async () => {
    api.user = { uid: 7 };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('duel', {
      format: 'advancement', startsAt: new Date(Date.now() - 60_000).toISOString(),
    }) });
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [{
      id: 'entrant-a', userId: 7, displayName: '选手甲', project: '333', device: 'ordinary', sessionKind: 'offline',
      status: 'confirmed', sessionId: 'session', orderId: 'order', canCheckIn: false, canRecordResult: false, resultRecordedAt: null,
    }] });
    api.getCompetitionBrackets.mockResolvedValue({ generated: true, standings: [], matches: [{
      id: 'match-a', ticketId: 'ticket', project: '333', device: 'ordinary', status: 'ready', playerA: 'entrant-a', playerB: 'entrant-b',
    }] });
    api.getCompetitionDuel.mockReset().mockResolvedValue({
      id: 'match-a', eventId: 'duel', project: '333', status: 'ready', gameNumber: 2, ownName: '选手甲', opponentName: '选手乙',
      ownScore: 1, opponentScore: 0, serverNow: new Date().toISOString(), canPlay: true, startAt: new Date(Date.now() + 3000).toISOString(),
      scramble: null, ownReady: true, opponentReady: true, activeGame: null,
      lastGame: { gameNumber: 1, ownResult: { centiseconds: 1000, penalty: '+2' }, opponentResult: { centiseconds: null, penalty: 'DNF' }, winner: 'own' },
    });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null,
      createElement(CompetitionDuelArena, { id: 'match-a', competition: fixture('duel') }))));
    const previous = host.querySelector('.competition-arena-game');
    expect(previous?.textContent).toContain('G1');
    expect(previous?.textContent).toContain('12.00 (+2)');
    expect(previous?.textContent).toContain('DNF');
    expect(previous?.textContent).toContain('胜');
    expect(host.querySelector('.competition-arena-hud')?.textContent).toContain('G2');
  });

  it('renders a semantic scoreboard and loads a published replay without participant access', async () => {
    const finalizedAt = new Date().toISOString();
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('final', { status: 'completed', finalizedAt }) });
    api.listCompetitionResults.mockResolvedValue({ results: [{
      id: 'replay-entry', displayName: '选手', wcaId: '2025TEST01', countryCode: 'CN', rank: 1, project: '333',
      device: 'smart', finalizedAt, replayAttempts: [2], attempts: Array.from({ length: 5 }, () => ({ centiseconds: 1100, penalty: 'none' })),
    }, {
      id: 'provisional-entry', displayName: '待复核选手', rank: 1, project: '222', device: 'smart',
      finalizedAt: null, replayAttempts: [1], attempts: Array.from({ length: 5 }, () => ({ centiseconds: 400, penalty: 'none' })),
    }] });
    api.getCompetitionAttemptReplay.mockResolvedValue({ report: { scramble: 'R', moves: [{ move: "R'", elapsedMs: 0 }], durationMs: 11000 } });
    await render('final');
    expect(host.querySelectorAll('table.competition-result-table')).toHaveLength(2);
    expect(host.querySelector('th.wca-person-column[scope="col"]')?.textContent).toBe('选手');
    expect(host.querySelector('th[scope="row"] .wca-person-team-slot')).toBeTruthy();
    expect(host.querySelector('th[scope="row"] .country-flag')).toBeTruthy();
    const replays = host.querySelectorAll<HTMLButtonElement>('.competition-result-attempts .competition-replay-button');
    expect(replays).toHaveLength(1);
    await act(async () => replays[0].click());
    expect(api.getCompetitionAttemptReplay).toHaveBeenCalledWith('replay-entry', 2, true);
  });

  it('allows a spot-check decision in the host workspace', async () => {
    api.user = { uid: 7, isAdmin: true };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('spot', { canManage: true, supervisionMode: 'self_service' }) });
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [{
      id: 'spot-entry', displayName: '抽检选手', reviewRequired: true, userId: 8, project: '333', device: 'ordinary',
      status: 'attended', sessionId: 'session', orderId: 'order', canCheckIn: false, canRecordResult: false,
      reviewAttempts: [{ attemptNumber: 3, centiseconds: 1000, penalty: 'none' }],
    }] });
    await act(async () => root.render(createElement(NuqsTestingAdapter, null, createElement(OnlineCompetitions, { mode: 'manage', id: 'spot' }))));
    expect(host.querySelector('.competition-spot-checks')?.textContent).toContain('自助赛抽检');
    await act(async () => button('核验通过').click());
    expect(api.reviewCompetitionSelfAttempt).toHaveBeenCalledWith('spot-entry', 3, 'approve');
    await act(async () => button('改判 DNF').click());
    expect(api.reviewCompetitionSelfAttempt).toHaveBeenCalledWith('spot-entry', 3, 'DNF');
  });

  it('requires a fresh recording or the current attempt’s uploaded clip after reload', async () => {
    api.user = { uid: 7 };
    const competition = fixture('self', { supervisionMode: 'self_service', startsAt: new Date(Date.now() - 10_000).toISOString() });
    api.getOnlineCompetition.mockResolvedValue({ competition });
    const now = new Date().toISOString();
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [{
      id: 'self-entry', userId: 7, displayName: '选手', project: '333', device: 'ordinary', sessionKind: 'self_service',
      status: 'confirmed', sessionId: 'session', orderId: 'order', checkedInAt: now, canCheckIn: false, canRecordResult: false, resultRecordedAt: null,
    }] });
    api.getCompetitionAttempts.mockResolvedValue({ attempts: [{ attemptNumber: 1, scramble: 'R U', issuedAt: now, recordedAt: null }] });
    api.uploadCompetitionEvidence.mockResolvedValue({ evidence: [{ id: 'uploaded-clip', mime: 'video/mp4', attemptNumber: 1, sizeBytes: 5, createdAt: now }] });
    await act(async () => root.render(createElement(NuqsTestingAdapter, { searchParams: '?entry=self-entry', children: createElement(OnlineCompetitions, { id: 'self' }) })));
    await act(async () => { await vi.waitFor(() => expect(host.querySelector('.competition-self-timer output')?.textContent).toBe('15s')); });
    expect(host.querySelector('.competition-scramble-layout[data-preview] svg')).toBeTruthy();
    await act(async () => select(host.querySelector<HTMLSelectElement>('#competition-timing-mode')!, 'external'));
    const score = host.querySelector<HTMLInputElement>('.competition-score-form input')!;
    await act(async () => fill(score, '12.34'));
    expect(host.textContent).toContain('这把还没有录像记录');
    expect(button('确认本次成绩').disabled).toBe(true);
    const file = new File(['video'], 'attempt.mp4', { type: 'video/mp4' });
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expect(api.uploadCompetitionEvidence).toHaveBeenCalledWith('self-entry', file, 1);
    expect(button('确认本次成绩').disabled).toBe(false);
    await act(async () => button('确认本次成绩').click());
    expect(api.completeCompetitionSelfAttempt).toHaveBeenCalledWith('self-entry', 1, {
      centiseconds: 1234, penalty: 'none', recordingEvidenceId: 'uploaded-clip',
    }, expect.any(String));
  });

  it('lays out actual win links in round columns and highlights entrants across the bracket', async () => {
    const match = (id: string, options: Partial<CompetitionBracketMatch>): CompetitionBracketMatch => ({
      id, ticketId: 'ticket', project: '333', device: 'ordinary', side: 'winners', round: 1, number: 1,
      bestOf: 3, playerA: 'a', playerB: 'b', nameA: '甲', nameB: '乙', scoreA: 2, scoreB: 0, winner: 'a',
      status: 'completed', nextWin: null, nextLoss: null, ...options,
    });
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('tree', { format: 'advancement' }) });
    api.getCompetitionBrackets.mockResolvedValue({ generated: true, standings: [], matches: [
      match('first', { nextWin: 'next' }),
      match('second', { number: 2, playerA: 'c', playerB: 'd', nameA: '丙', nameB: '丁', winner: 'c', nextWin: 'next' }),
      match('next', { round: 2, playerB: 'c', nameB: '丙', status: 'in_progress', gameNumber: 2, nextWin: 'final' }),
      match('final', { side: 'grand_final', bestOf: 5, playerA: null, playerB: null, status: 'pending' }),
    ] });
    await render('tree');
    const cards = [...host.querySelectorAll<HTMLElement>('.competition-match-card')];
    expect(cards[0].style.left).toBe(cards[1].style.left);
    expect(parseFloat(cards[2].style.left)).toBeGreaterThan(parseFloat(cards[1].style.left));
    expect(parseFloat(cards[2].style.top)).toBe((parseFloat(cards[0].style.top) + parseFloat(cards[1].style.top)) / 2);
    expect(host.querySelectorAll('.competition-bracket-lines path')).toHaveLength(3);
    expect(cards[2].textContent).toContain('第 2 局');
    await act(async () => cards[0].querySelector<HTMLElement>('.competition-match-player')!.focus());
    expect(host.querySelectorAll('.competition-match-player[data-path]')).toHaveLength(2);
    expect(host.querySelectorAll('.competition-bracket-lines path[data-path]')).toHaveLength(1);
  });

  it('shows an Ao5 report with trim marks and rank immediately in a finished session', async () => {
    api.user = { uid: 7 };
    const recordedAt = new Date().toISOString();
    const attempts = [582, 680, 720, 810, 911].map(centiseconds => ({ centiseconds, penalty: 'none' as const }));
    const entry: CompetitionRegistration = {
      id: 'finished-entry', userId: 7, displayName: 'Alice (爱丽丝)', project: '666', device: 'ordinary', sessionKind: 'self_service',
      status: 'attended', sessionId: 'session', orderId: 'order', checkedInAt: recordedAt, canCheckIn: false, canRecordResult: false,
      resultRecordedAt: recordedAt, attempts,
    };
    api.getOnlineCompetition.mockResolvedValue({ competition: fixture('report') });
    api.listCompetitionRegistrations.mockResolvedValue({ registrations: [entry] });
    api.listCompetitionResults.mockResolvedValue({ results: [{ ...entry, rank: 2, recordedAt, finalizedAt: null }] });
    await act(async () => root.render(createElement(NuqsTestingAdapter, { searchParams: '?entry=finished-entry',
      children: createElement(OnlineCompetitions, { id: 'report' }) })));
    await act(async () => { await vi.waitFor(() => expect(host.querySelector('.competition-report')).toBeTruthy()); });
    const report = host.querySelector('.competition-report');
    expect(report?.querySelector('.competition-report-metrics')?.textContent).toContain('7.37');
    expect(report?.querySelector('.competition-report-attempts')?.textContent).toContain('(5.82)');
    expect(report?.querySelector('.competition-report-attempts')?.textContent).toContain('(9.11)');
    expect(report?.querySelector('.competition-report-rank')?.textContent).toContain('2 组内暂列');
    expect(report?.textContent).toContain('生成战报图');
  });

  it('dismisses the certificate on a backdrop click or native cancel and keeps it open after a drag from inside', async () => {
    const methods = {
      showModal(this: HTMLDialogElement) { this.open = true; },
      close(this: HTMLDialogElement) { this.open = false; },
    };
    const originals = Object.entries(methods).map(([name, value]) => {
      const original = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name);
      Object.defineProperty(HTMLDialogElement.prototype, name, { configurable: true, value });
      return { name, original };
    });
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    try {
      await act(async () => root.render(createElement(CompetitionReportShare, {
        data: {
          competition: '测试比赛', organizer: '主办方', division: '三阶', name: '选手',
          date: '2026-11-25', rank: 1, final: true, metrics: [{ label: 'Ao5', value: '8.00' }],
        },
      })));
      await act(async () => button('完赛证书').click());
      const dialog = host.querySelector('dialog')!;
      const panel = dialog.querySelector('.competition-report-panel')!;
      expect(dialog.open).toBe(true);
      expect(dialog.hasAttribute('data-site-surface')).toBe(false);
      expect(panel.getAttribute('data-site-surface')).toBe('popover');
      const pointer = (target: Element, type: string) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0 }));
      await act(async () => {
        pointer(panel, 'pointerdown');
        pointer(panel, 'click');
      });
      expect(host.querySelector('dialog')).toBe(dialog);
      await act(async () => {
        pointer(panel, 'pointerdown');
        pointer(dialog, 'pointerup');
        pointer(dialog, 'click');
      });
      expect(host.querySelector('dialog')).toBe(dialog);
      await act(async () => {
        pointer(dialog, 'pointerdown');
        pointer(dialog, 'pointerup');
        pointer(dialog, 'click');
      });
      expect(host.querySelector('dialog')).toBeNull();
      expect(dialog.open).toBe(false);
      await act(async () => button('完赛证书').click());
      const cancel = new Event('cancel', { bubbles: true, cancelable: true });
      await act(async () => host.querySelector('dialog')!.dispatchEvent(cancel));
      expect(cancel.defaultPrevented).toBe(true);
      expect(host.querySelector('dialog')).toBeNull();
    } finally {
      context.mockRestore();
      for (const { name, original } of originals) {
        if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
      }
    }
  });

  it('checks the current entrant in from the homepage and opens the session in the same language', async () => {
    api.user = { uid: 7 };
    const entry: MyCompetitionEntry = {
      registrationId: 'personal-entry', competitionId: 'my-competition', titleZh: '参赛场次', titleEn: 'My session',
      status: 'confirmed', device: 'ordinary', orderId: 'order', sessionStartsAt: new Date().toISOString(), action: 'check_in',
    };
    api.listMyCompetitionEntries.mockResolvedValue({ entries: [entry] });
    await act(async () => root.render(createElement(CompetitionCenter)));
    const next = host.querySelector<HTMLButtonElement>('.my-competition-row button')!;
    expect(next.textContent).toBe('检录');
    await act(async () => next.click());
    expect(api.checkInCompetition).toHaveBeenCalledWith(entry.registrationId);
    expect(api.push).toHaveBeenCalledWith('/zh/competitions/my-competition?entry=personal-entry');
  });

  it('opens the smart cube check-in seat from the homepage without posting check-in', async () => {
    api.user = { uid: 7 };
    const entry: MyCompetitionEntry = {
      registrationId: 'smart-entry', competitionId: 'my-competition', titleZh: '智能魔方组', titleEn: 'Smart cube division',
      status: 'confirmed', device: 'smart', orderId: 'order', sessionStartsAt: new Date().toISOString(), action: 'check_in',
    };
    api.listMyCompetitionEntries.mockResolvedValue({ entries: [entry] });
    await act(async () => root.render(createElement(CompetitionCenter)));

    const link = host.querySelector<HTMLAnchorElement>('.my-competition-row a.competition-primary');
    expect(link?.textContent).toBe('连接魔方检录');
    expect(link?.getAttribute('href')).toBe('/competitions/my-competition?entry=smart-entry');
    expect(host.querySelector('.my-competition-row button')).toBeNull();
    link!.addEventListener('click', event => event.preventDefault(), { once: true });
    await act(async () => link!.click());
    expect(api.checkInCompetition).not.toHaveBeenCalled();
  });
});
