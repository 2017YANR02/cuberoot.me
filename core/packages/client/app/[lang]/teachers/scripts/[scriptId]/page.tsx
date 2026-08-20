import LiveScriptReaderClient from './LiveScriptReaderClient';
export const dynamicParams = false;
export function generateStaticParams() { return [{ scriptId: '_' }]; }
export default function Page() { return <LiveScriptReaderClient />; }
