import { pageMetadata } from '@/lib/page-meta';
import '@/components/competitions/online-competitions.css';
import './competitions.css';

export const generateMetadata = pageMetadata('competitions');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
