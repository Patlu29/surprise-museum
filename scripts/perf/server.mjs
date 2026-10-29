// Static server that mimics GitHub Pages: base path, gzip, short cache. Usage: node server.mjs <dir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const [dir, port] = [path.resolve(process.argv[2]), Number(process.argv[3] ?? 4180)];
const BASE = '/surprise-museum/';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};
const COMPRESS = new Set(['.html', '.js', '.css', '.svg', '.json', '.wasm']);
const cache = new Map();
http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404);
      return res.end();
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    const ext = path.extname(file);
    let body = cache.get(file);
    if (!body) {
      const raw = fs.readFileSync(file);
      body = { raw, gz: COMPRESS.has(ext) ? zlib.gzipSync(raw, { level: 6 }) : null };
      cache.set(file, body);
    }
    const headers = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'max-age=600',
    };
    const gz = body.gz && /gzip/.test(req.headers['accept-encoding'] ?? '');
    if (gz) headers['Content-Encoding'] = 'gzip';
    const out = gz ? body.gz : body.raw;
    headers['Content-Length'] = out.length;
    res.writeHead(200, headers);
    res.end(out);
  })
  .listen(port, () => console.log(`serving ${dir} on ${port}`));
