/**
 * 站内通知(notifications 表)+ 邮件旁路。
 *
 * 收件人用 ownerKey —— 与 comments.author_id / forum.author_id 同语义:绑了 WCA = 真 wca_id,
 * 没绑 = `u<uid>`(shared/account.ts 的 ownerKey)。
 *
 * 写表是主路径(await);邮件是 best-effort 旁路:未配 RESEND_API_KEY、用户没绑邮箱、
 * Resend 报错,一律只 console.warn,绝不让触发通知的那次评论/另解写入失败。
 */
import { query } from '../db/connection.js';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { emailConfigured, sendEmail } from './email.js';

const SITE = 'https://cuberoot.me';

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

/** ownerKey → 已验证邮箱。没绑邮箱返回 null。identity 两条插入路径都写 verified_at,故不会漏。 */
async function emailForOwnerKey(key: string): Promise<string | null> {
  const rows = await query<{ provider_uid: string }>(
    `SELECT i.provider_uid
       FROM auth_identities i
       JOIN app_users u ON u.id = i.user_id
      WHERE i.provider = 'email'
        AND i.verified_at IS NOT NULL
        AND (u.wca_id = ? OR ('u' || u.id::text) = ?)
      LIMIT 1`,
    [key, key],
  );
  return rows[0]?.provider_uid ?? null;
}

function mailBody(input: NotifyInput, kindText: { zh: string; en: string }): { subject: string; html: string; text: string } {
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
    + `<p style="color:#aaa;font-size:12px;margin:0">${esc(input.actorName)} ${kindText.en} on cuberoot.me.</p>`
    + `</div>`;
  const text = `${input.actorName} ${kindText.zh}\n${input.title}\n\n${excerpt}\n\n${url}`;
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
    const { subject, html, text } = mailBody({ ...input, excerpt, title }, kindText);
    for (const key of targets) {
      try {
        const to = await emailForOwnerKey(key);
        if (!to) continue;
        await sendEmail({ to, subject, html, text });
      } catch (e) {
        console.warn(`[notify] email to ${key} failed:`, (e as Error).message);
      }
    }
  })();
}
