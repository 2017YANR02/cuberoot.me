/** Integrate hash-bound review proposals. Dry-run by default; never publishes. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { resolve, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const round = dirname(fileURLToPath(import.meta.url));
const root = resolve(round, '../..');
const read = (p: string): any => JSON.parse(readFileSync(p, 'utf8'));
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const atomic = (p: string, v: unknown) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p + '.tmp', JSON.stringify(v, null, 2) + '\n');
  renameSync(p + '.tmp', p);
};
const baseline = read(resolve(round, 'baseline.json')).records;
const approvals = existsSync(resolve(round, 'correction-rechecks.json'))
  ? read(resolve(round, 'correction-rechecks.json')).entries : [];
const approved = new Map(approvals.map((a: any) => [a.key, a]));
const proposals = new Map<string, any>();
for (const group of ['posts-a', 'posts-b', 'logs']) {
  const dir = resolve(round, group);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const p = read(resolve(dir, name));
    if (!p.key || !p.path || !p.inputTranslationHash) continue;
    if (p.path.includes('/supplements/')) continue;
    if (proposals.has(p.key)) throw Error('Duplicate proposal: ' + p.key);
    proposals.set(p.key, { ...p, proposalFile: relative(root, resolve(dir, name)) });
  }
}
const errors: string[] = [];
const plans: any[] = [];
for (const b of baseline) {
  const p = proposals.get(b.key);
  if (!p) { errors.push('Missing review: ' + b.key); continue; }
  const record = read(resolve(root, b.path));
  if (p.path !== b.path || p.sourceHash !== b.sourceHash || p.inputTranslationHash !== b.translationHash)
    errors.push('Proposal binding mismatch: ' + b.key);
  if (record.source.hash !== b.sourceHash || hash(record.translation) !== b.translationHash)
    errors.push('Entry changed since review baseline: ' + b.key);
  if (!['pass', 'correction_required', 'source_uncertain'].includes(p.verdict))
    errors.push('Unknown verdict: ' + b.key);
  const title = p.title ?? record.translation.title;
  const content = p.content ?? record.translation.content;
  const changed = title !== record.translation.title || content !== record.translation.content;
  const contentHash = hash({ title, content });
  const approval: any = approved.get(b.key);
  if (changed && (approval?.contentHash !== contentHash || approval?.verdict !== 'pass'
    || !approval.reviewer || approval.reviewer.replace(/^\/root\//, '') === p.reviewer.replace(/^\/root\//, '')
    || !approval.reviewedAt
    || (approval.sourceHash && approval.sourceHash !== b.sourceHash)
    || (approval.inputTranslationHash && approval.inputTranslationHash !== b.translationHash)))
    errors.push('Correction needs independent recheck: ' + b.key);
  if (p.verdict === 'correction_required' && !changed)
    errors.push('Correction missing text: ' + b.key);
  plans.push({ b, p, record, title, content, changed, contentHash, approval });
}
for (const key of proposals.keys()) if (!baseline.some((b: any) => b.key === key)) errors.push('Unexpected proposal: ' + key);
const summary = { total: baseline.length, reviewed: plans.length, corrected: plans.filter(p => p.changed).length,
  sourceConcerns: plans.filter(p => p.p.verdict === 'source_uncertain' || p.p.sourceUncertainty).length, errors };
console.log(JSON.stringify(summary, null, 2));
if (errors.length) { process.exitCode = 1; }
else if (process.argv.includes('--apply')) {
  const at = new Date().toISOString();
  const stamp = at.replace(/[:.]/g, '-');
  const corpora = ['wca-post-translations', 'wca-log-translations'];
  const ledgers = new Map(corpora.map(c => [c, read(resolve(root, 'docs', c, 'progress.json'))]));
  for (const [corpus, ledger] of ledgers) {
    atomic(resolve(root, 'docs', corpus, 'checkpoints', stamp + '-before-full-review.json'), ledger);
  }
  const evidence: any[] = [];
  for (const plan of plans) {
    const { b, p, record, title, content, changed, contentHash, approval } = plan;
    const isLog = b.path.includes('/wca-log-translations/');
    const corpus = isLog ? 'wca-log-translations' : 'wca-post-translations';
    const dir = resolve(root, 'docs', corpus);
    const ledger = ledgers.get(corpus);
    const row = ledger.entries.find((r: any) => r.key === b.key);
    if (!row) throw Error('Missing ledger row: ' + b.key);
    const prior = JSON.parse(JSON.stringify(record));
    const sourceUncertain = p.verdict === 'source_uncertain' || Boolean(p.sourceUncertainty);
    const status = sourceUncertain ? 'pending_source_verification' : 'independently_verified';
    // Posts historically include reviewStatus in the hashed translation object.
    // A metadata-only review transition therefore also receives a version/archive.
    const needsVersion = changed || (!isLog && record.translation.reviewStatus !== status);
    if (needsVersion) {
      const slug = basename(b.path, '.json');
      const archiveName = b.translationHash + (isLog ? '-v' + record.translation.version : '') + '.json';
      const archive = resolve(dir, 'versions', slug, archiveName);
      if (!existsSync(archive)) atomic(archive, prior);
      Object.assign(record.translation, { title, content, version: record.translation.version + 1,
        revisedAt: at, revisionReason: changed ? '全文审校及术语校正；具体差异见审校记录。' : '完成当前版本独立审校；正文未改。' });
    }
    if (!isLog) record.translation.reviewStatus = status;
    const translationHash = hash(record.translation);
    const report = '../wca-translation-review-2026-10-26/final-report.json';
    const review = { reviewer: changed ? approval.reviewer : p.reviewer,
      reviewedAt: changed ? approval.reviewedAt : p.reviewedAt,
      report, sourceHash: b.sourceHash, reviewedTranslationHash: translationHash,
      verdict: 'pass', scope: changed ? '复核独立审校提出的全部修正及其原文上下文；其余内容沿用本轮逐篇审校证据。' : p.scope };
    if (isLog) {
      record.review.status = status;
      record.review.recheck = review;
      record.review.currentReview = { round: '2026-10-26', proposal: p.proposalFile,
        sourceConcern: sourceUncertain, notes: p.notes, inputTranslationHash: b.translationHash };
      row.verificationStatus = status;
    } else {
      record.review = { ...review, status, round: '2026-10-26', proposal: p.proposalFile,
        sourceConcern: sourceUncertain, notes: p.notes, inputTranslationHash: b.translationHash };
      record.translationHash = translationHash;
      row.reviewStatus = status;
    }
    Object.assign(row, { translationHash, translationVersion: record.translation.version });
    evidence.push({ key: b.key, path: b.path, sourceHash: b.sourceHash,
      inputTranslationHash: b.translationHash, reviewedTranslationHash: translationHash,
      reviewedContentHash: contentHash, reviewer: review.reviewer, reviewedAt: review.reviewedAt,
      firstReviewer: p.reviewer, scope: review.scope, verdict: 'pass', sourceConcern: sourceUncertain,
      proposal: p.proposalFile, changed, changes: p.changes, notes: p.notes });
    atomic(resolve(root, b.path), record);
  }
  atomic(resolve(round, 'final-report.json'), { checkedAt: at, ...summary, entries: evidence,
    scope: '全部639份唯一译文的审校与修正记录；按hash复用既有独立证据的条目在proposal中注明。pass仅指译文对原文的忠实性，不代表原文事实或外链附件已核验。' });
  for (const [corpus, ledger] of ledgers) {
    ledger.updatedAt = at;
    if (corpus === 'wca-log-translations') {
      const verified = ledger.entries.filter((r: any) => r.verificationStatus === 'independently_verified').length;
      Object.assign(ledger.counts, { independentlyReviewed: verified,
        pendingIndependentReview: ledger.entries.length - verified,
        pendingIndependentRecheck: ledger.entries.filter((r: any) => r.verificationStatus === 'pending_independent_recheck').length,
        pendingSourceVerification: ledger.entries.filter((r: any) => r.verificationStatus === 'pending_source_verification').length });
    } else {
      ledger.counts.independentlyReviewed = ledger.entries.filter((r: any) => r.reviewStatus === 'independently_verified').length;
      ledger.counts.pendingSourceVerification = ledger.entries.filter((r: any) => r.reviewStatus === 'pending_source_verification').length;
    }
    atomic(resolve(root, 'docs', corpus, 'progress.json'), ledger);
    atomic(resolve(root, 'docs', corpus, 'checkpoints', stamp + '-full-review.json'), ledger);
  }
  console.log('Integrated locally. Run both ledger validators, then build-wca-logs.mts and build-wca-posts.mts.');
}
