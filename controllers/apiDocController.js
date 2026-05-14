const fs = require('fs');
const path = require('path');

// Directorio base para las documentaciones de API
const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const DOCS_ROOT = path.join(BASE_DIR, 'api_docs');

// Asegurar que la carpeta raíz de docs exista
if (!fs.existsSync(DOCS_ROOT)) {
    fs.mkdirSync(DOCS_ROOT, { recursive: true });
}

const listDocs = (req, res) => {
    let targetPath = DOCS_ROOT;
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const subDir = urlParams.searchParams.get('path') || '';
    
    if (subDir) targetPath = path.join(DOCS_ROOT, subDir);

    try {
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const list = items.map(item => ({
            name: item.name,
            isFolder: item.isDirectory(),
            path: path.join(subDir, item.name).replace(/\\/g, '/')
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
    } catch (e) {
        res.writeHead(500);
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
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
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
        res.writeHead(404);
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
            
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'deleted' }));
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
    });
};

module.exports = { listDocs, saveDoc, readFile, deleteItem };