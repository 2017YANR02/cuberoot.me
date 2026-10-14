/** Resumable ZBLL scope, separate from the consumed one-shot WCA100 review. */
import { createHash } from 'node:crypto';
export const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export function validateOpt10BatchReview(review: any, evidence: {
  baseline: Buffer; report: Buffer; exit: Buffer; binary: Buffer; small: Buffer; header: Buffer;
}, current: { boot: string; swapouts: number }) {
  const prior = JSON.parse(evidence.baseline.toString()), report = JSON.parse(evidence.report.toString());
  const exit = JSON.parse(evidence.exit.toString()), resource = report.protection?.resource;
  const receipt = resource?.opt10ReviewReceipt;
  if (review?.schema !== 'cuberoot.opt10.zbll-review.v1' || review.scope !== 'double-zbll-symmetry-v2'
      || !review.reason || !Number.isFinite(Date.parse(review.reviewedAt))
      || review.baselineSha256 !== sha256(evidence.baseline) || review.reportSha256 !== sha256(evidence.report)
      || review.exitSha256 !== sha256(evidence.exit) || review.binarySha256 !== sha256(evidence.binary)
      || review.smallSha256 !== sha256(evidence.small) || review.headerSha256 !== sha256(evidence.header))
    throw Error('Opt10 ZBLL review evidence changed; review again without resetting the baseline');
  if (report.schema !== 'cuberoot.rust-opt10.wca100-report.v1' || report.cases !== 100
      || report.independentlyVerifiedSolutions !== 100 || report.optimalLengthsMatched !== 100
      || report.protection.triggered !== false || exit.exitCode !== 0 || exit.signal !== null
      || resource.stopped !== '' || resource.trigger !== null || resource.pressure !== 1
      || resource.peakRss > resource.rssLimit || !(resource.minimumHeadroom >= 2 ** 31)
      || receipt?.baselineSha256 !== review.baselineSha256 || receipt.executableSha256 !== review.binarySha256
      || receipt.snapshotSha256 !== review.smallSha256 || report.generationMetadata?.table?.headerSha256 !== review.headerSha256)
    throw Error('Opt10 ZBLL requires the completed, independently verified predecessor and unchanged artifacts');
  if (typeof prior.boot !== 'string' || !Number.isSafeInteger(prior.swapouts)
      || current.boot !== prior.boot || current.swapouts !== prior.swapouts
      || resource.boot !== prior.boot || resource.swapouts !== prior.swapouts)
    throw Error('Opt10 ZBLL boot/Swapouts changed; cannot reset the baseline');
  return { reviewSha256: sha256(Buffer.from(JSON.stringify(review))), baselineSha256: review.baselineSha256 };
}
