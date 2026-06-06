import ReconAltClient from './ReconAltClient';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ReconAltClient />;
}
