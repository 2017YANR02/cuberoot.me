#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fromHar, parseLink, saveText } from './transcript.mjs';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      login: { type: 'boolean' },
      har: { type: 'string' },
      output: { type: 'string', short: 'o' },
      timeout: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || (!positionals.length && !values.har)) {
    console.log('抖音直播文字记录导出\n\n' +
      '  node cli.mjs "复盘链接" [--login] [-o "输出.txt"]\n' +
      '  node cli.mjs --har "记录.har" ["复盘链接"] [-o "输出.txt"]\n\n' +
      '--login  打开专用浏览器供首次登录，随后自动导出。以后不加此参数即可后台运行。\n' +
      '--timeout 秒  登录后读取全场的超时，默认 180 秒（范围 10–3600）。\n' +
      '默认保存到桌面；不覆盖同名文件。时间均为北京时间。');
    process.exitCode = values.help ? 0 : 2;
  } else {
    if (positionals.length > 1) throw new Error('每次只接受一个复盘链接。');
    if (values.har && values.login) throw new Error('--har 与 --login 不能同时使用。');
    const link = positionals.length ? parseLink(positionals[0]) : null;
    const timeout = Number(values.timeout ?? 180);
    if (!Number.isInteger(timeout) || timeout < 10 || timeout > 3600) throw new Error('--timeout 必须是 10–3600 的整数秒。');
    let transcript;
    if (values.har) {
      transcript = await fromHar(values.har, link?.roomId);
    } else {
      const { launchBrowser, collect } = await import('./browser.mjs');
      let context;
      try {
        context = await launchBrowser(Boolean(values.login));
        for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
          await context.close().catch(() => {});
          process.exit(130);
        });
        const page = await context.newPage();
        for (const other of context.pages()) if (other !== page) await other.close();
        transcript = await collect(page, link, { login: values.login, timeout: timeout * 1000 });
      } finally { if (context) await context.close(); }
    }
    transcript.assertComplete();
    const name = `抖音直播文字记录_${transcript.meta.start.slice(0, 10)}_${transcript.roomId}_${Date.now()}.txt`;
    const path = await saveText(transcript, values.output || join(homedir(), 'Desktop', name));
    console.log(JSON.stringify({ ok: true, path, roomId: transcript.roomId, count: transcript.rows.length,
      start: transcript.meta.start, end: transcript.meta.end, complete: true }));
  }
} catch (error) {
  const message = error.code === 'EEXIST' ? '输出文件已经存在，请换一个文件名。' : error.message;
  // Do not print browser launch arguments, signed request URLs, cookies or stack traces.
  console.error(JSON.stringify({ ok: false, code: error.code || 'EXPORT_FAILED', error: message.startsWith('browserType.') || message.includes('Call log:')
    ? '浏览器未能启动或页面操作失败。请关闭本工具的其他窗口后重试，并确认已安装 Chromium。' : message }));
  process.exitCode = 1;
}
