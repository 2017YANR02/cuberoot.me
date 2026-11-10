'use client';

import { useEffect, useState } from 'react';
import { ErrorNotice, useWorkspace } from '@app-foundation/workspace-ui';
import type { Checklist } from '@cuberoot/shared/workspace-planning';
import { useT } from '@/hooks/useT';
import MoreToggle from '@/components/MoreToggle';
import ChecklistPanel from './ChecklistPanel';

const CHECKLIST_ID = '0764ec50-b12a-46c1-b309-73db5b63b1a8';
// Stable IDs ensure a retried first save addresses the same company checklist.
const SOFTWARE = [
  ['ChatGPT / Codex', 'AI 助手与开发', 'AI assistance and coding'],
  ['Chrome', '浏览与调试，可选（自带 Safari）', 'Browse and debug, optional (Safari included)'],
  ['Office', '文档、表格与演示', 'Documents, spreadsheets and slides'],
  ['微信', '日常沟通', 'Everyday messaging'],
  ['腾讯会议', '按会议平台安装，可选（自带 FaceTime）', 'Install for meeting compatibility, optional (FaceTime included)'],
  ['Shadowrocket', '网络代理，按需', 'Network proxy, optional'],
  ['Homebrew', '安装命令行软件', 'Install command-line software'],
  ['Git', '代码版本管理', 'Track code changes'],
  ['Node.js', '运行 JavaScript', 'Run JavaScript'],
  ['pnpm', '安装项目依赖', 'Install project dependencies'],
  ['Codex CLI', '终端 AI 编程', 'AI coding in the terminal'],
  ['GitHub CLI (gh)', '管理 GitHub 仓库', 'Manage GitHub repositories'],
  ['uv', '管理 Python 环境', 'Manage Python environments'],
  ['zsh-autosuggestions', '终端输入建议', 'Suggest terminal commands'],
  ['Xcode', 'iOS 开发与真机调试', 'Build and debug iOS apps'],
  ['Android Studio', 'Android 开发，按需', 'Android development, optional'],
  ['OpenJDK', 'Java 开发环境，按需', 'Java development, optional'],
  ['微信开发者工具', '微信小程序开发', 'Build WeChat mini programs'],
  ['抖音开发者工具', '抖音小程序开发', 'Build Douyin mini programs'],
  ['DevEco Studio', '鸿蒙开发，按需', 'HarmonyOS development, optional'],
  ['Docker', '运行容器，按需', 'Run containers, optional'],
  ['frpc', '连接开发预览隧道', 'Connect preview tunnels'],
  ['Caddy', '本地反向代理，按需', 'Local reverse proxy, optional'],
  ['PostgreSQL', '关系数据库，按需', 'Relational database, optional'],
  ['MySQL', '关系数据库，按需', 'Relational database, optional'],
  ['jq', '处理 JSON', 'Process JSON'],
  ['FFmpeg', '音视频转换', 'Convert audio and video'],
  ['Poppler', 'PDF 转图与提取', 'Render and extract PDFs'],
  ['LocalSend', '跨平台传文件，可选（苹果间用隔空投送）', 'Cross-platform transfers, optional (AirDrop for Apple devices)'],
  ['The Unarchiver', '解压 RAR、7z，可选', 'Extract RAR and 7z, optional'],
  ['IINA', '多格式播放，可选（自带 QuickTime）', 'Play more formats, optional (QuickTime included)'],
  ['OBS', '直播与进阶录屏，可选（自带基础录屏）', 'Streaming and advanced recording, optional (basic recording included)'],
  ['BetterDisplay', '进阶显示设置，可选（自带显示器设置）', 'Advanced display controls, optional (basic settings included)'],
  ['Stats', '菜单栏监控，可选（自带活动监视器）', 'Menu bar monitoring, optional (Activity Monitor included)'],
  ['OneDrive', '微软云同步，可选（通用同步可用 iCloud）', 'Microsoft cloud sync, optional (iCloud for general sync)'],
  ['百度网盘', '百度网盘文件同步，可选', 'Baidu cloud file sync, optional'],
  ['阿里云盘', '阿里云盘文件同步，可选', 'aDrive cloud file sync, optional'],
  ['VS Code', '手动编辑代码，可选', 'Edit code manually, optional'],
  ['UU远程', '远程协助，Mac / Windows', 'Remote assistance, Mac / Windows'],
  ['微信输入法', '中文输入，Mac / Windows', 'Chinese input, Mac / Windows'],
  ['ShareX', '截图与录屏，仅 Windows', 'Screenshots and recording, Windows only'],
] as const;

