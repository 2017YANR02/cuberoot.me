import I18nProvider from '@/i18n/I18nProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider initialLang="en">{children}</I18nProvider>;
}
