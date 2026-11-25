import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';

export function CompetitionScramble({ project, scramble }: { project: string; scramble: string }) {
  const preview = eventHasScramblePreview(project);
  return <div className="competition-scramble-layout" data-preview={preview || undefined}>
    <p className="competition-scramble">{scramble}</p>
    {preview && <ScramblePreview2D event={project} scramble={scramble} size={82} />}
  </div>;
}
