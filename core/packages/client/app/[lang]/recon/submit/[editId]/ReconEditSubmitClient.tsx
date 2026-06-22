'use client';
// Client shell for the recon edit form. The rendered route is the sentinel "_"
// (one static page reused for every id via a next.config rewrite), so the real
// editId can't come from useParams — derive it from the browser URL. Hold the
// form back until the id is known (null gate) so ReconSubmitForm only ever mounts
// once with the real editId (isEditing=!!editId — an empty string would render
// the NEW-submission form by mistake).
import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ReconSubmitForm from '../ReconSubmitForm';

export default function ReconEditSubmitClient() {
  const pathname = usePathname();
  const [editId, setEditId] = useState<string | null>(null);
  useEffect(() => {
    // URL is /<lang?>/recon/submit/<editId>; the last path segment is the id.
    const segs = window.location.pathname.split('/').filter(Boolean);
    setEditId(segs[segs.length - 1] ?? '');
  }, [pathname]);
  if (editId === null) return null;
  return (
    <Suspense fallback={null}>
      <ReconSubmitForm editId={editId} />
    </Suspense>
  );
}
