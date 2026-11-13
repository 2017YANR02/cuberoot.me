'use client';

import PageBackLink from '@/components/PageBackLink';
import { currentEntryHref } from '@/lib/entry-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, Search } from '@app-foundation/icons/lucide';
import { parseAsFloat, parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import Paginator from '@/components/wca-stats/Paginator';
import { CompactSelect } from '@/components/CompactSelect';
import SearchInput from '@/components/SearchInput';
import SortArrow from '@/components/SortArrow';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { executePlatformAction, loadPlatformResource, localizePlatformEntity, PlatformPermissionError } from '@/lib/platform-gateway';
import { fillPlatformParams, PLATFORM_ROUTES } from '@/lib/platform-routes';
import type { PlatformActionId, PlatformActionResult, PlatformEntity, PlatformResourceResult, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { PlatformDomainActions } from './PlatformDomainActions';
import { PlatformOrderPayment } from './PlatformOrderPayment';
import { PlatformDomainContent } from './PlatformDomainContent';
import { PlatformPrivacySettings } from './PlatformPrivacySettings';
import dynamic from 'next/dynamic';
import { PlatformLearningWorkspace, isPlatformLearningWorkspace } from './PlatformLearningWorkspace';
import { PlatformQrAdmin } from './PlatformQrAdmin';
import { titleFor } from './PlatformRouteHelpers';
import { PlatformLanding } from './PlatformLanding';
import { PlatformAboutView, PlatformOfflineView, PlatformAccountView, PlatformCanonicalView } from './PlatformInfoViews';
import { PlatformEntityList } from './PlatformEntityList';

const PlatformQrCardStudio = dynamic(
  () => import('./PlatformQrCardStudio').then(module => module.PlatformQrCardStudio),
  { loading: () => <PlatformState kind="loading" /> },
);

const EMPTY_PLATFORM_ENTITIES: PlatformEntity[] = [];

export function PlatformResourceRouteView({
  definition,
  params,
}: {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [rawPage, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [rawPageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(20));
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault(''));
  const page = Math.max(1, rawPage);
  const pageSize = [20, 50, 100].includes(rawPageSize) ? rawPageSize : 20;
  const [selectedLessonId, setSelectedLessonId] = useQueryState('lesson', parseAsString.withOptions({ history: 'push', scroll: false }));
  const [lessonStartTime, setLessonStartTime] = useQueryState('t', parseAsFloat);
  const [sort, setSort] = useQueryState('sort', parseAsStringEnum(['title', 'updated'] as const).withDefault('updated'));
  const [owned] = useQueryState('owned', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [stay] = useQueryState('stay', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [result, setResult] = useState<PlatformResourceResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [days, setDays] = useQueryState('days', parseAsInteger.withDefault(30));
  const [retry, setRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [redeemedCourseIds, setRedeemedCourseIds] = useState<ReadonlySet<string>>(() => new Set());
  const qrAdminMode = ({ 'admin-qr': 'manage', 'admin-qr-stats': 'stats', 'admin-qr-prompts': 'prompts' } as const)[definition.id as 'admin-qr' | 'admin-qr-stats' | 'admin-qr-prompts'];
  const searchable = ['courses', 'paths', 'events', 'news', 'shop', 'search', 'admin-courses', 'admin-paths', 'admin-events', 'admin-news', 'admin-products', 'instructor-courses', 'orders', 'admin-orders', 'admin-coupons', 'admin-payouts', 'admin-reconcile'].includes(definition.id);
  const sortable = ['courses', 'paths', 'events', 'news', 'shop', 'admin-courses', 'admin-paths', 'admin-events', 'admin-news', 'admin-products', 'instructor-courses'].includes(definition.id);
  const newRoute = PLATFORM_ROUTES.find(route => route.pattern === `${definition.pattern}/new`);
  const learningWorkspace = isPlatformLearningWorkspace(definition.id);
  const isQrCardStudio = definition.id === 'admin-qr-cards';
  const loadsResource = !isQrCardStudio && !learningWorkspace && !qrAdminMode && definition.kind !== 'canonical' && Boolean(definition.resource)
    && definition.id !== 'account-invites'
    && definition.id !== 'account-privacy'
    && (definition.kind !== 'form' || definition.id === 'teacher-apply');
  const permissionDenied = error instanceof PlatformPermissionError;

  const actionScope = useRef({ active: false, epoch: 0 });
  useEffect(() => {
    setMounted(true);
    const scope = actionScope.current;
    scope.active = true;
    scope.epoch += 1;
    return () => { scope.active = false; scope.epoch += 1; };
  }, []);
  const allowed = definition.access === 'public'
    || (definition.access === 'admin' ? isAdmin : Boolean(user));

  useEffect(() => {
    if (!mounted || !allowed || !definition.resource || !loadsResource) return;
    const controller = new AbortController();
    setResult(null);
    setError(null);
    void loadPlatformResource(definition.resource, {
      routeId: definition.id,
      params,
      query,
      sort,
      owned: owned === '1',
      page, pageSize, category, days: definition.resource === 'admin-analytics' ? days : undefined,
      signal: controller.signal,
    }).then(value => {
      if (controller.signal.aborted) return;
      const maxPage = value.total === undefined ? page : Math.max(1, Math.ceil(value.total / (value.pageSize ?? pageSize)));
      if (page > maxPage) { void setPage(maxPage); return; }
      setResult(value);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => controller.abort();
  }, [allowed, definition.resource, loadsResource, mounted, owned, params, query, retry, sort, page, pageSize, category, days]);

  useEffect(() => {
    const needsCourseOwnership = definition.id === 'courses' || definition.id === 'course-detail';
    if (!mounted || !user || !needsCourseOwnership) {
      setRedeemedCourseIds(new Set());
      return;
    }
    const controller = new AbortController();
    void (async () => {
      const items: PlatformEntity[] = [];
      let page = 1;
      while (!controller.signal.aborted) {
        const batch = await loadPlatformResource('account-courses', { params: {}, page, pageSize: 100, signal: controller.signal });
        items.push(...batch.items);
        if (!batch.items.length || (batch.total !== undefined ? items.length >= batch.total : batch.items.length < (batch.pageSize ?? 100))) break;
        page++;
      }
      return { items };
    })().then(({ items }) => {
        if (!controller.signal.aborted) {
          setRedeemedCourseIds(new Set(items.filter((item) => item.status === 'active').map((item) => item.id)));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setRedeemedCourseIds(new Set());
      });
    return () => controller.abort();
  }, [definition.id, mounted, user, retry]);

  const sortedItems = useMemo(() => {
    if (!result) return [];
    return result.items.map(item => localizePlatformEntity(item, lang));
  }, [result, lang]);

  const visibleRedeemedCourseIds = useMemo<ReadonlySet<string>>(() => {
    if (definition.id !== 'account-courses') return redeemedCourseIds;
    return new Set(sortedItems.filter((item) => item.status === 'active').map((item) => item.id));
  }, [definition.id, redeemedCourseIds, sortedItems]);

  // Keep the entire order current after native checkout, QR payment, or a provider return.
  const orderStatus = definition.id === 'order-detail' ? result?.items[0]?.data?.status : undefined;
  useEffect(() => {
    if (definition.id !== 'order-detail' || !mounted || !allowed || orderStatus !== 'pending_payment') return;
    const controller = new AbortController();
    let loading = false;
    const refreshOrder = async () => {
      if (loading || document.visibilityState === 'hidden' || controller.signal.aborted) return;
      loading = true;
      try {
        const next = await loadPlatformResource('orders', { routeId: 'order-detail', params, signal: controller.signal });
        if (!controller.signal.aborted) setResult(next);
      } catch { /* Preserve the last confirmed order; subsequent polls can recover. */ }
      finally { loading = false; }
    };
    const timer = window.setInterval(() => { void refreshOrder(); }, 3000);
    const onReturn = () => { void refreshOrder(); };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [definition.id, mounted, allowed, orderStatus, params]);

  const runAction = async (action: PlatformActionId, id?: string, payload: Record<string, unknown> = {}): Promise<PlatformActionResult | undefined> => {
    const epoch = actionScope.current.epoch;
    const isCurrent = () => actionScope.current.active && actionScope.current.epoch === epoch;
    if (!isCurrent()) return undefined;
    const key = id ? `${action}:${id}` : action;
    setActionBusy(key);
    setActionMessage(null);
    try {
      const response = await executePlatformAction(definition, { action, resourceId: id, payload });
      if (!isCurrent()) return undefined;
      if (action === 'redeem-invite') {
        let courseId = response.courseId;
        if (!courseId && response.entitlementId) {
          const { items } = await loadPlatformResource('entitlements', { params: {} });
          if (!isCurrent()) return undefined;
          const entitlement = items.find((item) => item.id === response.entitlementId);
          courseId = typeof entitlement?.data?.courseId === 'string' ? entitlement.data.courseId : null;
        }
        if (!courseId) throw new Error(t('兑换成功，但无法定位课程。请刷新后重试。', 'Code redeemed, but the course could not be located. Please refresh and try again.'));
        window.location.replace(currentEntryHref(`${lang === 'zh' ? '/zh' : ''}/platform/courses/${encodeURIComponent(courseId)}/sections/core`, 'replace'));
        return response;
      }
      setActionMessage(action === 'start-payment' ? null : response.message ?? t('操作已完成。', 'Action completed.'));
      if (definition.id === 'admin-qr-detail' && action === 'admin-save' && params.code
        && response.code && response.code !== params.code) {
        const url = new URL(window.location.href);
        url.pathname = `${url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)}${encodeURIComponent(response.code)}`;
        url.search = '';
        window.location.replace(url);
        return response;
      }
      setRetry((value) => value + 1);
      return response;
    } catch (reason) {
      if (isCurrent()) setActionMessage(reason instanceof Error ? reason.message : t('操作失败。', 'Action failed.'));
    } finally {
      if (isCurrent()) setActionBusy(null);
    }
    return undefined;
  };

  if (definition.id === 'home') return <PlatformLanding />;
  if (definition.id === 'account-invites') {
    return <div className="platform-route platform-redemption">
      {!mounted ? <PlatformState kind="loading" /> : !user ? (
        <AppLink href="/account" className="platform-button" prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      ) : (
        <>
          <PlatformDomainActions definition={definition} params={params} busy={actionBusy} runAction={runAction} />
          {actionMessage ? <p className="platform-action-message" role="status">{actionMessage}</p> : null}
        </>
      )}
    </div>;
  }
  const courseDetail = definition.id === 'course-detail';
  const inviteManager = definition.id === 'admin-invites';
  const courseSection = definition.id.startsWith('course-section-');
  const redemptionReturnPath = `${lang === 'zh' ? '/zh' : ''}/platform/account/invites`;
  const courseSectionLoginHref = `/account${nextQuery(redemptionReturnPath)}`;
  const course = courseDetail && !error ? sortedItems[0] : undefined;
  const publicDetail = definition.access === 'public' && definition.kind === 'detail' && !error ? sortedItems[0] : undefined;
  const courseRedeemed = Boolean(course && visibleRedeemedCourseIds.has(course.id));
  const orderPage = ['orders', 'order-detail', 'admin-orders', 'admin-order'].includes(definition.id);
  const pageTotal = result?.total;
  const effectivePageSize = result?.pageSize ?? pageSize;
  const pageTitle = publicDetail?.title ?? titleFor(t, definition);
  const areaTitle = courseDetail || courseSection || definition.id === 'course-lesson' || definition.id === 'courses' ? t('CubeRoot 课程', 'CubeRoot Courses') : t(({ discover: '发现', learning: '学习', commerce: '商店与订单', account: '个人空间', instructor: '讲师工作台', admin: '管理', organization: '机构', community: '社区' } as Record<string, string>)[definition.area] ?? '学习空间', ({ discover: 'Discover', learning: 'Learning', commerce: 'Shop and orders', account: 'My workspace', instructor: 'Instructor workspace', admin: 'Administration', organization: 'Organizations', community: 'Community' } as Record<string, string>)[definition.area] ?? 'Learning');
  const pageDescription = publicDetail?.summary ?? (definition.id === 'membership'
    ? t('课程会员用于解锁课程，与网站支持会员分开购买。', 'Course memberships unlock lessons and are purchased separately from site supporter memberships.')
    : '');
  const orderUnavailable = ['order-detail', 'admin-order'].includes(definition.id) && (!!error || !result || !sortedItems[0]);

  return (
    <div className={`platform-route${courseDetail ? ' platform-course-detail' : ''}${courseSection ? ' platform-course-classroom' : ''}${inviteManager ? ' platform-invite-page' : ''}`}>
      <header className="platform-route-header">
        <div className="platform-route-heading">
          {courseSection && params.id ? <div>
            <PageBackLink className="platform-home-secondary" fallback={`/platform/courses/${encodeURIComponent(params.id)}`} prefetch={false} />
          </div> : null}
          {!inviteManager && !orderPage ? <div className="platform-route-labels">
            {areaTitle !== pageTitle ? <span className="platform-route-area">{areaTitle}</span> : null}
            {courseRedeemed ? <span className="platform-course-redeemed">{t('已兑换', 'Redeemed')}</span> : null}
          </div> : null}
          <h1>{pageTitle}</h1>
          {!courseSection && !courseDetail && !inviteManager && !orderPage && pageDescription ? <p>{pageDescription}</p> : null}
          {course ? <div className="platform-home-actions">
            <AppLink
              className="platform-home-secondary"
              href={courseRedeemed ? `/platform/courses/${encodeURIComponent(course.id)}/sections/core` : '/platform/account/invites'}
              prefetch={false}
            >
              {courseRedeemed ? t('开始学习', 'Start learning') : t('兑换课程', 'Redeem a code')}<ArrowRight aria-hidden />
            </AppLink>
          </div> : null}
        </div>
      </header>

      {newRoute ? <p><AppLink className="platform-button platform-button-primary" href={`/platform/${newRoute.pattern}`} prefetch={false}>{titleFor(t, newRoute)}</AppLink></p> : null}
      {['admin', 'admin-event-analytics'].includes(definition.id) && allowed ? <CompactSelect label={t('统计范围', 'Period')} ariaLabel={t('统计范围', 'Period')} value={String(days)} items={[{ value: '7', label: t('最近 7 天', 'Last 7 days') }, { value: '30', label: t('最近 30 天', 'Last 30 days') }, { value: '90', label: t('最近 90 天', 'Last 90 days') }]} onChange={value => { void setDays(Number(value)); }} /> : null}
      {definition.id === 'events' ? <p><AppLink href="/platform/events/preview" prefetch={false} className="platform-home-secondary">{t('体验线上赛事流程', 'Explore online competitions')}<ArrowRight aria-hidden /></AppLink></p> : null}

      {definition.id === 'about' ? (
        <PlatformAboutView />
      ) : definition.id === 'offline' ? (
        <PlatformOfflineView />
      ) : (definition.id === 'login' || definition.id === 'account') ? (
        <PlatformAccountView loginOnly={definition.id === 'login'} />
      ) : definition.id === 'account-privacy' ? (
        !mounted ? <PlatformState kind="loading" /> : !allowed ? <PlatformState kind="permission" /> : <PlatformPrivacySettings definition={definition} />
      ) : definition.kind === 'canonical' ? (
        !mounted ? <PlatformState kind="loading" /> : !allowed ? <PlatformState kind="permission" /> : <PlatformCanonicalView definition={definition} params={params} />
      ) : !mounted ? (
        <PlatformState kind="loading" />
      ) : !allowed ? (
        <PlatformState
          kind="permission"
          permissionHref={courseSection ? courseSectionLoginHref : undefined}
        />
      ) : isQrCardStudio ? (
        <PlatformQrCardStudio entities={EMPTY_PLATFORM_ENTITIES} query={query} onQueryChange={value => { void setQuery(value || null); }} />
      ) : learningWorkspace ? (
        <PlatformLearningWorkspace definition={definition} params={params} />
      ) : qrAdminMode ? (
        <PlatformQrAdmin mode={qrAdminMode} />
      ) : definition.resource ? (
        <>
          {(definition.kind === 'collection' || definition.kind === 'dashboard')
            && definition.id !== 'membership'
            && definition.id !== 'me-membership'
            && !isQrCardStudio
            && !inviteManager
            && searchable
            && !permissionDenied ? (
            <div className="platform-toolbar">
              <SearchInput
                value={query}
                onChange={(value) => { void setPage(null); void setQuery(value || null); }}
                placeholder={t('搜索当前内容', 'Search this view')}
                ariaLabel={t('搜索当前内容', 'Search this view')}
                className="platform-search"
                inputClassName="platform-search-input"
              />
              {sortable && <div className="platform-sort" aria-label={t('排序', 'Sort')}>
                <Search aria-hidden />
                <button type="button" className="platform-sort-button" onClick={() => { void setPage(null); void setSort('updated'); }}>
                  {t('最近更新', 'Updated')}<SortArrow active={sort === 'updated'} dir="desc" />
                </button>
                <button type="button" className="platform-sort-button" onClick={() => { void setPage(null); void setSort('title'); }}>
                  {t('标题', 'Title')}<SortArrow active={sort === 'title'} dir="asc" />
                </button>
              </div>}
              {result?.categories?.length ? <CompactSelect label={t('分类', 'Category')} ariaLabel={t('分类', 'Category')} value={category}
                items={[{ value: '', label: t('全部', 'All') }, ...result.categories.map(value => ({ value, label: value }))]}
                onChange={value => { void setPage(null); void setCategory(value || null); }} /> : null}
            </div>
          ) : null}

          {definition.id === 'order-detail' && !permissionDenied && !orderUnavailable && sortedItems[0] ? <PlatformOrderPayment key={sortedItems[0].id}
            entity={sortedItems[0]} busy={actionBusy} runAction={runAction} message={actionMessage} /> : null}

          {!loadsResource ? null : permissionDenied ? (
            <PlatformState
              kind="permission"
              message={error.status === 403 ? t('当前账号没有访问这个工作区的角色。', 'Your account does not have the role required for this workspace.') : undefined}
              permissionHref={courseSection && error.status !== 403 ? courseSectionLoginHref : undefined}
            />
          ) : error ? (
            <PlatformState kind="error" message={error.message} onRetry={() => setRetry((value) => value + 1)} />
          ) : !result ? (
            <PlatformState kind="loading" />
          ) : isQrCardStudio ? (
            <PlatformQrCardStudio
              entities={sortedItems}
              query={query}
              onQueryChange={(value) => { void setQuery(value || null); }}
            />
          ) : inviteManager ? null : sortedItems.length === 0 && definition.id !== 'membership' && definition.id !== 'me-membership' ? (
            <PlatformState
              kind="empty"
              message={definition.id === 'teacher-detail'
                ? t('这个旧讲师标识没有对应的主站讲师资料。旧 Platform 的演示讲师未导入，请返回主站讲师名录查找真实资料。', 'This legacy teacher identifier has no matching main-site profile. Demo teachers from the legacy Platform were not imported; use the main-site directory to find current profiles.')
                : undefined}
            />
          ) : courseDetail || courseSection || ['path-detail', 'certificate', 'event-detail', 'news-detail', 'product-detail', 'admin', 'admin-event-analytics'].includes(definition.id) || definition.id === 'membership' || definition.id === 'me-membership' || definition.id === 'qr' ? null : (
            <PlatformEntityList
              definition={definition}
              items={sortedItems}
              redeemedCourseIds={visibleRedeemedCourseIds}
              actionBusy={actionBusy}
              onAction={(action, id, payload) => { void runAction(action, id, payload); }}
            />
          )}

          {result?.page && definition.kind === 'collection' && !isQrCardStudio && !inviteManager ? (
            pageTotal !== undefined ? <Paginator page={page} totalPages={Math.max(1, Math.ceil(pageTotal / effectivePageSize))}
              size={effectivePageSize} pageSizeOptions={[20, 50, 100]} isZh={lang === 'zh'} className="platform-pagination"
              onPageChange={value => { void setPage(value); }} onSizeChange={value => { void setPage(null); void setPageSize(value); }} />
              : <nav className="platform-pagination" aria-label={t('分页', 'Pagination')}>
                <button type="button" className="wse-page-btn" disabled={page <= 1} onClick={() => { void setPage(page - 1); }}>{t('上一页', 'Previous')}</button>
                <span>{t(`第 ${page} 页`, `Page ${page}`)}</span>
                <button type="button" className="wse-page-btn" disabled={result.items.length < effectivePageSize} onClick={() => { void setPage(page + 1); }}>{t('下一页', 'Next')}</button>
              </nav>
          ) : null}

          {definition.canonicalHref ? (
            <AppLink href={fillPlatformParams(definition.canonicalHref, params)} className="platform-canonical-link" prefetch={false}>
              {t(definition.canonicalLabel?.zh ?? '打开完整功能', definition.canonicalLabel?.en ?? 'Open the full feature')}
              <ExternalLink aria-hidden />
            </AppLink>
          ) : null}

          {!permissionDenied && !orderUnavailable ? <PlatformDomainContent definition={definition} params={params} entity={sortedItems[0]} previewRedirect={stay === '1'} selectedLessonId={selectedLessonId} lessonStartTime={lessonStartTime ?? undefined} courseRedeemed={courseRedeemed} onSelectLesson={id => { void setLessonStartTime(null); void setSelectedLessonId(id); }} /> : null}

          {permissionDenied || orderUnavailable || definition.id === 'qr' || (['membership', 'me-membership'].includes(definition.id) && !result) ? null : (
            <PlatformDomainActions
              definition={definition}
              params={params}
              entity={sortedItems[0]}
              entities={sortedItems}
              busy={actionBusy}
              runAction={runAction}
              onSaved={() => setRetry(value => value + 1)}
            />
          )}
          {actionMessage && (definition.id !== 'order-detail' || sortedItems[0]?.status !== 'pending_payment') ? <p className="platform-action-message" role="status">{actionMessage}</p> : null}
        </>
      ) : (
        <PlatformCanonicalView definition={definition} params={params} />
      )}
    </div>
  );
}
