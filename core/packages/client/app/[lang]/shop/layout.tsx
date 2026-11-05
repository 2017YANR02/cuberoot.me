import type { ReactNode } from 'react';
import { ShopShell } from '@/components/shop/ShopShell';
import '@/components/platform/platform.css';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}
