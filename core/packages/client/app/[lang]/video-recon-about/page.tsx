import credits from '../about/credits_data.json';
import VideoReconGuide from './VideoReconGuide';

export default function VideoReconAboutPage() {
  const upstream = credits.find(credit => credit.id === 'magic-stew');
  return <VideoReconGuide upstream={upstream && { name: upstream.name, url: upstream.url }} />;
}
