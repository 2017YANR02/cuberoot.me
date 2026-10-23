import { lllFivePolicy, validateLllFiveReview } from './lll-five-policy.mts';
import { pllPolicy, validatePllReview } from './pll-sample-policy.mts';
import {beginStatsRun, validateStatsRun} from './stats-resume-review.mts';
import {cornerExecutable, cornerResearchPolicy} from './corner-policy.mts';
import {readCornerSession} from './corner-session.mts';
import { currentPolicy, validateCurrentReview } from './opt10-current-benchmark-policy.mts';
import { zbllMultisolutionPolicy, validateZbllMultisolutionReview } from './zbll-multisolution-policy.mts';
import { nxPolicy as opt8NativePolicy, validateNxReview as validateOpt8NativeReview } from './opt8-native-policy.mts';
/** Backend-budgeted research. Shares the previous experiment's swap stop record. */
import { localOpt8Scope, validateLocalOpt8Review } from './opt8-local-policy.mts';
import { openPolicy, validateOpenReview, openStopPath } from './open-benchmark-policy.mts';
import { resumePolicy, validateResumeReview, resumeStopPath } from './original-resume-policy.mts';
import { candidatePolicy, validateCandidateReview, candidateStopPath } from './opt9-wasm-candidate-policy.mts';
import { dualCandidatePolicy, validateDualCandidateReview } from './wasm-dual-candidate-policy.mts';
import { browserPolicy, validateBrowserReview } from './wasm-browser-policy.mts';
import { nxPolicy, validateNxReview } from './nxopt-policy.mts';
import { constants, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, fstatSync, readSync, lstatSync, fsyncSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { readResumeReview, resumeStopPath as zbllResumeStopPath } from './zbll-resume-review.mts';
import { validateOpt10BatchReview, zbllOfficialPolicy, validateZbllOfficialReview } from './opt10-zbll-policy.mts';
import { officialPolicy, officialPaths, officialScope, collectOfficialEvidence, validateOfficialReview, officialHasStop } from './opt10-official-policy.mts';
import { collectMultithreadEvidence, multithreadPaths, multithreadPolicy, multithreadScope, validateMultithreadReview } from './multithread-policy.mts';
import { parseVm, memorySummary, parseProcesses } from '../../../core/scripts/mac-system-recorder.mts';
import { parseWasmBenchmarkArguments, readWca100 } from './wasm-benchmark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const native = resolve(here, 'target/release/cube48opt-research');
const zbllNative = resolve(here, 'target/zbll/release/cube48opt-research');
const opt10Native = resolve(here, 'target/opt10/release/cube48opt-research');
const opt10Small = resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
const opt10Table = resolve(root, '.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat');
const opt10Proof = resolve(root, '.tmp/cubeopt-reverse/opt10-generation-validation-v2.json');
const opt10Metadata = resolve(root, '.tmp/cubeopt-reverse/opt10-generated-v2/generation-metadata.json');
const opt10Input = resolve(root, '.tmp/cubeopt-reverse/wca100-single.tsv');
const opt10PayloadBytes = 31_130_910_720;
const opt10FileBytes = opt10PayloadBytes + 1024;
const opt10ProofSources = ['src/opt10_generate.rs', 'src/opt10.rs', 'src/opt10_table.rs', 'src/coord.rs', 'src/cube.rs'];
export const opt10ReviewSources = [...opt10ProofSources, 'src/main.rs', 'src/lib.rs', 'src/search.rs', 'src/table.rs', 'src/batch.rs',
  'examples/verify_opt10_generation.rs', 'Cargo.toml', 'Cargo.lock'];
export const opt10ReviewScope = 'opt10-rebuild-v2-single100';
export const opt10ReviewStages = ['verify-opt1', 'generate-opt10', 'solve-opt10'] as const;
const opt10CorpusSha256 = '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const GiB = 2 ** 30, MiB = 2 ** 20;

type MemoryObservation = { boot: string; swapouts: number; pressure: number; available: number };
type ReviewedRequest = { label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv };
export const resourceReviewScope = 'opt9-wasm-wca100-both-single';
export const productionResourceReviewScope = 'opt8-wasm-production-wca100-four-threads';
export const resourceReviewCommandSha256 = (executable: string, args: string[]) => digest(Buffer.from(JSON.stringify([executable, ...args])));

/** A manual review permits one lower-memory comparison, never resets history. */
export function validateResourceReview(review: any, baselineBytes: Buffer, resourcesBytes: Buffer,
    request: ReviewedRequest, current: MemoryObservation, used = false, newerStop = false) {
  const policy = researchPolicy(request.label, request.executable, request.args, request.env);
  const config = policy.entry === 'wasm-benchmark.mjs' ? parseWasmBenchmarkArguments(request.args.slice(1)) : null;
  const production = config?.variant === 8 && config.threads === 4 && review.scope === productionResourceReviewScope;
  if (policy.entry !== 'wasm-benchmark.mjs' || policy.backend !== 'opt' || config?.engine !== 'both'
      || !(production || policy.variant === 9 && config.threads === 1 && review.scope === resourceReviewScope)
      || production && review.schema !== 'cuberoot.resource-review.v1')
    throw Error('Resource review permits only its exact one-pass WASM comparison');
  if (used || newerStop) throw Error('Resource review was already consumed or a newer stop requires review');
  const prior = JSON.parse(baselineBytes.toString('utf8'));
  const resources = JSON.parse(resourcesBytes.toString('utf8'));
  if (!['cuberoot.resource-review.v1', 'cuberoot.resource-review.v2'].includes(review?.schema)
      || typeof review.reason !== 'string' || !review.reason.trim()
      || !Number.isFinite(Date.parse(review.reviewedAt))
      || !/^[a-z0-9-]+$/.test(review.stoppedLabel ?? '') || review.stoppedLabel === request.label
      || review.baselineSha256 !== digest(baselineBytes) || review.stoppedResourcesSha256 !== digest(resourcesBytes)
      || review.nextLabel !== request.label
      || review.commandSha256 !== resourceReviewCommandSha256(request.executable, request.args)
      || typeof prior.stopped !== 'string' || !prior.stopped || resources.stopped !== prior.stopped
      || typeof prior.boot !== 'string' || !prior.boot || !Number.isSafeInteger(prior.swapouts) || prior.swapouts < 0
      || resources.boot !== prior.boot || resources.swapouts !== prior.swapouts
      || review.boot !== prior.boot || review.swapouts !== prior.swapouts)
    throw Error('Resource review does not match the exact stopped record, resources and command');
  if (current.boot !== prior.boot || current.swapouts !== prior.swapouts)
    throw Error('Reviewed boot/swap baseline changed; cannot reset');
  if (current.pressure !== 1 || !Number.isSafeInteger(current.available) || current.available < policy.rssLimit + 3 * GiB)
    throw Error('Reviewed comparison has insufficient memory headroom or abnormal pressure');
  return { baselineSha256: review.baselineSha256 as string, commandSha256: review.commandSha256 as string };
}

type PreviousRunEvidence = { receipt: Buffer; resources: Buffer; report: Buffer; exit: Buffer;
  previousWasmSha256: string; candidateWasmSha256: string };

/** One successor is allowed only after a fully verified, normally exited run. */
export function validateSuccessfulPredecessor(review: any, evidence: PreviousRunEvidence, request: ReviewedRequest) {
  const { receipt: receiptBytes, resources: resourcesBytes, report: reportBytes, exit: exitBytes } = evidence;
  if (review.schema !== 'cuberoot.resource-review.v2'
      || review.previousReceiptSha256 !== digest(receiptBytes)
      || review.previousResourcesSha256 !== digest(resourcesBytes)
      || review.previousReportSha256 !== digest(reportBytes) || review.previousGuardExitSha256 !== digest(exitBytes)
      || !/^[a-f0-9]{64}$/.test(review.candidateWasmSha256 ?? '') || review.candidateWasmSha256 !== evidence.candidateWasmSha256)
    throw Error('Successor review does not match the exact predecessor evidence and new WASM');
  const previous = JSON.parse(receiptBytes.toString('utf8')), resources = JSON.parse(resourcesBytes.toString('utf8'));
  const report = JSON.parse(reportBytes.toString('utf8')), exit = JSON.parse(exitBytes.toString('utf8'));
  const expectedName = `${review.baselineSha256}${previous.previousReceiptSha256 ? `-${previous.previousReceiptSha256}` : ''}.json`;
  if (review.previousReceipt !== expectedName || previous.schema !== 'cuberoot.resource-review-consumption.v1'
      || previous.baselineSha256 !== review.baselineSha256 || previous.stoppedLabel !== review.stoppedLabel
      || previous.stoppedResourcesSha256 !== review.stoppedResourcesSha256 || previous.label === request.label
      || previous.commandSha256 !== resourceReviewCommandSha256(previous.executable, previous.args)
      || previous.before?.boot !== review.boot || previous.before?.swapouts !== review.swapouts
      || JSON.stringify(resources.reviewReceipt) !== JSON.stringify(previous))
    throw Error('Predecessor receipt does not match its consumed identity and resources');
  const oldPolicy = researchPolicy(previous.label, previous.executable, previous.args, { CUBEOPT_BACKEND:'opt', CUBEOPT_VARIANT:'9' });
  const oldConfig = parseWasmBenchmarkArguments(previous.args.slice(1)), newConfig = parseWasmBenchmarkArguments(request.args.slice(1));
  if (oldPolicy.entry !== 'wasm-benchmark.mjs' || oldConfig.variant !== 9 || oldConfig.engine !== 'both'
      || oldConfig.table !== newConfig.table || oldConfig.small !== newConfig.small || oldConfig.out === newConfig.out
      || exit.exitCode !== 0 || !Number.isFinite(Date.parse(exit.recordedAt))
      || !Number.isFinite(Date.parse(resources.sampledAt)) || Date.parse(exit.recordedAt) < Date.parse(resources.sampledAt)
      || resources.boot !== review.boot || resources.swapouts !== review.swapouts || resources.pressure !== 1
      || resources.stopped !== '' || resources.trigger !== null || resources.backend !== 'opt' || resources.variant !== 9
      || resources.entry !== 'wasm-benchmark.mjs' || resources.mode !== 'single-pass' || resources.h !== null
      || resources.rssLimit !== oldPolicy.rssLimit || resources.tableBytes !== oldPolicy.tableBytes
      || !Number.isFinite(resources.peakRss) || resources.peakRss <= 0 || resources.peakRss > oldPolicy.rssLimit
      || !Number.isFinite(resources.minimumHeadroom) || resources.minimumHeadroom < 2 * GiB)
    throw Error('Predecessor did not exit normally with intact original resource protection');
  if (report.schema !== 'cuberoot.rust-opt-wasm-benchmark-report.v1' || report.variant !== 9
      || report.corpusSha256 !== '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde'
      || report.cases !== 100 || report.threads !== 1 || report.measuredPasses !== 1 || report.warmupCases !== 0
      || !/^[a-f0-9]{64}$/.test(report.tableSha256 ?? ''))
    throw Error('Predecessor report is not the full fixed single-pass WCA100 comparison');
  for (const name of ['rust', 'original']) {
    const engine = report.engines?.[name];
    if (engine?.engine !== name || engine.cases !== 100 || engine.verifiedSolutions !== 100 || engine.optimalLengthsMatched !== 100
        || engine.processExited !== true || engine.threads !== 1 || engine.warmupCases !== 0 || engine.measuredPasses !== 1
        || engine.tableSha256 !== report.tableSha256 || !Number.isFinite(engine.totalSeconds) || engine.totalSeconds <= 0
        || !/^[a-f0-9]{64}$/.test(engine.artifacts?.sha256?.wasm ?? ''))
      throw Error('Predecessor report lacks both complete, independently verified engine results');
  }
  const oldWasm = report.engines.rust.artifacts.sha256.wasm;
  const history = previous.candidateHistorySha256 ?? [oldWasm];
  if (oldWasm !== evidence.previousWasmSha256 || previous.candidateWasmSha256 && previous.candidateWasmSha256 !== oldWasm
      || previous.previousReceiptSha256 && !Array.isArray(previous.candidateHistorySha256)
      || !Array.isArray(history) || !history.length || history.length > 100 || history.at(-1) !== oldWasm
      || history.some((hash:unknown)=>typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))
      || new Set(history).size !== history.length || history.includes(evidence.candidateWasmSha256))
    throw Error('Successor WASM must be new and its predecessor artifact/history unchanged');
  return { previousReceiptSha256: review.previousReceiptSha256 as string,
    previousResourcesSha256:review.previousResourcesSha256 as string, previousReportSha256:review.previousReportSha256 as string,
    previousGuardExitSha256:review.previousGuardExitSha256 as string,
    candidateWasmSha256: evidence.candidateWasmSha256, candidateHistorySha256:[...history, evidence.candidateWasmSha256] };
}

