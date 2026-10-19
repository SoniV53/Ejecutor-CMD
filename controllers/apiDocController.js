const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directorio base para las documentaciones de API
const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const DOCS_ROOT = path.join(BASE_DIR, 'api_docs');
const DOCS_ROOT_JSON = path.join(BASE_DIR, 'json');

// Asegurar que la carpeta raíz de docs exista
if (!fs.existsSync(DOCS_ROOT)) {
    fs.mkdirSync(DOCS_ROOT, { recursive: true });
}

// Migración suave: si existen archivos en json/json/rama que no estén en api_docs/json/rama, copiarlos
try {
    const legacyRamaDir = path.join(DOCS_ROOT_JSON, 'json', 'rama');
    const targetRamaDir = path.join(DOCS_ROOT, 'json', 'rama');
    if (fs.existsSync(legacyRamaDir)) {
        if (!fs.existsSync(targetRamaDir)) {
            fs.mkdirSync(targetRamaDir, { recursive: true });
        }
        const legacyFiles = fs.readdirSync(legacyRamaDir);
        for (const f of legacyFiles) {
            if (f.endsWith('.json')) {
                const srcFile = path.join(legacyRamaDir, f);
                const dstFile = path.join(targetRamaDir, f);
                if (!fs.existsSync(dstFile)) {
                    fs.copyFileSync(srcFile, dstFile);
                }
            }
        }
    }
} catch {
    // Ignorar errores de migración opcional
}

const listDocs = (req, res) => {
    let targetPath = DOCS_ROOT;
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const subDir = urlParams.searchParams.get('path') || '';

    if (subDir) targetPath = path.join(DOCS_ROOT, subDir);

    try {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const list = items.map(item => ({
            name: item.name,
            isFolder: item.isDirectory(),
            path: path.join(subDir, item.name).replace(/\\/g, '/')
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
};

const saveDoc = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { fileName, folder, content } = JSON.parse(body);
            const targetFolder = path.join(DOCS_ROOT, folder);

            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            const filePath = path.join(targetFolder, fileName.endsWith('.txt') ? fileName : `${fileName}.txt`);
            fs.writeFileSync(filePath, content);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', path: filePath }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
};

const saveJsonDoc = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { fileName, folder, content } = JSON.parse(body);
            // Guardar en DOCS_ROOT para que coincida con listDocs y readFile
            const targetFolder = path.join(DOCS_ROOT, folder);

            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            // Aseguramos la extensión .json
            const cleanName = fileName.replace(/\.json$/i, '');
            const filePath = path.join(targetFolder, `${cleanName}.json`);

            const formattedJson = JSON.stringify(JSON.parse(content), null, 2);
            fs.writeFileSync(filePath, formattedJson, 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', path: filePath }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error procesando JSON: ' + e.message }));
        }
    });
};

const readFile = (req, res) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const filePath = urlParams.searchParams.get('path');
    if (!filePath) return res.end();

    try {
        const fullPath = path.join(DOCS_ROOT, filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content }));
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No se encontró el archivo' }));
    }
};

const deleteItem = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { itemPath } = JSON.parse(body);
            const fullPath = path.join(DOCS_ROOT, itemPath);

            if (fs.lstatSync(fullPath).isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(fullPath);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'deleted' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
};

