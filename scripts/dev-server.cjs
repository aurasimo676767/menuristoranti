const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = require('../vercel.json');
const handlers = { '/api/admin': require('../api/admin'), '/api/menu': require('../api/menu') };
const types = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
      if (url.pathname.startsWith('/admin')) for (const header of config.headers[1].headers) res.setHeader(header.key, header.value);
      if (handlers[url.pathname]) {
        let raw = '', size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1500000) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Menu troppo grande.' })); return; }
          raw += chunk;
        }
        req.body = raw || undefined; req.query = Object.fromEntries(url.searchParams);
        res.status = status => { res.statusCode = status; return res; };
        res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
        await handlers[url.pathname](req, res); return;
      }
      const pathname = url.pathname === '/' ? '/index.html' : ['/admin', '/admin/'].includes(url.pathname) ? '/admin.html' : decodeURIComponent(url.pathname);
      if (!/^\/(?:index\.html|robots\.txt|sitemap\.xml|admin\.(?:html|js|css)|app\.js|style\.css|menu-data\.js|menu-loader\.js|assets\/[a-zA-Z0-9_./-]+)$/.test(pathname)) { res.writeHead(404); res.end('Not found'); return; }
      const file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const data = await fs.readFile(file);
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store'); res.end(data);
    } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
  });
}
if (require.main === module) {
  process.env.NODE_ENV = 'development';
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`Anteprima: http://127.0.0.1:${port} · Admin: http://127.0.0.1:${port}/admin`));
}
module.exports = { createServer };