/** Exclusive consumption is keyed by stopped history and (if any) predecessor. */
export function consumeResourceReview(receiptPath: string, receipt: unknown) {
  const fd = openSync(receiptPath, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(receipt, null, 2) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
  // Keep even a partially written receipt after failure: consumption fails closed.
}

export function deliverOpt10Input(input: NodeJS.WritableStream, bytes: Buffer, stop: (reason:string)=>void) {
  input.on('error', error => stop(`Opt10 fixed input pipe failed: ${String(error)}`));
  try { input.end(bytes); }
  catch (error) { stop(`Opt10 fixed input pipe failed: ${String(error)}`); }
}

type Opt10ReviewEvidence = {
  baseline: Buffer; stoppedResources: Buffer; executableSha256: string; sourceSha256: Record<string,string>; snapshotSha256: string;
  previous?: { receipt: Buffer; resources: Buffer; exit: Buffer };
  proof?: Buffer; metadata?: Buffer; headerSha256?: string; payloadSha256?: string; headerSnapshotSha256?: string;
  inputSha256?: string; corpusSha256?: string;
};

function opt10Stage(policy: ReturnType<typeof researchPolicy>) {
  if (policy.backend === 'opt10-verify' && policy.mode === 'verify-opt1') return 'verify-opt1';
  if (policy.backend === 'opt10' && ['generate-opt10', 'solve-opt10'].includes(policy.mode)) return policy.mode;
  throw Error('Opt10 review permits only its fixed verification, generation and single-pass solve chain');
}

/** Separate, one-use Opt10 chain. Never clears or replaces the original stop. */
export function validateOpt10ResourceReview(review: any, evidence: Opt10ReviewEvidence,
    request: ReviewedRequest, current: MemoryObservation, used = false, newerStop = false) {
  const policy = researchPolicy(request.label, request.executable, request.args, request.env);
  const stage = opt10Stage(policy), index = opt10ReviewStages.indexOf(stage as typeof opt10ReviewStages[number]);
  const prior = JSON.parse(evidence.baseline.toString('utf8'));
  const failed = JSON.parse(evidence.stoppedResources.toString('utf8'));
  const sha = /^[a-f0-9]{64}$/;
  if (used || newerStop) throw Error('Opt10 stage was already consumed or a new stop blocks continuation');
  if (review?.schema !== 'cuberoot.opt10.resource-review.v1' || review.scope !== opt10ReviewScope
      || review.stage !== stage || review.stoppedLabel !== 'opt10-generate-v1'
      || typeof review.reason !== 'string' || !review.reason.trim() || !Number.isFinite(Date.parse(review.reviewedAt))
      || review.baselineSha256 !== digest(evidence.baseline) || review.stoppedResourcesSha256 !== digest(evidence.stoppedResources)
      || review.nextLabel !== request.label || !/^[a-z0-9-]+$/.test(request.label) || request.label === review.stoppedLabel
      || review.commandSha256 !== resourceReviewCommandSha256(request.executable, request.args)
      || !sha.test(review.executableSha256 ?? '') || review.executableSha256 !== evidence.executableSha256
      || !sha.test(review.snapshotSha256 ?? '') || review.snapshotSha256 !== evidence.snapshotSha256
      || typeof prior.stopped !== 'string' || !prior.stopped || failed.stopped !== prior.stopped
      || failed.backend !== 'opt10' || failed.mode !== 'generate-opt10' || failed.tableBytes !== opt10FileBytes
      || failed.boot !== prior.boot || failed.swapouts !== prior.swapouts
      || typeof prior.boot !== 'string' || !prior.boot || !Number.isSafeInteger(prior.swapouts) || prior.swapouts < 0
      || review.boot !== prior.boot || review.swapouts !== prior.swapouts
      || current.boot !== prior.boot || current.swapouts !== prior.swapouts)
    throw Error('Opt10 review differs from the original stop, exact command, binary or boot/swap baseline');
  for (const name of opt10ReviewSources) {
    if (!sha.test(review.sourceSha256?.[name] ?? '') || review.sourceSha256[name] !== evidence.sourceSha256[name])
      throw Error(`Opt10 reviewed source changed: ${name}`);
  }
  if (current.pressure !== 1 || !Number.isSafeInteger(current.available) || current.available < policy.rssLimit + 3 * GiB)
    throw Error('Opt10 reviewed stage has insufficient memory or abnormal pressure');
  let previousReceipt: any, previousResources: any;
  if (index === 0) {
    if (review.previous !== undefined || evidence.previous !== undefined || review.proofSha256 !== undefined || review.metadataSha256 !== undefined)
      throw Error('Opt10 verification must begin a fresh single-use chain');
  } else {
    if (!evidence.previous || !review.previous) throw Error('Opt10 stage requires its successful predecessor');
    const p = evidence.previous;
    if (review.previous.receiptSha256 !== digest(p.receipt) || review.previous.resourcesSha256 !== digest(p.resources)
        || review.previous.exitSha256 !== digest(p.exit)) throw Error('Opt10 predecessor evidence changed');
    previousReceipt = JSON.parse(p.receipt.toString('utf8'));
    previousResources = JSON.parse(p.resources.toString('utf8'));
    const exit = JSON.parse(p.exit.toString('utf8'));
    const previousStage = opt10ReviewStages[index - 1];
    const previousEnv = previousStage === 'verify-opt1' ? {CUBEOPT_BACKEND:'opt10-verify',CUBEOPT_VARIANT:'1'} : {CUBEOPT_BACKEND:'opt10'};
    if (previousReceipt.schema !== 'cuberoot.opt10.resource-review-consumption.v1' || previousReceipt.scope !== opt10ReviewScope
        || previousReceipt.stage !== previousStage || previousReceipt.baselineSha256 !== review.baselineSha256
        || previousReceipt.stoppedResourcesSha256 !== review.stoppedResourcesSha256 || previousReceipt.stoppedLabel !== review.stoppedLabel
        || !/^[a-z0-9-]+$/.test(previousReceipt.label ?? '') || previousReceipt.label === request.label
        || previousReceipt.commandSha256 !== resourceReviewCommandSha256(previousReceipt.executable, previousReceipt.args)
        || previousReceipt.before?.boot !== current.boot || previousReceipt.before?.swapouts !== current.swapouts
        || previousReceipt.snapshotSha256 !== evidence.snapshotSha256
        || JSON.stringify(previousResources.opt10ReviewReceipt) !== JSON.stringify(previousReceipt)
        || exit.exitCode !== 0 || exit.signal !== null || !Number.isFinite(Date.parse(exit.finishedAt))
        || !Number.isFinite(Date.parse(previousResources.sampledAt)) || Date.parse(exit.finishedAt) < Date.parse(previousResources.sampledAt))
      throw Error('Opt10 predecessor did not finish successfully with the exact consumed receipt');
    const oldPolicy = researchPolicy(previousReceipt.label, previousReceipt.executable, previousReceipt.args, previousEnv);
    if (opt10Stage(oldPolicy) !== previousStage || previousResources.backend !== oldPolicy.backend
        || previousResources.entry !== oldPolicy.entry || previousResources.mode !== oldPolicy.mode
        || previousResources.variant !== oldPolicy.variant || previousResources.h !== oldPolicy.h
        || previousResources.rssLimit !== oldPolicy.rssLimit || previousResources.tableBytes !== oldPolicy.tableBytes
        || previousResources.boot !== current.boot || previousResources.swapouts !== current.swapouts
        || previousResources.pressure !== 1 || previousResources.stopped !== '' || previousResources.trigger !== null
        || !Number.isFinite(previousResources.peakRss) || previousResources.peakRss <= 0 || previousResources.peakRss > oldPolicy.rssLimit
        || !Number.isFinite(previousResources.minimumHeadroom) || previousResources.minimumHeadroom < 2 * GiB)
      throw Error('Opt10 predecessor resource protection did not remain intact');
    for (const name of opt10ReviewSources) if (previousReceipt.sourceSha256?.[name] !== evidence.sourceSha256[name])
      throw Error(`Opt10 source changed between stages: ${name}`);
  }
  if (index > 0) {
    if (!evidence.proof || review.proofSha256 !== digest(evidence.proof)) throw Error('Opt10 stage needs the exact new generator proof');
    const proof = JSON.parse(evidence.proof.toString('utf8'));
    validateOpt10GenerationProof(proof, evidence.sourceSha256, current);
    if (stage === 'generate-opt10' && JSON.stringify(proof.resources) !== JSON.stringify(previousResources))
      throw Error('Opt10 proof does not belong to the preceding verification');
    if (stage === 'solve-opt10' && review.proofSha256 !== previousReceipt.proofSha256)
      throw Error('Opt10 solve changed the generator proof');
  }
  if (stage === 'solve-opt10') {
    if (!evidence.metadata || review.metadataSha256 !== digest(evidence.metadata)
        || review.inputSha256 !== evidence.inputSha256 || !sha.test(review.inputSha256 ?? '')
        || review.corpusSha256 !== opt10CorpusSha256 || evidence.corpusSha256 !== opt10CorpusSha256
        || review.cases !== 100 || review.measuredPasses !== 1 || review.warmupCases !== 0 || review.threads !== 1
        || evidence.headerSnapshotSha256 !== evidence.snapshotSha256
        || request.env.CUBEOPT_MEASURE_RSS !== '1' || evidence.executableSha256 !== previousReceipt.executableSha256)
      throw Error('Opt10 solve requires the same generated build and exact single-pass WCA100 input');
    const metadata = JSON.parse(evidence.metadata.toString('utf8'));
    if (metadata.schema !== 'cuberoot.opt10.generation-metadata.v1' || metadata.binary?.path !== opt10Native
        || metadata.binary.sha256 !== evidence.executableSha256 || metadata.table?.path !== opt10Table
        || metadata.table.bytes !== opt10FileBytes || !sha.test(metadata.table.headerSha256 ?? '')
        || metadata.table.headerSha256 !== evidence.headerSha256 || !sha.test(metadata.table.payloadSha256 ?? '')
        || metadata.table.payloadSha256 !== evidence.payloadSha256 || metadata.generation?.exitCode !== 0
        || metadata.generation.completedDepth !== 12 || JSON.stringify(metadata.generation.resources) !== JSON.stringify(previousResources))
      throw Error('Opt10 solve requires the new completed table and successful generation provenance');
    for (const name of opt10ProofSources) if (metadata.sourceSha256?.[name] !== evidence.sourceSha256[name])
      throw Error(`Opt10 table provenance source changed: ${name}`);
  }
  return {stage, baselineSha256:review.baselineSha256, stoppedResourcesSha256:review.stoppedResourcesSha256,
    stoppedLabel:review.stoppedLabel, commandSha256:review.commandSha256, executableSha256:evidence.executableSha256,
    sourceSha256:evidence.sourceSha256, snapshotSha256:evidence.snapshotSha256, ...(review.previous ? {previous:review.previous} : {}),
    ...(index > 0 ? {proofSha256:review.proofSha256} : {}),
    ...(stage === 'solve-opt10' ? {metadataSha256:review.metadataSha256,inputSha256:review.inputSha256,corpusSha256:review.corpusSha256,
      cases:100,measuredPasses:1,warmupCases:0,threads:1} : {})};
}

export function resourceProtectionReasons(before: MemoryObservation, now: MemoryObservation, rss: number, rssLimit: number, headroom: number) {
  return [now.boot !== before.boot && 'boot changed', now.swapouts !== before.swapouts && 'Swapouts changed',
    now.pressure !== 1 && `memory pressure ${now.pressure}`, rss > rssLimit && `RSS ${rss} > ${rssLimit}`,
    headroom < 2 * GiB && `headroom ${headroom} < ${2 * GiB}`].filter((reason): reason is string => !!reason);
}

/** Pure protocol validation. Tests never need to observe memory or open a PDB. */
export function researchPolicy(label: string, executable: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
if (env.CUBEOPT_BACKEND === 'corner' || executable === cornerExecutable)
  return cornerResearchPolicy(label, executable, args, env);
if (env.CUBEOPT_OPT10_CURRENT_REVIEW !== undefined)
  return currentPolicy({label,executable,args,env});
if (env.CUBEOPT_PLL_REVIEW !== undefined)
  return pllPolicy({label,executable,args,env});
if (env.CUBEOPT_LLL_FIVE_REVIEW !== undefined)
  return lllFivePolicy({label,executable,args,env});
if (env.CUBEOPT_ZBLL_MULTISOLUTION_REVIEW !== undefined)
  return zbllMultisolutionPolicy({label,executable,args,env});
if (env.CUBEOPT_OPT8_NATIVE_REVIEW !== undefined)
  return opt8NativePolicy({label,executable,args,env});
if (env.CUBEOPT_NXOPT_REVIEW !== undefined)
  return nxPolicy({label,executable,args,env});
if (env.CUBEOPT_BROWSER_REVIEW !== undefined)
  return browserPolicy({label,executable,args,env});
if (env.CUBEOPT_WASM_DUAL_CANDIDATE_REVIEW !== undefined)
  return dualCandidatePolicy({label,executable,args,env});
if (env.CUBEOPT_WASM_CANDIDATE_REVIEW !== undefined)
  return candidatePolicy({label,executable,args,env});
if (env.CUBEOPT_ORIGINAL_RESUME_REVIEW !== undefined)
  return resumePolicy({label,executable,args,env});
if (env.CUBEOPT_OPEN_BENCHMARK_REVIEW !== undefined)
  return openPolicy({label,executable,args,env});
// Daily statistics explicitly authorized on 2026-10-17. Reuse the exact release
// and historical resource review, never the ZBLL continuation/reset exception.
if (label === 'scramble-stats-opt10-session') {
  const policy = zbllOfficialPolicy({label:'double-zbll-opt10-batch',executable,args,env}, availableParallelism());
  return {...policy, deadlineMs:0};
}
if (env.CUBEOPT_ZBLL_REVIEW !== undefined && executable === officialPaths.executable)
  return zbllOfficialPolicy({label,executable,args,env}, availableParallelism());
if (env.CUBEOPT_OPT10_OFFICIAL_REVIEW !== undefined)
  return officialPolicy({label,executable,args,env}, availableParallelism());
if (env.CUBEOPT_MULTITHREAD_REVIEW !== undefined)
  return multithreadPolicy({label,executable,args,env}, availableParallelism());
const searchThreads = env.CUBEOPT_SEARCH_THREADS ?? '1';
if (!/^(?:[1-9]|1[0-6])$/.test(searchThreads) || Number(searchThreads) > availableParallelism())
  throw Error('Invalid CUBEOPT_SEARCH_THREADS: expected 1..16 within available CPUs');
if (searchThreads !== '1' && (Number(env.CUBEOPT_SOLVE_THREADS ?? '1') > 1
    || ![native, zbllNative].includes(resolve(executable))
    || !['solve', 'solve-h10', 'solve-h48'].includes(args[0])))
  throw Error('Single-scramble threads require a native solve with one batch worker; fixed reviewed runs remain single-threaded');
if (env.CUBEOPT_ZBLL_REVIEW !== undefined) {
  const threads = Number(env.CUBEOPT_SOLVE_THREADS);
  if (!/^double-zbll-opt10-[a-z0-9-]+$/.test(label) || executable !== opt10Native
      || env.CUBEOPT_BACKEND !== 'opt10' || env.CUBEOPT_OPT10_REVIEW !== undefined
      || env.CUBEOPT_RESOURCE_REVIEW !== undefined || env.CUBEOPT_VARIANT !== undefined || env.CUBEOPT_H !== undefined
      || env.CUBEOPT_BENCHMARK !== undefined || env.CUBEOPT_MEASURE_RSS !== undefined
      || env.CUBEOPT_ZBLL_REVIEW !== resolve(root, '.tmp/double-zbll-symmetry-v2/opt10-resource-review.json')
      || !Number.isInteger(threads) || threads < 1 || threads > availableParallelism()
      || String(threads) !== env.CUBEOPT_SOLVE_THREADS
      || JSON.stringify(args) !== JSON.stringify(['solve-opt10', opt10Small, opt10Table, '8', '20', '0']))
    throw Error('Opt10 ZBLL requires the exact reviewed solve-only entry and valid worker count');
  return {entry:'native',mode:'solve-opt10',backend:'opt10',variant:null,h:null,tablePath:opt10Table,
    tableBytes:opt10FileBytes,measureNativeRss:false,rssLimit:opt10PayloadBytes+GiB,deadlineMs:2*60*60_000,zbll:true};
}
if (env.CUBEOPT_BACKEND === 'opt10' || ['generate-opt10', 'solve-opt10'].includes(args[0]) || resolve(executable) === opt10Native) {
  const generation = args[0] === 'generate-opt10';
  if (!/^[a-z0-9-]+$/.test(label) || executable !== opt10Native || env.CUBEOPT_BACKEND !== 'opt10'
      || env.CUBEOPT_VARIANT !== undefined || env.CUBEOPT_H !== undefined || env.CUBEOPT_BENCHMARK !== undefined
      || ![undefined, '1'].includes(env.CUBEOPT_SOLVE_THREADS)
      || ![undefined, '0', '1'].includes(env.CUBEOPT_MEASURE_RSS)
      || args[1] !== opt10Small || args[2] !== opt10Table
      || (generation ? args.length !== 4 || args[3] !== '16' || env.CUBEOPT_MEASURE_RSS === '1'
        : args[0] !== 'solve-opt10' || args.length !== 6 || args[3] !== '8' || args[4] !== '20' || args[5] !== '0'))
    throw Error('Opt10 requires the dedicated binary, canonical Opt9 snapshot/new Opt10 table, explicit backend and fixed generation/solve arguments');
  return {entry:'native',mode:args[0],backend:'opt10',variant:null,h:null,tablePath:opt10Table,
    tableBytes:opt10FileBytes,measureNativeRss:env.CUBEOPT_MEASURE_RSS === '1',
    rssLimit:opt10PayloadBytes+GiB,deadlineMs:(generation?6:1)*60*60_000};
}
if (resolve(executable) === resolve(here, 'target/release/examples/verify_opt10_generation')) {
  const small = resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
  const table = resolve(root, '.tmp/cubeopt-reverse/opt1-generated/h48prun01.dat');
  if (!/^[a-z0-9-]+$/.test(label) || args.length !== 4 || args[0] !== '--verify-opt1'
      || executable !== resolve(here, 'target/release/examples/verify_opt10_generation')
      || args[1] !== small || args[2] !== table || args[3] !== '16'
      || env.CUBEOPT_BACKEND !== 'opt10-verify' || env.CUBEOPT_VARIANT !== '1'
      || env.CUBEOPT_H !== undefined || env.CUBEOPT_MEASURE_RSS !== undefined
      || env.CUBEOPT_BENCHMARK !== undefined || env.CUBEOPT_SOLVE_THREADS !== undefined)
    throw Error('Opt10 generator verification permits only the canonical Opt1 table, Opt9 small snapshot and sixteen threads');
  return {entry:'opt10-verify',mode:'verify-opt1',backend:'opt10-verify',variant:1,h:null,
    tablePath:null,tableBytes:30_401_280,measureNativeRss:false,rssLimit:512*MiB,deadlineMs:60*60_000};
}
if (executable === process.execPath && resolve(args[0] ?? '') === resolve(here, 'wasm-benchmark.mjs')) {
  const config = parseWasmBenchmarkArguments(args.slice(1));
  if (!/^[a-z0-9-]+$/.test(label) || env.CUBEOPT_BACKEND !== 'opt'
      || env.CUBEOPT_VARIANT !== String(config.variant) || env.CUBEOPT_H !== undefined
      || ![undefined, '1'].includes(env.CUBEOPT_SOLVE_THREADS)
      || env.CUBEOPT_MEASURE_RSS !== undefined || env.CUBEOPT_BENCHMARK !== undefined)
    throw Error('WASM comparison requires matching Opt8/9 and the fixed sequential WCA100 protocol');
  if (config.threads !== 1 && !(config.variant === 8 && config.threads === 4))
    throw Error('Only the production Opt8 comparison permits four WASM threads');
  const tableBytes = 30_401_280 * 2 ** config.variant;
  // Original WASM retains a table/16 frontier plus its fast-move allocation;
  // both workers run sequentially. Reserve another GiB for runtime and parent.
  return { entry:'wasm-benchmark.mjs', mode:'single-pass', backend:'opt', variant:config.variant,
    h:null, tablePath:null, tableBytes, measureNativeRss:false, wasmThreads:config.threads,
    rssLimit:tableBytes + tableBytes / 16 + 19_208_560 + GiB + (config.threads - 1) * 64 * MiB, deadlineMs:60*60_000 };
}
// User-authorized H9-only generation through the repository's sole generator.
if (resolve(executable) === resolve(root, 'solver/target/release/table_generator')) {
  if (!/^[a-z0-9-]+$/.test(label) || args.length !== 2 || args[0] !== '--only' || args[1] !== 'h48-h9'
      || env.CUBEOPT_BACKEND !== 'h9gen' || env.CUBEOPT_H !== undefined
      || env.CUBE_TABLE_DIR !== resolve(root, 'solver/tables') || env.RAYON_NUM_THREADS !== '16'
      || env.CUBEOPT_MEASURE_RSS !== undefined || env.CUBEOPT_BENCHMARK !== undefined)
    throw Error('Only guarded H9 generation with the canonical table directory and sixteen threads is authorized');
  return {entry:'generator',mode:'generate',backend:'h9gen',variant:null,h:9,tablePath:null,
    tableBytes:h48FileBytes(9),measureNativeRss:false,rssLimit:h48FileBytes(9)+2*GiB,deadlineMs:6*60*60_000};
}
if (!label || !/^[a-z0-9-]+$/.test(label) || !executable ||
    !([native, zbllNative].includes(resolve(executable)) || executable === process.execPath &&
      ['oracle.mjs', 'validate.mjs', 'benchmark.mjs', 'verify-coordinates.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs', 'zbll-benchmark.mjs'].includes(args[0]?.split('/').at(-1) ?? '') &&
      resolve(args[0]) === resolve(here, args[0]?.split('/').at(-1) ?? '')))
  throw Error('Use guard.mts LABEL <native-binary | node oracle.mjs | node validate.mjs | node benchmark.mjs> [args]');
const entry = [native, zbllNative].includes(resolve(executable)) ? 'native' : args[0].split('/').at(-1);
const mode = entry === 'native' ? args[0] : args[1];
const solveThreads = env.CUBEOPT_SOLVE_THREADS ?? '1';
if (!/^[1-9][0-9]*$/.test(solveThreads) || Number(solveThreads) > availableParallelism())
  throw Error('Invalid CUBEOPT_SOLVE_THREADS: exceeds available CPU threads');
const backend = env.CUBEOPT_BACKEND ?? 'opt';
if (!['opt', 'h10', 'h48'].includes(backend)) throw Error('CUBEOPT_BACKEND must be opt, h10 or h48');
const h48Entry = entry === 'native' && ['solve-h48', 'query-h48'].includes(mode);
const benchmarkMode = env.CUBEOPT_BENCHMARK ?? '0';
if (!['0', '1'].includes(benchmarkMode) || benchmarkMode === '1' && !(h48Entry && mode === 'solve-h48'))
  throw Error('CUBEOPT_BENCHMARK=1 is only supported for guarded native H48 solves');
// H11 has format support for inspection/tests only. No run-time override exists.
// Reject it before any file access, including requests using a renamed table.
if (env.CUBEOPT_H !== undefined && !/^(?:[0-9]|10)$/.test(env.CUBEOPT_H)
    || h48Entry && !/^(?:[0-9]|10)$/.test(args[1] ?? '')
    || entry === 'native' && /^(?:solve|query)-h11$/.test(mode))
  throw Error('H11 execution is prohibited; H48 research permits only canonical H0 through H10');
if ((backend === 'h48') !== h48Entry)
  throw Error('H48 entries require CUBEOPT_BACKEND=h48 and matching CUBEOPT_H=0..10');
if (backend !== 'h48' && env.CUBEOPT_H !== undefined)
  throw Error('CUBEOPT_H is only valid for CUBEOPT_BACKEND=h48');
const h10Entry = entry === 'native' ? ['solve-h10', 'query-h10'].includes(mode)
  : ['verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs', 'zbll-benchmark.mjs'].includes(entry ?? '');
// Reject mismatches before observing memory or spawning: an H10 query must
// never accidentally inherit the default 30 MB Opt1 budget.
if ((backend === 'h10') !== h10Entry) throw Error('H10 entries require CUBEOPT_BACKEND=h10; Opt entries require CUBEOPT_BACKEND=opt (default)');
let h: number | null = null;
let tablePath: string | null = null;
if (h48Entry) {
  if (env.CUBEOPT_H !== args[1]) throw Error('CUBEOPT_H must exactly match the native H48 argument');
  if (!args[2] || (mode === 'query-h48' ? args.length !== 3 : args.length < 3 || args.length > 6))
    throw Error('Use solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES] or query-h48 H TABLE');
  const option = (index: number, min: number, max: number, name: string) => {
    if (args[index] !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(args[index])
        || !Number.isSafeInteger(Number(args[index])) || Number(args[index]) < min || Number(args[index]) > max))
      throw Error(`Invalid H48 ${name}`);
  };
  option(3, 1, 8, 'contexts');
  if (args[3] !== undefined && !['1', '8'].includes(args[3])) throw Error('H48 contexts must be 1 or 8');
  option(4, 0, 20, 'max depth');
  option(5, 0, Number.MAX_SAFE_INTEGER, 'node budget');
  h = Number(args[1]);
  tablePath = resolve(args[2]);
}
if (entry === 'native' && backend === 'opt' && !['inspect', 'solve'].includes(mode))
  throw Error('Unknown Opt native entry');
const optText = env.CUBEOPT_VARIANT ?? '1';
if (backend === 'opt' && !/^[1-9]$/.test(optText)) throw Error('CUBEOPT_VARIANT must be an integer from 1 to 9');
const variant = backend === 'opt' ? Number(optText) : null;
const tableBytes = h === null ? backend === 'h10' ? 30_336_314_216 : 30_401_280 * 2 ** (variant === 1 ? 0 : variant!)
  : h48FileBytes(h);
const measureRssText = env.CUBEOPT_MEASURE_RSS ?? '0';
if (!['0', '1'].includes(measureRssText)) throw Error('CUBEOPT_MEASURE_RSS must be 0 or 1');
const measureNativeRss = measureRssText === '1';
if (measureNativeRss && entry !== 'native') throw Error('CUBEOPT_MEASURE_RSS=1 requires the allowed native executable directly');
// verify-h10 is a fixed coordinate-only harness: ~2 MB auxiliary reads and
// sampled 64-byte main-table rows; no mmap, full scan, or solver dispatch.
// validate-h10 has its own full-table budget below.
const small = entry === 'verify-h10.mjs' || backend === 'opt' &&
  (entry === 'verify-coordinates.mjs' || ['inspect', 'small', 'verify-small', 'query-small'].includes(mode));
// Private resident pages already reduce free+file-backed pages. Subtracting RSS
// again double-counts the table. A fixed observation reserve covers sampling lag;
// preflight separately reserves the full expected process-tree peak.
// Generation briefly copies the sorted frontier before freeing the old one.
const rssLimit = small ? 512 * MiB : mode === 'generate' ? Math.ceil(tableBytes * 18 / 16) + 768 * MiB
  : entry === 'h10-benchmark.mjs' ? tableBytes + GiB
  : entry === 'benchmark.mjs' ? tableBytes * (args.includes('--sequential') ? 1 : 2) + GiB : tableBytes + 768 * MiB;
const zbllBatch = entry === 'native' && resolve(executable) === zbllNative && backend === 'h10' && mode === 'solve-h10';
const deadlineMs = zbllBatch ? 2 * 60 * 60_000 : mode === 'generate' ? 6 * 60 * 60_000
  : benchmarkMode === '1' ? 60 * 60_000
  : ['benchmark.mjs', 'validate.mjs', 'h10-benchmark.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'zbll-benchmark.mjs'].includes(entry ?? '') ? 60 * 60_000 : 10 * 60_000;
return { entry, mode, backend, variant, h, tablePath, tableBytes, measureNativeRss,
  rssLimit:rssLimit + (Number(searchThreads) - 1) * 16 * MiB, deadlineMs, searchThreads:Number(searchThreads) };
}

export function h48FileBytes(h: number): number {
  if (!Number.isInteger(h) || h < 0 || h > 10) throw Error('H11 execution is prohibited; expected H0 through H10');
  return 64 * Math.ceil((3393 * 34650 * 2 ** h) / 254) + 2_060_648;
}

/** Small, complete proof for the current generator; never reads or allocates a PDB. */
export function validateOpt10GenerationProof(proof: any, sourceHashes: Record<string,string>, current?: {boot:string;swapouts:number}) {
  const result = proof?.result, resource = proof?.resources;
  if (proof?.schema !== 'cuberoot.opt10.generation-proof.v1' || proof.exitCode !== 0
      || result?.schema !== 'cuberoot.opt10.opt1-generation-validation.v1' || result.sharedGenerator !== true
      || result.projectionEoBits !== 0 || result.base !== 7 || result.completedDepth !== 9 || result.threads !== 16
      || result.comparedValidCells !== 117_567_450 || result.differences !== 0 || result.allEqual !== true || result.tableWritten !== false
      || !Array.isArray(result.distribution) || result.distribution.length !== 11
      || result.distribution.some((n: unknown) => !Number.isSafeInteger(n) || Number(n) < 0)
      || result.distribution.reduce((sum:number,n:number)=>sum+n,0) !== 117_567_450
      || resource?.backend !== 'opt10-verify' || resource.variant !== 1 || resource.mode !== 'verify-opt1'
      || resource.stopped !== '' || resource.pressure !== 1 || typeof resource.boot !== 'string'
      || !Number.isSafeInteger(resource.swapouts) || resource.swapouts < 0
      || !Number.isFinite(resource.peakRss) || resource.peakRss <= 0 || resource.peakRss > 512*MiB
      || !Number.isFinite(resource.minimumHeadroom) || resource.minimumHeadroom < 2*GiB)
    throw Error('Opt10 requires a successful full Opt1 generator validation with zero differences and intact resource protection');
  for (const name of opt10ProofSources) {
    if (!/^[a-f0-9]{64}$/.test(proof.sourceSha256?.[name] ?? '') || proof.sourceSha256[name] !== sourceHashes[name])
      throw Error(`Opt10 generator changed since its full Opt1 validation: ${name}`);
  }
  if (current && (resource.boot !== current.boot || resource.swapouts !== current.swapouts))
    throw Error('Opt10 validation boot/swap baseline changed; cannot reset');
}

/** Fixed-size header validation rejects a renamed H/Opt table before mapping. */
export function validateOpt10Metadata(fileBytes: number, header: Buffer, snapshotSha256: string) {
  if (fileBytes !== opt10FileBytes || header.length !== 1024)
    throw Error(`Opt10 requires exactly ${opt10FileBytes} file bytes and a 1024-byte header`);
  const u32 = (at:number) => header.readUInt32LE(at), u64 = (at:number) => header.readBigUInt64LE(at);
  const validEntries = BigInt(3393*70*495*1024);
  if (!header.subarray(0,16).equals(Buffer.from('CBRT-OPT10-PDB\0\0'))
      || u32(16)!==1 || u32(20)!==1024 || u32(24)!==10 || u32(28)!==1
      || u64(32)!==BigInt(opt10PayloadBytes)*4n || u64(40)!==validEntries || u64(48)!==BigInt(opt10PayloadBytes)
      || header[56]!==10 || header[57]!==13 || header[58]<12 || header[58]>20 || header[59]!==1 || u64(64)!==818008n
      || header.subarray(72,104).toString('hex')!==snapshotSha256
      || digest(header.subarray(0,992))!==header.subarray(992).toString('hex')
      || [...header.subarray(60,64),...header.subarray(136,160),...header.subarray(288,992)].some(n=>n!==0))
    throw Error('Opt10 header does not match its completed EO10 format or snapshot');
  const distribution = Array.from({length:16},(_,index)=>u64(160+index*8));
  if (distribution.reduce((sum,n)=>sum+n,0n)!==validEntries || distribution.slice(14).some(n=>n!==0n))
    throw Error('Opt10 header has invalid distribution coverage');
  return fileBytes;
}

/** Main-header/size check prevents a renamed H11 or mismatched H table using a smaller budget. */
export function validateH48Metadata(h: number, fileBytes: number, header: Buffer): number {
  const expected = h48FileBytes(h);
  const mainBytes = expected - 2_060_648;
  if (fileBytes !== expected || header.length !== 512) throw Error(`H${h} requires exactly ${expected} file bytes and a 512-byte main header`);
  const entries = 3393 * 34650 * 2 ** h;
  const integer = (offset: number) => header.readBigUInt64LE(offset);
  const name = Buffer.alloc(100);
  name.write(`h48 solver h =${String(h).padStart(2, ' ')}`);
  if (header[324] !== h || header[325] !== 2 || header[326] !== (h < 4 ? 8 : h < 8 ? 9 : 10)
      || header[327] !== 3 || !header.subarray(224, 324).equals(name)
      || integer(168) !== 0n || integer(176) !== 512n || integer(184) !== BigInt(mainBytes + 512)
      || integer(200) !== BigInt(entries + 2 * (mainBytes / 64)) || integer(216) !== BigInt(mainBytes + 512))
    throw Error(`H${h} main header does not match its guarded 2-bit format`);
  return fileBytes;
}

async function main() {
const [label, executable, ...args] = process.argv.slice(2);
const policy = researchPolicy(label, executable, args);
const openBenchmark = 'openBenchmark' in policy && policy.openBenchmark === true;
const originalResume = 'originalResume' in policy && policy.originalResume === true;
const wasmCandidate = 'wasmCandidate' in policy && policy.wasmCandidate === true;
const dualWasmCandidate = 'dualWasmCandidate' in policy && policy.dualWasmCandidate === true;
const browserBenchmark = 'browserBenchmark' in policy && policy.browserBenchmark === true;
const opt8NativeBenchmark = 'opt8NativeBenchmark' in policy && policy.opt8NativeBenchmark === true;
const opt10CurrentBenchmark = 'opt10CurrentBenchmark' in policy && policy.opt10CurrentBenchmark === true;
const lllFive = 'lllFive' in policy && policy.lllFive === true;
const pllSample = 'pllSample' in policy && policy.pllSample === true;
const zbllMultisolution = pllSample || lllFive || 'zbllMultisolution' in policy && policy.zbllMultisolution === true;
const nxoptBenchmark = 'nxoptBenchmark' in policy && policy.nxoptBenchmark === true;
const dualScopeStopPath = 'scopeStopPath' in policy ? policy.scopeStopPath : undefined;
if ((dualWasmCandidate || browserBenchmark || opt10CurrentBenchmark || zbllMultisolution) && typeof dualScopeStopPath !== 'string') throw Error('Missing fixed candidate scope stop path');
const validateBenchmarkReview = pllSample ? validatePllReview : lllFive ? validateLllFiveReview : zbllMultisolution ? validateZbllMultisolutionReview : opt10CurrentBenchmark ? validateCurrentReview : opt8NativeBenchmark ? validateOpt8NativeReview : nxoptBenchmark ? validateNxReview : browserBenchmark ? validateBrowserReview : dualWasmCandidate ? validateDualCandidateReview : wasmCandidate ? validateCandidateReview : originalResume ? validateResumeReview : validateOpenReview;
let openBenchmarkReceipt: any;
const { entry, mode, backend, variant, h, tablePath, measureNativeRss, rssLimit, deadlineMs } = policy;
// Only the fixed, reviewed candidate policy may select a different startup reserve.
// Runtime headroom protection remains 2 GiB in resourceProtectionReasons.
const startupReserveBytes = 'startupReserveBytes' in policy ? policy.startupReserveBytes : 3 * GiB;
const reviewPath = process.env.CUBEOPT_RESOURCE_REVIEW;
if (reviewPath && lstatSync(reviewPath).size > 256 * 1024) throw Error('Review is not bounded');
const localOpt8 = Boolean(reviewPath && JSON.parse(readFileSync(reviewPath).toString()).scope === localOpt8Scope);
const opt10ReviewPath = process.env.CUBEOPT_OPT10_REVIEW;
const multithreadReviewPath = process.env.CUBEOPT_MULTITHREAD_REVIEW;
const officialReviewPath = process.env.CUBEOPT_OPT10_OFFICIAL_REVIEW;
const official = 'official' in policy && policy.official === true;
const multithread = 'multithread' in policy && policy.multithread === true;
const zbll = 'zbll' in policy && policy.zbll === true;
const zbllOfficial = 'zbllOfficial' in policy && policy.zbllOfficial === true;
const isOpt10Stage = !zbll && !multithread && !official && (backend === 'opt10' || backend === 'opt10-verify');
if (isOpt10Stage !== Boolean(opt10ReviewPath) || (opt10ReviewPath && reviewPath))
  throw Error('Opt10 execution requires its separate explicit stage review; other backends cannot use it');
if (reviewPath !== undefined && (!reviewPath || entry !== 'wasm-benchmark.mjs' || ![8,9].includes(variant!)
    || (!localOpt8 && parseWasmBenchmarkArguments(args.slice(1)).engine !== 'both')))
  throw Error('Resource review permits only the exact WASM WCA100 comparison with both engines');
let { tableBytes } = policy;
let generationProof: any;
let opt10HeaderSha256: string | undefined, opt10PayloadSha256: string | undefined, opt10HeaderSnapshotSha256: string | undefined;
let opt10SolveInput: Buffer | undefined;
if (backend === 'opt10') {
  // Normalize the paths validated in the caller's cwd before spawning at root.
  args[1] = opt10Small; args[2] = opt10Table;
  if (!lstatSync(opt10Small).isFile() || lstatSync(opt10Small).size !== 818_008)
    throw Error('Opt10 requires its canonical regular 818008-byte Opt9 snapshot');
  if (!zbll && !multithread && !official) {
    const sourceHashes = Object.fromEntries(opt10ProofSources.map(name=>[name,digest(readFileSync(resolve(here,name)))]));
    generationProof = JSON.parse(readFileSync(opt10Proof,'utf8'));
    validateOpt10GenerationProof(generationProof,sourceHashes);
  }
  if (mode === 'generate-opt10') {
    if (existsSync(opt10Table) || existsSync(opt10Table+'.partial'))
      throw Error('Opt10 output or partial already exists; refusing to overwrite');
  } else {
    if (!lstatSync(opt10Table).isFile()) throw Error('Opt10 table must be a regular file, not a symlink');
    const fd = openSync(opt10Table,'r');
    try {
      const header = Buffer.alloc(1024);
      if (readSync(fd,header,0,header.length,0)!==1024) throw Error('Truncated Opt10 header');
      tableBytes = validateOpt10Metadata(fstatSync(fd).size,header,digest(readFileSync(opt10Small)));
      opt10HeaderSha256 = digest(header); opt10PayloadSha256 = header.subarray(104,136).toString('hex');
      opt10HeaderSnapshotSha256 = header.subarray(72,104).toString('hex');
    } finally { closeSync(fd); }
  }
}
if (tablePath !== null && h !== null) {
  // The child runs at repo root, so pass the exact path checked in the caller's
  // directory rather than interpreting a relative table path a second time.
  args[2] = tablePath;
  const fd = openSync(tablePath, 'r');
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size !== tableBytes) throw Error(`H${h} requires a regular file of exactly ${tableBytes} bytes`);
    const header = Buffer.alloc(512);
    if (readSync(fd, header, 0, header.length, 1_120_256) !== header.length) throw Error('Truncated H48 main header');
    tableBytes = validateH48Metadata(h, info.size, header);
  } finally { closeSync(fd); }
}
if (process.platform !== 'darwin') throw Error('This resource guard requires macOS');
const observationReserve = 256 * MiB;
const output = resolve(root, '.tmp/cubeopt-reverse');
mkdirSync(output, { recursive: true });
if (backend === 'corner' && ['-resources.json', '-started.json'].some(suffix => existsSync(resolve(output, label + suffix))))
  throw Error('This corner-research label already has resource evidence; use a new label to resume the same checkpoint');
