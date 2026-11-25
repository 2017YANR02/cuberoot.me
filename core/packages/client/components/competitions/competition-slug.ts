export function createCompetitionSlug(name: string, fallback: 'competition' | 'organizer') {
  const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 52).replace(/^-|-$/g, '');
  return (stem || fallback) + '-' + crypto.randomUUID().slice(0, 8);
}
