'use client';

import Image, { getImageProps } from 'next/image';
import { ArrowRight, BookOpen } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import SearchInput from '@/components/SearchInput';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { COURSE_TOPICS, type CourseTopic, type courseCatalogDetails } from '@/lib/platform-course-catalog';
import { commerceMoney } from '@/lib/platform-commerce-format';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { eventDisplayName } from '@/lib/wca-events';
import { usePlatformSearchBinding, type PlatformFilterGroup } from '@/lib/platform-navigation-context';
import { localDetailHref } from './PlatformRouteHelpers';

const mobileCoverSizes = '(max-width: 307px) 80px, (max-width: 430px) 26vw, 112px';
const courseCoverSizes = '(max-width: 307px) 80px, (max-width: 430px) 26vw, (max-width: 600px) 112px, (max-width: 960px) 50vw, 370px';

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
  const searchLabel = t('搜索课程、讲师或学习内容', 'Search courses, instructors or topics');
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
  if (searchInMasthead) return null;
  return <div className="platform-toolbar platform-course-toolbar">
    <SearchInput value={query} onChange={onQuery} placeholder={searchLabel} ariaLabel={searchLabel}
      className="platform-search" inputClassName="platform-search-input" />
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

export function PlatformCourseCover({ coverUrl, mobileCoverUrl, eager = false }: Pick<CourseDetails, 'coverUrl' | 'mobileCoverUrl'> & { eager?: boolean }) {
  const mobile = mobileCoverUrl
    ? getImageProps({ src: mobileCoverUrl, alt: '', fill: true, sizes: mobileCoverSizes, unoptimized: !mobileCoverUrl.startsWith('/') }).props
    : null;
  return <div className="platform-course-card-cover" aria-hidden="true">
    <BookOpen size={32} />
    {coverUrl && <picture>
      {mobile && <source media="(max-width: 600px)" srcSet={mobile.srcSet ?? mobile.src} sizes={mobile.sizes} />}
      <Image src={coverUrl} alt="" fill sizes={courseCoverSizes} loading={eager ? 'eager' : 'lazy'}
        unoptimized={!coverUrl.startsWith('/')} onError={event => { event.currentTarget.hidden = true; }} />
    </picture>}
  </div>;
}

export function PlatformCourseLabels({ details }: { details: CourseDetails }) {
  const t = useT();
  const isZh = useLang() === 'zh';
  const puzzles = new Set(details.puzzles.map(id => eventDisplayName(id, isZh)));
  const topics = new Set(details.topics.map(topic => t(COURSE_TOPICS[topic].zh, COURSE_TOPICS[topic].en)));
  if (details.level) topics.add(details.level);
  if (!puzzles.size && !topics.size) return null;
  return <div className="platform-course-card-labels">
    {[...puzzles].map(puzzle => <span className="platform-course-card-label platform-course-card-label-puzzle" key={puzzle}>{puzzle}</span>)}
    {[...topics].map(topic => <span className="platform-course-card-label" key={topic}>{topic}</span>)}
  </div>;
}

export function PlatformCourseCards({ courses, definition, redeemedCourseIds }: {
  courses: { course: PlatformEntity; details: ReturnType<typeof courseCatalogDetails> }[];
  definition: PlatformRouteDefinition;
  redeemedCourseIds: ReadonlySet<string>;
}) {
  const t = useT();
  return <div className="platform-course-grid">
    {courses.map(({ course, details }, index) => {
      const data = course.data ?? {};
      const href = course.href?.startsWith('/') ? course.href : localDetailHref(definition, course);
      if (!href) return null;
      const price = data.baseAmountMinor ?? data.fromAmountMinor ?? data.amountMinor;
      const memberPrice = data.memberAmountMinor ?? data.fromMemberAmountMinor;
      const currency = typeof data.currency === 'string' && /^[A-Z]{3}$/.test(data.currency) ? data.currency : 'CNY';
      const instructors = t(details.instructors.join('、'), details.instructorsEn.join(', '));
      return <article className="platform-course-card" data-site-surface="panel" key={course.id}>
        <AppLink className="platform-course-card-link" href={href} prefetch={false}>
          <PlatformCourseCover {...details} eager={index === 0} />
          <div className="platform-course-card-body">
            <div className="platform-course-card-title"><h2>{course.title}</h2><ArrowRight size={16} aria-hidden /></div>
            <p className="platform-course-card-byline"><span>{instructors}</span>{details.lessonCount !== undefined && <span>{t(`${details.lessonCount} 课时`, `${details.lessonCount} lessons`)}</span>}</p>
            <div className="platform-course-card-tag-slot"><PlatformCourseLabels details={details} /></div>
            <p className="platform-course-card-summary">{course.summary}</p>
            <div className="platform-course-card-meta">
              {redeemedCourseIds.has(course.id) && <span className="platform-course-redeemed">{t('已兑换', 'Redeemed')}</span>}
              {price != null && Number.isFinite(Number(price)) && <span>{t('价格', 'Price')} {commerceMoney(price, currency)}</span>}
              {memberPrice != null && Number.isFinite(Number(memberPrice)) && <span>{t('会员价', 'Member price')} {commerceMoney(memberPrice, currency)}</span>}
            </div>
          </div>
        </AppLink>
      </article>;
    })}
  </div>;
}
