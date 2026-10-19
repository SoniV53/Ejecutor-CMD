const fs = require('fs');
const path = require('path');

const ANGULAR_DIST_DIR = path.join(__dirname, 'dist', 'consoleflow');
const ANGULAR_INDEX = path.join(ANGULAR_DIST_DIR, 'index.html');
const LEGACY_INDEX = path.join(__dirname, 'index.html');

// Rutas SPA de Angular que deben devolver el index.html principal
const spaRoutes = new Set([
  '/',
  '/index',
  '/hub',
  '/dashboard-cmd',
  '/dashboard-CMD',
  '/redes',
  '/doc-generator',
  '/emulador',
  '/api-doc',
  '/doc-api',
  '/repo-doc'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

const serveIndexHtml = (res) => {
  const targetIndex = fs.existsSync(ANGULAR_INDEX) ? ANGULAR_INDEX : LEGACY_INDEX;
  if (fs.existsSync(targetIndex)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(targetIndex));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error: No se encontró la compilación de Angular. Ejecuta npm run build:web.');
  }
};

const routeNavigation = (req, res) => {
  if (req.method !== 'GET') return false;

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // 1. Si es una ruta conocida del SPA de Angular, servimos index.html
  if (spaRoutes.has(pathname)) {
    serveIndexHtml(res);
    return true;
  }

  // 2. Intentar servir archivo estático compilado desde dist/consoleflow (main.js, polyfills.js, styles.css, etc.)
  const distFilePath = path.join(ANGULAR_DIST_DIR, pathname);
  if (
    distFilePath.startsWith(ANGULAR_DIST_DIR) &&
    fs.existsSync(distFilePath) &&
    fs.lstatSync(distFilePath).isFile()
  ) {
    const ext = path.extname(distFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(distFilePath));
    return true;
  }

  return false;
};

module.exports = {
  routeNavigation
};