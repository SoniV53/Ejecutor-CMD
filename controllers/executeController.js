const { exec } = require('child_process');

// Controlador para EJECUTAR comandos
const executeCommand = (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { command, path: cwd, background } = JSON.parse(body);
            
            // Reemplazar %CURRENT_DIR% por la ruta seleccionada
            const parsedCommand = command.replace(/%CURRENT_DIR%/gi, cwd);
            
            let fullCommand;
            if (background) {
                // Segundo plano: Ideal para 'start explorer' sin abrir consola
                fullCommand = parsedCommand;
            } else {
                // Normal: Abre una pestaña en Windows Terminal
                // Usamos "-d ." en lugar de "-d \"${cwd}\"" para evitar el bug de Windows
                // donde la barra invertida de "C:\" escapa las comillas y rompe el comando.
                fullCommand = `wt -w 0 nt -d . cmd /k "${parsedCommand}"`;
            }
            
            exec(fullCommand, { cwd }, (error) => {
                if (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'Ejecutado correctamente' }));
            });
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al procesar la petición de ejecución' }));
        }
    });
};

module.exports = {
    executeCommand
};