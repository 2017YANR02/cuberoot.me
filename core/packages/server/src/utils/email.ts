/**
 * 邮件发送 —— Resend REST API(无 SDK,直接 fetch)。
 *
 * 方案 A:邮箱只管国际方向(国内用户走手机验证码/微信),Resend 国际送达最佳、免费额度足。
 * env 未配 RESEND_API_KEY 时 emailConfigured() 返 false,路由据此返回 503,不尝试发送、不崩溃
 * (与 membership 的 xunhupayConfigured() 同款可选服务模式)。
 *
 * 需在 DNS 配好发信域名的 SPF/DKIM/DMARC(Gmail 2024 起强制,也是过 QQ/163 的前提),
 * 否则任何服务商都进垃圾箱。
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'cuberoot.me <noreply@cuberoot.me>';

export function emailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

/** 发送一封邮件。失败抛异常,由调用方决定给用户的响应。 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`email send failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** 发送验证码邮件(双语)。 */
export async function sendEmailCode(to: string, code: string, lang: 'zh' | 'en' = 'zh'): Promise<void> {
  const zh = lang === 'zh';
  const subject = zh ? `cuberoot.me 验证码 ${code}` : `Your cuberoot.me code ${code}`;
  const line1 = zh ? '你的登录验证码是:' : 'Your login verification code is:';
  const line2 = zh
    ? '10 分钟内有效。如果不是你本人操作,请忽略本邮件。'
    : 'Valid for 10 minutes. If this wasn’t you, please ignore this email.';
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:24px">`
    + `<p style="color:#444;font-size:15px">${line1}</p>`
    + `<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111;margin:12px 0">${code}</p>`
    + `<p style="color:#888;font-size:13px">${line2}</p>`
    + `</div>`;
  const text = `${line1} ${code}\n${line2}`;
  await sendEmail({ to, subject, html, text });
}
