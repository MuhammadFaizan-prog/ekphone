// Tiny static server for tests (no deps). node serve.mjs [port]
// Text files are gzip-compressed when the browser asks, like the Vercel host does (Vercel uses brotli/gzip).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root = new URL('../app/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    let body = fs.readFileSync(f);
    const type = types[path.extname(f)] || 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'no-cache', vary: 'accept-encoding' };
    if (/text|json|javascript|svg|manifest/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body, { level: 9 }); headers['content-encoding'] = 'gzip'; }
    headers['content-length'] = body.length;
    serve.hits = (serve.hits || 0) + 1; serve.bytes = (serve.bytes || 0) + body.length; (serve.log = serve.log || []).push(p);
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}
if (import.meta.url === `file://${process.argv[1]}`) serve(+process.argv[2] || 8080).then(({ url }) => console.log('serving', url));
