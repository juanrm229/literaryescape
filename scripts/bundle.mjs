// Bundle site/ into one self-contained HTML file (for previews / sharing as a file).
// Usage: node scripts/bundle.mjs [out]   (default: dist/literary-escape.html)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'literary-escape.html'));
let html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(assets\/[^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(SITE, f), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(SITE, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`bundle -> ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KB)`);
