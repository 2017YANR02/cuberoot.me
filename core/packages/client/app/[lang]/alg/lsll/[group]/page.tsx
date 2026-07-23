// 42 个大类全部 SSG;未知 slug 404。
import { CATEGORY_SLUGS } from '@/lib/lsll/model';
import LsllGroupClient from './LsllGroupClient';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((group) => ({ group }));
}

export default function Page() {
  return <LsllGroupClient />;
}
