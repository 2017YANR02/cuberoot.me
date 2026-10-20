import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { buildInputFingerprint, outputFingerprint, readBuildState, restoreBuildGraphInputs, walkFiles } from './build-state.mjs';
import { validateNativePages } from './native-page-check.mjs';

// Read-only local artifact checks. Platform configuration and device evidence
// cannot be inferred from these files or replaced with environment booleans.
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'dist-douyin');
const failures = [];
async function check(label, action) {
  try { await action(); console.log(`PASS ${label}`); }
  catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error.message}`); }
}
const json = async path => JSON.parse(await readFile(path, 'utf8'));
await check('正式 AppID 与域名校验', async () => {
  const local = await json(join(root, 'project.douyin.config.json'));
  const built = await json(join(output, 'project.config.json'));
  if (!/^tt[0-9a-f]{16,32}$/i.test(local.appid ?? '') || local.appid !== built.appid) throw new Error('缺少正式 AppID 或产物与本机配置不一致');
  if (built.setting?.urlCheck !== true) throw new Error('产物关闭了域名校验');
  if (built.douyinProjectType !== 'native') throw new Error('项目类型不是 native');
  const privatePath = join(output, 'project.private.config.json');
  try {
    const privateConfig = await json(privatePath);
    if (privateConfig.setting?.urlCheck === false) throw new Error('私有配置关闭了域名校验');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
});
await check('源码与产物指纹', async () => {
  const state = await readBuildState(root, 'douyin');
  if (!state) throw new Error('请先运行 build:douyin');
  const graph = restoreBuildGraphInputs(root, state.buildGraphInputs);
  if (state.sourceFingerprint !== await buildInputFingerprint(root, graph)
    || state.outputFingerprint !== await outputFingerprint(root, output)) throw new Error('源码或产物发生变化，请重新构建');
});
await check('页面完整性与核心原生模板', async () => {
  const app = await json(join(output, 'app.json'));
  if (!Array.isArray(app.pages) || !app.pages.length) throw new Error('缺少页面');
  for (const page of app.pages) {
    if (!/^pages\/[a-z0-9-]+\/index$/.test(page)) throw new Error('无效页面路径');
    for (const extension of ['js', 'json', 'ttml', 'ttss']) await stat(join(output, `${page}.${extension}`));
  }
  const core = [...new Set([app.pages[0], ...(app.tabBar?.list ?? []).map(tab => tab.pagePath),
    'pages/privacy/index', 'pages/contact/index', 'pages/account-link/index', 'pages/account-delete/index', 'pages/account-settings/index'])];
  if (core.some(page => !app.pages.includes(page))) throw new Error('核心页面未登记');
  await validateNativePages(output, core);
});
await check('上传包无源码映射', async () => {
  const files = await walkFiles(output);
  if (files.some(file => file.endsWith('.map'))) throw new Error('包含开发调试 sourcemap');
});
await check('个人主体全部登记页面原生', async () => {
  const app = await json(join(output, 'app.json'));
  await validateNativePages(output, app.pages);
});
console.log('\n仍须人工验收：主体及服务类目、请求/业务域名、隐私声明与授权、内容安全、审核账号、真实设备完整流程、反馈中心接收与回复。');
console.log('本检查不上传、不提审；本地检查通过不代表满足全部审核条件。');
if (failures.length) process.exitCode = 1;
