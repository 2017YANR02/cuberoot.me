/** Migration acceptance only: bounded evidence/header reads, no engine or table payload. */
import {collectOfficialEvidence} from '../../solver/experiments/cube48opt-rust/opt10-official-policy.mts';
import {opt10Configuration} from '../../solver/333opt/rust-h10-adapter.mts';
import {root, checkLocalTemporaryFiles} from './check.mjs';
const evidence=collectOfficialEvidence();
const config=opt10Configuration(root,16);
const temporaryErrors=checkLocalTemporaryFiles();
if(temporaryErrors.length)throw Error(JSON.stringify(temporaryErrors));
console.log(JSON.stringify({release:config.release,executableSha256:evidence.executableSha256,
 auxiliarySha256:evidence.snapshot.sha256,table:config.table,expectedTableBytes:31_130_911_744,
 snapshotAndHistoricalEvidence:'verified',temporaryFiles:'disposable',engineStarted:false},null,2));