const analyzeGitRepository = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { repoPath, includeRemote } = JSON.parse(body || '{}');
            const targetRepo = (repoPath || '').trim();

            if (!targetRepo || !fs.existsSync(targetRepo)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'La ruta especificada no existe en el sistema.' }));
                return;
            }

            const execOpts = {
                cwd: targetRepo,
                encoding: 'utf-8',
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe']
            };

            // Verificar si es un repositorio Git válido
            try {
                execSync('git rev-parse --is-inside-work-tree', execOpts);
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'El directorio seleccionado no es un repositorio Git válido (.git no encontrado).' }));
                return;
            }

            let currentBranch = '';
            try {
                currentBranch = execSync('git branch --show-current', execOpts).trim();
            } catch {
                currentBranch = '';
            }

            const refs = includeRemote ? 'refs/heads refs/remotes' : 'refs/heads';
            const rawOutput = execSync(
                `git for-each-ref --sort=-committerdate --format="%(refname:short)|%(objectname:short)|%(contents:subject)|%(committerdate:iso8601)|%(HEAD)|%(refname)" ${refs}`,
                execOpts
            );

            const branches = [];
            const seenNames = new Set();

            const lines = (rawOutput || '').split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const parts = trimmed.split('|');
                const shortName = (parts[0] || '').trim();
                const hash = (parts[1] || '').trim();
                const subject = (parts[2] || '').trim();
                const dateIso = (parts[3] || '').trim();
                const headMarker = (parts[4] || '').trim();
                const fullRef = (parts[5] || '').trim();

                if (!shortName) continue;
                // Ignorar punteros simbólicos como origin/HEAD o origin
                if (shortName.endsWith('/HEAD') || shortName === 'origin') continue;

                const isRemote = fullRef.startsWith('refs/remotes/');
                if (seenNames.has(shortName)) continue;
                seenNames.add(shortName);

                branches.push({
                    name: shortName,
                    lastCommitHash: hash,
                    lastCommitMsg: subject,
                    lastCommitDate: dateIso,
                    isCurrent: headMarker === '*' || shortName === currentBranch,
                    isRemote
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'success',
                repoPath: targetRepo,
                currentBranch,
                branches
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al analizar repositorio Git: ' + e.message }));
        }
    });
};

const getWindowsDrives = () => {
    const drives = [];
    for (let i = 67; i <= 90; i++) {
        const letter = String.fromCharCode(i);
        const drivePath = `${letter}:\\`;
        try {
            if (fs.existsSync(drivePath)) {
                drives.push(drivePath);
            }
        } catch {
            // Ignorar unidades inaccesibles
        }
    }
    return drives.length > 0 ? drives : ['C:\\'];
};

const browseDirectories = (req, res) => {
    try {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        let targetDir = (urlParams.searchParams.get('path') || '').trim();

        const drives = getWindowsDrives();

        if (!targetDir || !fs.existsSync(targetDir)) {
            targetDir = BASE_DIR && fs.existsSync(BASE_DIR) ? BASE_DIR : drives[0];
        }

        const resolvedPath = path.resolve(targetDir);
        const parsedPath = path.parse(resolvedPath);
        const parentPath =
            resolvedPath !== parsedPath.root ? path.dirname(resolvedPath) : null;
        const isCurrentGitRepo = fs.existsSync(path.join(resolvedPath, '.git'));

        let directories = [];
        try {
            const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
            directories = entries
                .filter(entry => {
                    if (!entry.isDirectory()) return false;
                    // Ocultar carpetas del sistema o ocultas innecesarias salvo que sean relevantes
                    if (
                        entry.name.startsWith('$') ||
                        entry.name === 'System Volume Information' ||
                        entry.name === 'node_modules' ||
                        entry.name === '.git' ||
                        entry.name === '.angular'
                    ) {
                        return false;
                    }
                    return true;
                })
                .map(entry => {
                    const fullSubPath = path.join(resolvedPath, entry.name);
                    let isGitRepo = false;
                    try {
                        isGitRepo = fs.existsSync(path.join(fullSubPath, '.git'));
                    } catch {
                        isGitRepo = false;
                    }
                    return {
                        name: entry.name,
                        path: fullSubPath,
                        isGitRepo
                    };
                })
                .sort((a, b) => {
                    if (a.isGitRepo && !b.isGitRepo) return -1;
                    if (!a.isGitRepo && b.isGitRepo) return 1;
                    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
                });
        } catch {
            directories = [];
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                currentPath: resolvedPath,
                parentPath,
                isCurrentGitRepo,
                drives,
                directories
            })
        );
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al explorar directorios: ' + e.message }));
    }
};

module.exports = {
    listDocs,
    saveDoc,
    readFile,
    deleteItem,
    saveJsonDoc,
    analyzeGitRepository,
    browseDirectories
};
