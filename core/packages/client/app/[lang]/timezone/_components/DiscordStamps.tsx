'use client';

/**
 * Discord 时间码 —— 把页面上钉住的那一刻编成 `<t:1754236400:F>`。
 *
 * 用处:在群里约时间。发一句「周六 20:00」总有人算错,发这段码则由 Discord 客户端在
 * 每个读者本地渲染 —— 北京看到晚 8 点,洛杉矶看到早 5 点,同一条消息各读各的。
 *
 * 码里只有 Unix 秒 + 一个样式字母,时区信息不进码;渲染成什么样完全由读者的客户端决定,
 * 所以这里的预览用**本机**时区(不传 timeZone),而不是上面选的「我的时区」—— 预览要
 * 回答的是「我自己在 Discord 里会看到什么」。
 *
 * 样式表见 docs.discord.com/developers/reference(9 种,f 是省略样式时的默认)。这里一律
 * 写全 `:样式`,不出裸 `<t:X>` —— 复制走的码不该有隐含默认。
 *
 * 走时性能同 page.tsx:未钉住时刻时整页每秒重渲染,格式化器按 locale+样式缓存在模块级,
 * 每秒只付 9 次 format(),不付 9 次 Intl 构造。
 */

import { useMemo } from 'react';
import { Check, Copy } from 'lucide-react';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';
import { localZone, zoneOffsetMinutes } from '@cuberoot/shared/tz';
import { zoneLabel } from '@/lib/tz-zones';

interface StampStyle {
  /** Discord 样式字母 */
  code: string;
  zh: string;
  en: string;
  /** 相对时间(R)不走 DateTimeFormat,故可空 */
  opts?: Intl.DateTimeFormatOptions;
}

