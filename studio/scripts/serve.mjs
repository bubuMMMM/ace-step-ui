/** Minimal static file server for local preview: node scripts/serve.mjs [port] */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public');
const port = Number(process.argv[2] || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let path = join(root, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  try {
    const info = await stat(path).catch(() => null);
    if (info && info.isDirectory()) path = join(path, 'index.html');
    else if (!info && !extname(path)) path = `${path}.html`;
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
