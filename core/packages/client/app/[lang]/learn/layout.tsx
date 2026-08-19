import { pageMetadata } from '../../../lib/page-meta';
import '../../../components/teaching/teaching.css';

export const generateMetadata = pageMetadata('learn');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
