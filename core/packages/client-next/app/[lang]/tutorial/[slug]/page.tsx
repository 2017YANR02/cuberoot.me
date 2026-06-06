import TutorialPostClient from './TutorialPostClient';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <TutorialPostClient />;
}
