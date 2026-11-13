import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

/** Adapt optional browser-only jsPDF features at the native build boundary. */
export function nativePdfPlugin(packageRoot) {
  return {name:'native-pdf-runtime',setup(build) {
    build.onLoad({filter:/[\\/]jspdf[\\/]dist[\\/]jspdf\.es\.min\.js$/},async args=>({
      contents:`import {pdfEnvironment as global} from ${JSON.stringify(resolve(packageRoot,'src/lib/pdf-runtime.ts'))};\n${await readFile(args.path,'utf8')}`,
      loader:'js',resolveDir:resolve(args.path,'..'),
    }));
    // Markdown's browser conditional uses document.createElement to decode
    // entities. Its standard runtime-neutral entry uses the same entity table.
    build.onResolve({filter:/^decode-named-character-reference$/},args=>({path:createRequire(args.importer).resolve(args.path)}));
    build.onResolve({filter:/^raf$/},args=>/[\\/]canvg[\\/]/.test(args.importer) ? {path:resolve(packageRoot,'src/lib/pdf-animation-frame.ts')} : null);
    // HTML-to-canvas and sanitization are unused by our explicit PDF layout.
    // Images arrive as native Canvas RGBA, so the PNG decoder is unused too.
    build.onResolve({filter:/^(html2canvas|dompurify|canvg|fast-png)$/},args=>
      /[\\/]jspdf[\\/]dist[\\/]/.test(args.importer) ? {path:resolve(packageRoot,'src/lib/pdf-browser-only.ts')} : null);
  }};
}
