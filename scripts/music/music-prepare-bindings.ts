import { existsSync } from 'node:fs';
import { basename, join, parse } from 'node:path';
import { conservativeArtist, conservativeCategory, exactLyricsTitleMatch, TAXONOMY } from './music-classify.js';
import { fileSha256, readJson, SHA256, writeJsonAtomic, nonempty } from './music-shared.js';
import { AssetContext, copyAuxiliaryAtomic, embeddedCover, setAssetBinding, sourcePath, trackOutputPath } from './music-prepare-assets.js';
import { SourceRecord } from './music-prepare-inventory.js';

type Auxiliary = SourceRecord & { kind: 'cover' | 'lyrics' };
export interface ManualItem { kind: string; source: string; reason: string }
function rel(record: SourceRecord): string { return record.relativePath.replaceAll('\\', '/'); }
function keyDirectory(record: SourceRecord): string { return parse(rel(record)).dir.toLowerCase(); }
function keyStem(record: SourceRecord): string { return `${keyDirectory(record)}|${parse(rel(record)).name}`.toLowerCase(); }
function group<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) { const name = key(item); result.set(name, [...(result.get(name) ?? []), item]); }
  return result;
}
function audioId(record: SourceRecord): string { if (!record.id) throw new Error('Missing media id.'); return record.id; }
function addManual(queue: ManualItem[], asset: Auxiliary, reason: string): void { queue.push({ kind: asset.kind, source: asset.relativePath, reason }); }

