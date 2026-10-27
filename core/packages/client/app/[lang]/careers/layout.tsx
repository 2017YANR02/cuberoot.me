import { pageMetadata } from '@/lib/page-meta';
import './careers.css';

export const generateMetadata = pageMetadata('careers');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
