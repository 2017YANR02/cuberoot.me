import { pageMetadata } from '../../../lib/page-meta';

export const generateMetadata = pageMetadata('wechat-groups');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
