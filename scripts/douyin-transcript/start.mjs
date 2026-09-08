import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { browserExecutable } from './runtime.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const terminal = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

function run(command, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true,
      stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'] });
    let output = '';
    child.stdout?.setEncoding('utf8').on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`操作未完成（退出码 ${code}），请查看上方提示。`)));
  });
}

try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('请先安装 Node.js 22 或更新的 LTS 版本：https://nodejs.org/en/download/');
  const args = process.argv.slice(2);
  const setupOnly = args.length === 1 && args[0] === '--setup';
  if (args.includes('--help') || args.includes('-h')) {
    await run(process.execPath, [join(root, 'cli.mjs'), '--help']);
  } else {
    if (!args.length) {
      if (!terminal) throw new Error('请传入复盘链接，或在终端中运行此启动工具。');
      const link = (await terminal.question('粘贴抖音直播复盘链接：')).trim();
      if (!link) throw new Error('没有输入链接。');
      args.push(link);
    }
    if (!args.includes('--har')) {
      if (!existsSync(join(root, 'node_modules', 'playwright', 'package.json'))) {
        console.log('首次使用，正在安装运行依赖……');
        // Only a fixed npm command enters cmd.exe; user links never enter a shell.
        if (process.platform === 'win32') await run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd ci --ignore-scripts --no-audit --no-fund']);
        else await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
      }
      if (!existsSync(await browserExecutable())) {
        console.log('首次使用，正在下载适合本机的 Chromium 浏览器……');
        await run(process.execPath, [join(root, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium']);
      }
      if (!setupOnly && !args.includes('--login')) args.push('--login');
    }
    if (setupOnly) {
      console.log('安装完成，可以使用启动入口导出文字记录。');
    } else {
      const output = await run(process.execPath, [join(root, 'cli.mjs'), ...args], { capture: true });
      const result = JSON.parse(output.trim());
      if (!result.ok) throw new Error('导出未完成。');
      console.log(`\n已导出 ${result.count} 条文字记录：\n${result.path}`);
      if (interactive && ['darwin', 'win32'].includes(process.platform)) {
        try {
          const command = process.platform === 'darwin' ? '/usr/bin/open' : 'notepad.exe';
          const openArgs = process.platform === 'darwin' ? ['-t', result.path] : [result.path];
          const child = spawn(command, openArgs, { windowsHide: true, detached: true, stdio: 'ignore' });
          await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
          child.unref();
        } catch { console.log('未能自动打开文件，请到桌面查看已保存的 TXT。'); }
      }
    }
  }
} catch (error) {
  console.error(error.code === 'ENOENT' ? '未找到所需程序，请安装 Node.js LTS（包含 npm）后重新打开启动工具。' : error.message);
  process.exitCode = 1;
} finally {
  if (terminal) {
    await terminal.question('\n按回车关闭……').catch(() => {});
    terminal.close();
  }
}
