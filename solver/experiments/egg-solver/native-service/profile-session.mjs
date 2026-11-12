// Linux perf sampling, enabled only after the table is ready. No solver changes.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {appendFileSync, closeSync, constants, openSync, readSync, statSync, writeSync, writeFileSync} from 'node:fs';

export async function startSearchProfile({pid, directory, onFailure}) {
  assert.equal(process.platform, 'linux');
  const control = `${directory}/perf-control`, ack = `${directory}/perf-ack`;
  execFileSync('mkfifo', [control, ack]);
  const controlFd = openSync(control, constants.O_RDWR | constants.O_NONBLOCK);
  const ackFd = openSync(ack, constants.O_RDWR | constants.O_NONBLOCK);
  const args = ['record', '-e', 'cpu-clock:u', '-F', '99', '--call-graph', 'dwarf,4096',
    '--delay=-1', `--control=fifo:${control},${ack}`, '-p', String(pid), '-o', `${directory}/perf.data`];
  const child = spawn('/usr/bin/perf', args, {detached:true, stdio:['ignore','pipe','pipe']});
  let status, failure, finished = false, cleaned = false, logBytes = 0;
  const done = new Promise(resolve => {
    child.on('error', error => {failure = error; onFailure(error);});
    child.on('close', (code, signal) => {
      status = {code, signal};
      if (!finished) {failure ??= Error('Profiler exited during search'); onFailure(failure);}
      resolve(status);
    });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => {
    logBytes += bytes.length;
    if (logBytes > 1024 ** 2) onFailure(Error('Profiler log limit'));
    else appendFileSync(`${directory}/perf.log`, bytes);
  });
  const command = async value => {
    if (failure) throw failure;
    assert(!status, 'Profiler is closed');
    writeSync(controlFd, value + '\n');
    const until = performance.now() + 10_000;
    let response = '';
    while (!response.includes('\n')) {
      if (failure) throw failure;
      assert(performance.now() < until, `Profiler ${value} acknowledgement timeout`);
      const buffer = Buffer.alloc(64);
      try {const size = readSync(ackFd, buffer); response += buffer.subarray(0,size).toString();}
      catch (error) {if (error.code !== 'EAGAIN') throw error;}
      if (!response.includes('\n')) await new Promise(resolve => setTimeout(resolve,10));
    }
    // Alibaba's perf 5.10 writes the C string's trailing NUL as well.
    assert.equal(response.replaceAll('\0', '').trim(), 'ack');
  };
  const close = async () => {
    if (cleaned) return;
    finished = true;
    if (!status) {
      child.kill('SIGINT');
      const timer = setTimeout(() => {try {process.kill(-child.pid,'SIGKILL');} catch(e) {if(e.code!=='ESRCH')onFailure(e);}}, 5000);
      await done; clearTimeout(timer);
    }
    closeSync(controlFd); closeSync(ackFd); cleaned = true;
    writeFileSync(`${directory}/perf-exit.json`, JSON.stringify({pid:child.pid,args,...status})+'\n',{flag:'wx'});
  };
  try {await command('enable');}
  catch (error) {await close(); throw error;}
  return {
    pid:child.pid,
    sample() {assert(statSync(`${directory}/perf.data`).size < 256 * 1024 ** 2, 'Profiler data limit'); if(failure)throw failure;},
    async finish() {
      await command('disable'); await close();
      // perf 5.10 re-raises the requested SIGINT after flushing its output.
      assert(status.code===0 || status.signal==='SIGINT', 'Profiler did not stop cleanly');
      const header=execFileSync('/usr/bin/perf',['report','--stdio','--header-only','-i',`${directory}/perf.data`],{encoding:'utf8',timeout:10_000,maxBuffer:1024**2});
      writeFileSync(`${directory}/perf-header.txt`,header,{flag:'wx'});
    },
    close,
  };
}
