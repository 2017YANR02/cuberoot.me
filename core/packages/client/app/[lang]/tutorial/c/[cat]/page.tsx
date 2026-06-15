import TutorialCategoryClient from './TutorialCategoryClient';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <TutorialCategoryClient />;
}
