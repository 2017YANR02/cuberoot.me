import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { inspectionPenalty, formatMs, createTimerStoreData } from '@cuberoot/shared/timer';
import { watchTimerSlot, decodeWatchTimerRecord, type WatchTimerRecord } from '../../app-ui/src/watch-timer';

// Runs the actual Foundation-only Swift DTO/rules against the canonical TS functions.
// Native SDK builds and runtime acceptance remain separate from this contract check.
describe.skipIf(process.platform !== 'darwin')('watch native wire and timing boundaries', () => {
  it('matches inspection/format rules and losslessly round-trips a real phone slot', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cuberoot-watch-contract-'));
    try {
      const cases = [0, 14999, 15000, 15000.1, 16000, 17000, 17000.1, 20000];
      const times = [0, 1, 999.9, 12345.67, 59999.9, 60000, 3599999.9, 3600000, 86400000];
      const record: WatchTimerRecord = {version:1, id:'8B7FF5B5-B7FA-4D6F-BC2C-755E1DAD445C',
        slot: watchTimerSlot(createTimerStoreData(1,'test-session','zh'),"R U R'"), ts:123456,
        timeMs:12345.67, penalty:'+2', inspectionMs:16000};
      record.moves = [{ m:'U', ts:0 },{ m:"U'", ts:250 }];
      record.device = { model:'gan-v4', name:'GAN16ui' };
      record.gyro = 'RwIAAQAAfwAAAA==';
      const input = join(directory,'input.json'), output = join(directory,'output.json');
      record.slot.previewPng = 'cHJldmlldy1jb250cmFjdA==';
      writeFileSync(input,JSON.stringify(record));
      const source = `import Foundation
let cases: [Double] = ${JSON.stringify(cases)}
let times: [Double] = ${JSON.stringify(times)}
var cursor = WatchBatchCursor()
let sourceA = "7D056329-3B5D-4574-B5E1-AB74798F77D7"
let sourceB = "4D2B89E8-EA99-4441-A4F5-A075EF38A2BB"
let ordered = [cursor.accept(source: sourceA, revision: 2), cursor.accept(source: sourceA, revision: 3), cursor.accept(source: sourceA, revision: 2), cursor.accept(source: sourceB, revision: 1), cursor.accept(source: sourceA, revision: 4)]
var restored = try JSONDecoder().decode(WatchBatchCursor.self, from: JSONEncoder().encode(cursor))
let result = ["batches": ordered.map { String($0) }, "replay": [String(restored.accept(source: sourceB, revision: 1))], "penalties": cases.map { WatchTimerRules.penalty($0, limit: 15) }, "times": times.map { WatchTimerRules.format($0) }]
print(String(decoding: try JSONEncoder().encode(result), as: UTF8.self))
let record = try JSONDecoder().decode(WatchTimerRecord.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
precondition(!record.canTransfer(recordingVersion: nil))
precondition(record.canTransfer(recordingVersion: 1))
precondition(WatchTimerRules.result(record) == "14.34+")
var manual = record
manual.moves = nil
precondition(manual.canTransfer(recordingVersion: nil))
var largeSlot = record.slot
largeSlot.sessionName = String(repeating: "测", count: 500)
largeSlot.previewPng = String(repeating: "/", count: 4000)
var largeBatch = WatchTimerBatch(version: 1, id: sourceA, configuration: largeSlot.sessionName, language: "zh", slots: Array(repeating: largeSlot, count: 10), unsupported: false, sourceId: sourceA, sequence: 1)
let payload = try largeBatch.transportJSON()
precondition(payload.utf8.count <= 56_000)
let delivered = try JSONDecoder().decode(WatchTimerBatch.self, from: Data(payload.utf8))
precondition(!delivered.slots.isEmpty && delivered.slots.count < 10)
precondition(delivered.slots[0].scramble == record.slot.scramble && delivered.slots[0].previewPng != nil)
try JSONEncoder().encode(record).write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
`;
      const main = join(directory,'main.swift'), binary = join(directory,'contract');
      writeFileSync(main, source);
      const compile = spawnSync('xcrun',['swiftc', resolve('../../apps/mobile/ios/App/WatchShared/WatchTimerWire.swift'),main,'-o',binary],{encoding:'utf8'});
      expect(compile.status, compile.stderr).toBe(0);
      const run = spawnSync(binary,[input,output],{encoding:'utf8'});
      expect(run.status, run.stderr).toBe(0);
      const result = JSON.parse(run.stdout);
      expect(result.batches).toEqual(['true','true','false','true','false']);
      expect(result.replay).toEqual(['false']);
      expect(result.penalties).toEqual(cases.map(ms => inspectionPenalty(ms,15)));
      expect(result.times).toEqual(times.map(ms => formatMs(ms)));
      expect(decodeWatchTimerRecord(JSON.parse(readFileSync(output,'utf8')))).toEqual(record);
    } finally { rmSync(directory,{recursive:true,force:true}); }
  }, 60000);
});
