'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { apiUrl } from '@/lib/api-base';
import { useT } from '@/hooks/useT';

type TeacherCourse = { id: string; slug?: string; titleZh: string; titleEn: string; summaryZh?: string; summaryEn?: string };

/** Uses the public course-owner association; expands on demand to avoid a directory-wide request fanout. */
export function PlatformTeacherCourses({ teacherId }: { teacherId: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [courses, setCourses] = useState<TeacherCourse[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setCourses(null); setFailed(false);
    void fetch(apiUrl(`/v1/platform/teachers/${teacherId}/courses`), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('courses_unavailable');
      const data = await response.json() as { items: TeacherCourse[] };
      if (!controller.signal.aborted) setCourses(data.items);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [open, teacherId, retry]);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="directory-scripts">
    <summary>{t('开设的在线课程', 'Online courses')}</summary>
    {open && <div>
      {failed ? <p role="alert">{t('课程暂时无法加载。', 'Courses could not be loaded.')} <button type="button" onClick={() => setRetry(value => value + 1)}>{t('重试', 'Retry')}</button></p> : courses === null ? <p role="status">{t('正在加载课程…', 'Loading courses…')}</p> : courses.length === 0 ? <p>{t('尚未发布在线课程。', 'No online courses published yet.')}</p> : courses.map(course => <AppLink key={course.id} href={`/platform/courses/${encodeURIComponent(course.slug || course.id)}`} prefetch={false}>{t(course.titleZh || course.titleEn, course.titleEn || course.titleZh)}</AppLink>)}
    </div>}
  </details>;
}
