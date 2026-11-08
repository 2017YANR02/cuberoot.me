import { ContentSkeleton } from '@/components/ContentSkeleton';
import './forum.css';

export default function ForumLoading() {
  return <div className="forum-page"><ContentSkeleton variant="article" /></div>;
}
