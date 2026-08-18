import { pageMetadata } from '../../../lib/page-meta';
import './org.css';

export const generateMetadata = pageMetadata('org');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
