#!/usr/bin/env node
import {relative, resolve} from 'node:path';
import {root, temporaryReferences, temporaryWrite} from '../../scripts/local-artifacts/check.mjs';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
let input:any;try{input=JSON.parse(raw).tool_input;}catch{process.exit(0);}
if(typeof input?.file_path!=='string')process.exit(0);
const file=relative(root,resolve(root,input.file_path)).replaceAll('\\','/');
if(file.startsWith('../'))process.exit(0);
const content=String(input.content??input.new_string??'');
const reason=temporaryWrite(file)??(temporaryReferences(file,content).length
 ? '正式代码不得依赖未登记的临时路径。运行资产、断点、领取记录和待提交结果放 .local-data；可丢弃文件放 .tmp/scratch、.tmp/cache 或 .tmp/png。确属临时的旧路径须在 docs/local-artifact-policy.json 写明逐行理由。':null);
if(reason)process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:reason}}));
