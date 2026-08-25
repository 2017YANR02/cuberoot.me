export {
  decodeWebSessionError,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
  decodeWebSessionUserEnvelope,
  isWebSessionTicket,
} from '@cuberoot/shared/auth/web-session';

const UNSAFE_INTERNAL_PATH_PATTERN = /[\\\u0000-\u001F\u007F]/;

export function isSafeWebSessionDestination(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !UNSAFE_INTERNAL_PATH_PATTERN.test(value);
}
