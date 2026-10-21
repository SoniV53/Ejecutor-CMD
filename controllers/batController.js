const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const BAT_DIR = path.join(BASE_DIR, 'bat');

// Asegurar que la carpeta "bat" exista en la raíz de la app (igual que la carpeta "json")
if (!fs.existsSync(BAT_DIR)) {
    fs.mkdirSync(BAT_DIR, { recursive: true });
}

// Controlador para guardar o crear un archivo .bat en la carpeta "bat" de la app
const saveBat = (req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => {
        try {
            const { dirPath, fileName, content } = JSON.parse(body || '{}');

            if (!fileName || !fileName.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'El nombre del archivo .bat es obligatorio.' }));
                return;
            }

            let cleanName = path.basename(fileName.trim());
            if (!cleanName.toLowerCase().endsWith('.bat') && !cleanName.toLowerCase().endsWith('.cmd')) {
                cleanName += '.bat';
            }

            // Se guarda por defecto en la carpeta "bat" de la app, igual que los json
            let effectiveDir = (dirPath || '').trim();
            if (!effectiveDir || effectiveDir === 'BAT_DIR' || effectiveDir === 'app') {
                effectiveDir = BAT_DIR;
            }

            if (!fs.existsSync(effectiveDir)) {
                fs.mkdirSync(effectiveDir, { recursive: true });
            }

            const fullPath = path.join(effectiveDir, cleanName);

            // Normalizar saltos de línea para Windows batch (CRLF: \r\n)
            const normalizedContent = (content || '').replace(/\r?\n/g, '\r\n');

            fs.writeFileSync(fullPath, normalizedContent, 'utf8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    status: 'success',
                    message: 'Archivo .bat guardado exitosamente en la carpeta de la app',
                    fileName: cleanName,
                    dirPath: effectiveDir,
                    fullPath: fullPath,
                    scriptCommand: `call "${fullPath}"`
                })
            );
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al guardar archivo .bat: ' + error.message }));
        }
    });
};

// Controlador para leer el contenido de un archivo .bat
const readBat = (req, res) => {
    try {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        let filePath = urlParams.searchParams.get('path');
        const fileName = urlParams.searchParams.get('file');

        if (!filePath && fileName) {
            filePath = path.join(BAT_DIR, path.basename(fileName));
        }

        if (!filePath || !fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Archivo .bat no encontrado en: ' + (filePath || 'ruta vacía') }));
            return;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                status: 'success',
                fileName: path.basename(filePath),
                filePath,
                content
            })
        );
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al leer archivo .bat: ' + error.message }));
    }
};

// Controlador para listar archivos .bat en la carpeta "bat" de la app
const listBats = (req, res) => {
    try {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const dirPath = urlParams.searchParams.get('dir') || BAT_DIR;

        if (!fs.existsSync(dirPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', batDir: BAT_DIR, files: [] }));
            return;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const files = entries
            .filter(e => e.isFile() && (e.name.toLowerCase().endsWith('.bat') || e.name.toLowerCase().endsWith('.cmd')))
            .map(e => ({
                name: e.name,
                fullPath: path.join(dirPath, e.name)
            }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', batDir: BAT_DIR, files }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al listar archivos .bat: ' + error.message }));
    }
};

// Controlador para exportar / descargar un archivo .bat
const exportBat = (req, res) => {
    try {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        let filePath = urlParams.searchParams.get('path');
        const fileName = urlParams.searchParams.get('file');

        if (!filePath && fileName) {
            filePath = path.join(BAT_DIR, path.basename(fileName));
        }

        if (!filePath || !fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Archivo .bat no encontrado para exportar');
            return;
        }

        const cleanName = path.basename(filePath);
        const content = fs.readFileSync(filePath, 'utf8');

        res.writeHead(200, {
            'Content-Type': 'application/x-bat; charset=utf-8',
            'Content-Disposition': `attachment; filename="${cleanName}"`,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error al exportar archivo .bat: ' + error.message);
    }
};

// Controlador para obtener información de la carpeta de la app
const getBatInfo = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
        JSON.stringify({
            status: 'success',
            batDir: BAT_DIR,
            baseDir: BASE_DIR
        })
    );
};

// Controlador para eliminar un archivo .bat
const deleteBat = (req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => {
        try {
            const { filePath, fileName } = JSON.parse(body || '{}');
            let targetPath = filePath;
            if (!targetPath && fileName) {
                targetPath = path.join(BAT_DIR, path.basename(fileName));
            }
            if (targetPath && fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', message: 'Archivo .bat eliminado' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al eliminar archivo .bat: ' + error.message }));
        }
    });
};

module.exports = {
    saveBat,
    readBat,
    listBats,
    exportBat,
    getBatInfo,
    deleteBat,
    BAT_DIR
};
