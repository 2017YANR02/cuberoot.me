'use client';

import PageBackLink from '@/components/PageBackLink';
import LangToggle from '@/components/LangToggle';
import { currentEntryHref } from '@/lib/entry-navigation';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Plus, Search } from '@app-foundation/icons/lucide';
import { parseAsFloat, parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import Paginator from '@/components/wca-stats/Paginator';
import { CompactSelect } from '@/components/CompactSelect';
import SearchInput from '@/components/SearchInput';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import SortArrow from '@/components/SortArrow';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { executePlatformAction, loadPlatformResource, localizePlatformEntity, PlatformPermissionError } from '@/lib/platform-gateway';
import { WebSessionRestoreError } from '@/lib/session-fetch';
import { fillPlatformParams, isPlatformCourseClassroom, isPlatformInstructorApplication, isPlatformInstructorCourseEditor, isPlatformLearningWorkspace, PLATFORM_INSTRUCTOR_PAGE_SIZES, PLATFORM_ROUTES } from '@/lib/platform-routes';
import { isInstructorCourseListEntry, platformNavigationState, platformPathname, platformWorkspaceRoutes } from '@/lib/platform-navigation';
import { PlatformNavigationContext, PlatformInstructorAccessRefreshContext, usePlatformSearchBinding, type PlatformFilterGroup } from '@/lib/platform-navigation-context';
import type { PlatformActionId, PlatformActionResult, PlatformEntity, PlatformResourceResult, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import dynamic from 'next/dynamic';
import { instructorApplicationStatus, titleFor } from './PlatformRouteHelpers';
import { PlatformAboutView, PlatformOrganizationAdmission, PlatformOfflineView, PlatformAccountView, PlatformCanonicalView } from './PlatformInfoViews';
import { COURSE_FILTER_THRESHOLD, COURSE_TOPIC_IDS, courseCatalogDetails, loadCourseCatalog, loadLegacyCatalogPreviews, loadLegacyCourseLessonAccess, matchesCourseCatalog } from '@/lib/platform-course-catalog';
import { CourseCatalogSearch, PlatformCourseCards, PlatformCourseToolbar } from './PlatformCourseCatalog';
import { PlatformEntityList } from './PlatformEntityList';
import { PlatformScopedSearch } from './PlatformScopedSearch';
import { InstructorAdmissionIntro, INSTRUCTOR_APPLICATION_START } from './PlatformInstructorAdmission';

const PlatformDomainActions = dynamic(() => import('./PlatformDomainActions').then(module => module.PlatformDomainActions),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const PlatformDomainContent = dynamic(() => import('./PlatformDomainContent').then(module => module.PlatformDomainContent),
  { ssr: false });
const PlatformOrderPayment = dynamic(() => import('./PlatformOrderPayment').then(module => module.PlatformOrderPayment),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const PlatformPrivacySettings = dynamic(() => import('./PlatformPrivacySettings').then(module => module.PlatformPrivacySettings),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const PlatformQrAdmin = dynamic(() => import('./PlatformQrAdmin').then(module => module.PlatformQrAdmin),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const PlatformHomepageAdmin = dynamic(() => import('./PlatformHomepageAdmin').then(module => module.PlatformHomepageAdmin),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const PlatformLearningWorkspace = dynamic(() => import('./PlatformLearningWorkspace').then(module => module.PlatformLearningWorkspace),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const PlatformInstructorProfile = dynamic(() => import('./PlatformInstructorProfile').then(module => module.PlatformInstructorProfile),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });

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
  const inPlatformShell = useContext(PlatformNavigationContext);
  const refreshInstructorAccess = useContext(PlatformInstructorAccessRefreshContext);
  const instructorCourseList = definition.id === 'instructor-courses';
  const instructorApplication = isPlatformInstructorApplication(definition.id);
  const applicationStart = definition.id === 'teacher-apply-start';
  const pageSizeOptions = definition.area === 'instructor' && definition.id !== 'teacher-apply' ? PLATFORM_INSTRUCTOR_PAGE_SIZES : [20, 50, 100];
  const defaultPageSize = pageSizeOptions[0];
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [rawPage, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const updateQuery = (value: string) => { void setPage(null); void setQuery(value || null); };
  const [rawPageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(defaultPageSize));
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault(definition.id === 'admin-applications' ? 'pending' : ''));
  const [puzzle, setPuzzle] = useQueryState('puzzle', parseAsString.withDefault(''));
  const [trialOnly, setTrialOnly] = useQueryState('trial', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const page = Math.max(1, rawPage);
  const pageSize = pageSizeOptions.includes(rawPageSize) ? rawPageSize : defaultPageSize;
  const [selectedLessonId, setSelectedLessonId] = useQueryState('lesson', parseAsString.withOptions({ history: 'push', scroll: false }));
  const [lessonStartTime, setLessonStartTime] = useQueryState('t', parseAsFloat);
  const [sort, setSort] = useQueryState('sort', parseAsStringEnum(['title', 'updated'] as const).withDefault('updated'));
  const [owned] = useQueryState('owned', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [stay] = useQueryState('stay', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [result, setResult] = useState<PlatformResourceResult | null>(null);
  const [classroomCourseTitle, setClassroomCourseTitle] = useState<string | null>(null);
  useEffect(() => {
    if (definition.id !== 'course-lesson') return;
    const controller = new AbortController();
    setClassroomCourseTitle(null);
    void loadPlatformResource('courses', { params: { id: params.id }, signal: controller.signal }).then(value => {
      const item = value.items[0];
      if (item && !controller.signal.aborted) setClassroomCourseTitle(localizePlatformEntity(item, lang).title);
    }).catch(() => {});
    return () => controller.abort();
  }, [definition.id, params.id, lang]);
  const collectionSearchScope = definition.id === 'paths' || definition.id === 'events' || definition.id === 'news' || definition.id === 'instructor-courses' ? definition.id : null;
  // Collection-only routes have no domain-detail content or embedded creation forms.
  const catalogOnly = Boolean(collectionSearchScope) || definition.id === 'courses';
  const [collectionCategories, setCollectionCategories] = useState<readonly string[]>([]);
  useEffect(() => {
    if (collectionSearchScope && result) setCollectionCategories(result.categories ?? []);
    else if (!collectionSearchScope) setCollectionCategories([]);
  }, [collectionSearchScope, result]);
  const collectionFilterGroups: PlatformFilterGroup[] = [];
  if (collectionCategories.length || category) collectionFilterGroups.push({
    id: 'category', label: t('分类', 'Category'), value: category || '', defaultValue: '',
    presentation: collectionCategories.length > 8 ? 'list' : 'chips',
    searchPlaceholder: collectionCategories.length > 8 ? t('搜索分类', 'Search categories') : undefined,
    options: [{ value: '', label: t('全部', 'All') },
      ...[...new Set([...collectionCategories, ...(category ? [category] : [])])].map(value => ({ value, label: value }))],
  });
  collectionFilterGroups.push({ id: 'sort', label: t('排序', 'Sort'), value: sort, defaultValue: 'updated',
    options: [{ value: 'updated', label: t('最近更新', 'Updated') }, { value: 'title', label: t('标题', 'Title') }] });
  const collectionFilters = {
      title: collectionSearchScope === 'events' ? t('筛选活动', 'Filter events')
        : collectionSearchScope === 'news' ? t('筛选资讯', 'Filter news')
        : collectionSearchScope === 'instructor-courses' ? t('筛选讲师课程', 'Filter instructor courses') : t('筛选学习路径', 'Filter learning paths'),
      groups: collectionFilterGroups,
      apply: (values: Record<string, string>) => { void setPage(null); void setCategory(values.category || null); void setSort(values.sort === 'title' ? 'title' : 'updated'); },
  };
  const collectionSearchInMasthead = usePlatformSearchBinding(collectionSearchScope ?? 'paths', query, updateQuery, Boolean(collectionSearchScope) && !instructorCourseList, {
    routeId: definition.id, filters: collectionFilters,
  });
  const [error, setError] = useState<Error | null>(null);
  const [days, setDays] = useQueryState('days', parseAsInteger.withDefault(30));
  const [retry, setRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const instructorApplicationFlow = instructorApplication || definition.id === 'admin-application';
  const [reviewMessage, setReviewMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const courseOwner = user ? String(user.uid ?? user.wcaId) : '';
  const [ownedCourseResult, setOwnedCourseResult] = useState<{ owner: string; courses: ReadonlyMap<string, PlatformEntity> } | null>(null);
  const ownedCourses = useMemo<ReadonlyMap<string, PlatformEntity>>(() => courseOwner && ownedCourseResult?.owner === courseOwner ? ownedCourseResult.courses : new Map(), [courseOwner, ownedCourseResult]);
  const redeemedCourseIds = useMemo(() => new Set(ownedCourses.keys()), [ownedCourses]);
  const qrAdminMode = ({ 'admin-qr': 'manage', 'admin-qr-stats': 'stats', 'admin-qr-prompts': 'prompts' } as const)[definition.id as 'admin-qr' | 'admin-qr-stats' | 'admin-qr-prompts'];
  const searchable = ['courses', 'paths', 'events', 'news', 'shop', 'search', 'admin-courses', 'admin-paths', 'admin-events', 'admin-news', 'admin-products', 'instructor-courses', 'orders', 'admin-orders', 'admin-coupons', 'admin-payouts', 'admin-reconcile', 'admin-applications'].includes(definition.id);
  const sortable = ['courses', 'paths', 'events', 'news', 'shop', 'admin-courses', 'admin-paths', 'admin-events', 'admin-news', 'admin-products', 'instructor-courses'].includes(definition.id);
  const newRoute = PLATFORM_ROUTES.find(route => route.pattern === `${definition.pattern}/new`);
  const learningWorkspace = isPlatformLearningWorkspace(definition.id);
  const instructorProfile = definition.id === 'instructor-profile';
  const instructorCourseNew = definition.id === 'instructor-course-new';
  const instructorLessonNew = definition.id === 'instructor-lesson-new';
  const instructorCourseEditor = isPlatformInstructorCourseEditor(definition.id);
  const canCreateInstructorCourse = instructorCourseNew && result?.items[0]?.data?.instructorStatus === 'active';
  const isQrCardStudio = definition.id === 'admin-qr-cards';
  const loadsResource = !isQrCardStudio && !learningWorkspace && !qrAdminMode && definition.kind !== 'canonical' && Boolean(definition.resource)
    && definition.id !== 'account-invites'
    && definition.id !== 'account-privacy'
    && (definition.kind !== 'form' || instructorApplication || instructorCourseNew || instructorLessonNew);
  const permissionDenied = error instanceof PlatformPermissionError;
  const courseCatalog = definition.id === 'courses';
  const includeCourseAccess = Boolean(user) && (definition.id === 'course-detail' || definition.id.startsWith('course-section-'));
  const requestQuery = courseCatalog ? '' : query;
  const requestSort = courseCatalog ? undefined : sort;
  const requestCategory = courseCatalog ? '' : category;
  const requestPage = courseCatalog ? 1 : page;
  const requestSize = courseCatalog ? 60 : pageSize;

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
    if (definition.id !== 'course-detail') setResult(null);
    setError(null);
    const resource = definition.resource;
    const load = (withAccess: boolean) => loadPlatformResource(resource, {
      routeId: definition.id,
      params,
      query: requestQuery,
      sort: requestSort,
      owned: owned === '1',
      page: requestPage, pageSize: requestSize, category: requestCategory,
      days: resource === 'admin-analytics' ? days : undefined,
      includeCourseAccess: withAccess,
      signal: controller.signal,
    });
    const request: Promise<PlatformResourceResult> = courseCatalog
      ? loadCourseCatalog(controller.signal).then(items => ({ items }))
      : load(includeCourseAccess).then(value => includeCourseAccess && !controller.signal.aborted
          ? loadLegacyCourseLessonAccess(value, controller.signal)
          : value).catch((reason: unknown) => {
          if (includeCourseAccess && !controller.signal.aborted
            && (reason instanceof PlatformPermissionError || reason instanceof WebSessionRestoreError)) return load(false);
          throw reason;
        });
    void request.then(value => {
      if (controller.signal.aborted) return;
      const maxPage = value.total === undefined ? requestPage : Math.max(1, Math.ceil(value.total / (value.pageSize ?? requestSize)));
      if (requestPage > maxPage) { void setPage(maxPage); return; }
      setResult(value);
      if (courseCatalog) void loadLegacyCatalogPreviews(value.items, controller.signal).then(items => {
        if (!controller.signal.aborted && items !== value.items) setResult(current => current === value ? { ...value, items } : current);
      });
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => controller.abort();
  }, [allowed, definition.resource, loadsResource, mounted, owned, params, retry, courseCatalog, requestQuery, requestSort, requestPage, requestSize, requestCategory, days, includeCourseAccess]);

  useEffect(() => {
    const needsCourseOwnership = definition.id === 'courses';
    if (!mounted || !user || !needsCourseOwnership) {
      setOwnedCourseResult(null);
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
          setOwnedCourseResult({ owner: courseOwner, courses: new Map(items.filter((item) => item.status === 'active').map((item) => [item.id, item])) });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setOwnedCourseResult(null);
      });
    return () => controller.abort();
  }, [definition.id, mounted, user, courseOwner, retry]);

  const sortedItems = useMemo(() => {
    if (!result) return [];
    return result.items.map(item => {
      const localized = localizePlatformEntity(item, lang);
      if (instructorApplication) return { ...localized, title: t('讲师申请', 'Instructor application') };
      if (definition.resource === 'admin-applications') {
        const name = item.data?.applicantDisplayName;
        return { ...localized, title: typeof name === 'string' && name.trim() ? name.trim() : t('未知申请人', 'Unknown applicant') };
      }
      return localized;
    });
  }, [result, lang, definition.id, definition.resource, instructorApplication, t]);

  const courseEntries = useMemo(() => courseCatalog
    ? sortedItems.map(course => ({ course, details: courseCatalogDetails(course) }))
    : [], [courseCatalog, sortedItems]);
  const showCourseFilters = courseEntries.length >= COURSE_FILTER_THRESHOLD;
  const hasCourseFilters = Boolean(query || puzzle || category || trialOnly === '1');
  const coursePuzzles = useMemo(() => new Set(courseEntries.flatMap(entry => entry.details.puzzles)), [courseEntries]);
  const courseTopics = COURSE_TOPIC_IDS.filter(topic => courseEntries.some(entry =>
    (!puzzle || entry.details.puzzles.includes(puzzle)) && entry.details.topics.includes(topic)));
  const courseTopicPuzzles = useMemo(() => new Map(COURSE_TOPIC_IDS.flatMap(topic => {
    const matches = courseEntries.filter(entry => entry.details.topics.includes(topic));
    return matches.length ? [[topic, [...new Set(matches.flatMap(entry => entry.details.puzzles))]] as const] : [];
  })), [courseEntries]);
  const filteredCourses = useMemo(() => {
    const matches = courseEntries.filter(({ course, details }) => matchesCourseCatalog(course, details, { q: query, puzzle, category, trialOnly: trialOnly === '1' }));
    return matches.toSorted((a, b) => Number(ownedCourses.has(b.course.id)) - Number(ownedCourses.has(a.course.id))
      || (sort === 'title' ? a.course.title.localeCompare(b.course.title, lang) : 0));
  }, [courseEntries, query, puzzle, category, trialOnly, sort, lang, ownedCourses]);
  const coursePages = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
  const coursePage = Math.min(page, coursePages);

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
    const profileEntityId = definition.id === 'instructor-profile' ? result?.items[0]?.id : undefined;
    const isCurrent = () => actionScope.current.active && actionScope.current.epoch === epoch;
    if (!isCurrent()) return undefined;
    if(action==='apply-instructor'&&applicationStart&&result?.instructorHomepageDraft===false){
      setActionMessage(t('新版讲师申请需要更新服务后才能提交。已填写资料暂时保留，请联系管理员。','The service must be updated before this application can be submitted. Your entries remain available; contact an administrator.'));
      return undefined;
    }
    const key = id ? `${action}:${id}` : action;
    setActionBusy(key);
    setActionMessage(null);
    if (action === 'submit-review') setReviewMessage(null);
    try {
      const response = await executePlatformAction(definition, { action, resourceId: id, payload });
      if (action === 'archive-instructor') refreshInstructorAccess();
      if (!isCurrent()) return undefined;
      if (definition.id === 'instructor-profile' && (action === 'initialize-instructor-profile' || action === 'link-instructor-profile')) {
        const teacherEntryId = Number(response.teacherEntryId ?? (action === 'link-instructor-profile' ? payload.teacherEntryId : undefined));
        if (!Number.isSafeInteger(teacherEntryId) || teacherEntryId <= 0) throw new Error(t('暂时无法确认个人主页，请重试。', 'Unable to confirm the personal profile. Try again.'));
        // Use the committed association immediately; do not remount and repeat
        // the repair while an older read response may still be in flight.
        setResult(previous => previous ? { ...previous, items: previous.items.map(item => item.id === profileEntityId ? {
          ...item, data: { ...item.data, teacherEntryId },
        } : item) } : previous);
        return response;
      }
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
      if (action === 'submit-review') setReviewMessage({ text: t('评价已保存。', 'Review saved.') });
      else setActionMessage(action === 'start-payment' || instructorApplicationFlow ? null
        : response.course?.reviewStatus === 'pending' || response.lesson?.reviewStatus === 'pending' ? t('已提交发布审核。', 'Submitted for publication review.')
        : response.message ?? t('操作已完成。', 'Action completed.'));
      if (definition.id === 'admin-qr-detail' && action === 'admin-save' && params.code
        && response.code && response.code !== params.code) {
        const url = new URL(window.location.href);
        url.pathname = `${url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)}${encodeURIComponent(response.code)}`;
        url.search = '';
        window.location.replace(url);
        return response;
      }
      if (!(instructorCourseNew && action === 'save-instructor-course') && !(instructorLessonNew && action === 'save-course-lesson')) setRetry((value) => value + 1);
      return response;
    } catch (reason) {
      if (isCurrent()) {
        if (action === 'submit-review') {
          const requiresAccess = reason instanceof Error && reason.message.includes('An active course entitlement is required');
          setReviewMessage({ error: true, text: requiresAccess
            ? t('解锁课程后可评价。', 'Unlock this course to leave a review.')
            : t('评价未保存，请重试。', 'Your review was not saved. Please try again.') });
        } else if (action === 'initialize-instructor-profile' || action === 'link-instructor-profile') {
          const message = reason instanceof Error ? reason.message : '';
          setActionMessage(reason instanceof PlatformPermissionError
            ? t('讲师权限已失效，请重新登录或联系管理员。', 'Instructor access is unavailable. Sign in again or contact an administrator.')
            : /legacy teacher profile|already linked|canonical profile|administrator selection/i.test(message)
              ? t('存在尚未确认的历史资料，请联系管理员核对。', 'Unconfirmed legacy profiles exist. Contact an administrator.')
              : /404|not found/i.test(message)
                ? t('个人主页同步接口尚不可用，请联系管理员更新服务。', 'The profile sync endpoint is unavailable. Contact an administrator to update the service.')
                : t('个人主页同步失败，请重试。', 'Profile synchronization failed. Try again.'));
        } else if (instructorApplicationFlow) {
          const message = reason instanceof Error ? reason.message : '';
          setActionMessage(reason instanceof PlatformPermissionError
            ? t('当前账号无法执行此操作，请重新登录或联系管理员。', 'This account cannot perform the action. Sign in again or contact an administrator.')
            : /pending instructor application|already been decided|Only pending applications|already has an instructor record|Only active instructors/.test(message)
              ? t('申请状态已变化，请刷新页面查看最新结果。', 'The application status changed. Refresh to see the latest result.')
              : t('操作未完成，已保留输入内容，请稍后重试。', 'The action did not complete. Your input is preserved; try again shortly.'));
        } else setActionMessage(reason instanceof Error ? reason.message : t('操作失败。', 'Action failed.'));
      }
    } finally {
      if (isCurrent()) setActionBusy(null);
    }
    return undefined;
  };

  if (definition.id === 'account-invites') {
    return <div className="platform-route platform-redemption">
      {!mounted ? <PlatformState kind="loading" /> : !user ? (
        <AppLink href={`/account${nextQuery(`${lang === 'zh' ? '/zh' : ''}/platform/account/invites`)}`} className="platform-button" prefetch={false}>{t('登录', 'Sign in')}</AppLink>
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
  const courseClassroom = isPlatformCourseClassroom(definition.id);
  const returnPath = `${lang === 'zh' ? '/zh' : ''}/platform/${fillPlatformParams(definition.pattern, params)}`;
  const lessonQuery = new URLSearchParams();
  if (selectedLessonId) lessonQuery.set('lesson', selectedLessonId);
  if (lessonStartTime != null) lessonQuery.set('t', String(lessonStartTime));
  const courseSectionLoginHref = `/account${nextQuery(`${returnPath}${lessonQuery.size ? `?${lessonQuery}` : ''}`)}`;
  const course = courseDetail && !error ? sortedItems[0] : undefined;
  const publicDetail = definition.access === 'public' && definition.kind === 'detail' && !error
    && definition.id !== 'course-section-core' ? sortedItems[0] : undefined;
  const orderPage = ['orders', 'order-detail', 'admin-orders', 'admin-order'].includes(definition.id);
  const pageTotal = result?.total;
  const effectivePageSize = result?.pageSize ?? pageSize;
  const pageTitle = courseCatalog ? t('全部课程', 'All courses') : definition.id === 'teacher-apply' && sortedItems[0]?.data?.instructorStatus === 'active' ? t('讲师身份', 'Instructor status') : publicDetail?.title ?? titleFor(t, definition);
  const areaTitle = courseDetail || courseSection || definition.id === 'course-lesson' || definition.id === 'courses' ? t('CubeRoot 课程', 'CubeRoot Courses') : t(({ discover: '发现', learning: '学习', commerce: '商店与订单', account: '个人空间', instructor: '讲师工作台', admin: '管理', organization: '机构', community: '社区' } as Record<string, string>)[definition.area] ?? '学习空间', ({ discover: 'Discover', learning: 'Learning', commerce: 'Shop and orders', account: 'My workspace', instructor: 'Instructor workspace', admin: 'Administration', organization: 'Organizations', community: 'Community' } as Record<string, string>)[definition.area] ?? 'Learning');
  const pageDescription = publicDetail?.summary ?? (definition.id === 'membership'
    ? t('课程会员用于解锁课程，与网站支持会员分开购买。', 'Course memberships unlock lessons and are purchased separately from site supporter memberships.')
    : '');
  const orderUnavailable = ['order-detail', 'admin-order'].includes(definition.id) && (!!error || !result || !sortedItems[0]);
  const navigation = inPlatformShell && !courseDetail && !courseClassroom
    ? platformNavigationState(`/platform/${fillPlatformParams(definition.pattern, params)}`) : null;
  const workspaceRoutes = navigation ? platformWorkspaceRoutes(definition, Boolean(user), isAdmin) : [];
  const headingInNavigation = definition.id !== 'events' && (navigation?.secondary === definition.id || workspaceRoutes.some(item => item.id === definition.id));
  const showAreaTitle = definition.area !== 'discover' && !inviteManager && !orderPage && !courseCatalog && areaTitle !== pageTitle
    && !(inPlatformShell && definition.area === 'instructor' && definition.id !== 'teacher-apply' && !instructorCourseEditor)
    && !navigation?.primary && workspaceRoutes.length === 0;
  const showDescription = !courseClassroom && !courseDetail && !inviteManager && !orderPage && Boolean(pageDescription);
  const heading = <h1 className={headingInNavigation ? 'sr-only' : undefined}>{pageTitle}</h1>;
  const showHeader = !headingInNavigation || showAreaTitle || showDescription;

  return (
    <div className={`platform-route${courseDetail ? ' platform-course-detail' : ''}${courseClassroom ? ' platform-course-classroom' : ''}${inviteManager ? ' platform-invite-page' : ''}${instructorCourseEditor ? ' platform-instructor-course-editor-page' : ''}${definition.id === 'instructor-courses' ? ' platform-instructor-course-list-page' : ''}${applicationStart ? ' platform-instructor-application-page' : ''}`}>
      {applicationStart ? <header className="platform-route-header platform-wizard-route-header"><PageBackLink fallback="/platform/teachers/apply" label={t('返回讲师入驻','Back to instructor admission')} acceptEntry={href=>platformPathname(href)==='/platform/teachers/apply'} /><h1 className="sr-only">{pageTitle}</h1><LangToggle soft showLabel /></header> : courseClassroom ? <header className="platform-route-header">
        <PageBackLink fallback={`/platform/courses/${encodeURIComponent(params.id)}`} label={t('返回课程详情', 'Back to course details')} acceptEntry={href => platformPathname(href) === `/platform/courses/${encodeURIComponent(params.id)}`} />
        <h1>{courseSection ? sortedItems[0]?.title ?? pageTitle : classroomCourseTitle ?? t('课程学习', 'Course lesson')}</h1>
      </header> : instructorCourseEditor ? <header className={`platform-route-header${instructorCourseNew ? ' platform-wizard-route-header' : instructorLessonNew ? ' platform-lesson-route-header' : ''}`}>
        <PageBackLink fallback={instructorCourseNew ? '/platform/instructor' : '/platform/instructor/courses'} label={instructorCourseNew ? t('返回讲师工作台', 'Back to instructor workspace') : t('返回讲师课程', 'Back to instructor courses')} acceptEntry={instructorCourseNew ? () => false : isInstructorCourseListEntry} />
        {!instructorLessonNew && <h1 className="sr-only">{pageTitle}</h1>}
        {(instructorCourseNew || instructorLessonNew) && <LangToggle soft showLabel />}
      </header> : !course && (showHeader ? <header className="platform-route-header">
        <div className="platform-route-heading">
          {showAreaTitle && <div className="platform-route-labels"><span className="platform-route-area">{areaTitle}</span></div>}
          {heading}
          {showDescription && <p>{pageDescription}</p>}
        </div>
        {instructorCourseList && mounted && allowed && !permissionDenied && <PlatformScopedSearch compact lang={lang} scope="instructor-courses" binding={{ scope:'instructor-courses', routeId:definition.id, query, submit:updateQuery, filters:collectionFilters }} />}
      </header> : heading)}

      {newRoute && (definition.id !== 'instructor-courses' || (result && !error)) ? <div className={`platform-route-actions${definition.id === 'instructor-courses' ? ' platform-instructor-course-create-actions' : ''}`}>
        {definition.id === 'instructor-courses' && <div className="platform-instructor-course-count"><span className="platform-instructor-course-count-icon"><BookOpen aria-hidden /></span><strong>{pageTotal === undefined ? t(`本页 ${sortedItems.length} 门课程`, `${sortedItems.length} courses on this page`) : t(query ? `找到 ${pageTotal} 门课程` : `共 ${pageTotal} 门课程`, query ? `${pageTotal} matching courses` : `${pageTotal} courses`)}</strong></div>}
        <AppLink className="platform-button platform-button-primary" href={`/platform/${newRoute.pattern}`} prefetch={false}>{titleFor(t, newRoute)}{definition.id === 'instructor-courses' && <Plus aria-hidden />}</AppLink>
      </div> : null}
      {['admin', 'admin-event-analytics'].includes(definition.id) && allowed ? <CompactSelect label={t('统计范围', 'Period')} ariaLabel={t('统计范围', 'Period')} value={String(days)} items={[{ value: '7', label: t('最近 7 天', 'Last 7 days') }, { value: '30', label: t('最近 30 天', 'Last 30 days') }, { value: '90', label: t('最近 90 天', 'Last 90 days') }]} onChange={value => { void setDays(Number(value)); }} /> : null}

      {definition.id === 'about' ? (
        <PlatformAboutView />
      ) : definition.id === 'organization-admission' ? (
        <PlatformOrganizationAdmission />
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
      ) : !allowed && definition.id === 'teacher-apply' ? <InstructorAdmissionIntro signedIn={false}/> : !allowed && applicationStart ? (
        <section className="platform-application-flow platform-application-guest">
          <h2>{t('申请成为讲师', 'Apply as an instructor')}</h2><p>{t('分享你的教学经验，审核通过后即可使用讲师工作台。', 'Share your teaching experience and unlock the instructor workspace after approval.')}</p>
          <AppLink className="platform-button platform-button-primary" href={`/account${nextQuery(`${lang === 'zh' ? '/zh' : ''}${INSTRUCTOR_APPLICATION_START}`)}`} prefetch={false}>{t('登录后申请', 'Sign in to apply')}</AppLink>
        </section>
      ) : !allowed ? (
        <PlatformState
          kind="permission"
          permissionHref={courseSection ? courseSectionLoginHref : `/account${nextQuery(returnPath)}`}
        />
      ) : isQrCardStudio ? (
        <PlatformQrCardStudio entities={EMPTY_PLATFORM_ENTITIES} query={query} onQueryChange={value => { void setQuery(value || null); }} />
      ) : definition.id === 'admin-homepage' ? (
        <PlatformHomepageAdmin />
      ) : learningWorkspace ? (
        <PlatformLearningWorkspace definition={definition} params={params} />
      ) : qrAdminMode ? (
        <PlatformQrAdmin mode={qrAdminMode} />
      ) : definition.resource ? (
        <>
          {courseCatalog ? showCourseFilters ? <PlatformCourseToolbar
            query={query} puzzle={puzzle} topic={category} sort={sort} puzzles={coursePuzzles} topics={courseTopics} topicPuzzles={courseTopicPuzzles}
            onQuery={updateQuery}
            onPuzzle={value => { void setPage(null); void setPuzzle(value || null); void setCategory(null); }}
            onTopic={value => { void setPage(null); void setCategory(value || null); }}
            onSort={value => { void setPage(null); void setSort(value); }}
            onApplyFilters={(nextPuzzle, nextTopic, nextSort) => {
              void setPage(null); void setPuzzle(nextPuzzle || null); void setCategory(nextTopic || null); void setSort(nextSort);
            }}
          /> : <>
            <div className="platform-toolbar"><CourseCatalogSearch query={query} onQuery={updateQuery} /></div>
            {result && <div className="platform-catalog-count">
              <span>{hasCourseFilters ? t(`找到 ${filteredCourses.length} 门课程`, `${filteredCourses.length} matching courses`) : t(`共 ${courseEntries.length} 门课程，更多课程陆续上线`, `${courseEntries.length} courses · More courses coming soon`)}</span>
              {hasCourseFilters && <button type="button" className="platform-button" onClick={() => {
                void setPage(null); void setQuery(null); void setPuzzle(null); void setCategory(null); void setTrialOnly(null);
              }}>{t('清除筛选', 'Clear filters')}</button>}
            </div>}
          </> : (definition.kind === 'collection' || definition.kind === 'dashboard')
            && definition.id !== 'membership'
            && definition.id !== 'me-membership'
            && !isQrCardStudio
            && !inviteManager
            && searchable
            && !instructorCourseList
            && !collectionSearchInMasthead
            && !permissionDenied ? (
            <div className="platform-toolbar">
              <SearchInput
                value={query}
                onChange={updateQuery}
                placeholder={definition.id === 'admin-applications' ? t('搜索申请人或 WCA ID', 'Search applicants or WCA ID') : t('搜索当前内容', 'Search this view')}
                ariaLabel={definition.id === 'admin-applications' ? t('搜索申请人或 WCA ID', 'Search applicants or WCA ID') : t('搜索当前内容', 'Search this view')}
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
              {definition.id === 'admin-applications' ? <CompactSelect label={t('审核状态', 'Review status')} ariaLabel={t('审核状态', 'Review status')} value={category}
                items={[{ value: 'all', label: t('全部状态', 'All statuses') }, ...['pending', 'approved', 'rejected', 'withdrawn'].map(value => ({ value, label: instructorApplicationStatus(value, t) }))]}
                onChange={value => { void setPage(null); void setCategory(value); }} /> : result?.categories?.length ? <CompactSelect label={t('分类', 'Category')} ariaLabel={t('分类', 'Category')} value={category}
                items={[{ value: '', label: t('全部', 'All') }, ...result.categories.map(value => ({ value, label: value }))]}
                onChange={value => { void setPage(null); void setCategory(value || null); }} /> : null}
            </div>
          ) : null}

          {courseCatalog && showCourseFilters && trialOnly === '1' && <button type="button" className="platform-button" onClick={() => { void setPage(null); void setTrialOnly(null); }}>{t('仅试听课程 · 清除筛选', 'Trial courses only · Clear filter')}</button>}

          {definition.id === 'order-detail' && !permissionDenied && !orderUnavailable && sortedItems[0] ? <PlatformOrderPayment key={sortedItems[0].id}
            entity={sortedItems[0]} busy={actionBusy} runAction={runAction} message={actionMessage} /> : null}

          {!loadsResource ? null : permissionDenied ? (
            <PlatformState
              kind="permission"
              message={error.status === 403 ? t('当前账号没有访问这个工作区的角色。', 'Your account does not have the role required for this workspace.') : undefined}
              permissionHref={courseClassroom && error.status !== 403 ? courseSectionLoginHref : undefined}
            />
          ) : error ? (
            <PlatformState kind="error" message={error.message} onRetry={() => setRetry((value) => value + 1)} />
          ) : !result ? (
            definition.id === 'instructor-courses' ? <ContentSkeleton variant="cards" rows={3} media label={t('正在加载讲师课程…','Loading instructor courses…')}/> : <PlatformState kind="loading" />
          ) : instructorProfile ? (
            <PlatformInstructorProfile entity={sortedItems[0]} busy={actionBusy} runAction={runAction} />
          ) : instructorCourseNew ? (
            canCreateInstructorCourse ? null : <PlatformState kind="permission" message={t('当前账号没有可用的讲师权限。', 'This account does not have active instructor access.')} />
          ) : isQrCardStudio ? (
            <PlatformQrCardStudio
              entities={sortedItems}
              query={query}
              onQueryChange={(value) => { void setQuery(value || null); }}
            />
          ) : courseCatalog ? (
            filteredCourses.length > 0 ? (
              <PlatformCourseCards definition={definition} ownedCourses={ownedCourses}
                courses={filteredCourses.slice((coursePage - 1) * pageSize, coursePage * pageSize)} />
            ) : hasCourseFilters ? <PlatformState kind="empty" message={t('没有符合条件的课程。试试清除筛选或更换关键词。', 'No courses match. Clear a filter or try another search.')} /> : null
          ) : inviteManager || instructorApplication ? null : sortedItems.length === 0 && definition.id === 'events' ? (
            <div className="platform-teacher-empty" data-site-surface="panel"><h2>{query ? t('没有匹配的活动', 'No matching events') : t('暂无平台活动', 'No upcoming events')}</h2><p>{t('你也可以查看线上比赛。', 'You can also explore online competitions.')}</p><AppLink className="platform-button" href="/platform/events/online" prefetch={false}>{t('查看线上比赛', 'Browse online competitions')}<ArrowRight aria-hidden /></AppLink></div>
          ) : sortedItems.length === 0 && definition.id !== 'membership' && definition.id !== 'me-membership' ? (
            <PlatformState
              kind="empty"
              title={definition.id === 'instructor-courses' ? (query ? t('没有匹配的课程', 'No matching courses') : t('还未创建课程', 'No courses created yet')) : undefined}
              message={definition.id === 'teacher-detail'
                ? t('这个旧讲师标识没有对应的主站讲师资料。旧 Platform 的演示讲师未导入，请返回主站讲师名录查找真实资料。', 'This legacy teacher identifier has no matching main-site profile. Demo teachers from the legacy Platform were not imported; use the main-site directory to find current profiles.')
                : undefined}
            />
          ) : courseDetail || courseSection || instructorCourseEditor || ['path-detail', 'certificate', 'event-detail', 'news-detail', 'product-detail', 'admin', 'admin-event-analytics', 'admin-application'].includes(definition.id) || definition.id === 'membership' || definition.id === 'me-membership' || definition.id === 'qr' ? null : (
            <PlatformEntityList
              definition={definition}
              items={sortedItems}
              redeemedCourseIds={visibleRedeemedCourseIds}
              actionBusy={actionBusy}
              onAction={(action, id, payload) => { void runAction(action, id, payload); }}
            />
          )}

          {definition.canonicalHref ? (
            <AppLink href={fillPlatformParams(definition.canonicalHref, params)} className="platform-canonical-link" prefetch={false}>
              {t(definition.canonicalLabel?.zh ?? '打开完整功能', definition.canonicalLabel?.en ?? 'Open the full feature')}
              <ExternalLink aria-hidden />
            </AppLink>
          ) : null}

          {!instructorProfile && !instructorCourseEditor && !catalogOnly && !permissionDenied && !orderUnavailable ? <PlatformDomainContent definition={definition} params={params} entity={sortedItems[0]} previewRedirect={stay === '1'} selectedLessonId={selectedLessonId} lessonStartTime={lessonStartTime ?? undefined} onSelectLesson={id => { void setLessonStartTime(null); void setSelectedLessonId(id); }} /> : null}

          {instructorProfile || (instructorCourseNew && (!canCreateInstructorCourse || error)) || ((definition.id === 'instructor-course' || instructorLessonNew) && (!sortedItems[0] || error)) || catalogOnly || permissionDenied || orderUnavailable || definition.id === 'qr' || (courseDetail && !course) || (['membership', 'me-membership'].includes(definition.id) && !result) || (instructorApplicationFlow && (!result || error)) ? null : (
            <PlatformDomainActions
              definition={definition}
              params={params}
              entity={sortedItems[0]}
              entities={sortedItems}
              busy={actionBusy}
              runAction={runAction}
              reviewMessage={reviewMessage}
              onSaved={() => { setRetry(value => value + 1); if (instructorApplication) refreshInstructorAccess(); }}
            />
          )}
          {actionMessage && (definition.id !== 'order-detail' || sortedItems[0]?.status !== 'pending_payment') ? <p className={instructorApplicationFlow ? 'platform-action-message platform-form-error' : 'platform-action-message'} role={instructorApplicationFlow ? 'alert' : 'status'}>{actionMessage}</p> : null}
          {courseCatalog && coursePages > 1 && <Paginator page={coursePage} totalPages={coursePages}
            size={pageSize} pageSizeOptions={pageSizeOptions} isZh={lang === 'zh'} className="platform-pagination"
            onPageChange={value => { void setPage(value); }} onSizeChange={value => { void setPage(null); void setPageSize(value); }} />}
          {result?.page && !courseCatalog && definition.kind === 'collection' && !isQrCardStudio && !inviteManager && (definition.id !== 'events' || (sortedItems.length > 0 && (pageTotal === undefined || pageTotal > effectivePageSize))) ? (
            pageTotal !== undefined ? <Paginator page={page} totalPages={Math.max(1, Math.ceil(pageTotal / effectivePageSize))}
              size={effectivePageSize} pageSizeOptions={pageSizeOptions} isZh={lang === 'zh'} className="platform-pagination"
              onPageChange={value => { void setPage(value); }} onSizeChange={value => { void setPage(null); void setPageSize(value); }} />
              : <nav className="platform-pagination" aria-label={t('分页', 'Pagination')}>
                <button type="button" className="wse-page-btn" disabled={page <= 1} onClick={() => { void setPage(page - 1); }}>{t('上一页', 'Previous')}</button>
                <span>{t(`第 ${page} 页`, `Page ${page}`)}</span>
                <button type="button" className="wse-page-btn" disabled={result.items.length < effectivePageSize} onClick={() => { void setPage(page + 1); }}>{t('下一页', 'Next')}</button>
              </nav>
          ) : null}
        </>
      ) : (
        <PlatformCanonicalView definition={definition} params={params} />
      )}
    </div>
  );
}
