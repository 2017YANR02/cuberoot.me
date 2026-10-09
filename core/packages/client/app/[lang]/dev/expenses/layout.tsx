import { pageMetadata } from '../../../../lib/page-meta';

export const generateMetadata = pageMetadata('dev/expenses');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
