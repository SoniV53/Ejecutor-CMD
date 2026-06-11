const fs = require('fs');
const path = require('path');

// Definimos las rutas a los archivos físicos
const HTML_FILE = path.join(__dirname, 'index.html');
const DASHBOARD_FILE = path.join(__dirname, 'ui/dashboard-CMD/dashboard-CMD.html');
const REDES_FILE = path.join(__dirname, 'ui/redes/generador-redes.html');
const DOC_GEN_FILE = path.join(__dirname, 'ui/doc-Generator/doc-generator.html');
const EMULADOR_FILE = path.join(__dirname, 'ui/emulador/emulador.html');
const API_DOC_FILE = path.join(__dirname, 'ui/doc-api/api-doc.html');
const REPO_DOC_FILE = path.join(__dirname, 'ui/repo_doc/repo_doc.html');

// Mapa exacto de URLs que el usuario escribe -> a qué archivo corresponden
const routes = {
    '/': HTML_FILE,
    '/index': HTML_FILE,
    '/dashboard-CMD': DASHBOARD_FILE,
    '/redes': REDES_FILE,
    '/doc-generator': DOC_GEN_FILE,
    '/emulador': EMULADOR_FILE,
    '/doc-api': API_DOC_FILE,
    '/repo-doc': REPO_DOC_FILE
};

// Función principal que exportaremos
const routeNavigation = (req, res) => {
    // Si la petición es GET y la URL existe en nuestro mapa de rutas
    if (req.method === 'GET' && routes[req.url]) {
        const filePath = routes[req.url];

        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fs.readFileSync(filePath));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Error: No se encontró el archivo físico para la ruta ${req.url}.`);
        }

        return true; // Retornamos true para avisar que SÍ respondimos a esta ruta
    }

    return false; // Retornamos false si la URL no era una página HTML
};

module.exports = {
    routeNavigation
};