const record = resolve(root, '.tmp/h48-corners-research/resource-baseline.json');
const ownRecord = resolve(output, 'resource-baseline.json');
const lockPath = resolve(output, 'compute.lock');
const reviewedStopPath = resolve(output, 'resource-review-stop.json');
const opt10ReviewedStopPath = resolve(output, 'opt10-resource-review-stop.json');
const atomic = (path: string, value: unknown) => { writeFileSync(path + '.new', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.new', path); };
const readSmallRecord = (path: string, maximumBytes = 64 * 1024) => {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > maximumBytes) throw Error('Resource review requires bounded regular records or WASM artifacts');
    return readFileSync(fd);
  } finally { closeSync(fd); }
};
const command = (exe: string, argv: string[] = []) => execFileSync(exe, argv, { encoding: 'utf8', timeout: 3000 });
function memory() {
  const vm = parseVm(command('/usr/bin/vm_stat'));
  const summary = memorySummary(vm);
  if (!summary || !Number.isSafeInteger(vm.pages.Swapouts) || vm.pages.Swapouts < 0 ||
      !Number.isSafeInteger(summary.reclaimableEstimateBytes) || summary.reclaimableEstimateBytes < 0)
    throw Error('Missing or invalid memory observation');
  return { boot: command('/usr/sbin/sysctl', ['-n', 'kern.boottime']).trim(), swapouts: vm.pages.Swapouts,
    pressure: Number(command('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']).trim()), available: summary.reclaimableEstimateBytes };
}
let before = memory();
const cornerSession = backend === 'corner' ? readCornerSession(before) : undefined;
const statsResume = label === 'scramble-stats-opt10-session' ? beginStatsRun(before) : undefined;
const zbllResume = zbllOfficial && label === 'double-zbll-opt10-session' ? readResumeReview(before) : undefined;
if (generationProof) {
  const sourceHashes = Object.fromEntries(opt10ProofSources.map(name=>[name,digest(readFileSync(resolve(here,name)))]));
  validateOpt10GenerationProof(generationProof,sourceHashes,before);
}
if (process.env.AUF_EXPECTED_BOOT !== undefined && (process.env.AUF_EXPECTED_BOOT !== before.boot || Number(process.env.AUF_EXPECTED_SWAPOUTS) !== before.swapouts))
  throw Error('Long-job boot/swap baseline changed; cannot reset');
