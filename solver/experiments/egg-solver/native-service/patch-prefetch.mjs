// Diagnostic only: isolate NTA vs T0 without changing code placement or search.
// Inputs are the pinned AVX-512 adapter and llvm-objdump -d --demangle output.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const [source,disassembly,directory]=process.argv.slice(2);
assert(source&&disassembly&&directory);
const original=readFileSync(source),bytes=Buffer.from(original);
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(original),'99750e771ef4c06a1c141f340957281862cf296d67d09fb986bd0e13f6a5af66');
assert.equal(bytes.readUInt16LE(18),62);
const phoff=Number(bytes.readBigUInt64LE(32)),size=bytes.readUInt16LE(54),count=bytes.readUInt16LE(56),loads=[];
for(let i=0;i<count;i++){
 const p=phoff+i*size;
 if(bytes.readUInt32LE(p)===1)loads.push({flags:bytes.readUInt32LE(p+4),offset:Number(bytes.readBigUInt64LE(p+8)),address:Number(bytes.readBigUInt64LE(p+16)),size:Number(bytes.readBigUInt64LE(p+32))});
}
let symbol;const changes=[];
for(const line of readFileSync(disassembly,'utf8').split('\n')){
 const label=line.match(/^([0-9a-f]+) <(.+)>:$/);if(label)symbol=label[2];
 if(!line.includes('\tprefetchnta\t'))continue;
 assert(['<egg_solver::lanes::share::Worker>::rounds','<egg_solver::lanes::Lane>::advance_cold','<egg_solver::lanes::Lane>::extend_jobs'].includes(symbol));
 const m=line.match(/^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)\s/);assert(m);
 const address=parseInt(m[1],16),op=Buffer.from(m[2].trim().split(/\s+/).map(x=>parseInt(x,16)));
 const seg=loads.find(s=>(s.flags&1)&&address>=s.address&&address+op.length<=s.address+s.size);assert(seg);
 const position=seg.offset+address-seg.address;assert.deepEqual(bytes.subarray(position,position+op.length),op);
 const opcode=op.indexOf(Buffer.from([15,24]));assert(opcode>=0&&((op[opcode+2]>>3)&7)===0);
 const fileOffset=position+opcode+2,before=bytes[fileOffset];bytes[fileOffset]|=8;
 changes.push({symbol,address,fileOffset,before,after:bytes[fileOffset],instruction:line.trim()});
}
assert.equal(changes.length,6);
mkdirSync(directory,{recursive:true});
writeFileSync(`${directory}/cuberoot-egg`,bytes,{flag:'wx',mode:0o755});
writeFileSync(`${directory}/build.json`,JSON.stringify({diagnosticOnly:true,
 purpose:'Six table PREFETCHNTA hints become PREFETCHT0; every other byte and code address is preserved. Not a production build. The retained build-id is for matching symbols, not an updated integrity digest.',
 baseSha256:sha(original),sha256:sha(bytes),bytes:bytes.length,changes},null,2)+'\n',{flag:'wx'});
