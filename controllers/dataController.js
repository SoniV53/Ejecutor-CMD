const fs = require('fs');
const path = require('path');

// --- TRUCO PARA MODO PORTABLE (.EXE) ---
const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const DATA_FILE = path.join(BASE_DIR, 'json/datos_consola.json');

// Controlador para OBTENER datos
const getData = (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al leer los datos' }));
    }
};

// Controlador para GUARDAR datos
const saveData = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            fs.writeFileSync(DATA_FILE, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'Data guardada correctamente' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al guardar los datos' }));
        }
    });
};

module.exports = {
    getData,
    saveData
};