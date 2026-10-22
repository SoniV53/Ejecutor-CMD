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

function resolveRoot(root) {
    const trimmed = (root || '').trim();
    if (trimmed && fs.existsSync(trimmed)) {
        return trimmed;
    }
    return DOCS_ROOT;
}

const getDocInfo = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        defaultDocsDir: DOCS_ROOT,
        baseDir: BASE_DIR
    }));
};

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
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const rootParam = urlParams.searchParams.get('root') || '';
    const subDir = urlParams.searchParams.get('path') || '';
    const effectiveRoot = resolveRoot(rootParam);

    const targetPath = subDir ? path.join(effectiveRoot, subDir) : effectiveRoot;

    try {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const list = items
            .filter(item => !item.name.startsWith('.') && item.name !== '_init.txt')
            .map(item => {
                const itemRelPath = path.join(subDir, item.name).replace(/\\/g, '/');
                const ext = path.extname(item.name).toLowerCase();
                return {
                    name: item.name,
                    isFolder: item.isDirectory(),
                    path: itemRelPath,
                    fullPath: path.join(targetPath, item.name),
                    extension: ext
                };
            })
            .sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
            });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
};

function readDirTree(dirPath, rootPath, maxDepth = 12, currentDepth = 0) {
    if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return [];
    try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        return items
            .filter(item => !item.name.startsWith('.') && item.name !== '_init.txt' && item.name !== '.keep.txt' && item.name !== '.keep' && item.name !== 'node_modules')
            .map(item => {
                const fullPath = path.join(dirPath, item.name);
                const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                const isFolder = item.isDirectory();
                const ext = isFolder ? '' : path.extname(item.name).toLowerCase();
                return {
                    name: item.name,
                    isFolder,
                    path: relPath,
                    fullPath,
                    extension: ext,
                    children: isFolder ? readDirTree(fullPath, rootPath, maxDepth, currentDepth + 1) : []
                };
            })
            .sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
            });
    } catch {
        return [];
    }
}

const getDocTree = (req, res) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const rootParam = urlParams.searchParams.get('root') || '';
    const effectiveRoot = resolveRoot(rootParam);

    try {
        if (!fs.existsSync(effectiveRoot)) {
            fs.mkdirSync(effectiveRoot, { recursive: true });
        }
        const tree = readDirTree(effectiveRoot, effectiveRoot);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tree));
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
            const { fileName, folder, content, root } = JSON.parse(body);
            const effectiveRoot = resolveRoot(root);
            const targetFolder = folder ? path.join(effectiveRoot, folder) : effectiveRoot;

            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            let cleanName = (fileName || '').trim();
            if (!cleanName) {
                cleanName = 'nota.txt';
            }

            // Si no tiene extensión, verificar si el contenido es JSON o usar .txt
            if (!path.extname(cleanName)) {
                try {
                    JSON.parse(content);
                    cleanName += '.json';
                } catch {
                    cleanName += '.txt';
                }
            }

            const filePath = path.join(targetFolder, cleanName);
            fs.writeFileSync(filePath, content || '', 'utf-8');

            const relPath = path.join(folder || '', cleanName).replace(/\\/g, '/');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'success',
                fileName: cleanName,
                path: relPath,
                fullPath: filePath
            }));
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
            const { fileName, folder, content, root } = JSON.parse(body);
            const effectiveRoot = resolveRoot(root);
            const targetFolder = folder ? path.join(effectiveRoot, folder) : effectiveRoot;

            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            const cleanName = fileName.replace(/\.json$/i, '');
            const filePath = path.join(targetFolder, `${cleanName}.json`);

            const formattedJson = JSON.stringify(JSON.parse(content), null, 2);
            fs.writeFileSync(filePath, formattedJson, 'utf-8');

            const relPath = path.join(folder || '', `${cleanName}.json`).replace(/\\/g, '/');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', path: relPath, fullPath: filePath }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error procesando JSON: ' + e.message }));
        }
    });
};

