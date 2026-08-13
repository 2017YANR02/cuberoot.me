import { BEGINNER_MICRO_COURSE } from './beginner-micro';
import { CFOP_MICRO_COURSE } from './cfop-micro';
import { TRIAL_MICRO_COURSE } from './trial-micro';
import type { MicroCourse, MicroLesson, Module, Stage } from './types';

export type { MicroCourse, MicroLesson, Module, Stage } from './types';

export const TEACHING_COURSES = [TRIAL_MICRO_COURSE, BEGINNER_MICRO_COURSE, CFOP_MICRO_COURSE] as const;

export function moduleLessons(module: Module): MicroLesson[] {
  return module.lessons;
}

export function stageLessons(stage: Stage): MicroLesson[] {
  return stage.modules.flatMap(moduleLessons);
}

export function courseLessons(course: MicroCourse): MicroLesson[] {
  return course.stages.flatMap(stageLessons);
}

export function lessonMinutes(lessons: MicroLesson[]): number {
  return lessons.reduce((total, lesson) => total + lesson.minutes, 0);
}

export const TEACHING_LESSON_COUNT = TEACHING_COURSES.reduce(
  (total, course) => total + courseLessons(course).length,
  0,
);

export const TEACHING_TOTAL_MINUTES = TEACHING_COURSES.reduce(
  (total, course) => total + lessonMinutes(courseLessons(course)),
  0,
);
