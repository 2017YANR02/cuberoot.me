import { pageMetadata } from '@/lib/page-meta';
import './components/canvas-texture.css';

export const generateMetadata = pageMetadata('tutorial');
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
