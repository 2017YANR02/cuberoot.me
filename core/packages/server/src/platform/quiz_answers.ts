import { badRequest, PlatformApiError } from './errors.js';

export const PLATFORM_QUIZ_QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'boolean',
  'text',
] as const;

export type PlatformQuizQuestionType = typeof PLATFORM_QUIZ_QUESTION_TYPES[number];
export type PlatformQuizAnswer = number | number[] | boolean | string;

type AnswerSource = 'authoring' | 'submission' | 'stored';

function invalid(source: AnswerSource, message: string): never {
  if (source === 'stored') {
    throw new PlatformApiError('INVALID_STATE', 409, `Published quiz has an invalid answer key: ${message}`);
  }
  badRequest(message);
}

export function normalizePlatformQuizChoices(
  questionType: PlatformQuizQuestionType,
  rawChoices: unknown,
  label = 'choices',
): string[] {
  if (!Array.isArray(rawChoices)) badRequest(`${label} must be an array`);
  if (questionType !== 'single_choice' && questionType !== 'multiple_choice') {
    if (rawChoices.length !== 0) badRequest(`${label} must be empty for ${questionType} questions`);
    return [];
  }
  if (rawChoices.length < 2 || rawChoices.length > 100) {
    badRequest(`${label} must contain 2-100 choices`);
  }
  const choices = rawChoices.map((choice, index) => {
    if (typeof choice !== 'string') badRequest(`${label}[${index}] must be a string`);
    const value = choice.trim();
    if (!value || value.length > 500) badRequest(`${label}[${index}] has an invalid length`);
    return value;
  });
  if (new Set(choices).size !== choices.length) badRequest(`${label} must contain unique choices`);
  return choices;
}

function integerChoice(raw: unknown, source: AnswerSource, label: string, choiceCount: number): number {
  let value = raw;
  if (source === 'submission' && typeof value === 'string' && /^\d+$/.test(value.trim())) {
    value = Number(value.trim());
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    invalid(source, `${label} must be an integer choice index`);
  }
  if (value < 0 || value >= choiceCount) invalid(source, `${label} choice index is out of range`);
  return value;
}

function multipleChoices(raw: unknown, source: AnswerSource, label: string, choiceCount: number): number[] {
  let value = raw;
  if (source === 'submission' && typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        value = JSON.parse(trimmed) as unknown;
      } catch {
        invalid(source, `${label} must be a JSON array or comma-separated choice indexes`);
      }
    } else {
      value = trimmed === '' ? [] : trimmed.split(',').map((part) => part.trim());
    }
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > choiceCount) {
    invalid(source, `${label} must contain 1-${choiceCount} choice indexes`);
  }
  const normalized = value.map((item, index) => integerChoice(item, source, `${label}[${index}]`, choiceCount));
  if (new Set(normalized).size !== normalized.length) invalid(source, `${label} must not contain duplicate choices`);
  return normalized.sort((left, right) => left - right);
}

export function normalizePlatformQuizAnswer(input: {
  questionType: PlatformQuizQuestionType;
  raw: unknown;
  choiceCount: number;
  source: AnswerSource;
  label?: string;
}): PlatformQuizAnswer {
  const label = input.label ?? 'answer';
  switch (input.questionType) {
    case 'single_choice':
      return integerChoice(input.raw, input.source, label, input.choiceCount);
    case 'multiple_choice':
      return multipleChoices(input.raw, input.source, label, input.choiceCount);
    case 'boolean': {
      let value = input.raw;
      if (input.source === 'submission' && typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') value = true;
        else if (normalized === 'false') value = false;
      }
      if (typeof value !== 'boolean') invalid(input.source, `${label} must be a boolean`);
      return value;
    }
    case 'text': {
      if (typeof input.raw !== 'string') invalid(input.source, `${label} must be a string`);
      const value = input.raw.trim();
      if (!value || value.length > 2_000) invalid(input.source, `${label} has an invalid length`);
      return value;
    }
  }
}

export function platformQuizAnswersEqual(left: PlatformQuizAnswer, right: PlatformQuizAnswer): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
