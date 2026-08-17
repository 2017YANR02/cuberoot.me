import "server-only";
import type { StorageProvider } from "./types";
import { localProvider } from "./providers/local";
import { r2Provider } from "./providers/r2";
import { s3Provider } from "./providers/s3";
import { ossProvider } from "./providers/oss";
import { cosProvider } from "./providers/cos";

const PROVIDERS: Record<string, StorageProvider> = {
  local: localProvider,
  r2: r2Provider,
  s3: s3Provider,
  oss: ossProvider,
  cos: cosProvider,
};

export function getActive(): StorageProvider {
  const id = (process.env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (!id) return localProvider;
  return PROVIDERS[id] ?? localProvider;
}
