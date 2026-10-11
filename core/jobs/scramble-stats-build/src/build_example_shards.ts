/** Split existing preview samples; this never runs a solver or changes sampling. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

type Sample = [string, string, string, string?];
type CompMeta = [string, string, number, string, string, (0 | 1)?];
export interface ExampleSet {
  variants: Record<string, Record<string, Record<string, Record<string, Sample[]>>>>;
  comps?: Record<string, [string, string]>;
  idMeta?: Record<string, CompMeta>;
}
export interface ExampleShard extends ExampleSet {
  meta: { content_hash: string };
}
export type ExampleShardIndex = Record<string, Record<string, Record<string, string>>>;

export function splitExampleSet(source: ExampleSet): Array<{ variant: string; stage: string; shard: ExampleShard }> {
  return Object.entries(source.variants).flatMap(([variant, stages]) =>
    Object.entries(stages).map(([stage, subsets]) => {
      const idMeta: NonNullable<ExampleSet['idMeta']> = {};
      const comps: NonNullable<ExampleSet['comps']> = {};
      for (const bins of Object.values(subsets)) for (const samples of Object.values(bins)) {
        for (const [id] of samples) {
          const meta = source.idMeta?.[id];
          if (!meta) continue; // Synthetic samples do not have competition metadata.
          idMeta[id] = meta;
          const comp = source.comps?.[meta[0]];
          if (comp) comps[meta[0]] = comp;
        }
      }
      const data: ExampleSet = { variants: { [variant]: { [stage]: subsets } }, comps, idMeta };
      const content_hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      return { variant, stage, shard: { meta: { content_hash }, ...data } };
    }),
  );
}

export function writeExampleShards(outDir: string): ExampleShardIndex {
  const distributionPath = path.join(outDir, 'distribution.json');
  const distribution = JSON.parse(fs.readFileSync(distributionPath, 'utf8'));
  const examples = JSON.parse(fs.readFileSync(path.join(outDir, 'examples.json'), 'utf8'));
  const index: ExampleShardIndex = {};
  for (const [setKey, set] of Object.entries(distribution.sets) as Array<[string, { event?: string }]>) {
    // Missing per-event samples are legitimate for datasets without that reservoir.
    const perEventPath = path.join(outDir, `examples_${setKey}.json`);
    const source: ExampleSet | undefined = set.event
      ? (fs.existsSync(perEventPath) ? JSON.parse(fs.readFileSync(perEventPath, 'utf8')) : undefined)
      : examples.sets[setKey];
    if (!source) continue;
    for (const { variant, stage, shard } of splitExampleSet(source)) {
      for (const key of [setKey, variant, stage]) {
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error(`Unsafe example key: ${key}`);
      }
      const relative = `examples_stage/${setKey}/${variant}__${stage}.json`;
      const output = path.join(outDir, relative);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(shard));
      ((index[setKey] ??= {})[variant] ??= {})[stage] = `${relative}?v=${shard.meta.content_hash}`;
    }
  }
  // Publish the pointer last. The client checks the content version before using a shard,
  // and can use the existing full file while static assets are rolling out.
  distribution.meta.example_shards = index;
  fs.writeFileSync(distributionPath, JSON.stringify(distribution));
  return index;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2])
    : fileURLToPath(new URL('../../../../stats/scramble/', import.meta.url));
  const index = writeExampleShards(outDir);
  console.log(`Wrote ${Object.values(index).flatMap(variants => Object.values(variants)).reduce((n, stages) => n + Object.keys(stages).length, 0)} example shards`);
}
