import { pageMetadata } from '../../../lib/page-meta';
import '@/components/teacher-directory/teacher-directory.css';
export const generateMetadata = pageMetadata('teachers');
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
