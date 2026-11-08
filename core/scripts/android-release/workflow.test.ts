import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { pushVendors } from '../../apps/mobile/scripts/android-push-config.ts';

const workflow = readFileSync(new URL('../../../.github/workflows/app_release.yml', import.meta.url), 'utf8');
const jobs = Object.fromEntries([...workflow.matchAll(/^  ([a-z][a-z-]*):\n([\s\S]*?)(?=^  [a-z][a-z-]*:\n|$(?![\s\S]))/gm)]
  .filter(([, name]) => ['build', 'sign-android', 'publish', 'publish-play'].includes(name!))
  .map(([, name, body]) => [name!, body!]));

test('dependency builds cannot access signing or publication credentials', () => {
  assert.ok(jobs.build);
  assert.doesNotMatch(jobs.build, /environment:/);
  const buildSecrets = [...jobs.build.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]);
  const allowed = ['GETUI_APP_ID', ...pushVendors.flatMap(vendor => vendor.keys.map(key => `GETUI_${key}`))];
  assert.deepEqual(buildSecrets.sort(), allowed.sort());
  const androidBuild = jobs.build.split('      - name: Build unsigned Android artifacts')[1]!.split('      - uses: actions/upload-artifact')[0]!;
  for (const key of allowed) assert.ok(androidBuild.includes(`secrets.${key}`));
  assert.match(androidBuild, /matrix.platform == 'android' && inputs.platform != 'windows'/);
  assert.match(androidBuild, /vars\.ANDROID_PUSH_REQUIRED/);
  assert.match(androidBuild, /vars\.ANDROID_PUSH_VENDORS/);
  assert.match(jobs.build, /\.github\/workflows/); // Contract tests must exist in the sparse checkout.
  assert.match(jobs.build, /--unsigned-ci/);
  assert.match(jobs['sign-android'], /environment: app-release\n/);
  assert.doesNotMatch(jobs['sign-android'], /pnpm install|gradlew|APP_RELEASE_SSH|PLAY_SERVICE_ACCOUNT/);
  assert.match(jobs['sign-android'], /secrets\.ANDROID_KEYSTORE_BASE64/);
  assert.match(jobs['sign-android'], /umask 077/);
  assert.match(jobs['sign-android'], /trap 'rm -f "\$key"' EXIT/);
  for (const name of ['publish', 'publish-play']) {
    assert.match(jobs[name], /environment: app-release-publish\n/);
    assert.doesNotMatch(jobs[name], /secrets\.ANDROID_|pnpm install/);
  }
});

test('publication is opt-in and failed platform artifacts cannot silently publish', () => {
  assert.match(workflow, /play_track:[\s\S]*?default: none/);
  assert.match(workflow, /only_play:[\s\S]*?default: false/);
  assert.match(workflow, /build_only:[\s\S]*?default: false/);
  for (const name of ['build', 'sign-android', 'publish', 'publish-play']) assert.match(jobs[name], /github\.ref == 'refs\/heads\/main'/);
  for (const name of ['publish', 'publish-play']) assert.match(jobs[name], /inputs\.build_only != true/);
  assert.match(jobs.publish, /inputs\.only_play != true/);
  assert.match(jobs['publish-play'], /inputs\.play_track != '' && inputs\.play_track != 'none'/);
  assert.match(jobs['publish-play'], /needs: sign-android/);
  assert.match(jobs.publish, /needs: \[build, sign-android\]/);
  assert.match(jobs.publish, /actions\/download-artifact/);
  assert.doesNotMatch(jobs.publish, /continue-on-error/);
  assert.match(jobs.publish, /StrictHostKeyChecking=yes/);
  assert.equal(existsSync(new URL('../../../.github/workflows/android_release.yml', import.meta.url)), false);
});
