import { getMiniProgramLocale, tr, type MiniProgramLocale } from './i18n';
import { miniProgramApi } from './platform';

type MiniProgramEnvironment = 'develop' | 'trial' | 'release' | 'unknown';

export interface MiniProgramReleaseView {
  channel: string;
  notes: string[];
  notesTitle: string;
  version: string;
  versionLabel: string;
}

const RELEASE_NOTES = [
  {
    en: 'Checks your sign-in before opening any feature page',
    zh: '打开任一功能页前都会先检查登录状态',
  },
  {
    en: 'Adds the running version and changelog',
    zh: '新增运行版本与更新日志',
  },
  {
    en: 'Refines account and contact information',
    zh: '优化账号与联系信息展示',
  },
] as const;

function readRuntimeRelease(): { environment: MiniProgramEnvironment; version: string } {
  try {
    const api = miniProgramApi() as typeof wx & {
      getAccountInfoSync?: () => {
        miniProgram?: {
          envVersion?: unknown;
          version?: unknown;
        };
      };
    };
    if (typeof api.getAccountInfoSync !== 'function') {
      return { environment: 'unknown', version: '' };
    }
    const miniProgram = api.getAccountInfoSync().miniProgram;
    const environment = miniProgram?.envVersion;
    const version = miniProgram?.version;
    return {
      environment: environment === 'develop' || environment === 'trial' || environment === 'release'
        ? environment
        : 'unknown',
      version: typeof version === 'string' ? version.trim() : '',
    };
  } catch {
    return { environment: 'unknown', version: '' };
  }
}

function environmentLabel(environment: MiniProgramEnvironment, locale: MiniProgramLocale): string {
  if (environment === 'release') return tr({ en: 'Release', zh: '正式版' }, locale);
  if (environment === 'trial') return tr({ en: 'Preview', zh: '体验版' }, locale);
  if (environment === 'develop') return tr({ en: 'Development', zh: '开发版' }, locale);
  return '';
}

export function getMiniProgramReleaseView(
  locale: MiniProgramLocale = getMiniProgramLocale(),
): MiniProgramReleaseView {
  const runtime = readRuntimeRelease();
  const channel = environmentLabel(runtime.environment, locale);
  return {
    channel: runtime.version ? channel : '',
    notes: RELEASE_NOTES.map((note) => tr(note, locale)),
    notesTitle: tr({ en: 'Changelog', zh: '更新日志' }, locale),
    version: runtime.version
      || channel
      || tr({ en: 'Version unavailable', zh: '版本号暂不可用' }, locale),
    versionLabel: tr({ en: 'Version', zh: '版本' }, locale),
  };
}
