/**
 * 站内通知(notifications 表)+ 邮件旁路。
 *
 * 收件人用 ownerKey —— 与 comments.author_id / forum.author_id 同语义:绑了 WCA = 真 wca_id,
 * 没绑 = `u<uid>`(shared/account.ts 的 ownerKey)。
 *
 * 写表是主路径(await);邮件是 best-effort 旁路:未配 RESEND_API_KEY、用户没绑邮箱、
 * Resend 报错,一律只 console.warn,绝不让触发通知的那次评论/另解/发帖写入失败。
 *
 * 邮件按收件人语言发(app_users.lang,0072);语言未知则双语回落 —— 见 rememberLang。
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

export type NotificationKind =
  | 'recon_alt' | 'recon_comment' | 'recon_reply'
  | 'forum_thread' | 'forum_reply' | 'forum_report'
  | 'forum_review' | 'forum_approved' | 'forum_rejected'
  | 'comp_reg';

/** 邮件语言。站点只有 en / zh-Hans 两种。 */
export type MailLang = 'zh' | 'en';

/**
 * 收件人语言未知时的回落:双语。
 * 不猜 —— 猜错的代价(整封信看不懂)远大于多印一行的代价,而中英受众这里五五开。
 */
const BILINGUAL: MailLang[] = ['zh', 'en'];

export interface NotifyInput {
  /** ownerKey 列表;内部会去重并剔除 actor 自己(自己的动作不通知自己)。 */
  recipients: (string | null | undefined)[];
  kind: NotificationKind;
  actorKey: string;
  actorName: string;
  /** 通知标题(recon 的「选手 项目 比赛」/ 论坛的主题标题)。 */
  title: string;
  /** 正文摘要(评论内容 / 另解步骤 / 帖子正文),入库前截断。 */
  excerpt: string;
  /** 站内相对路径,如 `/recon/2489`、`/forum/t/17`。 */
  link: string;
}

const KIND_TEXT: Record<NotificationKind, Record<MailLang, string>> = {
  recon_alt: { zh: '提交了新另解', en: 'submitted an alternative solution' },
  recon_comment: { zh: '发表了新评论', en: 'left a new comment' },
  recon_reply: { zh: '回复了你的评论', en: 'replied to your comment' },
  forum_thread: { zh: '发布了新主题', en: 'started a new thread' },
  forum_reply: { zh: '回复了你的主题', en: 'replied to your thread' },
  forum_report: { zh: '举报了一个帖子', en: 'reported a post' },
  forum_review: { zh: '发布了待审核内容', en: 'posted content awaiting review' },
  forum_approved: { zh: '通过了你的帖子', en: 'approved your post' },
  forum_rejected: { zh: '驳回了你的帖子', en: 'declined your post' },
  comp_reg: { zh: '报名了国外比赛', en: 'registered for an overseas competition' },
};

/** 邮件里的固定文案。 */
const UI: Record<MailLang, { view: string; unsub: string }> = {
  zh: { view: '查看', unsub: '不想再收到这类邮件?点此退订' },
  en: { view: 'View on cuberoot.me', unsub: 'Unsubscribe from these emails' },
};

/** 管理员的 ownerKey(admin 都绑了 WCA,ownerKey 即真 wca_id)。 */
export function adminRecipients(): string[] {
  return [...ADMIN_WCA_IDS];
}

/**
 * 记住某人的站点语言 —— 邮件要按收件人语言发,而收件人的语言只有他自己逛站时才知道
 * (发通知的那一刻在场的是 actor,不是收件人)。未读角标轮询是唯一「每个登录用户都会打」
 * 的已认证请求,故搭它的车上报,不新增请求。
 *
 * 轮询很频繁而语言几乎不变,所以进程内 memo 挡掉重复写:每人每进程最多写一次(改语言再写一次)。
 * 写失败就撤销 memo,让下次轮询重试 —— 否则一次抖动会让这人整个进程周期都存不上语言。
 */
const langMemo = new Map<string, MailLang>();

