'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { TeachingApiError, type TeachingPage } from '@/lib/teaching-saas-api';

export function useOperationKey() {
  const keyRef = useRef('');
  const get = useCallback(() => {
    keyRef.current ||= crypto.randomUUID();
    return keyRef.current;
  }, []);
  const reset = useCallback(() => { keyRef.current = ''; }, []);
  return { get, reset };
}

export function teachingErrorMessage(error: unknown, t: ReturnType<typeof useT>): string {
  if (error instanceof TeachingApiError) {
    if (error.code === 'UNAUTHENTICATED') return t('请先登录。', 'Please sign in first.');
    if (error.code === 'PERMISSION_DENIED' || error.status === 403) return t('你没有执行此操作的权限。', 'You do not have permission to do that.');
    if (error.code === 'RESOURCE_NOT_FOUND' || error.status === 404) return t('没有找到对应内容，或你无权查看。', 'This item was not found or is not available to you.');
    if (error.code === 'IDEMPOTENCY_CONFLICT' || error.status === 409) return t('数据已经变化，请刷新后重试。', 'The data has changed. Refresh and try again.');
    if (error.code === 'TIMEOUT') return t('请求超时，请重试。', 'The request timed out. Try again.');
  }
  return t('请求失败，请稍后重试。', 'Request failed. Please try again.');
}

export function useTeachingPage<T>(loader: () => Promise<TeachingPage<T>>) {
  const t = useT();
  const [result, setResult] = useState<TeachingPage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void loader().then((value) => {
      if (!cancelled) setResult(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loader, reloadToken, t]);

  const reload = useCallback(() => { setReloadToken((value) => value + 1); }, []);
  return { result, loading, error, reload };
}

export function MutationMessage({ message, error = false }: { message: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? 'org-message org-message-error' : 'org-message org-message-success'} role={error ? 'alert' : 'status'}>{message}</p>;
}

export function TeachingPagination({
  page,
  pageSize,
  total,
  baseHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  baseHref: string;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="org-pagination" aria-label={t('分页', 'Pagination')}>
      {page > 1 && <AppLink href={`${baseHref}?page=${page - 1}`} prefetch={false}>{t('上一页', 'Previous')}</AppLink>}
      <span>{t(`第 ${page} / ${pages} 页`, `Page ${page} of ${pages}`)}</span>
      {page < pages && <AppLink href={`${baseHref}?page=${page + 1}`} prefetch={false}>{t('下一页', 'Next')}</AppLink>}
    </nav>
  );
}

export function entityStatusLabel(status: string, t: ReturnType<typeof useT>): string {
  const labels: Record<string, [string, string]> = {
    active: ['使用中', 'Active'],
    inactive: ['已停用', 'Inactive'],
    archived: ['已归档', 'Archived'],
    suspended: ['已暂停', 'Suspended'],
    scheduled: ['已排课', 'Scheduled'],
    in_progress: ['进行中', 'In progress'],
    completed: ['已完成', 'Completed'],
    cancelled: ['已取消', 'Cancelled'],
    frozen: ['已冻结', 'Frozen'],
    expired: ['已过期', 'Expired'],
    exhausted: ['已用完', 'Exhausted'],
  };
  const label = labels[status];
  return label ? t(label[0], label[1]) : status;
}

export function teachingRoleLabel(role: string, t: ReturnType<typeof useT>): string {
  const labels: Record<string, [string, string]> = {
    owner: ['所有者', 'Owner'],
    admin: ['管理员', 'Admin'],
    teacher: ['老师', 'Teacher'],
    assistant: ['助教', 'Assistant'],
    finance: ['财务', 'Finance'],
    viewer: ['只读成员', 'Viewer'],
  };
  const label = labels[role];
  return label ? t(label[0], label[1]) : role;
}
