import IframePage from '@/components/IframePage';

const CONTESTS_APP_URL = process.env.NEXT_PUBLIC_CONTESTS_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3005/default' : 'https://contests.cuberoot.me/default');

export default function Page() {
  return (
    <IframePage
      src={CONTESTS_APP_URL}
      title="CubeRoot Contests"
      fullAppHref={CONTESTS_APP_URL}
      fullAppLabel={{ en: 'Open full app', zh: '打开完整应用' }}
      syncDocumentTitle={false}
    />
  );
}
