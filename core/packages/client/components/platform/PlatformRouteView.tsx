'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search, Sparkles } from 'lucide-react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { AccountPanel, LoginForm } from '@/components/AuthPanel';
import BoolToggle from '@/components/BoolToggle';
import SearchInput from '@/components/SearchInput';
import SortArrow from '@/components/SortArrow';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  executePlatformAction,
  loadPlatformResource,
  PLATFORM_ACTION_LABELS,
  PlatformPermissionError,
} from '@/lib/platform-gateway';
import { fillPlatformParams, PLATFORM_NAV, PLATFORM_ROUTES } from '@/lib/platform-routes';
import type {
  PlatformActionId,
  PlatformActionResult,
  PlatformEntity,
  PlatformResourceResult,
  PlatformRouteDefinition,
} from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { PlatformDomainActions } from './PlatformDomainActions';
import { PlatformDomainContent } from './PlatformDomainContent';
import { PlatformPrivacySettings } from './PlatformPrivacySettings';

function titleFor(t: ReturnType<typeof useT>, definition: PlatformRouteDefinition): string {
  return t(definition.title.zh, definition.title.en);
}

function localDetailHref(definition: PlatformRouteDefinition, entity: PlatformEntity): string | null {
  const base = `/platform/${definition.pattern}`.replace(/\/$/, '');
  if (definition.kind !== 'collection') return null;
  if (definition.id === 'teachers') return `/platform/teachers/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'community') return `/platform/community/posts/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'community-circle') return `/platform/community/posts/${encodeURIComponent(entity.id)}`;
  if (['courses', 'paths', 'events', 'news', 'shop', 'orders'].includes(definition.id)) {
    return `${base}/${encodeURIComponent(entity.id)}`;
  }
  const adminCollections: Record<string, string> = {
    'admin-algorithms': 'algorithms',
    'admin-applications': 'teacher-applications',
    'admin-courses': 'courses',
    'admin-events': 'events',
    'admin-teachers': 'teachers',
    'admin-news': 'news',
    'admin-orders': 'orders',
    'admin-products': 'products',
    'admin-qr': 'qr',
  };
  if (adminCollections[definition.id]) return `/platform/admin/${adminCollections[definition.id]}/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'instructor-courses') return `/platform/instructor/courses/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'account-courses') return `/platform/courses/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'account-favorites') {
    const targetType = entity.data?.targetType;
    if (targetType === 'course') return `/platform/courses/${encodeURIComponent(entity.id)}`;
    if (targetType === 'product') return `/platform/shop/${encodeURIComponent(entity.id)}`;
    if (targetType === 'event') return `/platform/events/${encodeURIComponent(entity.id)}`;
  }
  if (definition.id === 'account-wishlist') return `/platform/shop/${encodeURIComponent(entity.id)}`;
  return null;
}

function favoriteType(definition: PlatformRouteDefinition, item: PlatformEntity): 'course' | 'product' | 'event' {
  const explicit = item.data?.targetType;
  if (explicit === 'product' || explicit === 'event') return explicit;
  if (definition.resource === 'products') return 'product';
  if (definition.resource === 'events') return 'event';
  return 'course';
}

function PlatformLanding() {
  const t = useT();
  const areas = PLATFORM_NAV.map((nav) => ({
    ...nav,
    routes: PLATFORM_ROUTES.filter((route) => route.area === nav.area)
      .filter((route) => route.pattern && !route.pattern.includes(':') && !['about', 'offline', 'login', 'account'].includes(route.id))
  }));
  const accessLabel = (access: PlatformRouteDefinition['access']) => access === 'public'
    ? null
    : access === 'account'
      ? t('需登录', 'Sign-in required')
      : access === 'instructor'
        ? t('讲师', 'Instructor')
        : t('管理员', 'Admin');
  return (
    <div className="platform-landing">
      <div className="platform-landing-copy">
        <span className="platform-kicker"><Sparkles aria-hidden />{t('一个账号，一条完整学习路径', 'One account, one continuous learning path')}</span>
        <h1>{t('从发现课程到完成学习，都留在 CubeRoot 主站。', 'From discovery to completion, everything stays on CubeRoot.')}</h1>
        <p>{t('Platform 不再是独立前端。这里汇集课程、讲师、活动、交易、学习记录与机构协作，并复用主站已经成熟的社区和工具。', 'Platform is no longer a separate frontend. Courses, instructors, events, commerce, learning records, and organizations meet here while mature community and tool experiences are reused from the main site.')}</p>
      </div>
      <div className="platform-track" aria-label={t('Platform 功能入口', 'Platform feature entry points')}>
        {PLATFORM_NAV.map((item, index) => (
          <AppLink key={item.area} href={item.href} className="platform-track-stop" prefetch={false}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{t(item.label.zh, item.label.en)}</strong>
          </AppLink>
        ))}
      </div>
      <div className="platform-directory">
        {areas.map((area) => (
          <section key={area.area}>
            <h2>{t(area.label.zh, area.label.en)}</h2>
            <div>
              {area.routes.map((route) => (
                <AppLink key={route.id} href={`/platform/${route.pattern}`} prefetch={false}>
                  <span>{t(route.title.zh, route.title.en)}</span>
                  {accessLabel(route.access) ? <small>{accessLabel(route.access)}</small> : null}
                </AppLink>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlatformAboutView() {
  const t = useT();
  return (
    <div className="platform-static-view">
      <section>
        <h2>{t('现在的 Platform', 'Platform today')}</h2>
        <p>{t('Platform 已迁入 CubeRoot 主站：课程、学习记录、订单、讲师和运营工作区使用同一个账号与数据权限，不再维护第二套独立前端。', 'Platform now lives in the CubeRoot main site. Courses, learning records, orders, instructors, and operations use the same account and authorization model, without a second standalone frontend.')}</p>
      </section>
      <section>
        <h2>{t('复用原则', 'Reuse policy')}</h2>
        <p>{t('论坛、计时器、公式库、讲师名录和教学机构已有成熟主站实现；Platform 页面保留业务上下文，并把最终操作交给这些唯一实现。', 'The forum, timer, algorithm library, teacher directory, and organizations already have canonical main-site implementations. Platform keeps the product context and hands final interaction to those single implementations.')}</p>
      </section>
      <div className="platform-write-actions">
        <AppLink className="platform-button platform-button-primary" href="/platform/courses">{t('浏览课程', 'Browse courses')}</AppLink>
        <AppLink className="platform-button" href="/platform/account/courses">{t('我的学习', 'My learning')}</AppLink>
      </div>
    </div>
  );
}

function PlatformOfflineView() {
  const t = useT();
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return (
    <div className="platform-static-view">
      <section>
        <h2>{online === null ? t('正在检测连接', 'Checking connection') : online ? t('当前已联网', 'You are online') : t('当前处于离线状态', 'You are offline')}</h2>
        <p>{t('课程目录、订单、学习进度和后台操作需要实时连接。已经由浏览器缓存的主站工具可能仍可打开，但离线期间不会伪造同步成功。', 'Course catalogs, orders, progress, and administration require a live connection. Main-site tools already cached by the browser may still open, but no synchronization is presented as successful while offline.')}</p>
      </section>
      <div className="platform-write-actions">
        <button type="button" className="platform-button platform-button-primary" onClick={() => window.location.reload()}>{t('重新连接', 'Reconnect')}</button>
        <AppLink className="platform-button" href="/timer">{t('打开计时器', 'Open timer')}</AppLink>
        <AppLink className="platform-button" href="/alg">{t('打开公式库', 'Open algorithms')}</AppLink>
      </div>
    </div>
  );
}

function PlatformAccountView({ loginOnly }: { loginOnly: boolean }) {
  const user = useAuthUser();
  const t = useT();
  if (!user || loginOnly) {
    return (
      <div className="platform-auth-view">
        <p>{t('Platform 与主站共用同一个账号，不需要再次注册。', 'Platform shares the main-site account; no second registration is needed.')}</p>
        <LoginForm onDone={() => window.location.reload()} />
      </div>
    );
  }
  return <AccountPanel />;
}

function PlatformCanonicalView({
  definition,
  params,
}: {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}) {
  const t = useT();
  const href = fillPlatformParams(definition.canonicalHref ?? '/', params);
  const related = PLATFORM_ROUTES
    .filter((item) => item.area === definition.area && item.id !== definition.id)
    .filter((item) => !item.pattern.includes(':'))
    .slice(0, 4);
  return (
    <div className="platform-canonical">
      <div className="platform-canonical-status">
        <strong>{t('共享主站能力', 'Shared main-site capability')}</strong>
        <p>{t('账号、数据和权限均为同一套；此页提供 Platform 上下文，具体交互使用主站的唯一实现。', 'Account, data, and permissions are shared. This page provides Platform context while the interaction uses the main site’s single implementation.')}</p>
      </div>
      <AppLink href={href} className="platform-button platform-button-primary" prefetch={false}>
        {t(definition.canonicalLabel?.zh ?? '打开功能', definition.canonicalLabel?.en ?? 'Open feature')}
        <ExternalLink aria-hidden />
      </AppLink>
      {related.length ? (
        <section className="platform-related">
          <h2>{t('同一区域', 'In this area')}</h2>
          <div>
            {related.map((item) => (
              <AppLink key={item.id} href={`/platform${item.pattern ? `/${item.pattern}` : ''}`} prefetch={false}>
                {titleFor(t, item)}
              </AppLink>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PlatformEntityList({
  definition,
  items,
  onAction,
  actionBusy,
}: {
  definition: PlatformRouteDefinition;
  items: PlatformEntity[];
  onAction: (action: PlatformActionId, id: string, payload?: Record<string, unknown>) => void;
  actionBusy: string | null;
}) {
  const t = useT();
  const baseActions = definition.kind === 'collection' || definition.kind === 'dashboard'
    ? (definition.actions ?? []).filter((action) => ['favorite', 'wishlist', 'enroll', 'cancel-order', 'delete-course', 'delete-note'].includes(action))
    : [];
  const quickActions: PlatformActionId[] = [
    ...baseActions,
    ...(definition.id === 'admin-qr' ? ['qr-toggle' as const] : []),
    ...(['admin-paths', 'admin-events', 'admin-news', 'admin-products', 'admin-teachers'].includes(definition.id) ? ['admin-delete' as const] : []),
  ];
  return (
    <div className="platform-entity-list">
      {items.map((item) => {
        const href = item.href?.startsWith('/') ? item.href : localDetailHref(definition, item);
        return (
          <article className="platform-entity" key={item.id}>
            <div className="platform-entity-heading">
              <div>
                {item.eyebrow ? <span>{item.eyebrow}</span> : null}
                <h2>{href ? <AppLink href={href} prefetch={false}>{item.title}</AppLink> : item.title}</h2>
              </div>
              {item.status ? <span className="platform-status">{item.status}</span> : null}
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            {item.fields?.length ? (
              <dl>
                {item.fields.map((field) => (
                  <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                ))}
              </dl>
            ) : null}
            {quickActions.length ? (
              <div className="platform-row-actions">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="platform-text-button"
                    disabled={actionBusy === `${action}:${item.id}`}
                    onClick={() => {
                      if (action === 'admin-delete' && !window.confirm(t('确定归档这条记录吗？', 'Archive this record?'))) return;
                      if (action === 'delete-course' && !window.confirm(t('确定归档这门课程吗？', 'Archive this course?'))) return;
                      if (action === 'cancel-order' && !window.confirm(t('确定取消这笔订单吗？', 'Cancel this order?'))) return;
                      if (action === 'delete-note' && !window.confirm(t('确定删除这条笔记吗？', 'Delete this note?'))) return;
                      const payload = action === 'favorite'
                        ? { targetType: favoriteType(definition, item), active: definition.id !== 'account-favorites' }
                        : action === 'wishlist'
                          ? { active: definition.id !== 'account-wishlist' }
                          : action === 'qr-toggle'
                            ? { disabled: item.data?.status !== 'disabled' }
                            : undefined;
                      onAction(action, item.id, payload);
                    }}
                  >
                    {actionBusy === `${action}:${item.id}` ? t('处理中…', 'Working…') : t(PLATFORM_ACTION_LABELS[action].zh, PLATFORM_ACTION_LABELS[action].en)}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function PlatformRouteView({
  definition,
  params,
}: {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}) {
  const t = useT();
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [sort, setSort] = useQueryState('sort', parseAsStringEnum(['title', 'updated'] as const).withDefault('updated'));
  const [owned, setOwned] = useQueryState('owned', parseAsStringEnum(['0', '1'] as const).withDefault('0'));
  const [result, setResult] = useState<PlatformResourceResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const loadsResource = Boolean(definition.resource)
    && definition.id !== 'account-privacy'
    && (definition.kind !== 'form' || definition.id === 'teacher-apply');

  useEffect(() => { setMounted(true); }, []);
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
      signal: controller.signal,
    }).then(setResult).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => controller.abort();
  }, [allowed, definition.resource, loadsResource, mounted, owned, params, query, retry, sort]);

  const sortedItems = useMemo(() => {
    if (!result) return [];
    return [...result.items].sort((a, b) => sort === 'title'
      ? a.title.localeCompare(b.title)
      : (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }, [result, sort]);

  const runAction = async (action: PlatformActionId, id?: string, payload: Record<string, unknown> = {}): Promise<PlatformActionResult | undefined> => {
    const key = id ? `${action}:${id}` : action;
    setActionBusy(key);
    setActionMessage(null);
    try {
      const response = await executePlatformAction(definition, { action, resourceId: id, payload });
      setActionMessage(response.message ?? t('操作已完成。', 'Action completed.'));
      setRetry((value) => value + 1);
      return response;
    } catch (reason) {
      setActionMessage(reason instanceof Error ? reason.message : t('操作失败。', 'Action failed.'));
    } finally {
      setActionBusy(null);
    }
    return undefined;
  };

  if (definition.id === 'home') return <PlatformLanding />;

  return (
    <div className="platform-route">
      <header className="platform-route-header">
        <span className="platform-route-area">{definition.area}</span>
        <h1>{titleFor(t, definition)}</h1>
        <p>{t(definition.description.zh, definition.description.en)}</p>
      </header>

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
        <PlatformState kind="permission" />
      ) : definition.resource ? (
        <>
          {(definition.kind === 'collection' || definition.kind === 'dashboard')
            && definition.id !== 'membership'
            && definition.id !== 'me-membership' ? (
            <div className="platform-toolbar">
              <SearchInput
                value={query}
                onChange={(value) => { void setQuery(value || null); }}
                placeholder={t('搜索当前内容', 'Search this view')}
                ariaLabel={t('搜索当前内容', 'Search this view')}
                className="platform-search"
                inputClassName="platform-search-input"
              />
              <div className="platform-sort" aria-label={t('排序', 'Sort')}>
                <Search aria-hidden />
                <button type="button" className="platform-sort-button" onClick={() => { void setSort('updated'); }}>
                  {t('最近更新', 'Updated')}<SortArrow active={sort === 'updated'} dir="desc" />
                </button>
                <button type="button" className="platform-sort-button" onClick={() => { void setSort('title'); }}>
                  {t('标题', 'Title')}<SortArrow active={sort === 'title'} dir="asc" />
                </button>
              </div>
              {definition.access === 'instructor' || definition.access === 'admin' ? (
                <BoolToggle
                  value={owned === '1'}
                  onChange={(value) => { void setOwned(value ? '1' : '0'); }}
                  label={t('只看我负责的', 'Only my items')}
                />
              ) : null}
            </div>
          ) : null}

          {!loadsResource ? null : error instanceof PlatformPermissionError ? (
            <PlatformState kind="permission" message={error.status === 403 ? t('当前账号没有访问这个工作区的角色。', 'Your account does not have the role required for this workspace.') : undefined} />
          ) : error ? (
            <PlatformState kind="error" message={error.message} onRetry={() => setRetry((value) => value + 1)} />
          ) : !result ? (
            <PlatformState kind="loading" />
          ) : sortedItems.length === 0 && definition.id !== 'membership' && definition.id !== 'me-membership' ? (
            <PlatformState
              kind="empty"
              message={definition.id === 'teacher-detail'
                ? t('这个旧讲师标识没有对应的主站讲师资料。旧 Platform 的演示讲师未导入，请返回主站讲师名录查找真实资料。', 'This legacy teacher identifier has no matching main-site profile. Demo teachers from the legacy Platform were not imported; use the main-site directory to find current profiles.')
                : undefined}
            />
          ) : definition.id === 'membership' || definition.id === 'me-membership' ? null : (
            <PlatformEntityList
              definition={definition}
              items={sortedItems}
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

          <PlatformDomainContent definition={definition} params={params} entity={sortedItems[0]} />

          {(['membership', 'me-membership'].includes(definition.id) && !result) ? null : (
            <PlatformDomainActions
              definition={definition}
              params={params}
              entity={sortedItems[0]}
              entities={sortedItems}
              busy={actionBusy}
              runAction={runAction}
            />
          )}
          {actionMessage ? <p className="platform-action-message" role="status">{actionMessage}</p> : null}
        </>
      ) : (
        <PlatformCanonicalView definition={definition} params={params} />
      )}
    </div>
  );
}
