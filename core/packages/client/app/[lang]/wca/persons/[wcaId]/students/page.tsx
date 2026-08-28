import StudentManagerClient from './StudentManagerClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ wcaId: '_' }];
}

export default function Page() {
  return <StudentManagerClient />;
}
