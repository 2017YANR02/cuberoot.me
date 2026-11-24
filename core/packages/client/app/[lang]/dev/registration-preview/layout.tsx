import { pageMetadata } from '@/lib/page-meta';

export async function generateMetadata(props: Parameters<ReturnType<typeof pageMetadata>>[0]) {
  return {
    ...await pageMetadata('dev/registration-preview')(props),
    robots: { index: false, follow: false },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
