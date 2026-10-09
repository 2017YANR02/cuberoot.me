import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { runIncremental, sourceRows } from '../src/incremental';

it('imports all 62 real NewYorkMultimatum2026 scrambles with MySQL-escaped tabs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wca-intake-'));
  try {
    // Complete original row from WCA_export_2026-10-04.tsv.zip. WCA generates
    // TSV using mysql --batch --quick (DatabaseDumper.mysqldump_tsv), and MBF
    // newlines become pipes. The first 61 scrambles contain escaped trailing tabs.
    const fixture = new URL('./fixtures/wca-export-5852577.tsv', import.meta.url);
    await copyFile(fixture, join(dir, 'Scrambles.tsv'));
    const original = (await readFile(fixture, 'utf8')).split('\n')[1].split('\t')[0];
    const originalScrambles = original.split('|');
    expect(originalScrambles).toHaveLength(62);
    expect(originalScrambles.filter(s => s.endsWith('\\t'))).toHaveLength(61);
    expect(normalizeWcaScramble(originalScrambles[0])).toBeNull();

    expect(await runIncremental({ dataDir: dir, tsvDir: dir, useCached: false, dryRun: false }))
      .toEqual({ rows: 1, expanded: 62 });
    const lines = (await readFile(join(dir, 'incremental/new_no_wide_move.txt'), 'utf8')).trimEnd().split('\n');
    expect(lines).toHaveLength(62);
    for (let i = 0; i < 62; i++) {
      // Independent expected text: this captured export has precisely one
      // encoded trailing tab on these 61 lines, and none on the final line.
      const originalText = i < 61 ? originalScrambles[i].slice(0, -2) : originalScrambles[i];
      const expected = normalizeWcaScramble(originalText);
      expect(expected).not.toBeNull();
      expect(lines[i]).toBe(`5852577${String(i + 1).padStart(3, '0')},${expected}`);
    }
    expect(lines[0]).toBe("5852577001,B2 R' F2 R2 U' F2 U' R2 B2 U' L2 R' B' L U' L2 F' L' R B R2");
    expect(await readFile(join(dir, 'incremental/new_watermark.txt'), 'utf8')).toBe('5852577');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('decodes TSV field escapes once while preserving invalid literals and CSV input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wca-intake-escapes-'));
  try {
    const header = 'id\tscramble\tevent_id';
    await writeFile(join(dir, 'Scrambles.tsv'), [header,
      '1\tR\\tU\\nF\t333',
      '2\tR U\\\\t\t333',
      '3\tR U\\q\t333',
      '4\tR\\0U\t333',
    ].join('\n'));
    const options = { dataDir: dir, useCached: false, dryRun: true };
    const actual = [];
    for await (const row of sourceRows(options, dir)) actual.push(row.scramble);
    expect(actual).toEqual(['R\tU\nF', 'R U\\t', 'R U\\q', 'R\0U']);
    expect(normalizeWcaScramble(actual[0])).toBe('R U F');
    for (const invalid of actual.slice(1)) expect(normalizeWcaScramble(invalid)).toBeNull();

    const csv = join(dir, 'source.csv');
    await writeFile(csv, 'id,scramble,event_id\n1,R U\\t,333\n');
    const fromCsv = [];
    for await (const row of sourceRows({ ...options, sourceCsv: csv })) fromCsv.push(row.scramble);
    expect(fromCsv).toEqual(['R U\\t']);
    expect(normalizeWcaScramble(fromCsv[0])).toBeNull();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('decodes the complete real record for the PG mirror without changing MBF pipe boundaries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wca-mirror-'));
  const previousArgs = process.argv;
  try {
    const fixture = fileURLToPath(new URL('./fixtures/wca-export-5852577.tsv', import.meta.url));
    const counts = join(dir, 'counts.tsv');
    const delta = join(dir, 'delta.csv');
    const comps = join(dir, 'comps.txt');
    await writeFile(counts, '');
    process.argv = [process.execPath, 'build_mirror_delta.mjs',
      '--scrambles', fixture, '--prod-counts', counts, '--out-delta', delta, '--out-comps', comps];
    await import('../build_mirror_delta.mjs');
    const original = (await readFile(fixture, 'utf8')).split('\n')[1].split('\t')[0];
    const csv = await readFile(delta, 'utf8');
    expect(csv).toBe('competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble\n'
      + 'NewYorkMultimatum2026,333mbf,1,B,0,1,' + original.replaceAll('\\t', '\t') + '\n');
    expect(csv).not.toContain('\\t');
    expect(csv.split('|')).toHaveLength(62);
    expect(await readFile(comps, 'utf8')).toBe('NewYorkMultimatum2026\n');
  } finally {
    process.argv = previousArgs;
    await rm(dir, { recursive: true, force: true });
  }
});
