import assert from 'node:assert/strict';
import test from 'node:test';
import { ipNumber, rangeCidrs, countryConfig } from './update-cn-ranges.ts';

test('CIDRs cover exact IPv4 boundaries without exempting neighbours', () => {
  assert.deepEqual(rangeCidrs('1.0.1.1', '1.0.1.6'), ['1.0.1.1/32', '1.0.1.2/31', '1.0.1.4/31', '1.0.1.6/32']);
  assert.deepEqual(rangeCidrs('0.0.0.0', '255.255.255.255'), ['0.0.0.0/0']);
});
test('IPv6 supports compressed, mapped and non-aligned ranges', () => {
  assert.deepEqual(rangeCidrs('240e::', '240e:ffff:ffff:ffff:ffff:ffff:ffff:ffff'), ['240e:0:0:0:0:0:0:0/16']);
  assert.deepEqual(rangeCidrs('::1', '::6'), ['0:0:0:0:0:0:0:1/128', '0:0:0:0:0:0:0:2/127', '0:0:0:0:0:0:0:4/127', '0:0:0:0:0:0:0:6/128']);
  assert.equal(ipNumber('::ffff:1.0.1.1').value, ipNumber('::ffff:100:101').value);
  assert.throws(() => rangeCidrs('1.1.1.2', '1.1.1.1'));
  assert.throws(() => rangeCidrs('1.1.1.1', '::1'));
});
test('truncated or malformed downloads cannot replace the allowlist', () => {
  assert.throws(() => countryConfig('<html>Error</html>', '2026-09'));
  assert.throws(() => countryConfig('1.0.1.0,1.0.1.255,CN\n', '2026-09'));
});
