import PaperReader from '../PaperReader';
import { paper } from '../../paper';
import manuscript from './manuscript.json';

export default async function PaperPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <PaperReader lang={lang} paper={paper} manuscript={manuscript} />;
}
