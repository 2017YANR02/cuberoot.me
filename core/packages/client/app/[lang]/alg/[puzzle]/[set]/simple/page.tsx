import SimpleAlgSetClient from './SimpleAlgSetClient';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ puzzle: '3x3', set: 'zbll' }];
}

export default function Page() {
  return <SimpleAlgSetClient />;
}
