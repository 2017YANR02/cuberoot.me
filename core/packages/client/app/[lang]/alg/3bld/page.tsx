'use client';

// 3BLD hub index — fans out to all /alg/3bld/* modules via the shared
// <Bld3Hub /> grid (also embedded inline on /trainer when the puzzle selector
// is set to 三盲/3BLD).

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Bld3Hub } from './_components/Bld3Hub';

export default function Bld3HubPage() {
  useDocumentTitle('盲拧训练', '3BLD Trainer');
  return <Bld3Hub />;
}
