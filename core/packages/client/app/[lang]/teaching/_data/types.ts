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

export interface Course {
  id: 'trial' | 'beginner' | 'cfop';
  label: string;
  title: string;
  summary: string;
  audience: string;
  lessons: Lesson[];
}
