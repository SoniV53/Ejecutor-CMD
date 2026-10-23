const http = require('http');
const fs = require('fs');
const path = require('path');

// --- TRUCO PARA MODO PORTABLE (.EXE) ---
const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || __dirname;

// Cargar variables de entorno desde .env si existe
const envPath = path.join(BASE_DIR, '.env');
if (fs.existsSync(envPath)) {
    try {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                const val = trimmed.substring(eqIdx + 1).trim();
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    } catch (e) {
        console.error('Error cargando .env:', e);
    }
}

// Importamos nuestros controladores y rutas
const dataController = require('./controllers/dataController');
const dataEmuladorController = require('./controllers/dataEmuladorController');
const executeController = require('./controllers/executeController');
const apiDocController = require('./controllers/apiDocController');
const batController = require('./controllers/batController');
const syncController = require('./controllers/syncController');
const googleAuthController = require('./controllers/googleAuthController');
const routing = require('./navegacion');

// ----------------------------------------------------
// 1. CONFIGURACIÓN DE CARPETAS Y ARCHIVOS INICIALES
// ----------------------------------------------------
const JSON_DIR = path.join(BASE_DIR, 'json');
const DATA_FILE = path.join(BASE_DIR, 'json/datos_consola.json');

// Asegurar que la carpeta "json" exista
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
}

// Si el archivo JSON no existe, lo crea vacío
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ projects: [], commands: [], categories: [] }, null, 2));
}

