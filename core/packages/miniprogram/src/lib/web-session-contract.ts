const WEB_SESSION_TICKET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UNSAFE_INTERNAL_PATH_PATTERN = /[\\\u0000-\u001F\u007F]/;

export function isWebSessionTicket(value: unknown): value is string {
  return typeof value === 'string' && WEB_SESSION_TICKET_PATTERN.test(value);
}

export function isSafeWebSessionDestination(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !UNSAFE_INTERNAL_PATH_PATTERN.test(value);
}
