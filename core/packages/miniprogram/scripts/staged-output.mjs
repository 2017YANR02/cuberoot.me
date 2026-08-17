import { access, rename, rm } from 'node:fs/promises';

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function publishStagedDirectory({ stagedPath, targetPath, backupPath }) {
  let hadTarget = await pathExists(targetPath);
  const hasInterruptedBackup = await pathExists(backupPath);
  if (hasInterruptedBackup && !hadTarget) {
    await rename(backupPath, targetPath);
    hadTarget = true;
  } else if (hasInterruptedBackup) {
    await rm(backupPath, { force: true, recursive: true });
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
