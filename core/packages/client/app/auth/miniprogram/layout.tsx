import I18nProvider from '@/i18n/I18nProvider';

export default function MiniProgramAuthLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider initialLang="zh">{children}</I18nProvider>;
}
