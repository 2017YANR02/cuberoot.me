import { pageMetadata } from '../../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('wca/persons/students');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
