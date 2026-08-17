import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  monthFolder,
  pickExt,
  type StorageProvider,
  type StoragePutResult,
} from "../types";

// Local provider: writes under public/uploads/<yyyy-mm>/<uuid>.<ext>.
// Next.js serves /public/* at the URL root, so the returned URL is just /uploads/...

const ROOT = path.join(process.cwd(), "public", "uploads");

async function putImpl(
  buf: Buffer,
  filename: string,
  _contentType: string,
): Promise<StoragePutResult> {
  void _contentType;
  const folder = monthFolder();
  const ext = pickExt(filename);
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(ROOT, folder);
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, name);
  await writeFile(abs, buf);
  const key = `${folder}/${name}`;
  return { url: `/uploads/${key}`, key };
}

async function deleteImpl(key: string): Promise<void> {
  // Basic safety: only allow keys matching folder/name.
  if (!/^[\w-]+\/[\w.-]+$/.test(key)) return;
  const abs = path.join(ROOT, key);
  try {
    await unlink(abs);
  } catch {
    // ignore missing file
  }
}

export const localProvider: StorageProvider = {
  id: "local",
  put: putImpl,
  delete: deleteImpl,
};