export function rememberLang(ownerKey: string, raw: string | null | undefined): void {
  const lang: MailLang | null = raw === 'zh' ? 'zh' : raw === 'en' ? 'en' : null;
  if (!ownerKey || !lang || langMemo.get(ownerKey) === lang) return;
  if (langMemo.size > 10_000) langMemo.clear();
  langMemo.set(ownerKey, lang);
  void query(
    `UPDATE app_users SET lang = ?
      WHERE (wca_id = ? OR ('u' || id::text) = ?) AND lang IS DISTINCT FROM ?`,
    [lang, ownerKey, ownerKey, lang],
  ).catch((e) => {
    langMemo.delete(ownerKey);
    console.warn(`[notify] rememberLang(${ownerKey}) failed:`, (e as Error).message);
  });
}

/**
 * ownerKey → 收信邮箱 + 语言。返回 null = 不发信:没绑邮箱、邮箱未验证,或本人已退订
 * (email_notify = false)。identity 两条插入路径都写 verified_at,故不会误漏。
 * lang 为 NULL(还没见过这人)→ 双语回落。
 */
async function mailTargetFor(key: string): Promise<{ to: string; langs: MailLang[] } | null> {
  const rows = await query<{ provider_uid: string; lang: string | null }>(
    `SELECT i.provider_uid, u.lang
       FROM auth_identities i
       JOIN app_users u ON u.id = i.user_id
      WHERE i.provider = 'email'
        AND i.verified_at IS NOT NULL
        AND u.email_notify
        AND (u.wca_id = ? OR ('u' || u.id::text) = ?)
      LIMIT 1`,
    [key, key],
  );
  const row = rows[0];
  if (!row?.provider_uid) return null;
  const langs: MailLang[] = row.lang === 'zh' ? ['zh'] : row.lang === 'en' ? ['en'] : BILINGUAL;
  return { to: row.provider_uid, langs };
}

/**
 * 一封信的内容,按收件人语言渲染。langs[0] 是主语言(定标题和正文);多于一种 = 语言未知的
 * 双语回落,次语言只补一行小字,不整封翻倍。退订链接按收件人签,故必须逐收件人生成。
 */
function mailBody(
  input: NotifyInput,
  kindText: Record<MailLang, string>,
  unsubUrl: string,
  langs: MailLang[],
): { subject: string; html: string; text: string } {
  const url = `${SITE}${input.link}`;
  const [primary, ...rest] = langs;
  const esc = (s: string) => s.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] as string));

  const subject = `${input.actorName} ${kindText[primary]} — ${input.title}`;
  const unsubText = langs.map((l) => UI[l].unsub).join(' / ');

  const secondary = rest
    .map((l) => `<p style="color:#aaa;font-size:12px;margin:0 0 6px">`
      + `${esc(input.actorName)} ${kindText[l]} on cuberoot.me.</p>`)
    .join('');

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">`
    + `<p style="color:#444;font-size:15px;margin:0 0 4px">${esc(input.actorName)} ${kindText[primary]}</p>`
    + `<p style="color:#888;font-size:13px;margin:0 0 16px">${esc(input.title)}</p>`
    + `<blockquote style="margin:0 0 20px;padding:12px 14px;background:#f6f6f7;border-left:3px solid #ddd;`
    + `color:#333;font-size:14px;white-space:pre-wrap;word-break:break-word">${esc(input.excerpt)}</blockquote>`
    + `<p style="margin:0 0 20px"><a href="${url}" style="color:#0b7;font-size:14px">${UI[primary].view}</a></p>`
    + secondary
    + `<p style="color:#aaa;font-size:12px;margin:0">`
    + `<a href="${unsubUrl}" style="color:#aaa">${unsubText}</a>`
    + `</p>`
    + `</div>`;

  const text =
    `${input.actorName} ${kindText[primary]}\n${input.title}\n\n${input.excerpt}\n\n${url}\n\n`
    + `${unsubText}: ${unsubUrl}`;
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
        const target = await mailTargetFor(key);   // 已退订 / 没绑邮箱 → null,不发
        if (!target) continue;
        const { to, langs } = target;
        const unsubUrl = `${API}/v1/notifications/unsubscribe?t=${encodeURIComponent(signUnsubToken(key))}`;
        const { subject, html, text } = mailBody({ ...input, excerpt, title }, kindText, unsubUrl, langs);
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
