// Hash cache accelerates local scans; it is never the successful-publish baseline.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = text => createHash('sha256').update(text).digest('hex');
const signature = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs, s.birthtimeNs].join(':');

async function atomicWrite(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, text, 'utf8');
  await rename(temporary, file);
}

export async function buildManifest({ root, cache, output, force = false, concurrency = 8, progress = () => {} }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 14) throw new Error('concurrency must be 1..14');
  root = path.resolve(root);
  for (const file of [cache, output]) {
    const relative = path.relative(root, path.resolve(file));
    if (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
      throw new Error('Cache and output must be outside the scanned directory');
    }
  }
  const started = performance.now();
  let previous = {};
  if (!force) {
    try {
      const saved = JSON.parse(await readFile(cache, 'utf8'));
      if (saved?.version === 1 && saved.root === root && saved.entries && saved.checksum === digest(JSON.stringify(saved.entries))) {
        previous = saved.entries;
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
  }
  const files = [];
  const state = { total: 0, checked: 0, reused: 0, hashed: 0, seconds: 0 };
  const report = phase => {
    state.seconds = (performance.now() - started) / 1000;
    progress({ ...state, phase });
  };
  let phase = 'enumerating';
  const timer = setInterval(() => report(phase), 1000);
  try {
    async function walk(directory, prefix = '') {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const relative = `${prefix}${entry.name}`;
        if (relative === 'steps/wca_scramble_steps.csv') continue;
        // Downstream tar/xargs lists cannot safely represent these names.
        if (/[\r\n\\]/u.test(relative)) throw new Error(`Unsupported filename: ${JSON.stringify(relative)}`);
        if (entry.isSymbolicLink()) throw new Error(`Symbolic link is not publishable: ${relative}`);
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), `${relative}/`);
        else if (entry.isFile()) files.push(relative);
        else throw new Error(`Not a regular file: ${relative}`);
      }
      state.total = files.length;
    }
    await walk(root);
    files.sort();
    phase = 'hashing';
    report(phase);
    const entries = Object.create(null);
    const lines = new Array(files.length);
    let next = 0;
    let failure;
    async function worker() {
      while (!failure && next < files.length) {
        const index = next++;
        const relative = files[index];
        const absolute = path.join(root, relative);
        try {
          const before = await lstat(absolute, { bigint: true });
          if (!before.isFile()) throw new Error(`File replaced during scan: ${relative}`);
          const stamp = signature(before);
          const old = previous[relative];
          let hash;
          if (Array.isArray(old) && old[0] === stamp && /^[a-f0-9]{40}$/u.test(old[1])) {
            hash = old[1];
            state.reused++;
          } else {
            const hasher = createHash('sha1');
            // Most files are tiny JSON/TXT; avoid a stream's per-file event overhead.
            // Keep large files streamed so memory stays bounded with eight workers.
            if (before.size <= 1048576n) hasher.update(await readFile(absolute));
            else for await (const chunk of createReadStream(absolute)) hasher.update(chunk);
            hash = hasher.digest('hex');
            const after = await lstat(absolute, { bigint: true });
            if (!after.isFile() || signature(after) !== stamp) throw new Error(`File changed during hashing: ${relative}; retry after generation finishes`);
            state.hashed++;
          }
          entries[relative] = [stamp, hash];
          lines[index] = `${hash}  ./${relative}\n`;
          state.checked++;
        } catch (error) {
          failure = error;
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (failure) throw failure;
    phase = 'saving';
    report(phase);
    await atomicWrite(output, lines.join(''));
    await atomicWrite(cache, JSON.stringify({ version: 1, root, checksum: digest(JSON.stringify(entries)), entries }));
    report('done');
    return { ...state };
  } finally {
    clearInterval(timer);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = name => args[args.indexOf(name) + 1];
  try {
    for (const name of ['--root', '--cache', '--output']) {
      if (!args.includes(name) || !value(name) || value(name).startsWith('--')) throw new Error(`Missing ${name}`);
    }
    let lastReport = -Infinity;
    await buildManifest({ root: value('--root'), cache: value('--cache'), output: value('--output'), force: args.includes('--force'),
      progress: s => {
        const done = s.phase === 'done';
        if (!done && s.seconds - lastReport < (process.stdout.isTTY ? 1 : 300)) return;
        lastReport = s.seconds;
        const message = done ? `检查完成：${s.total} 个文件，用时 ${s.seconds.toFixed(1)} 秒`
          : s.phase === 'hashing' ? `正在检查文件 ${s.checked}/${s.total}`
          : s.phase === 'saving' ? '正在保存检查结果' : '正在查找文件';
        if (process.stdout.isTTY) {
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(message + (done ? '\n' : ''));
        } else console.log(message);
      } });
  } catch (error) {
    if (process.stdout.isTTY) process.stdout.write('\n');
    console.error(error.message);
    process.exitCode = 1;
  }
}
