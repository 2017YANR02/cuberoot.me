'use client';

import Image, { getImageProps } from 'next/image';
import { BookOpen } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import SearchInput from '@/components/SearchInput';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { COURSE_TOPICS, firstPlatformTrialLessonId, type CourseTopic, type courseCatalogDetails } from '@/lib/platform-course-catalog';
import { commerceMoney } from '@/lib/platform-commerce-format';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { eventDisplayName } from '@/lib/wca-events';
import { usePlatformSearchBinding, type PlatformFilterGroup } from '@/lib/platform-navigation-context';
import { localDetailHref } from './PlatformRouteHelpers';

const mobileCoverSizes = '(max-width: 307px) 80px, (max-width: 430px) 26vw, 112px';
const courseCoverSizes = '(max-width: 307px) 80px, (max-width: 430px) 26vw, (max-width: 600px) 112px, (max-width: 960px) 50vw, 370px';

export function CourseCatalogSearch({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  const t = useT();
  const label = t('搜索课程名称、讲师或关键词', 'Search by course, instructor or keyword');
  return <SearchInput value={query} onChange={onQuery} placeholder={label} ariaLabel={label}
    className="platform-search" inputClassName="platform-search-input" />;
}

export function PlatformCourseToolbar({ query, puzzle, topic, sort, puzzles, topics, topicPuzzles, onQuery, onPuzzle, onTopic, onSort, onApplyFilters }: {
  query: string;
  puzzle: string;
  topic: string;
  sort: 'title' | 'updated';
  puzzles: ReadonlySet<string>;
  topics: readonly CourseTopic[];
  topicPuzzles: ReadonlyMap<CourseTopic, readonly string[]>;
  onQuery: (value: string) => void;
  onPuzzle: (value: string) => void;
  onTopic: (value: string) => void;
  onSort: (value: 'title' | 'updated') => void;
  onApplyFilters: (puzzle: string, topic: string, sort: 'title' | 'updated') => void;
}) {
  const t = useT();
  const isZh = useLang() === 'zh';
  const allTopics = t('全部学习方向', 'All learning topics');
  const topicItems = [{ value: '', label: allTopics }, ...topics.map(id => ({
    value: id, label: t(COURSE_TOPICS[id].zh, COURSE_TOPICS[id].en),
  }))];
  const sortItems = [
    { value: 'updated', label: t('最近更新', 'Recently updated') },
    { value: 'title', label: t('课程名称', 'Course title') },
  ] as const;
  const groups: PlatformFilterGroup[] = [];
  if (puzzles.size || puzzle) groups.push({
    id: 'puzzle', label: t('项目', 'Puzzle'), value: puzzle || '', defaultValue: '',
    searchPlaceholder: t('搜索项目', 'Search puzzles'),
    options: [{ value: '', label: t('全部项目', 'All puzzles') }, ...[...puzzles].map(value => ({
      value, label: eventDisplayName(value, isZh), searchText: `${eventDisplayName(value, true)} ${eventDisplayName(value, false)}`,
    }))],
  });
  if (topicPuzzles.size || topic) groups.push({
    id: 'topic', label: t('学习方向', 'Learning topic'), value: topic || '', defaultValue: '', presentation: 'chips',
    options: [{ value: '', label: allTopics }, ...[...topicPuzzles].map(([value, compatible]) => ({
      value, label: t(COURSE_TOPICS[value].zh, COURSE_TOPICS[value].en), dependsOn: { group: 'puzzle', values: compatible },
    }))],
  });
  groups.push({ id: 'sort', label: t('排序', 'Sort'), value: sort, defaultValue: 'updated', options: sortItems });
  const searchInMasthead = usePlatformSearchBinding('courses', query, onQuery, true, {
    routeId: 'courses', filters: { title: t('筛选课程', 'Filter courses'), groups,
      apply: values => onApplyFilters(values.puzzle ?? '', values.topic ?? '', values.sort === 'title' ? 'title' : 'updated') },
  });
  if (searchInMasthead) return <div className="platform-toolbar"><CourseCatalogSearch query={query} onQuery={onQuery} /></div>;
  return <div className="platform-toolbar platform-course-toolbar">
    <CourseCatalogSearch query={query} onQuery={onQuery} />
    {(puzzles.size > 0 || puzzle) && <PuzzlePicker
      isZh={isZh} selectedEvent={puzzle} wcaEvents={puzzles} availableEvents={puzzles}
      leadingGroups={[{ id: 'all', label: '', items: [{ id: '', label: t('全部项目', 'All puzzles') }] }]}
      discovery={{ searchLabel: t('搜索项目', 'Search puzzles'), clearLabel: t('清除搜索', 'Clear search'),
        emptyLabel: t('没有匹配项目', 'No matching puzzles'), resultsLabel: '' }}
      placeholderLabel={t('全部项目', 'All puzzles')} triggerVariant="pill" showTriggerLabel showArrow onSelect={onPuzzle}
    />}
    {(topics.length > 0 || topic) && <CompactSelect
      label={topicItems.find(item => item.value === topic)?.label ?? allTopics}
      ariaLabel={t('学习方向', 'Learning topic')} value={topic} onChange={onTopic} items={topicItems} showArrow
    />}
    <CompactSelect label={sort === 'title' ? sortItems[1].label : sortItems[0].label} ariaLabel={t('课程排序', 'Sort courses')}
      value={sort} onChange={onSort} items={sortItems} showArrow
    />
  </div>;
}

type CourseDetails = ReturnType<typeof courseCatalogDetails>;

export function PlatformCourseCover({ coverUrl, mobileCoverUrl, eager = false, catalog = false, lessonCountLabel }: Pick<CourseDetails, 'coverUrl' | 'mobileCoverUrl'> & { eager?: boolean; catalog?: boolean; lessonCountLabel?: string }) {
  const mobile = !catalog && mobileCoverUrl
    ? getImageProps({ src: mobileCoverUrl, alt: '', fill: true, sizes: mobileCoverSizes, unoptimized: !mobileCoverUrl.startsWith('/') }).props
    : null;
  return <div className="platform-course-card-cover" aria-hidden={lessonCountLabel ? undefined : true}>
    <BookOpen size={32} aria-hidden="true" />
    {coverUrl && <picture>
      {mobile && <source media="(max-width: 600px)" srcSet={mobile.srcSet ?? mobile.src} sizes={mobile.sizes} />}
      <Image src={coverUrl} alt="" fill sizes={catalog ? '(max-width: 639px) clamp(148px, 42vw, 188px), (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 300px' : courseCoverSizes} loading={eager ? 'eager' : 'lazy'}
        unoptimized={!coverUrl.startsWith('/')} onError={event => { event.currentTarget.hidden = true; }} />
    </picture>}
    {lessonCountLabel && <span className="platform-course-cover-count">{lessonCountLabel}</span>}
  </div>;
}

export function PlatformCourseLabels({ details, limit }: { details: CourseDetails; limit?: number }) {
  const t = useT();
  const isZh = useLang() === 'zh';
  const puzzles = new Set(details.puzzles.map(id => eventDisplayName(id, isZh)));
  const topics = new Set(details.topics.map(topic => t(COURSE_TOPICS[topic].zh, COURSE_TOPICS[topic].en)));
  const audience = t(details.audience.zh, details.audience.en);
  if (audience) topics.add(audience);
  const labels = [...[...puzzles].map(label => ({ label, puzzle: true })), ...[...topics].filter(label => !puzzles.has(label)).map(label => ({ label, puzzle: false }))].slice(0, limit);
  if (!labels.length) return null;
  return <div className="platform-course-card-labels">
    {labels.map(({ label, puzzle }) => <span className={`platform-course-card-label${puzzle ? ' platform-course-card-label-puzzle' : ''}`} key={label}>{label}</span>)}
  </div>;
}

export function PlatformCourseCards({ courses, definition, ownedCourses }: {
  courses: { course: PlatformEntity; details: ReturnType<typeof courseCatalogDetails> }[];
  definition: PlatformRouteDefinition;
  ownedCourses: ReadonlyMap<string, PlatformEntity>;
}) {
  const t = useT();
  return <div className="platform-course-grid platform-course-catalog-grid" aria-label={t('全部课程', 'All courses')}>
    {courses.map(({ course, details }) => {
      const data = course.data ?? {};
      const href = course.href?.startsWith('/') ? course.href : localDetailHref(definition, course);
      if (!href) return null;
      const price = data.baseAmountMinor ?? data.fromAmountMinor ?? data.amountMinor;
      const hasPrice = price != null && Number.isFinite(Number(price)) && Number(price) >= 0;
      const currency = typeof data.currency === 'string' && /^[A-Z]{3}$/.test(data.currency) ? data.currency : 'CNY';
      const instructors = t(details.instructors.join('、'), details.instructorsEn.join(', '));
      const owned = ownedCourses.get(course.id);
      const bps = owned?.data?.progressBps;
      const progress = typeof bps === 'number' && Number.isFinite(bps) ? Math.min(100, Math.max(0, bps / 100)) : null;
      const lessonId = owned?.data?.continueLessonId;
      const continueHref = typeof lessonId === 'string' && lessonId
        ? `/platform/courses/${encodeURIComponent(course.id)}/learn/${encodeURIComponent(lessonId)}` : href;
      const hasProgress = progress !== null && progress > 0;
      const free = data.enrollmentMode === 'free' || (data.enrollmentMode !== 'invite' && data.enrollmentMode !== 'admin_grant' && hasPrice && Number(price) === 0);
      const trialId = !owned && !free ? firstPlatformTrialLessonId(course) : undefined;
      const trial = Boolean(trialId);
      const actionHref = owned ? continueHref : trialId ? `/platform/courses/${encodeURIComponent(course.id)}/sections/core?lesson=${encodeURIComponent(trialId)}` : null;
      const status = owned ? t('已解锁', 'Unlocked')
        : free ? t('免费', 'Free')
          : trial ? t('免费试听', 'Free preview')
            : data.enrollmentMode === 'invite' ? t('兑换课程', 'Redeem course')
              : hasPrice ? commerceMoney(price, currency) : t('查看课程', 'View course');
      const priceStatus = !owned && !free && !trial && data.enrollmentMode !== 'invite' && hasPrice;
      return <article className="platform-course-card" data-site-surface="panel" key={course.id}>
        <AppLink className="platform-course-card-link" href={href} prefetch={false}>
          <PlatformCourseCover {...details} catalog lessonCountLabel={details.lessonCount === undefined ? undefined : t(`${details.lessonCount} 课时`, `${details.lessonCount} lessons`)} />
          <div className="platform-course-card-body">
            <div className="platform-course-card-title"><h3>{course.title}</h3></div>
            <div className="platform-course-card-tag-slot"><PlatformCourseLabels details={details} limit={2} /></div>
            <p className="platform-course-card-byline">{instructors}</p>
            <div className="platform-course-card-meta">
              {hasProgress ? <div className="platform-home-progress platform-catalog-progress">
                <progress max={100} value={progress} aria-label={t('课程进度', 'Course progress')} />
                <span>{t(`已学 ${progress < 1 ? '<1' : Math.round(progress)}%`, `Learned ${progress < 1 ? '<1' : Math.round(progress)}%`)}</span>
              </div> : <span className={`platform-catalog-status${priceStatus ? ' platform-catalog-price' : ''}`}>{status}</span>}
            </div>
          </div>
        </AppLink>
        {actionHref && <div className="platform-catalog-card-actions"><AppLink className="platform-button" href={actionHref} prefetch={false} aria-label={owned ? t(`学习${course.title}`, `Learn ${course.title}`) : t(`试听${course.title}`, `Preview ${course.title}`)}>{owned ? hasProgress ? t('继续学习', 'Continue learning') : t('开始学习', 'Start learning') : t('免费试听', 'Free preview')}</AppLink></div>}
      </article>;
    })}
  </div>;
}
