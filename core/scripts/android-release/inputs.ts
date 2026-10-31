/** Conservative library coverage; website/API-only changes do not require a new APK. */
export function affectsAndroidBuild(path: string): boolean {
  if (/^core\/packages\/(client|platform)\//.test(path)) return false;
  return /^core\/(apps\/mobile|packages|scripts|patches|assets\/brand)\//.test(path)
    || /^core\/(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json)$/.test(path)
    || path === '.node-version' || path === '.github/workflows/app_release.yml'
    || /^tools\/(cstimer-scramble|solver\/rust-cross)\//.test(path);
}