const otherComputations = command('/bin/ps', ['-axo', 'pid,comm']).split('\n')
  .filter(line => /solve_h48_h10|cube48opt-research|corner-research|table_generator|nxopt\d+/.test(line));
if (otherComputations.length) throw Error('Another native computation is running: ' + otherComputations.join('; '));
if (!openBenchmark && !zbllResume && !statsResume && !cornerSession && (existsSync(reviewedStopPath) || existsSync(opt10ReviewedStopPath) || existsSync(officialPaths.stop)
    || (existsSync(multithreadPaths.stop) && !multithreadReviewPath && !official && !zbllOfficial && !localOpt8))) throw Error('A newer reviewed computation stopped; further execution requires review');
let reviewReceipt: any;
let opt10ReviewReceipt: any;
let multithreadReviewReceipt: any;
let officialReviewReceipt: any;
const officialReviewBytes = officialReviewPath ? readSmallRecord(officialReviewPath,256*1024) : undefined;
const officialReview = officialReviewBytes ? JSON.parse(officialReviewBytes.toString('utf8')) : undefined;
const reviewBytes = reviewPath ? readSmallRecord(resolve(reviewPath)) : undefined;
const review = reviewBytes ? JSON.parse(reviewBytes.toString('utf8')) : undefined;
const opt10ReviewBytes = opt10ReviewPath ? readSmallRecord(resolve(opt10ReviewPath)) : undefined;
const opt10Review = opt10ReviewBytes ? JSON.parse(opt10ReviewBytes.toString('utf8')) : undefined;
const multithreadReviewBytes = multithreadReviewPath ? readSmallRecord(multithreadReviewPath, 256*1024) : undefined;
const multithreadReview = multithreadReviewBytes ? JSON.parse(multithreadReviewBytes.toString('utf8')) : undefined;
if (mode === 'solve-opt10' && !zbll && !multithread && !official) {
  const corpus = readWca100();
  const expected = Buffer.from(corpus.cases.map(item => `${item.id}\t${item.scramble}\n`).join(''));
  opt10SolveInput = readSmallRecord(opt10Input);
  if (corpus.corpusSha256 !== opt10CorpusSha256 || corpus.cases.length !== 100 || !expected.equals(opt10SolveInput))
    throw Error('Opt10 solve input is not exactly the original fixed WCA first 100');
}
function checkZbllReview(current: MemoryObservation) {
  if (!zbll) return;
  if (statsResume) {
    validateStatsRun(statsResume,current);
    const original=JSON.parse(readSmallRecord(process.env.CUBEOPT_ZBLL_REVIEW!).toString());
    const identity=validateZbllOfficialReview(original,collectOfficialEvidence(),{...current,boot:original.boot,swapouts:original.swapouts},false);
    return {...identity,statsRunDirectory:statsResume.directory,acceptedSwapouts:statsResume.swapouts};
  }
  if (zbllResume) {
    const resumed=readResumeReview(current)!;
    const original=JSON.parse(readSmallRecord(process.env.CUBEOPT_ZBLL_REVIEW!).toString());
    // Validate the original release against its historical observation; the
    // explicit continuation separately validates today's unchanged counter.
    const identity=validateZbllOfficialReview(original,collectOfficialEvidence(),
      {...current,boot:original.boot,swapouts:original.swapouts},false);
    return {...identity,resumeReviewSha256:resumed.sha256,originalSwapouts:resumed.originalSwapouts,acceptedSwapouts:resumed.acceptedSwapouts};
  }
  if (zbllOfficial) return validateZbllOfficialReview(
    JSON.parse(readSmallRecord(process.env.CUBEOPT_ZBLL_REVIEW!).toString()),collectOfficialEvidence(),current,officialHasStop());
  const fd = openSync(opt10Table, 'r'), header = Buffer.alloc(1024);
  try { if (readSync(fd,header,0,1024,0) !== 1024) throw Error('Truncated Opt10 header'); } finally { closeSync(fd); }
  return validateOpt10BatchReview(JSON.parse(readSmallRecord(process.env.CUBEOPT_ZBLL_REVIEW!).toString()), {
    baseline: readSmallRecord(ownRecord), report: readSmallRecord(resolve(output,'wca100-rust-opt10-single-report.json'), 2*MiB),
    exit: readSmallRecord(resolve(output,'wca100-rust-opt10-single-exit.json')),
    binary: readSmallRecord(executable,64*MiB), small: readSmallRecord(opt10Small,818_008), header,
  }, current);
}
function checkBaselines(current: MemoryObservation) {
  if (cornerSession) { readCornerSession(current); return; }
  if (statsResume) { validateStatsRun(statsResume,current); return; }
  if (zbllResume) { readResumeReview(current); return; }
  if (openBenchmark) {
    validateBenchmarkReview({label,executable,args,env:process.env},current);
    return;
  }
  for (const file of [record, ownRecord]) if (existsSync(file)) {
    const prior = JSON.parse(readFileSync(file, 'utf8'));
    if (prior.boot !== current.boot || prior.swapouts !== current.swapouts || prior.stopped && !(file === ownRecord && (review || opt10Review || zbll || multithreadReview || officialReview)))
      throw Error(`Prior resource baseline requires review: ${file}`);
  }
}
function checkOfficialReview(current: MemoryObservation) {
  if (!officialReview) return;
  const receiptPath=resolve(officialPaths.receipts,`${label}.json`);
  const evidence=collectOfficialEvidence();
  const identity=validateOfficialReview(officialReview,evidence,{label,executable,args,env:process.env},current,
    existsSync(receiptPath),officialHasStop());
  if (['-resources.json','-exit.json'].some(suffix=>existsSync(resolve(output,label+suffix))))
    throw Error('Official label already has execution evidence');
  opt10SolveInput=evidence.inputBytes;
  return {receiptPath,identity};
}
function checkMultithreadReview(current: MemoryObservation) {
  if (!multithreadReview) return;
  const request = {label,executable,args,env:process.env};
  const evidence = collectMultithreadEvidence(request);
  const kind = entry === 'native' ? backend === 'h48' ? `native-h${h}` : `native-opt${variant ?? 10}` : `wasm-opt${variant}`;
  // Each authorized native candidate consumes one fixed receipt, regardless
  // of review formatting or a later rebuild. Failures cannot be retried.
  const suffix = evidence.policy.experiment ? `-experiment-${evidence.policy.experiment}`
    : evidence.policy.opt10Experiment ? `-opt10-experiment-${evidence.policy.opt10Experiment}`
    : (multithreadReview.repair || multithreadReview.continuation) ? '-' + digest(multithreadReviewBytes!) : '';
  const receiptPath = resolve(multithreadPaths.receipts, `${evidence.baseline.sha256}-${kind}${suffix}.json`);
  const identity = validateMultithreadReview(multithreadReview,evidence,request,current,existsSync(receiptPath),
    existsSync(reviewedStopPath) || existsSync(opt10ReviewedStopPath) || existsSync(multithreadPaths.stop));
  if (existsSync(resolve(output,`${label}-resources.json`)) || existsSync(resolve(output,`${label}-exit.json`)))
    throw Error('Multithread label already has execution evidence');
  if (evidence.policy.wasmConfig && existsSync(evidence.policy.wasmConfig.out))
    throw Error('WASM multithread output directory already exists');
  if (entry === 'native') opt10SolveInput = evidence.inputBytes;
  return {receiptPath,identity};
}
function checkOpt10Review(current: MemoryObservation) {
  if (!opt10Review) return;
  const stage = opt10Stage(policy), stageIndex = opt10ReviewStages.indexOf(stage as typeof opt10ReviewStages[number]);
  const baselineBytes = readSmallRecord(ownRecord), baselineHash = digest(baselineBytes);
  const receipts = resolve(output, 'opt10-review-receipts');
  const receiptPath = resolve(receipts, `${baselineHash}-${stage}.json`);
  let previous: Opt10ReviewEvidence['previous'];
  if (stageIndex > 0) {
    const receipt = readSmallRecord(resolve(receipts, `${baselineHash}-${opt10ReviewStages[stageIndex - 1]}.json`));
    const parsed = JSON.parse(receipt.toString('utf8'));
    if (!/^[a-z0-9-]+$/.test(parsed.label ?? '')) throw Error('Invalid Opt10 predecessor label');
    previous = {receipt,resources:readSmallRecord(resolve(output, `${parsed.label}-resources.json`)),
      exit:readSmallRecord(resolve(output, `${parsed.label}-exit.json`))};
  }
  const identity = validateOpt10ResourceReview(opt10Review, {
    baseline:baselineBytes, stoppedResources:readSmallRecord(resolve(output, 'opt10-generate-v1-resources.json')),
    executableSha256:digest(readSmallRecord(resolve(executable),64*MiB)),
    sourceSha256:Object.fromEntries(opt10ReviewSources.map(name=>[name,digest(readSmallRecord(resolve(here,name),4*MiB))])),
    snapshotSha256:digest(readSmallRecord(opt10Small,818_008)),
    previous, ...(stageIndex > 0 ? {proof:readSmallRecord(opt10Proof)} : {}),
    ...(stage === 'solve-opt10' ? {metadata:readSmallRecord(opt10Metadata),headerSha256:opt10HeaderSha256,
      payloadSha256:opt10PayloadSha256,headerSnapshotSha256:opt10HeaderSnapshotSha256,
      inputSha256:digest(opt10SolveInput!),corpusSha256:opt10CorpusSha256} : {}),
  }, {label,executable,args,env:process.env}, current, existsSync(receiptPath),
    existsSync(reviewedStopPath) || existsSync(opt10ReviewedStopPath));
  if (existsSync(resolve(output,`${label}-resources.json`)) || existsSync(resolve(output,`${label}-exit.json`)))
    throw Error('Opt10 stage label already has execution evidence');
  return {receipts,receiptPath,identity};
}
function checkReview(current: MemoryObservation) {
  if (!review) return;
  if (!/^[a-z0-9-]+$/.test(review.stoppedLabel ?? '')) throw Error('Invalid reviewed stopped label');
  const baselineBytes = readSmallRecord(ownRecord);
  const receipts = resolve(output, 'resource-review-receipts');
  if (localOpt8) {
    const receiptPath = resolve(receipts, 'opt8-local-' + label + '.json');
    const identity = validateLocalOpt8Review(review,{label,executable,args,env:process.env},current,existsSync(receiptPath));
    return {receipts,receiptPath,identity};
  }
  const successor = review.schema === 'cuberoot.resource-review.v2';
  if (successor && (!/^[a-f0-9]{64}(?:-[a-f0-9]{64})?\.json$/.test(review.previousReceipt ?? '')
      || !/^[a-f0-9]{64}$/.test(review.previousReceiptSha256 ?? '')))
    throw Error('Successor review requires a canonical consumed receipt and its SHA-256');
  const receiptPath = resolve(receipts, `${digest(baselineBytes)}${review.scope === productionResourceReviewScope ? '-opt8-production' : successor ? `-${review.previousReceiptSha256}` : ''}.json`);
  const identity = validateResourceReview(review, baselineBytes,
    readSmallRecord(resolve(output, `${review.stoppedLabel}-resources.json`)),
    { label, executable, args, env: process.env }, current,
    existsSync(receiptPath), existsSync(reviewedStopPath));
  let predecessor;
  if (successor) {
    const previousBytes = readSmallRecord(resolve(receipts, review.previousReceipt));
    const previous = JSON.parse(previousBytes.toString('utf8'));
    if (!/^[a-z0-9-]+$/.test(previous.label ?? '')) throw Error('Invalid predecessor label');
    const previousConfig = parseWasmBenchmarkArguments(previous.args.slice(1));
    const newConfig = parseWasmBenchmarkArguments(args.slice(1));
    predecessor = validateSuccessfulPredecessor(review, {
      receipt:previousBytes, resources:readSmallRecord(resolve(output, `${previous.label}-resources.json`)),
      report:readSmallRecord(resolve(previousConfig.out, 'report.json')),
      exit:readSmallRecord(resolve(previousConfig.out, 'guard-exit.json')),
      previousWasmSha256:digest(readSmallRecord(previousConfig.wasm, 4 * MiB)),
      candidateWasmSha256:digest(readSmallRecord(newConfig.wasm, 4 * MiB)),
    }, { label, executable, args, env:process.env });
  }
  if (existsSync(resolve(output, `${label}-resources.json`))) throw Error('Reviewed run label already has resource results');
  return { receipts, receiptPath, identity:{...identity, ...predecessor} };
}
checkBaselines(before);
const zbllReviewReceipt = checkZbllReview(before);
checkReview(before);
checkOpt10Review(before);
checkMultithreadReview(before);
checkOfficialReview(before);
if (before.pressure !== 1 || before.available < rssLimit + startupReserveBytes)
  throw Error(`Insufficient memory headroom: ${backend === 'corner' ? 'corner96' : backend === 'h48' ? `h${h}` : backend === 'h10' ? 'h10' : `opt${variant}`} ${entry}/${mode} requires ${rssLimit + startupReserveBytes} bytes; observed ${before.available}`);
