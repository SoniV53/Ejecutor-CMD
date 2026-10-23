const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const JSON_DIR = path.join(BASE_DIR, 'json');
const BAT_DIR = path.join(BASE_DIR, 'bat');
const DOCS_DIR = path.join(BASE_DIR, 'api_docs');

// Asegurar que las carpetas base existan
[JSON_DIR, BAT_DIR, DOCS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

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

// GET /api/sync/bundle -> Obtiene toda la data de la app (json, bat, api_docs)
const getSyncBundle = (req, res) => {
    try {
        const jsonFiles = readFilesRecursively(JSON_DIR);
        const batFiles = readFilesRecursively(BAT_DIR);
        const apiDocFiles = readFilesRecursively(DOCS_DIR);

        const bundle = {
            status: 'success',
            timestamp: Date.now(),
            counts: {
                json: jsonFiles.length,
                bat: batFiles.length,
                api_docs: apiDocFiles.length
            },
            data: {
                json: jsonFiles,
                bat: batFiles,
                api_docs: apiDocFiles
            }
        };

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(bundle));
    } catch (error) {
        console.error('Error generando bundle de sincronización:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: error.message || error }));
    }
};

// POST /api/sync/restore -> Restaura o actualiza archivos en el disco local
const restoreSyncBundle = (req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString('utf8')));
    req.on('end', () => {
        try {
            const payload = JSON.parse(body || '{}');
            const data = payload.data || {};
            let writtenCount = 0;

            // 1. Restaurar archivos JSON
            if (Array.isArray(data.json)) {
                for (const item of data.json) {
                    if (!item.name || typeof item.content !== 'string') continue;
                    const cleanName = path.basename(item.relativePath || item.name);
                    const targetFile = path.join(JSON_DIR, cleanName);
                    fs.writeFileSync(targetFile, item.content, 'utf8');
                    writtenCount++;
                }
            }

            // 2. Restaurar archivos BAT
            if (Array.isArray(data.bat)) {
                for (const item of data.bat) {
                    if (!item.name || typeof item.content !== 'string') continue;
                    const cleanName = path.basename(item.relativePath || item.name);
                    const targetFile = path.join(BAT_DIR, cleanName);
                    const normalized = item.content.replace(/\r?\n/g, '\r\n');
                    fs.writeFileSync(targetFile, normalized, 'utf8');
                    writtenCount++;
                }
            }

            // 3. Restaurar archivos API_DOCS (pueden ser recursivos)
            if (Array.isArray(data.api_docs)) {
                for (const item of data.api_docs) {
                    const rel = (item.relativePath || item.name || '').replace(/\\/g, '/');
                    if (!rel || typeof item.content !== 'string') continue;

                    const targetFile = path.join(DOCS_DIR, rel);
                    const targetDir = path.dirname(targetFile);

                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }

                    fs.writeFileSync(targetFile, item.content, 'utf8');
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