export async function buildMusicOutputs(ctx: AssetContext, sourceRecords: SourceRecord[], canonical: SourceRecord[], completed: SourceRecord[]): Promise<{ tracks: number; manualReview: number }> {
  const coverBindings = new Map<string, string>();
  const lyricsBindings = new Map<string, string>();
  for (const record of completed) {
    const cover = await embeddedCover(ctx, record);
    if (cover) {
      const id = audioId(record), name = basename(cover);
      setAssetBinding(ctx, id, 'cover', name);
      coverBindings.set(id, `/music/library/covers/${name}`);
    }
  }
  const mediaByStem = group(canonical, keyStem);
  const auxiliary = sourceRecords.filter((record): record is Auxiliary => record.kind === 'cover' || record.kind === 'lyrics');
  const auxiliaryByKindAndStem = group(auxiliary, asset => `${asset.kind}|${keyStem(asset)}`);
  const completedIds = new Set(completed.map(audioId));
  const completedByDirectory = group(completed, keyDirectory);
  const manualQueue: ManualItem[] = [];
  const handledAuxiliary = new Set<string>();
  const albumCoverCandidates = auxiliary.filter(asset => asset.kind === 'cover' && /^(?:cover|folder)\.jpg$/i.test(basename(rel(asset))));
  for (const [directory, candidates] of group(albumCoverCandidates, keyDirectory)) {
    const covers = candidates.filter(asset => /^cover\.jpg$/i.test(basename(rel(asset))));
    const folders = candidates.filter(asset => /^folder\.jpg$/i.test(basename(rel(asset))));
    const chosen = covers.length === 1 ? covers[0] : covers.length === 0 && folders.length === 1 ? folders[0] : undefined;
    if (!chosen) continue;
    for (const candidate of candidates) handledAuxiliary.add(rel(candidate).toLowerCase());
    const destination = join(ctx.outputRoot, 'covers', `${chosen.contentSha256}${chosen.extension}`);
    if (await copyAuxiliaryAtomic(ctx, sourcePath(ctx, chosen), destination, chosen.contentSha256)) {
      const name = basename(destination);
      for (const track of completedByDirectory.get(directory) ?? []) {
        const id = audioId(track);
        if (coverBindings.has(id)) continue;
        setAssetBinding(ctx, id, 'cover', name);
        coverBindings.set(id, `/music/library/covers/${name}`);
      }
    } else addManual(manualQueue, chosen, 'copy-failed');
  }
  const lyricsMatchesByAsset = new Map<string, SourceRecord[]>();
  const lyricsAssetsByTrack = new Map<string, Auxiliary[]>();
  for (const asset of auxiliary.filter(asset => asset.kind === 'lyrics')) {
    const matches = (completedByDirectory.get(keyDirectory(asset)) ?? []).filter(track => exactLyricsTitleMatch(rel(asset), track));
    lyricsMatchesByAsset.set(rel(asset).toLowerCase(), matches);
    for (const track of matches) {
      const id = audioId(track);
      lyricsAssetsByTrack.set(id, [...(lyricsAssetsByTrack.get(id) ?? []), asset]);
    }
  }
  for (const asset of auxiliary) {
    const relativeKey = rel(asset).toLowerCase();
    if (handledAuxiliary.has(relativeKey)) continue;
    if (asset.kind === 'lyrics') {
      const matches = lyricsMatchesByAsset.get(relativeKey) ?? [];
      if (!matches.length) { addManual(manualQueue, asset, 'no-normalized-title-match'); continue; }
      const unambiguous = matches.filter(track => lyricsAssetsByTrack.get(audioId(track))?.length === 1);
      if (!unambiguous.length) { addManual(manualQueue, asset, 'multiple-normalized-title-assets'); continue; }
      const destination = join(ctx.outputRoot, 'lyrics', `${asset.contentSha256}${asset.extension}`);
      if (await copyAuxiliaryAtomic(ctx, sourcePath(ctx, asset), destination, asset.contentSha256)) {
        const name = basename(destination);
        for (const track of unambiguous) {
          const id = audioId(track);
          setAssetBinding(ctx, id, 'lyrics', name);
          lyricsBindings.set(id, `/music/library/lyrics/${name}`);
        }
        if (unambiguous.length !== matches.length) addManual(manualQueue, asset, 'partially-ambiguous-normalized-title-match');
      } else addManual(manualQueue, asset, 'copy-failed');
      continue;
    }
    const matches = mediaByStem.get(keyStem(asset)) ?? [];
    const sameAssets = auxiliaryByKindAndStem.get(`${asset.kind}|${keyStem(asset)}`) ?? [];
    if (matches.length !== 1) { addManual(manualQueue, asset, matches.length ? 'multiple-exact-stem-tracks' : 'no-exact-stem-track'); continue; }
    if (sameAssets.length !== 1) { addManual(manualQueue, asset, 'multiple-exact-stem-assets'); continue; }
    const track = matches[0], id = audioId(track);
    if (!completedIds.has(id) || coverBindings.has(id)) continue;
    const destination = join(ctx.outputRoot, 'covers', `${asset.contentSha256}${asset.extension}`);
    if (await copyAuxiliaryAtomic(ctx, sourcePath(ctx, asset), destination, asset.contentSha256)) {
      const name = basename(destination);
      setAssetBinding(ctx, id, 'cover', name);
      coverBindings.set(id, `/music/library/covers/${name}`);
    } else addManual(manualQueue, asset, 'copy-failed');
  }
  const lrcgetPath = join(parse(ctx.inventoryPath).dir, 'lrcget-import.v1.json');
  if (existsSync(lrcgetPath)) {
    const report = readJson<{ tracks: Array<{ id: string; status: string; sha256?: string }> }>(lrcgetPath);
    for (const entry of report.tracks) {
      lyricsBindings.delete(entry.id);
      if (entry.status !== 'synced') continue;
      if (!entry.sha256 || !SHA256.test(entry.sha256)) throw new Error('Invalid LRCGET asset hash.');
      const assetPath = join(ctx.outputRoot, 'lyrics', `${entry.sha256}.lrc`);
      if (!existsSync(assetPath) || await fileSha256(assetPath) !== entry.sha256) throw new Error(`LRCGET asset missing or corrupt: ${entry.sha256}`);
      lyricsBindings.set(entry.id, `/music/library/lyrics/${entry.sha256}.lrc`);
    }
  }
  const sorted = [...completed].sort((a, b) => rel(a).localeCompare(rel(b), 'en'));
  const tracks = sorted.map(record => {
    const id = audioId(record), output = trackOutputPath(ctx, record);
    if (!output) throw new Error(`Completed track has no output binding: ${id}`);
    const category = conservativeCategory(record);
    const track: Record<string, unknown> = {
      id, title: nonempty(record.title) ?? parse(rel(record)).name,
      artist: conservativeArtist(record) ?? '', duration: Math.round((record.duration ?? 0) * 1000) / 1000,
      src: `/music/library/tracks/${basename(output)}`,
    };
    if (nonempty(record.album)) track.album = nonempty(record.album);
    track.genre = category.id;
    if (coverBindings.has(id)) track.cover = coverBindings.get(id);
    if (lyricsBindings.has(id)) track.lyrics = lyricsBindings.get(id);
    return track;
  });
  writeJsonAtomic(join(ctx.outputRoot, 'manifest.v1.json'), { version: 1, tracks });
  const classifications = [...completed].sort((a, b) => audioId(a).localeCompare(audioId(b), 'en')).map(record => {
    const id = audioId(record), category = conservativeCategory(record);
    const artist = conservativeArtist(record), album = nonempty(record.album), language = nonempty(record.language);
    const needsReview = [!artist && 'artist', !album && 'album', category.id === 'unclassified' && 'category', record.year == null && 'year', !language && 'language'].filter(Boolean);
    const item: Record<string, unknown> = {
      id, outputSha256: ctx.prepared.get(id)?.outputSha256,
      sourceType: ['.mp4', '.mov', '.mkv'].includes(record.extension) ? 'video' : 'audio',
      artist: artist ?? '', categories: [category.id], categorySource: category.source, needsReview,
    };
    if (album) item.album = album;
    if (record.year != null) item.year = record.year;
    if (language) item.language = language;
    if (nonempty(record.genre)) item.rawGenre = nonempty(record.genre);
    return item;
  });
  const counts = new Map<string, number>();
  for (const item of classifications) for (const category of item.categories as string[]) counts.set(category, (counts.get(category) ?? 0) + 1);
  writeJsonAtomic(join(ctx.outputRoot, 'classification.v1.json'), {
    version: 1, taxonomy: TAXONOMY,
    summary: [...counts].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([id, tracks]) => ({ id, tracks })),
    tracks: classifications,
  });
  writeJsonAtomic(join(parse(ctx.inventoryPath).dir, 'manual-review.v1.json'), {
    version: 1, items: manualQueue.sort((a, b) => a.kind.localeCompare(b.kind, 'en') || a.source.localeCompare(b.source, 'en')),
  });
  writeJsonAtomic(join(parse(ctx.inventoryPath).dir, 'asset-bindings.v1.json'), {
    version: 1, tracks: [...ctx.assets.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
  });
  return { tracks: tracks.length, manualReview: manualQueue.length };
}
