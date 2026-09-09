import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../../..');
const core = resolve(repository, 'core');
const require = createRequire(resolve(core, 'package.json'));
const { build } = require('esbuild');
const client = resolve(core, 'packages/client');
const cache = process.env.SPACE_CACHE ?? 'E:/CubeRoot-Assets/space/bootstrap';
const temporary = resolve(repository, '.tmp/png/space-blender');
await mkdir(cache, { recursive: true }); await mkdir(temporary, { recursive: true });
const bundle = resolve(temporary, 'capture.js');
await build({ entryPoints: [resolve(here, 'capture.ts')], outfile: bundle, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', nodePaths: [resolve(client, 'node_modules'), resolve(core, 'node_modules')], alias: { '@': client }, define: { 'import.meta.env.DEV': 'true', 'process.env.NODE_ENV': '"development"' } });
const verificationBundle = resolve(temporary, 'verify.js');
await build({ entryPoints: [resolve(here, 'verify.ts')], outfile: verificationBundle, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', nodePaths: [resolve(client, 'node_modules'), resolve(core, 'node_modules')], alias: { '@': client }, define: { 'import.meta.env.DEV': 'true', 'process.env.NODE_ENV': '"development"' } });
const valid = /^(shanghai|(minimal|cyberpunk|modern|vintage|italian|penthouse|japanese|company)-(original|island|shanghai))$/;
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const match = url.pathname.match(/^\/(capture|report)\/([^/]+)$/);
    if (req.method === 'POST' && match && valid.test(match[2])) {
      const parts = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 800 * 1024 * 1024) throw new Error('Asset exceeds 800 MiB'); parts.push(chunk); }
      await writeFile(resolve(cache, `${match[2]}.${match[1] === 'capture' ? 'glb' : 'json'}`), Buffer.concat(parts));
      res.end('saved'); console.log(`${match[1]} ${match[2]} ${bytes} bytes`); return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (url.pathname === '/verify') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><title>Space Blender verification</title><pre>Checking exported assets…</pre><script type="module" src="/verify.js"></script>'); return; }
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><title>Space Blender capture</title><pre>Loading scene assets…</pre><script type="module" src="/capture.js"></script>'); return; }
    const publicRoot = resolve(client, 'public');
    const path = url.pathname === '/capture.js' ? bundle : url.pathname === '/verify.js' ? verificationBundle : resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    if (path !== bundle && path !== verificationBundle && !path.startsWith(publicRoot + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    res.setHeader('Content-Length', (await stat(path)).size); res.end(await readFile(path));
  } catch (error) { res.writeHead(500).end(String(error)); }
}).listen(3016, '127.0.0.1', () => console.log(`Space Blender capture http://127.0.0.1:3016; cache ${cache}`));