// An abandoned lock requires explicit inspection; never erase it to auto-restart.
const lock = openSync(lockPath, 'wx');
writeFileSync(lock, JSON.stringify({ pid: process.pid, backend, variant, h, entry, mode, boot: before.boot,
  ...('wasmThreads' in policy ? {wasmThreads:policy.wasmThreads} : {}) }));
closeSync(lock);
try {
  if (cornerSession) {
    before = memory();
    checkBaselines(before);
    consumeResourceReview(resolve(output, `${label}-started.json`), {
      schema: 'cuberoot.corner96-run.v1', label, executable, args, before,
      sessionSha256: cornerSession.sha256, executableSha256: digest(readSmallRecord(executable, 64 * MiB)),
      startedAt: new Date().toISOString(), guardPid: process.pid,
    });
  }
  if (openBenchmark) {
    before=memory();
    const checked=validateBenchmarkReview({label,executable,args,env:process.env},before);
    openBenchmarkReceipt=checked.receipt;
    consumeResourceReview(checked.receiptPath,openBenchmarkReceipt);
    if (entry==='native') opt10SolveInput=checked.input;
  }
  if (zbll) { before = memory(); checkBaselines(before); checkZbllReview(before); }
  if (review) {
    before = memory();
    checkBaselines(before);
    const checked = checkReview(before)!;
    mkdirSync(checked.receipts, { recursive: true });
    reviewReceipt = { schema:'cuberoot.resource-review-consumption.v1', ...checked.identity,
      reviewSha256:digest(reviewBytes!), reviewPath:resolve(reviewPath!), stoppedLabel:review.stoppedLabel,
      stoppedResourcesSha256:review.stoppedResourcesSha256, label, executable, args, before,
      consumedAt:new Date().toISOString(), pid:process.pid };
    consumeResourceReview(checked.receiptPath, reviewReceipt);
  }
  if (opt10Review) {
    before = memory();
    checkBaselines(before);
    const checked = checkOpt10Review(before)!;
    mkdirSync(checked.receipts, {recursive:true});
    opt10ReviewReceipt = {schema:'cuberoot.opt10.resource-review-consumption.v1',scope:opt10ReviewScope,
      ...checked.identity,reviewSha256:digest(opt10ReviewBytes!),reviewPath:resolve(opt10ReviewPath!),
      label,executable,args,before,consumedAt:new Date().toISOString(),pid:process.pid};
    consumeResourceReview(checked.receiptPath,opt10ReviewReceipt);
  }
  if (multithreadReview) {
    before = memory(); checkBaselines(before);
    const checked = checkMultithreadReview(before)!;
    mkdirSync(multithreadPaths.receipts, {recursive:true});
    multithreadReviewReceipt = {...checked.identity,schema:'cuberoot.multithread-wca100-consumption.v1',scope:checked.identity.scope,
      reviewSha256:digest(multithreadReviewBytes!),reviewPath:multithreadReviewPath!,before,
      consumedAt:new Date().toISOString(),pid:process.pid};
    consumeResourceReview(checked.receiptPath,multithreadReviewReceipt);
  }
  if (officialReview) {
    before=memory();checkBaselines(before);
    const checked=checkOfficialReview(before)!;
    mkdirSync(officialPaths.receipts,{recursive:true});
    officialReviewReceipt={...checked.identity,schema:'cuberoot.opt10-official-consumption.v1',scope:officialScope,
      reviewPath:officialReviewPath,reviewSha256:digest(officialReviewBytes!),before,consumedAt:new Date().toISOString(),pid:process.pid};
    consumeResourceReview(checked.receiptPath,officialReviewReceipt);
  }
  if (!existsSync(ownRecord)) atomic(ownRecord, before);
} catch (error) { unlinkSync(lockPath); throw error; }
let peakRss = 0, minimumHeadroom = before.available, stopped = '';
let trigger: any = null;
let forceKill: ReturnType<typeof setTimeout> | undefined;
// Only wrap the already validated native executable. time writes its child
// rusage to inherited stderr; it and the native remain in the guarded group.
const child = spawn(measureNativeRss ? '/usr/bin/time' : executable,
  measureNativeRss ? ['-l', executable, ...args] : args,
  { cwd: root, detached: true, stdio: opt10SolveInput ? ['pipe','inherit','inherit'] : 'inherit',
    ...(backend === 'corner' ? {env: {...process.env, CUBEOPT_CORNER_GUARDED: '1'}} : {}) });
