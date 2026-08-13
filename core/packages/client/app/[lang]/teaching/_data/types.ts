export type LessonKind = 'concept' | 'case' | 'drill' | 'example' | 'resource' | 'milestone';

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  outcome: string;
  shots: string[];
  script: string[];
  formulas?: Array<{
    name: string;
    alg: string;
    note: string;
  }>;
}

export interface MicroLesson extends Lesson {
  kind: LessonKind;
}

export interface Module {
  id: string;
  title: string;
  summary: string;
  lessons: MicroLesson[];
  resource?: {
    label: string;
    href: string;
  };
}

export interface Stage {
  id: string;
  title: string;
  summary: string;
  modules: Module[];
}

export interface Course {
  id: 'trial' | 'beginner' | 'cfop';
  label: string;
  title: string;
  summary: string;
  audience: string;
  lessons: Lesson[];
}

export interface MicroCourse extends Omit<Course, 'lessons'> {
  stages: Stage[];
}