const readFile = (req, res) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const filePath = urlParams.searchParams.get('path');
    const rootParam = urlParams.searchParams.get('root') || '';
    if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Ruta no especificada' }));
    }

    const effectiveRoot = resolveRoot(rootParam);

    try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(effectiveRoot, filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            content,
            fileName: path.basename(fullPath),
            fullPath,
            path: filePath
        }));
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No se encontró el archivo: ' + e.message }));
    }
};

const deleteItem = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { itemPath, root } = JSON.parse(body);
            const effectiveRoot = resolveRoot(root);
            const fullPath = path.isAbsolute(itemPath) ? itemPath : path.join(effectiveRoot, itemPath);

            if (fs.existsSync(fullPath)) {
                if (fs.lstatSync(fullPath).isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(fullPath);
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'deleted' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
};

const renameItem = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { oldPath, newName, root } = JSON.parse(body);
            const effectiveRoot = resolveRoot(root);
            const fullOldPath = path.isAbsolute(oldPath) ? oldPath : path.join(effectiveRoot, oldPath);

            if (!fs.existsSync(fullOldPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'El archivo original no existe.' }));
                return;
            }

            const dir = path.dirname(fullOldPath);
            const fullNewPath = path.join(dir, (newName || '').trim());
            fs.renameSync(fullOldPath, fullNewPath);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'success',
                newPath: fullNewPath,
                newName: path.basename(fullNewPath)
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
};

const openInExplorer = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { folder, root } = JSON.parse(body || '{}');
            const effectiveRoot = resolveRoot(root);
            const targetFolder = folder ? (path.isAbsolute(folder) ? folder : path.join(effectiveRoot, folder)) : effectiveRoot;

            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            const { exec } = require('child_process');
            exec(`explorer.exe "${targetFolder}"`, { windowsHide: false });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', targetFolder }));
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

const getBranchCommits = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { repoPath, branchName, limit } = JSON.parse(body || '{}');
            const targetRepo = (repoPath || '').trim();
            const targetBranch = (branchName || '').trim();
            const maxCommits = Number(limit) > 0 ? Number(limit) : 150;

            if (!targetRepo || !fs.existsSync(targetRepo)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: ' primero selecciona un directorio de repositorio Git válido en el Apartado de Análisis.' }));
                return;
            }

            if (!targetBranch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Nombre de rama no especificado.' }));
                return;
            }

            const execOpts = {
                cwd: targetRepo,
                encoding: 'utf-8',
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe']
            };

            let rawLog = '';
            try {
                rawLog = execSync(
                    `git log "${targetBranch}" -n ${maxCommits} --format="%h|%s|%cI|%an"`,
                    execOpts
                );
            } catch {
                // Intentar con origin/<branchName> por si es una rama remota no descargada localmente
                try {
                    rawLog = execSync(
                        `git log "origin/${targetBranch}" -n ${maxCommits} --format="%h|%s|%cI|%an"`,
                        execOpts
                    );
                } catch {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            error: `No se encontró la rama "${targetBranch}" en el repositorio Git (${targetRepo}).`
                        })
                    );
                    return;
                }
            }

            const commits = [];
            const lines = (rawLog || '').split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const parts = trimmed.split('|');
                const hash = (parts[0] || '').trim();
                const message = (parts[1] || '').trim();
                const date = (parts[2] || '').trim();
                const author = (parts[3] || '').trim();
                if (!hash) continue;

                commits.push({
                    hash,
                    message,
                    date,
                    author
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    status: 'success',
                    branchName: targetBranch,
                    commits
                })
            );
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al obtener commits de la rama: ' + e.message }));
        }
    });
};

module.exports = {
    getDocInfo,
    listDocs,
    saveDoc,
    readFile,
    deleteItem,
    renameItem,
    openInExplorer,
    saveJsonDoc,
    analyzeGitRepository,
    browseDirectories,
    getBranchCommits,
    getDocTree
};

