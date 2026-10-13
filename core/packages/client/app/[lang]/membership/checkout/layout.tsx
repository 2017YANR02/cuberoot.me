import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'origin',
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
