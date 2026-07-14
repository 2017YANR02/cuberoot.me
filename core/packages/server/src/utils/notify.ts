/**
 * 站内通知(notifications 表)+ 邮件旁路。
 *
 * 收件人用 ownerKey —— 与 comments.author_id / forum.author_id 同语义:绑了 WCA = 真 wca_id,
 * 没绑 = `u<uid>`(shared/account.ts 的 ownerKey)。
 *
 * 写表是主路径(await);邮件是 best-effort 旁路:未配 RESEND_API_KEY、用户没绑邮箱、
 * Resend 报错,一律只 console.warn,绝不让触发通知的那次评论/另解写入失败。
 */
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { emailConfigured, sendEmail } from './email.js';
import { JWT_SECRET } from './session.js';

const SITE = 'https://cuberoot.me';
const API = process.env.PUBLIC_API_ORIGIN || 'https://api.cuberoot.me';

/**
 * 退订令牌:免登录一键退订用(邮件里的人不一定还持有会话)。
 * 不设过期 —— 一封两年前的旧邮件里的退订链接也必须仍然管用。
 * 泄露的最坏后果是「被别人退订」,不涉及读取,故与会话同密钥即可。
 */
export function signUnsubToken(userKey: string): string {
  return jwt.sign({ k: userKey, p: 'unsub' }, JWT_SECRET);
}

/** 校验退订令牌,返回 ownerKey;非法 / 用途不符返回 null。 */
export function verifyUnsubToken(token: string): string | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as { k?: string; p?: string };
    return p.p === 'unsub' && p.k ? p.k : null;
  } catch {
    return null;
  }
}

export type NotificationKind = 'recon_alt' | 'recon_comment' | 'recon_reply';

export interface NotifyInput {
  /** ownerKey 列表;内部会去重并剔除 actor 自己(自己的动作不通知自己)。 */
  recipients: (string | null | undefined)[];
  kind: NotificationKind;
  actorKey: string;
  actorName: string;
  /** 通知标题(如 recon 的「选手 项目 比赛」)。 */
  title: string;
  /** 正文摘要(评论内容 / 另解步骤),入库前截断。 */
  excerpt: string;
  /** 站内相对路径,如 `/recon/2489`。 */
  link: string;
}

const KIND_TEXT: Record<NotificationKind, { zh: string; en: string }> = {
  recon_alt: { zh: '提交了新另解', en: 'submitted an alternative solution' },
  recon_comment: { zh: '发表了新评论', en: 'left a new comment' },
  recon_reply: { zh: '回复了你的评论', en: 'replied to your comment' },
};

/** 管理员的 ownerKey(admin 都绑了 WCA,ownerKey 即真 wca_id)。 */
export function adminRecipients(): string[] {
  return [...ADMIN_WCA_IDS];
}

/**
 * ownerKey → 收信邮箱。返回 null = 不发信:没绑邮箱、邮箱未验证,或本人已退订
 * (email_notify = false)。identity 两条插入路径都写 verified_at,故不会误漏。
 */
async function emailForOwnerKey(key: string): Promise<string | null> {
  const rows = await query<{ provider_uid: string }>(
    `SELECT i.provider_uid
       FROM auth_identities i
       JOIN app_users u ON u.id = i.user_id
      WHERE i.provider = 'email'
        AND i.verified_at IS NOT NULL
        AND u.email_notify
        AND (u.wca_id = ? OR ('u' || u.id::text) = ?)
      LIMIT 1`,
    [key, key],
  );
  return rows[0]?.provider_uid ?? null;
}

/** 一封信的内容。退订链接按收件人签,故必须逐收件人生成。 */
function mailBody(
  input: NotifyInput,
  kindText: { zh: string; en: string },
  unsubUrl: string,
): { subject: string; html: string; text: string } {
  const url = `${SITE}${input.link}`;
  const subject = `${input.actorName} ${kindText.zh} — ${input.title}`;
  const excerpt = input.excerpt.slice(0, 500);
  const esc = (s: string) => s.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] as string));
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">`
    + `<p style="color:#444;font-size:15px;margin:0 0 4px">${esc(input.actorName)} ${kindText.zh}</p>`
    + `<p style="color:#888;font-size:13px;margin:0 0 16px">${esc(input.title)}</p>`
    + `<blockquote style="margin:0 0 20px;padding:12px 14px;background:#f6f6f7;border-left:3px solid #ddd;`
    + `color:#333;font-size:14px;white-space:pre-wrap;word-break:break-word">${esc(excerpt)}</blockquote>`
    + `<p style="margin:0 0 20px"><a href="${url}" style="color:#0b7;font-size:14px">查看 / View on cuberoot.me</a></p>`
    + `<p style="color:#aaa;font-size:12px;margin:0 0 6px">${esc(input.actorName)} ${kindText.en} on cuberoot.me.</p>`
    + `<p style="color:#aaa;font-size:12px;margin:0">`
    + `<a href="${unsubUrl}" style="color:#aaa">不想再收到这类邮件?点此退订 / Unsubscribe</a>`
    + `</p>`
    + `</div>`;
  const text =
    `${input.actorName} ${kindText.zh}\n${input.title}\n\n${excerpt}\n\n${url}\n\n`
    + `退订 / Unsubscribe: ${unsubUrl}`;
  return { subject, html, text };
}

/**
 * 写入通知 + 旁路发邮件。收件人为空时直接返回。
 * 邮件不 await(fire-and-forget):常驻 pm2 进程,不存在 serverless 提前 kill。
 */
export async function notify(input: NotifyInput): Promise<void> {
  const actor = input.actorKey;
  const targets = [...new Set(input.recipients.filter((r): r is string => !!r && r !== actor))];
  if (targets.length === 0) return;

  const kindText = KIND_TEXT[input.kind];
  const excerpt = input.excerpt.slice(0, 500);
  const title = input.title.slice(0, 200);

  for (const key of targets) {
    await query(
      `INSERT INTO notifications (user_key, kind, actor_key, actor_name, title, excerpt, link)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [key, input.kind, actor, input.actorName, title, excerpt, input.link],
    );
  }

  if (!emailConfigured()) return;
  void (async () => {
    for (const key of targets) {
      try {
        const to = await emailForOwnerKey(key);   // 已退订 / 没绑邮箱 → null,不发
        if (!to) continue;
        const unsubUrl = `${API}/v1/notifications/unsubscribe?t=${encodeURIComponent(signUnsubToken(key))}`;
        const { subject, html, text } = mailBody({ ...input, excerpt, title }, kindText, unsubUrl);
        await sendEmail({
          to, subject, html, text,
          // 一键退订:客户端 POST 同一 URL(RFC 8058),不需要用户点进网页。
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
      } catch (e) {
        console.warn(`[notify] email to ${key} failed:`, (e as Error).message);
      }
    }
  })();
}