// 说明:dateStyle/timeStyle 与 year/month/day 这类单项不能混用(Intl 直接抛),所以
// 「长日期」一类走 style、「短日期」一类走单项 —— 短日期用 dateStyle:'short' 会得到
// 两位年份(4/20/21),离 Discord 的 20/04/2021 更远。
const STYLES: StampStyle[] = [
  { code: 't', zh: '时间', en: 'Short time', opts: { timeStyle: 'short' } },
  { code: 'T', zh: '时间带秒', en: 'Time with seconds', opts: { timeStyle: 'medium' } },
  { code: 'd', zh: '短日期', en: 'Short date', opts: { year: 'numeric', month: '2-digit', day: '2-digit' } },
  { code: 'D', zh: '长日期', en: 'Long date', opts: { dateStyle: 'long' } },
  { code: 'f', zh: '日期 + 时间', en: 'Date and time', opts: { dateStyle: 'long', timeStyle: 'short' } },
  { code: 'F', zh: '带星期的完整时间', en: 'Full date and time', opts: { dateStyle: 'full', timeStyle: 'short' } },
  { code: 's', zh: '短日期 + 时间', en: 'Short date and time', opts: { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' } },
  { code: 'S', zh: '短日期 + 时间带秒', en: 'Short date, time with seconds', opts: { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', second: '2-digit' } },
  { code: 'R', zh: '相对现在', en: 'Relative to now' },
];

/** Discord 省略样式时按 f 渲染 —— 标出来,免得有人以为 f 是可有可无的。 */
const DEFAULT_STYLE = 'f';

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: string, code: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${code}`;
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    dtfCache.set(key, f);
  }
  return f;
}

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
function rtf(locale: string): Intl.RelativeTimeFormat {
  let f = rtfCache.get(locale);
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    rtfCache.set(locale, f);
  }
  return f;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * R 样式的预览。Discord 自己按「秒 → 分 → 时 → 天 → 月 → 年」逐级进位,这里照抄那套阶梯;
 * 月/年用 30 / 365 天近似 —— 相对时间本来就是模糊读数,差一天不影响判断。
 */
function relativeLabel(at: Date, now: Date, locale: string): string {
  const diff = at.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const f = rtf(locale);
  if (abs < MINUTE) return f.format(Math.round(diff / 1000), 'second');
  if (abs < HOUR) return f.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return f.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return f.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return f.format(Math.round(diff / (30 * DAY)), 'month');
  return f.format(Math.round(diff / (365 * DAY)), 'year');
}

export default function DiscordStamps({ at, now, homeTz }: {
  /** 页面钉住的时刻(未钉住时就是此刻) */
  at: Date;
  /** 真正的此刻 —— 只有 R 用得上,不能拿 at 顶替(钉住时 at 早已不是现在) */
  now: Date;
  /** 页面上选的「我的时区」—— 只用来判断要不要提示预览读数和它对不上 */
  homeTz: string;
}) {
  const { copiedKey, copy } = useCopy();
  const isZh = useLang() === 'zh';
  const locale = tr({ zh: 'zh-CN', en: 'en-US' });
  const unix = Math.floor(at.getTime() / 1000);

  // 「我的时区」被改成了别处(比如替朋友挑时间)时,预览的钟点会和上面的卡片对不上 ——
  // 那不是错,但不说一句必被当成 bug。比的是偏移不是名字:上海 / 澳门同偏移,提示无意义。
  const previewTz = localZone();
  const previewDiffers = zoneOffsetMinutes(previewTz, at) !== zoneOffsetMinutes(homeTz, at);

  const rows = useMemo(() => STYLES.map((s) => ({
    ...s,
    text: `<t:${unix}:${s.code}>`,
    preview: s.opts
      ? dtf(locale, s.code, s.opts).format(at)
      : relativeLabel(at, now, locale),
  })), [unix, at, now, locale]);

  return (
    <section className="tz-discord">
      <h2>{tr({ zh: 'Discord 时间码', en: 'Discord timestamps' })}</h2>
      <p className="tz-note">{tr({
        zh: '把下面任意一行粘进 Discord 消息发出去,每个人看到的都是自己时区的时间 —— 不用替对方换算,也不会有人记错日期。码里存的是上面选定的那一刻;左边是你自己会看到的样子,点一行即复制。',
        en: 'Paste any of these into a Discord message: everyone reads it in their own zone, so nobody has to convert and nobody gets the date wrong. The code carries the moment picked above; the preview is what you would see. Click a row to copy.',
      })}</p>

      {previewDiffers && (
        <p className="tz-note tz-stamp-warn">{tr({
          zh: `预览按这台设备所在的${zoneLabel(previewTz, isZh)}渲染,和上面选的${zoneLabel(homeTz, isZh)}对不上是正常的 —— 码里存的是同一刻,换算由各人的客户端来做。`,
          en: `The preview renders in this device’s zone (${zoneLabel(previewTz, isZh)}), so it reads differently from the ${zoneLabel(homeTz, isZh)} you picked above. Same moment either way — each client does its own conversion.`,
        })}</p>
      )}

      <ul className="tz-stamp-list">
        {rows.map((r) => (
          <li key={r.code}>
            <button
              type="button"
              className="tz-stamp"
              onClick={() => copy(r.text, r.code)}
              aria-label={tr({ zh: `复制 ${r.zh} 时间码`, en: `Copy ${r.en} timestamp` })}
            >
              <span className="tz-stamp-preview">{r.preview}</span>
              <span className="tz-stamp-name">
                {tr({ zh: r.zh, en: r.en })}
                {r.code === DEFAULT_STYLE && (
                  <>{' '}<span className="tz-stamp-tag">{tr({ zh: '默认', en: 'default' })}</span></>
                )}
              </span>
              <code className="tz-stamp-code">{r.text}</code>
              <span className={`tz-stamp-icon${copiedKey === r.code ? ' is-copied' : ''}`} aria-hidden="true">
                {copiedKey === r.code ? <Check size={15} /> : <Copy size={15} />}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="tz-stamp-unix">
        {tr({ zh: '别处要用的话,这一刻的 Unix 秒是', en: 'The raw Unix seconds for this moment:' })}
        <button
          type="button"
          className="tz-stamp-unix-btn"
          onClick={() => copy(String(unix), 'unix')}
        >
          <code>{unix}</code>
          {copiedKey === 'unix' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        </button>
      </p>
    </section>
  );
}
