// IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0.
// Generate nginx geo CIDRs from the monthly country CSV; no request-time lookup.
import { readFile, writeFile, rename, copyFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { isIP } from "node:net";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function ipNumber(ip: string): { value: bigint; bits: number } {
  const version = isIP(ip);
  if (version === 4) return { value: ip.split('.').reduce((n, part) => n * 256n + BigInt(part), 0n), bits: 32 };
  if (version !== 6 || ip.includes('%')) throw new Error(`Invalid database IP: ${ip}`);
  if (ip.includes('.')) {
    const split = ip.lastIndexOf(':');
    const v4 = ipNumber(ip.slice(split + 1)).value;
    ip = `${ip.slice(0, split)}:${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`;
  }
  const halves = ip.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return { value: groups.reduce((n, part) => (n << 16n) + BigInt(`0x${part}`), 0n), bits: 128 };
}

function ipText(value: bigint, bits: number): string {
  if (bits === 32) return [24n, 16n, 8n, 0n].map(shift => String((value >> shift) & 255n)).join('.');
  return Array.from({ length: 8 }, (_, i) => ((value >> BigInt((7 - i) * 16)) & 65535n).toString(16)).join(':');
}

export function rangeCidrs(first: string, last: string): string[] {
  let { value: start, bits } = ipNumber(first);
  const end = ipNumber(last);
  if (end.bits !== bits || start > end.value) throw new Error('Invalid country range');
  const result: string[] = [];
  while (start <= end.value) {
    let hostBits = 0;
    while (hostBits < bits && start % (1n << BigInt(hostBits + 1)) === 0n && start + (1n << BigInt(hostBits + 1)) - 1n <= end.value) hostBits++;
    result.push(`${ipText(start, bits)}/${bits - hostBits}`);
    start += 1n << BigInt(hostBits);
  }
  return result;
}

export function countryConfig(csv: string, month: string): string {
  const cidrs: string[] = [];
  let rows = 0, cn4 = 0, cn6 = 0;
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^"?([0-9a-fA-F:.]+)"?,"?([0-9a-fA-F:.]+)"?,"?([A-Z]{2})"?$/.exec(line);
    if (!match) throw new Error('Unexpected country CSV row');
    rows++;
    if (match[3] !== 'CN') continue;
    if (isIP(match[1]) === 4) cn4++; else cn6++;
    cidrs.push(...rangeCidrs(match[1], match[2]));
  }
  if (rows < 100_000 || cn4 < 100 || cn6 < 10 || cidrs.length > 200_000) throw new Error('Country database coverage check failed');
  return `# DB-IP country lite ${month}; https://db-ip.com; CC BY 4.0\n# ${cn4} IPv4 and ${cn6} IPv6 CN ranges\n${cidrs.map(cidr => `${cidr} 1;`).join('\n')}\n`;
}

async function main() {
  const month = new Date().toISOString().slice(0, 7);
  const args = process.argv.slice(2);
  const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : '/etc/nginx/cuberoot-cn-ranges.conf';
  if (!output) throw new Error('Missing output path');
  const apply = args.includes('--apply');
  const previous = await readFile(output, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
  if (previous?.startsWith(`# DB-IP country lite ${month};`) && !args.includes('--force')) { console.log('CN ranges already current'); return; }
  const inputIndex = args.indexOf('--input');
  let compressed: Uint8Array;
  if (inputIndex >= 0) compressed = await readFile(args[inputIndex + 1]);
  else {
    const response = await fetch(`https://download.db-ip.com/free/dbip-country-lite-${month}.csv.gz`, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Country database download HTTP ${response.status}`);
    compressed = new Uint8Array(await response.arrayBuffer());
  }
  const config = countryConfig(gunzipSync(compressed, { maxOutputLength: 100 * 1024 * 1024 }).toString('utf8'), month);
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, config, { mode: 0o644 });
  if (previous !== null && apply) {
    await mkdir('/var/backups/cuberoot-geoip', { recursive: true, mode: 0o700 });
    await copyFile(output, `/var/backups/cuberoot-geoip/cn-ranges-${Date.now()}.conf`);
  }
  await rename(temporary, output);
  if (apply) {
    const nginx = '/www/server/nginx/sbin/nginx';
    try {
      execFileSync(nginx, ['-t'], { stdio: 'inherit' });
      execFileSync(nginx, ['-s', 'reload'], { stdio: 'inherit' });
    } catch (error) {
      // Keep the last valid database. Never silently replace it with an empty allowlist.
      if (previous !== null) {
        await writeFile(temporary, previous, { mode: 0o644 });
        await rename(temporary, output);
        execFileSync(nginx, ['-t'], { stdio: 'inherit' });
        execFileSync(nginx, ['-s', 'reload'], { stdio: 'inherit' });
      }
      throw error;
    }
  }
  console.log(config.split('\n').slice(0, 2).join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
