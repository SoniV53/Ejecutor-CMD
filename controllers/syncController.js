const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const JSON_DIR = path.join(BASE_DIR, 'json');
const BAT_DIR = path.join(BASE_DIR, 'bat');
const DOCS_DIR = path.join(BASE_DIR, 'api_docs');

// Carpetas internas del sistema / código fuente / compilación que NO son carpetas de usuario
const IGNORED_SYSTEM_DIRS = new Set([
    'node_modules',
    'src',
    'dist',
    'release',
    'out',
    'build',
    'controllers',
    'scripts',
    'assets',
    'tasks',
    'resources',
    'locales',
    'swiftshader',
    'win-unpacked',
    '.git',
    '.angular',
    '.vscode',
    '.gemini',
    '.idea',
    '.github'
]);

// Asegurar que las carpetas base por defecto existan
[JSON_DIR, BAT_DIR, DOCS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Detecta todas las carpetas de usuario que existan donde está ubicada la app (ej. api_docs, bat, json, notas, etc.)
function getAppUserFolders() {
    if (!fs.existsSync(BASE_DIR)) return [];
    const entries = fs.readdirSync(BASE_DIR, { withFileTypes: true });
    const folders = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (name.startsWith('.')) continue;
        if (IGNORED_SYSTEM_DIRS.has(name.toLowerCase())) continue;
        folders.push(name);
    }
    // Ordenar poniendo primero api_docs, bat, json y luego cualquier carpeta creada por el usuario (ej. notas)
    const priority = { api_docs: 1, bat: 2, json: 3 };
    folders.sort((a, b) => {
        const pa = priority[a.toLowerCase()] || 99;
        const pb = priority[b.toLowerCase()] || 99;
        if (pa !== pb) return pa - pb;
        return a.localeCompare(b);
    });
    return folders;
}

// Función auxiliar para leer recursivamente todos los archivos de un directorio
function readFilesRecursively(dirPath, rootDir = dirPath) {
    let results = [];
    if (!fs.existsSync(dirPath)) return results;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
            results = results.concat(readFilesRecursively(fullPath, rootDir));
        } else if (entry.isFile()) {
            // Ignorar archivos temporales o de bloqueo
            if (entry.name === '.DS_Store' || entry.name.endsWith('.tmp')) continue;
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const stat = fs.statSync(fullPath);
                results.push({
                    name: entry.name,
                    relativePath,
                    content,
                    mtime: stat.mtimeMs,
                    size: stat.size
                });
            } catch (err) {
                console.error(`Error leyendo archivo ${fullPath}:`, err);
            }
        }
    }
    return results;
}

// GET /api/sync/bundle -> Obtiene TODAS las carpetas y archivos donde está ubicada la app
const getSyncBundle = (req, res) => {
    try {
        const folderNames = getAppUserFolders();
        const data = {};
        const counts = {};
        const folders = [];

        for (const folderName of folderNames) {
            const folderPath = path.join(BASE_DIR, folderName);
            const files = readFilesRecursively(folderPath);
            data[folderName] = files;
            counts[folderName] = files.length;
            folders.push({
                name: folderName,
                fileCount: files.length,
                files
            });
        }

        const bundle = {
            status: 'success',
            timestamp: Date.now(),
            baseDir: BASE_DIR,
            folders,
            counts,
            data
        };

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(bundle));
    } catch (error) {
        console.error('Error generando bundle de sincronización:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: error.message || error }));
    }
};

// POST /api/sync/restore -> Restaura o actualiza cualquier carpeta y archivo en el directorio de la app
const restoreSyncBundle = (req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString('utf8')));
    req.on('end', () => {
        try {
            const payload = JSON.parse(body || '{}');
            const data = payload.data || {};
            const emptyFolders = Array.isArray(payload.emptyFolders) ? payload.emptyFolders : [];
            let writtenCount = 0;

            // Crear carpetas vacías seleccionadas si aplica (ej. carpeta 'notas' recién creada)
            for (const rawFolder of emptyFolders) {
                const safeFolderName = path.basename(String(rawFolder || '').trim());
                if (!safeFolderName || safeFolderName.startsWith('.') || IGNORED_SYSTEM_DIRS.has(safeFolderName.toLowerCase())) {
                    continue;
                }
                const folderTarget = path.join(BASE_DIR, safeFolderName);
                if (!fs.existsSync(folderTarget)) {
                    fs.mkdirSync(folderTarget, { recursive: true });
                }
            }

            // Restaurar archivos de todas las carpetas recibidas (api_docs, bat, json, notas, etc.)
            for (const [rawFolderName, items] of Object.entries(data)) {
                const safeFolderName = path.basename(String(rawFolderName || '').trim());
                if (!safeFolderName || safeFolderName.startsWith('.') || IGNORED_SYSTEM_DIRS.has(safeFolderName.toLowerCase())) {
                    continue;
                }
                if (!Array.isArray(items)) continue;

                const folderRoot = path.join(BASE_DIR, safeFolderName);
                if (!fs.existsSync(folderRoot)) {
                    fs.mkdirSync(folderRoot, { recursive: true });
                }

                for (const item of items) {
                    const rel = (item.relativePath || item.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
                    if (!rel || rel.includes('..') || typeof item.content !== 'string') continue;

                    const targetFile = path.join(folderRoot, rel);
                    const targetDir = path.dirname(targetFile);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }

                    const contentToWrite =
                        safeFolderName.toLowerCase() === 'bat' || rel.toLowerCase().endsWith('.bat')
                            ? item.content.replace(/\r?\n/g, '\r\n')
                            : item.content;

                    fs.writeFileSync(targetFile, contentToWrite, 'utf8');
                    writtenCount++;
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'success',
                message: `${writtenCount} archivos sincronizados localmente correctamente`,
                writtenCount
            }));
        } catch (error) {
            console.error('Error restaurando bundle de sincronización:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', error: error.message || error }));
        }
    });
};

module.exports = {
    getSyncBundle,
    restoreSyncBundle
};

