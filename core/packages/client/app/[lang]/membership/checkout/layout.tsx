import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMetadata } from '@/lib/page-meta';

export async function generateMetadata(props: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return {
    ...await pageMetadata('membership/checkout')(props),
    robots: { index: false, follow: false },
    referrer: 'origin',
  };
}

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
