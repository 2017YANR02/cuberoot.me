import { readFileSync, writeFileSync } from 'node:fs';
import { knowledgeIndexSchema } from '../src/utils/site_assistant_knowledge.js';
import { auditKnowledge, parseEvaluationCases } from './assistant-evaluation.js';

// Explicit file inputs: no crawling, indexing writes or paid requests.
const value = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const indexPath = value('index'), casesPath = value('cases'), output = value('output');
if (!indexPath || !casesPath || !output) throw new Error('Required: --index=pages.json --cases=cases.json --output=report.json');
const report = await auditKnowledge(knowledgeIndexSchema.parse(JSON.parse(readFileSync(indexPath, 'utf8'))), parseEvaluationCases(JSON.parse(readFileSync(casesPath, 'utf8'))).filter(c => c.split === 'development'));
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pages: report.pages, passages: report.passages, gaps: report.coverage.filter(c => c.status !== 'covered').length, output }));
