import { SITE_ASSISTANT_DAILY_LIMIT, type AssistantErrorCode } from '@cuberoot/shared/site-assistant';

export const ASSISTANT_ERROR_TEXT: Record<AssistantErrorCode, { zh: string; en: string }> = {
  login_required: { zh: '请先登录并绑定 WCA 账号，再使用 AI 问答。普通搜索仍可使用。', en: 'Sign in and link your WCA account to use AI. Regular search is still available.' },
  wca_link_required: { zh: '请在账号页绑定 WCA 账号，再使用 AI 问答。普通搜索仍可使用。', en: 'Link your WCA account on the account page to use AI. Regular search is still available.' },
  account_forbidden: { zh: '当前账号无法使用 AI 问答。', en: 'AI questions are unavailable for this account.' },
  daily_limit: { zh: `全站今日 ${SITE_ASSISTANT_DAILY_LIMIT} 次提问额度已用完，北京时间零点恢复。`, en: `The site’s daily allowance of ${SITE_ASSISTANT_DAILY_LIMIT} questions is used up. It resets at midnight Beijing time (UTC+8).` },
  busy: { zh: '当前提问较多，请稍后重试。', en: 'Too many requests right now. Please try again shortly.' },
  verification_required: { zh: '访问验证已失效，请完成验证后重新提问。', en: 'Access verification is required. Complete verification, then ask again.' },
  source_verification_required: { zh: '资料来源要求验证或拒绝访问，暂时无法读取。请稍后重试。', en: 'A source requires verification or has denied access. Please try again later.' },
  timeout: { zh: '这次查询超时了，请缩小问题范围后重试。', en: 'This query timed out. Try a more specific question.' },
  network: { zh: '连接中断，请检查网络后重试。', en: 'The connection was interrupted. Check your network and retry.' },
  model_unavailable: { zh: '模型服务暂时无法回答，请稍后重试。', en: 'The model service is temporarily unavailable. Please try again later.' },
  source_unavailable: { zh: '查询资料时发生错误，请稍后重试。', en: 'A data source could not be read. Please try again later.' },
  unavailable: { zh: '问答服务暂时不可用，请稍后重试。', en: 'The assistant is temporarily unavailable. Please try again later.' },
};

export function assistantResponseError(response: Pick<Response, 'status' | 'headers'>, body: unknown): AssistantErrorCode {
  const data = body && typeof body === 'object' ? body as { error?: unknown; code?: unknown } : {};
  if (response.headers.get('x-cuberoot-verification-required') === '1' || response.headers.get('x-vercel-mitigated') === 'challenge' || data.code === 'competition_verification_required') return 'verification_required';
  if (typeof data.error === 'string' && Object.hasOwn(ASSISTANT_ERROR_TEXT, data.error)) return data.error as AssistantErrorCode;
  if (response.status === 401) return 'login_required';
  if (response.status === 429) return 'busy';
  if (response.status === 504 || response.status === 408) return 'timeout';
  return 'unavailable';
}
