import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface InterviewDraft {
  title: string;
  source: string;
  status: string;
  context: string;
  introduction: string;
  schedule: string;
  questions: { id: number; topic: string; question: string; takeaway: string; answer: string; confirm: string; example: string; sourceIds?: string[] }[];
  pending: string[];
  research?: {
    checkedAt: string;
    summary: string;
    sources: { id: string; title: string; url: string; note: string }[];
  };
}

/** Local editorial material stays outside Git, public assets, and client bundles. */
export async function loadInterviewDraft(): Promise<InterviewDraft> {
  return JSON.parse(await readFile(join(process.cwd(), '.private', 'interview.json'), 'utf8')) as InterviewDraft;
}