// ----------------------------------------------------
// 2. LÓGICA DEL SERVIDOR (RUTAS)
// ----------------------------------------------------
const server = http.createServer((req, res) => {
    // Configuración CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- RUTAS FRONTEND (VISTAS HTML) ---

    // Delegamos toda la lógica de navegación a navegacion.js
    // Si la función retorna "true", significa que encontró la ruta y ya envió el HTML.
    // Usamos "return" para detener la ejecución y no buscar más abajo.
    if (routing.routeNavigation(req, res)) {
        return;
    }

    // --- ARCHIVOS ESTÁTICOS DE UI (/ui/...) ---
    if (req.method === 'GET' && req.url.startsWith('/ui/')) {
        const filePath = path.join(__dirname, req.url);
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath);
            let contentType = 'text/plain';
            if (ext === '.js') contentType = 'application/javascript';
            else if (ext === '.html') contentType = 'text/html';
            else if (ext === '.css') contentType = 'text/css';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(fs.readFileSync(filePath));
        } else {
            res.writeHead(404);
            res.end('Archivo estático no encontrado');
        }
        return;
    }

    // --- RUTAS BACKEND (API -> VAN A LOS CONTROLADORES) ---

    // Obtener Datos
    if (req.method === 'GET' && req.url === '/data') {
        return dataController.getData(req, res);
    }

    // Guardar Datos
    if (req.method === 'POST' && req.url === '/data') {
        return dataController.saveData(req, res);
    }

    // Obtener Datos
    if (req.method === 'GET' && req.url === '/dataEmulador') {
        return dataEmuladorController.getData(req, res);
    }

    // Guardar Datos
    if (req.method === 'POST' && req.url === '/dataEmulador') {
        return dataEmuladorController.saveData(req, res);
    }

    // Ejecutar Comando en CMD interno (Streaming)
    if (req.method === 'POST' && req.url === '/execute') {
        return executeController.executeCommand(req, res);
    }

    // Detener proceso activo del CMD interno
    if (req.method === 'POST' && req.url === '/execute/kill') {
        return executeController.killProcess(req, res);
    }

    // Detener TODOS los procesos activos del CMD interno
    if (req.method === 'POST' && req.url === '/execute/kill-all') {
        return executeController.killAllProcesses(req, res);
    }

    // Enviar stdin a proceso activo del CMD interno
    if (req.method === 'POST' && req.url === '/execute/input') {
        return executeController.sendInputToProcess(req, res);
    }

    // API DOC MANAGER
    if (req.url.startsWith('/api/doc/info')) return apiDocController.getDocInfo(req, res);
    if (req.url.startsWith('/api/doc/list')) return apiDocController.listDocs(req, res);
    if (req.url.startsWith('/api/doc/tree')) return apiDocController.getDocTree(req, res);
    if (req.url.startsWith('/api/doc/saveJsonDoc')) return apiDocController.saveJsonDoc(req, res);
    if (req.url.startsWith('/api/doc/save')) return apiDocController.saveDoc(req, res);
    if (req.url.startsWith('/api/doc/read')) return apiDocController.readFile(req, res);
    if (req.url.startsWith('/api/doc/delete')) return apiDocController.deleteItem(req, res);
    if (req.url.startsWith('/api/doc/rename')) return apiDocController.renameItem(req, res);
    if (req.url.startsWith('/api/doc/open-explorer')) return apiDocController.openInExplorer(req, res);
    if (req.url.startsWith('/api/doc/analyze-git')) return apiDocController.analyzeGitRepository(req, res);
    if (req.url.startsWith('/api/doc/browse-dirs')) return apiDocController.browseDirectories(req, res);
    if (req.url.startsWith('/api/doc/branch-commits')) return apiDocController.getBranchCommits(req, res);

    // BAT SCRIPT MANAGER (Almacenados en carpeta "bat" de la app, igual que "json")
    if (req.method === 'POST' && req.url === '/api/bat/save') return batController.saveBat(req, res);
    if (req.method === 'GET' && req.url.startsWith('/api/bat/read')) return batController.readBat(req, res);
    if (req.method === 'GET' && req.url.startsWith('/api/bat/list')) return batController.listBats(req, res);
    if (req.method === 'GET' && req.url.startsWith('/api/bat/export')) return batController.exportBat(req, res);
    if (req.method === 'GET' && req.url === '/api/bat/info') return batController.getBatInfo(req, res);
    if (req.method === 'POST' && req.url === '/api/bat/delete') return batController.deleteBat(req, res);

    // GLOBAL GOOGLE DRIVE SYNC MANAGER (Sincronización de toda la data: json, bat, api_docs)
    if (req.method === 'GET' && req.url === '/api/sync/bundle') return syncController.getSyncBundle(req, res);
    if (req.method === 'POST' && req.url === '/api/sync/restore') return syncController.restoreSyncBundle(req, res);

    // GOOGLE OAUTH EN NAVEGADOR
    if (req.method === 'GET' && req.url === '/api/auth/google/login') return googleAuthController.login(req, res);
    if (req.method === 'GET' && req.url.startsWith('/api/auth/google/callback')) return googleAuthController.callback(req, res);
    if (req.method === 'GET' && req.url === '/api/auth/google/status') return googleAuthController.status(req, res);
    if (req.method === 'GET' && req.url === '/api/auth/google/token') return googleAuthController.getToken(req, res);
    if (req.method === 'POST' && req.url === '/api/auth/google/logout') return googleAuthController.logout(req, res);

    // DIÁLOGO DEL SISTEMA PARA SELECCIONAR CARPETA NATIVA
    if (req.method === 'POST' && req.url === '/api/system/select-directory') {
        const { exec } = require('child_process');
        const psCmd = 'powershell -NoProfile -Command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.windows.forms\') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = \'Seleccionar Carpeta del Proyecto\'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"';
        exec(psCmd, { windowsHide: false }, (err, stdout) => {
            const selected = (stdout || '').trim();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ selectedPath: selected || null }));
        });
        return;
    }

    // 404 para cualquier otra ruta que no exista
    res.writeHead(404);
    res.end('404 Not Found');
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`Servidor ConsoleFlow activo`);
    console.log(`HOME: http://localhost:${PORT}/`);
    console.log(`=========================================\n`);
});
