// Shared continent globe icon (orthographic projection, rasterized to small webp).
// Used by RegionPicker (filter dropdown) and RecentRecords (continental-record marker).
export type ContinentSlug =
  | 'africa' | 'asia' | 'europe' | 'northAmerica' | 'oceania' | 'southAmerica';

// WCA continental-record badge token → continent slug.
export const RECORD_BADGE_CONTINENT: Record<string, ContinentSlug> = {
  AfR: 'africa',
  AsR: 'asia',
  ER: 'europe',
  NAR: 'northAmerica',
  OcR: 'oceania',
  SAR: 'southAmerica',
};

export function ContinentIcon({ slug, className }: { slug: ContinentSlug; className?: string }) {
  return (
    <span className={className ?? 'continent-icon'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/_assets/continent-icons/${slug}.webp`} alt="" width={20} height={20} decoding="async" />
    </span>
  );
}
