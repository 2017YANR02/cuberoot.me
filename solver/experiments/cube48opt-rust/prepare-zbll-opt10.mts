/** Preparation only: bounded header/artifact reads; never spawns a solver. */
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256, validateOpt10BatchReview } from './opt10-zbll-policy.mts';
import { rustScramble } from '../../333opt/rust-h10-adapter.mts';
const root = resolve(import.meta.dirname, '../../..'), base = resolve(root,'.tmp/cubeopt-reverse');
const out = resolve(root,'.tmp/zbll-opt10-acceptance-20261013');
const read = (name:string) => readFileSync(resolve(base,name));
const report = read('wca100-rust-opt10-single-report.json');
const parsed = JSON.parse(report.toString()), metadata = parsed.generationMetadata;
const header = Buffer.alloc(1024), fd = openSync(metadata.table.path,'r');
try { if (readSync(fd,header,0,1024,0) !== 1024) throw Error('Truncated header'); } finally { closeSync(fd); }
const evidence = { baseline:read('resource-baseline.json'), report, exit:read('wca100-rust-opt10-single-exit.json'),
  binary:readFileSync(metadata.binary.path), small:read('opt9-generated/small-memory.bin'), header };
const review = { schema:'cuberoot.opt10.zbll-review.v1',scope:'double-zbll-symmetry-v2',reviewedAt:new Date().toISOString(),
  reason:'User requests Opt10 ZBLL trials and resumable integration. Prior file-cache pressure was fixed with F_NOCACHE; subsequent generation and WCA100 passed under the unchanged baseline. Preserve stopped history and reject any new violation.',
  baselineSha256:sha256(evidence.baseline),reportSha256:sha256(report),exitSha256:sha256(evidence.exit),
  binarySha256:sha256(evidence.binary),smallSha256:sha256(evidence.small),headerSha256:sha256(header) };
validateOpt10BatchReview(review,evidence,JSON.parse(evidence.baseline.toString()));
writeFileSync(resolve(root,'.tmp/double-zbll-symmetry-v2/opt10-resource-review.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
mkdirSync(out,{recursive:true});
const cases = JSON.parse(readFileSync(resolve(root,'.tmp/zbll-rust-acceptance-20261013-v3/input.json'),'utf8')).cases;
writeFileSync(resolve(out,'input.json'),JSON.stringify(cases,null,2),{flag:'wx'});
writeFileSync(resolve(out,'input.tsv'),cases.map((x:any,i:number)=>`${i}\t${rustScramble(x.scramble)}\n`).join(''),{flag:'wx'});
console.log(`Prepared ${cases.length} regression cases; no solver started.`);
