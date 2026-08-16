export const EXPECTED_APP_PAGES: readonly string[];
export const EXPECTED_TAB_BAR: readonly Readonly<{
  pagePath: string;
  text: string;
}>[];
export const PUBLIC_INDEXED_PAGES: readonly string[];
export const REQUIRED_RELEASE_CONFIRMATIONS: readonly Readonly<{
  key: string;
  env: string;
  failure: string;
}>[];
export function releaseConfirmationsFromEnv(
  environment: Record<string, string | undefined>,
): Record<string, boolean>;