export default function MacSetupChecklist() {
  const t = useT();
  const { api } = useWorkspace();
  const [list, setList] = useState<Checklist | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error>();
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(value => value + 1);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(undefined);
    async function load() {
      // Reuse the deployed paginated API, including archived lists. Never recreate
      // defaults just because this checklist is absent from the first page.
      for (let page = 1; page <= 10000; page++) {
        const data = await api<{ checklists: Checklist[]; hasMore: boolean }>(`checklists?archived=true&page=${page}`);
        if (cancelled) return;
        const saved = data.checklists.find(row => row.id === CHECKLIST_ID);
        if (saved || !data.hasMore) {
          setList(saved ?? null);
          setReady(true);
          return;
        }
      }
      throw new Error('Checklist pagination limit reached');
    }
    void load().catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause : new Error(String(cause))); });
    return () => { cancelled = true; };
  }, [api, revision]);

  const initial: Checklist = {
    id: CHECKLIST_ID, name: t('软件清单', 'Software checklist'),
    projectId: null, projectName: null, projectActive: null,
    active: true, canEdit: true, version: 0,
    items: SOFTWARE.map(([name, zh, en], index) => ({
      id: `0764ec50-b12a-46c1-b309-${String(index + 1).padStart(12, '0')}`,
      text: `${name}：${t(zh, en)}`, done: false,
    })),
  };
  return <section id="mac-setup">
    <p className="staff-muted">{t('公司共享清单，修改自动保存。开发工具按任务安装，版本以项目配置为准。', 'Company checklist; edits save automatically. Install development tools as needed, using project versions.')}</p>
    <ErrorNotice error={error} retry={reload} />
    {!ready && !error && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {ready && <ChecklistPanel key={`${revision}:${list?.id ?? 'new'}`} list={list ?? initial} presentation="software" defaultExpanded allowItemDelete itemStatus="all" archiveSupported={false} reload={reload} onSaved={setList} />}
    <details className="staff-start-disclosure">
      <MoreToggle as="summary">{t('安装与迁移备注', 'Installation and migration notes')}</MoreToggle>
      <p>{t('Office：在 Microsoft「服务和订阅」下载，安装后用同一授权账号登录 Word。', 'Office: download from Microsoft Services & subscriptions, then sign in to Word with the licensed account.')}</p>
      <a href="https://account.microsoft.com/services" target="_blank" rel="noopener noreferrer">{t('Microsoft 服务和订阅', 'Microsoft Services & subscriptions')}</a>
      <p>{t('zsh-autosuggestions：安装后在 ~/.zshrc 加载插件，新开终端验证灰色建议，按右方向键接受。', 'zsh-autosuggestions: load the plugin in ~/.zshrc, open a new terminal and accept a gray suggestion with the right arrow.')}</p>
      <p>{t('项目目录：创建 ~/Developer，并加入 Finder 侧边栏「个人收藏」，名称为 Developer。CubeRoot 放在 ~/Developer/cuberoot.me；~ 使用新 Mac 当前用户的个人目录。已有仓库先复用，不自动搬动。', 'Project folder: create ~/Developer and add it to Finder sidebar Favorites as Developer. Keep CubeRoot in ~/Developer/cuberoot.me; ~ means the current user’s home on the new Mac. Reuse existing checkouts without moving them automatically.')}</p>
      <p>{t('迁移前核对未提交、未推送代码。项目放在 ~/Developer/，恢复终端配置、devsite 和项目启动命令；SSH、签名证书与预览接入按本人权限配置。', 'Check uncommitted and unpushed code before migrating. Keep projects in ~/Developer/ and restore shell settings, devsite and project launch commands. Configure SSH, signing and preview access for your own permissions.')}</p>
    </details>
  </section>;
}
