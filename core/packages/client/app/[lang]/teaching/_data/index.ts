import { BEGINNER_COURSE } from './beginner';
import { CFOP_COURSE } from './cfop';
import { TRIAL_COURSE } from './trial';

export type { Course, Lesson } from './types';

export const TEACHING_COURSES = [TRIAL_COURSE, BEGINNER_COURSE, CFOP_COURSE] as const;

export const TEACHING_LESSON_COUNT = TEACHING_COURSES.reduce(
  (total, course) => total + course.lessons.length,
  0,
);

export const TEACHING_TOTAL_MINUTES = TEACHING_COURSES.reduce(
  (total, course) => total + course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
  0,
);
