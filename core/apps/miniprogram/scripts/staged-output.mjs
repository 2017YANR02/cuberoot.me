import { access, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Validate the entire candidate before touching the live output. Never follow links
// in a generated tree: cleanup must not escape either output directory.
async function assertRegularTree(directory) {
  if (!(await lstat(directory)).isDirectory()) throw new Error(`不是产物目录：${directory}`);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertRegularTree(path);
    else if (!entry.isFile()) throw new Error(`产物目录不支持链接或特殊文件：${path}`);
  }
}

async function syncDirectory(source, target) {
  await mkdir(target, { recursive: true });
  const previous = new Map((await readdir(target, { withFileTypes: true }))
    .map((entry) => [entry.name, entry]));
  const entries = await readdir(source, { withFileTypes: true });
  // Update the entry manifest last, after its referenced resources exist.
  entries.sort((a, b) => Number(a.name === 'app.json') - Number(b.name === 'app.json'));
  for (const entry of entries) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    const old = previous.get(entry.name);
    if (old && old.isDirectory() !== entry.isDirectory()) {
      await rm(to, { recursive: true, force: true });
    }
    if (entry.isDirectory()) {
      await syncDirectory(from, to);
    } else {
      const contents = await readFile(from);
      const unchanged = old?.isFile() && contents.equals(await readFile(to));
      if (!unchanged) await writeFile(to, contents);
    }
    previous.delete(entry.name);
  }
  for (const entry of previous.values()) {
    await rm(join(target, entry.name), { recursive: true, force: true });
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function publishStagedDirectory({ stagedPath, targetPath, backupPath, preserveRoot = false }) {
  let hadTarget = await pathExists(targetPath);
  const hasInterruptedBackup = await pathExists(backupPath);
  if (hasInterruptedBackup && !hadTarget) {
    await rename(backupPath, targetPath);
    hadTarget = true;
  } else if (hasInterruptedBackup) {
    await rm(backupPath, { force: true, recursive: true });
  }
  if (preserveRoot) {
    await assertRegularTree(stagedPath);
    if (hadTarget) await assertRegularTree(targetPath);
    // Douyin opens dist-douyin itself as the project root. Windows may deny
    // renaming that directory even though its individual files remain writable.
    // This is not a multi-file transaction; retain staging if an I/O error occurs
    // so the next build can reconcile it, and never report a failed sync as success.
    await syncDirectory(stagedPath, targetPath);
    await rm(stagedPath, { force: true, recursive: true });
    return;
  }
  if (hadTarget) await rename(targetPath, backupPath);

  try {
    await rename(stagedPath, targetPath);
  } catch (error) {
    if (hadTarget) {
      try {
        await rename(backupPath, targetPath);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `无法发布新产物，且旧产物恢复失败：${targetPath}`,
        );
      }
    }
    throw error;
  }

  if (hadTarget) await rm(backupPath, { force: true, recursive: true });
}
