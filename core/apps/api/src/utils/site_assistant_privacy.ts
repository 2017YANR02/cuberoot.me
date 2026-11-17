/** Best-effort credential redaction, not a claim that arbitrary prose is anonymous. */
export function redactAssistantText(value: string): string {
  return value.replace(/\u0000/g, '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/((?:password|passwd|api[_-]?key|access[_-]?token|secret|密码)\s*[=:：]\s*)[^\s&,;"']+/gi, '$1[redacted]');
}
