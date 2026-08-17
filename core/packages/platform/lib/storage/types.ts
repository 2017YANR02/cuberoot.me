import "server-only";

export interface StoragePutResult {
  url: string;
  key: string;
}

export interface StorageProvider {
  id: string;
  put(buf: Buffer, filename: string, contentType: string): Promise<StoragePutResult>;
  delete?(key: string): Promise<void>;
}

export function pickExt(filename: string, fallback = "bin"): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return fallback;
  const ext = filename.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return fallback;
  return ext;
}

export function monthFolder(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