// The reviewed solve receives only the already checked bytes, never extra
// caller-provided cases or a second pass on inherited standard input.
if (opt10SolveInput) deliverOpt10Input(child.stdin!, opt10SolveInput, stop);
const closed = new Promise<number>((ok, no) => { child.on('error', no); child.on('close', code => ok(code ?? 1)); });
function stop(reason: string, protection = false, details?: unknown) {
  if (stopped) return;
  stopped = reason;
  try {
    if (protection || openBenchmark || opt10ReviewReceipt || multithreadReviewReceipt || officialReviewReceipt || localOpt8 || cornerSession) {
      trigger = { reason, sampledAt:new Date().toISOString(), details };
      // A reviewed run must never mutate the original stopped history.
      if ((multithreadReviewReceipt?.repair || multithreadReviewReceipt?.continuation) && existsSync(multithreadPaths.stop)) {
        const previous = readSmallRecord(multithreadPaths.stop);
        const archive = resolve(output, `multithread-stop-${digest(previous)}.json`);
        if (!existsSync(archive)) writeFileSync(archive, previous, {flag:'wx'});
      }
      atomic(cornerSession ? cornerSession.stopPath : statsResume ? statsResume.stopPath : zbllResume ? zbllResumeStopPath : dualWasmCandidate || browserBenchmark || nxoptBenchmark || opt8NativeBenchmark || opt10CurrentBenchmark || zbllMultisolution ? dualScopeStopPath as string : wasmCandidate ? candidateStopPath : originalResume ? resumeStopPath : openBenchmark ? openStopPath : officialReviewReceipt ? officialPaths.stop : multithreadReviewReceipt ? multithreadPaths.stop : opt10ReviewReceipt || zbll ? opt10ReviewedStopPath : reviewReceipt ? reviewedStopPath : ownRecord,
        { ...before, stopped: reason, trigger,
          ...(reviewReceipt ? { label, reviewReceipt } : {}), ...(opt10ReviewReceipt ? {label,opt10ReviewReceipt} : {}),
          ...(multithreadReviewReceipt ? {label,multithreadReviewReceipt} : {}),...(officialReviewReceipt ? {label,officialReviewReceipt} : {}) });
    }
  } catch (error) {
    console.error('Could not persist resource stop record:', error);
  } finally {
    // A disk/recording failure must never prevent the requested termination.
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      const pgid = -child.pid;
      forceKill = setTimeout(() => { try { process.kill(pgid, 'SIGKILL'); } catch {} }, 1500);
    }
  }
}
async function cleanProcessGroup() {
  if (!child.pid) return;
  const pgid = -child.pid;
  const alive = () => { try { process.kill(pgid, 0); return true; } catch { return false; } };
  if (!alive()) return;
  if (!stopped) {
    if (openBenchmark || multithreadReviewReceipt || officialReviewReceipt || localOpt8) stop('Child processes outlived the command');
    else stopped = 'Child processes outlived the command';
  }
  try { process.kill(pgid, 'SIGTERM'); } catch {}
  await new Promise(resolve => setTimeout(resolve, 1500));
  // A group can survive its leader. Do not use child.exitCode here and do not
  // release the research lock while a retained child may still be computing.
  if (alive()) { try { process.kill(pgid, 'SIGKILL'); } catch {} }
}
function sample() {
  try {
    if (zbllOfficial && label === 'double-zbll-opt10-session' && Date.now() >= Date.parse('2026-12-01T00:00:00Z'))
      stop('ZBLL task authorization expired', true);
    const now = memory();
    const all = parseProcesses(command('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm']));
    if (!all.some(p => p.pid === process.pid)) throw Error('Incomplete process observation');
    const family = new Set([process.pid]);
    for (let changed = true; changed;) {
      changed = false;
      for (const p of all) if (family.has(p.ppid) && !family.has(p.pid)) { family.add(p.pid); changed = true; }
    }
    const rss = all.reduce((n, p) => n + (family.has(p.pid) ? p.rssBytes : 0), 0);
    peakRss = Math.max(peakRss, rss);
    const headroom = now.available - observationReserve;
    minimumHeadroom = Math.min(minimumHeadroom, headroom);
    const reasons = resourceProtectionReasons(before, now, rss, rssLimit, headroom);
    if (reasons.length) stop(`Resource protection: ${reasons.join('; ')}`, true, { ...now, rss, rssLimit, headroom, reasons });
    atomic(statsResume ? resolve(statsResume.directory, "resources.json") : resolve(output, `${label}-resources.json`), { ...now, backend, variant, h, entry, mode, measureNativeRss, tableBytes, rssLimit, deadlineMs, peakRss, minimumHeadroom, stopped, trigger, reviewReceipt, opt10ReviewReceipt, zbllReviewReceipt, multithreadReviewReceipt, officialReviewReceipt, openBenchmarkReceipt, ...(cornerSession ? {guardPid:process.pid, childPid:child.pid, sessionSha256:cornerSession.sha256} : zbllMultisolution ? {guardPid:process.pid, childPid:child.pid, sessionSha256:openBenchmarkReceipt.reviewSha256} : {}), sampledAt: new Date().toISOString() });
  } catch (e) { stop(String(e), true, { observationError:String(e) }); }
}
const interval = setInterval(sample, 500);
const deadline = deadlineMs ? setTimeout(() => stop('Research deadline'), deadlineMs) : undefined;
process.on('SIGINT', () => stop('Interrupted'));
process.on('SIGTERM', () => stop('Interrupted'));
try {
  const status = await closed;
  if (openBenchmark && status !== 0) stop(`Benchmark child exited with status ${status}`);
  if (localOpt8 && status !== 0) stop(`Local Opt8 child exited with status ${status}`);
  if (opt10ReviewReceipt && status !== 0) stop(`Opt10 child exited with status ${status}`);
  if (multithreadReviewReceipt && status !== 0) stop(`Multithread child exited with status ${status}`);
  if (officialReviewReceipt && status !== 0) stop(`Official Opt10 child exited with status ${status}`);
  await cleanProcessGroup(); sample(); process.exitCode = stopped ? 1 : status;
} catch (error) {
  if (openBenchmark) stop(`Benchmark child failed: ${String(error)}`);
  if (opt10ReviewReceipt) stop(`Opt10 child failed: ${String(error)}`);
  if (multithreadReviewReceipt) stop(`Multithread child failed: ${String(error)}`);
  if (officialReviewReceipt) stop(`Official Opt10 child failed: ${String(error)}`);
  throw error;
}
finally { await cleanProcessGroup(); clearInterval(interval); clearTimeout(deadline); clearTimeout(forceKill); unlinkSync(lockPath); }
if (stopped) console.error(stopped);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
