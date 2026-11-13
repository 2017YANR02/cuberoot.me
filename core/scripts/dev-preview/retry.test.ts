import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retry, retryable, retryDelay, RetryableError, TunnelRetryPolicy } from './retry.ts';

test('temporary failures resume the same operation with capped backoff', async () => {
  let attempts=0; const waits:number[]=[];
  const result=await retry(async()=>{
    if(++attempts<4)throw new TypeError('fetch failed',{cause:Object.assign(new Error('offline'),{code:'ECONNRESET'})});
    return 'same request';
  },{sleep:async ms=>{waits.push(ms);}});
  assert.equal(result,'same request');assert.equal(attempts,4);
  assert.deepEqual(waits,[5000,10000,20000]);assert.equal(retryDelay(100),300000);
});
test('key, permission and configuration failures are not retried', async()=>{
  for(const message of ['Permission denied (publickey)','REMOTE HOST IDENTIFICATION HAS CHANGED','Existing DNS conflicts','Invalid connection profile','Queue HTTP 403']){
    let attempts=0;
    await assert.rejects(retry(async()=>{attempts++;throw Error(message);},{sleep:async()=>{assert.fail('must not retry');}}));
    assert.equal(attempts,1);
  }
});
test('subprocess transport failures retry but authentication failures do not',()=>{
  assert.equal(retryable({stderr:'ssh: Connection timed out during banner exchange'}),true);
  assert.equal(retryable({stderr:'Permission denied (publickey)',code:'ETIMEDOUT'}),false);
  assert.equal(retryable(Error('Queue HTTP 503')),true);
  assert.equal(retryable({stderr:'queryA ECONNREFUSED dev-test-pc.cuberoot.me'}),true);
  assert.equal(retryable({status:75,stderr:'fetch failed'}),true);
  assert.equal(retryable({message:'Connection to 47.97.30.181 closed by remote host.'}),true);
  assert.equal(retryable({message:'Timeout, server 47.97.30.181 not responding.'}),true);
  assert.equal(retryable(Error('Deployment failed; inspect GitHub Actions before retry')),false);
});
test('stopping enrollment interrupts a long retry wait without another attempt',async()=>{
  const controller=new AbortController();let attempts=0;
  await assert.rejects(retry(async()=>{attempts++;throw new RetryableError('offline');},{signal:controller.signal,notify:()=>controller.abort()}),{name:'AbortError'});
  assert.equal(attempts,1);
});

test('tunnel reconnect tolerates stale listeners with bounded retries and resets after recovery', () => {
  const policy = new TunnelRetryPolicy();
  const forwarding = 'WARNING: connection is not using a post-quantum key exchange algorithm.\nError: remote port forwarding failed for listen port 7106';
  assert.equal(policy.next(255, 'Connection closed by remote host.', 120_000), 10_000);
  assert.deepEqual(Array.from({ length: 6 }, () => policy.next(255, forwarding, 300)), [20_000, 40_000, 60_000, 60_000, 60_000, 60_000]);
  assert.equal(policy.next(255, forwarding, 300), null);
  assert.equal(policy.next(255, 'Broken pipe', 120_000), 10_000);
  assert.equal(policy.next(255, forwarding, 300), 20_000);
  assert.equal(retryable({ message: forwarding }), false, 'provisioning retains its strict policy');
});

test('tunnel network backoff is capped and authentication/configuration errors pause immediately', () => {
  const policy = new TunnelRetryPolicy();
  assert.deepEqual(Array.from({ length: 5 }, () => policy.next(255, 'Connection timed out', 100)), [10_000, 20_000, 40_000, 60_000, 60_000]);
  for (const message of ['Permission denied (publickey)', 'Host key verification failed', 'REMOTE HOST IDENTIFICATION HAS CHANGED', 'Bad configuration option', 'spawn ssh ENOENT', 'Permission denied\nremote port forwarding failed for listen port 7106']) {
    assert.equal(new TunnelRetryPolicy().next(255, message, 100), null, message);
  }
  assert.equal(new TunnelRetryPolicy().next(0, '', 120_000), 10_000);
});
