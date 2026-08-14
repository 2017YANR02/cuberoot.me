export type LessonKind = 'concept' | 'case' | 'drill' | 'example' | 'resource' | 'milestone';

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface Lesson {
  id: string;
  title: LocalizedText;
  minutes: number;
  outcome: LocalizedText;
  shots: LocalizedText[];
  script: LocalizedText[];
  formulas?: Array<{
    name: LocalizedText;
    alg: string;
    note: LocalizedText;
  }>;
}

export interface MicroLesson extends Lesson {
  kind: LessonKind;
}

export interface Module {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  lessons: MicroLesson[];
  resource?: {
    label: LocalizedText;
    href: string;
  };
}

export interface Stage {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  modules: Module[];
}

export interface Course {
  id: 'trial' | 'beginner' | 'cfop';
  label: LocalizedText;
  title: LocalizedText;
  summary: LocalizedText;
  audience: LocalizedText;
  lessons: Lesson[];
}

export interface MicroCourse extends Omit<Course, 'lessons'> {
  stages: Stage[];
}
