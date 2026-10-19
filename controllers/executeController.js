const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');

// Mapa de procesos activos en el CMD interno: processId -> ChildProcess
const activeProcesses = new Map();

// Conserva los códigos ANSI de color (\x1B[...m) pero limpia secuencias de movimiento de cursor/título de ventana
const cleanTerminalOutput = (str) => {
  if (!str) return '';
  return str
    .replace(/\x1B\][^\x07\x1B]*(\x07|\x1B\\)/g, '')
    .replace(/\x1B\[[0-?]*[ -/]*[@-l,n-~]/g, '');
};

// Mata un árbol de procesos en Windows por PID (asíncrono)
const killPidTreeAsync = (pid, callback) => {
  if (!pid) {
    if (callback) callback();
    return;
  }
  exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true }, () => {
    if (callback) callback();
  });
};

// Mata un árbol de procesos en Windows por PID de forma SÍNCRONA (garantiza limpieza al cerrar/morir la app)
const killPidTreeSync = (pid) => {
  if (!pid) return;
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore', windowsHide: true });
  } catch {
    // Ignorar si el proceso ya había terminado
  }
};

// Detiene de forma síncrona TODOS los procesos activos (usado cuando la app se cierra o muere)
const killAllProcessesSync = () => {
  if (activeProcesses.size === 0) return;
  for (const [processId, child] of activeProcesses.entries()) {
    try {
      if (child && child.pid) {
        killPidTreeSync(child.pid);
      }
      if (child && !child.killed) {
        child.kill('SIGKILL');
      }
    } catch {
      // Ignorar errores individuales al cerrar
    }
    activeProcesses.delete(processId);
  }
};

// Registrar listeners globales del proceso Node/Electron para nunca dejar procesos huérfanos
process.on('exit', () => {
  killAllProcessesSync();
});

['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach((signal) => {
  process.on(signal, () => {
    killAllProcessesSync();
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Excepción no controlada, limpiando procesos CMD activos:', err);
  killAllProcessesSync();
});

const executeCommand = (req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk.toString()));
  req.on('end', () => {
    try {
      const { command, path: requestedCwd } = JSON.parse(body);

      // Validar que el directorio exista; si no, usar el directorio actual del proceso
      let effectiveCwd = requestedCwd && requestedCwd.trim() ? requestedCwd.trim() : process.cwd();
      if (!fs.existsSync(effectiveCwd)) {
        effectiveCwd = process.cwd();
      }

      // Reemplazar %CURRENT_DIR% por la ruta efectiva
      const parsedCommand = (command || '').replace(/%CURRENT_DIR%/gi, effectiveCwd);
      const processId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Cabeceras para streaming en tiempo real (NDJSON)
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const sendEvent = (payload) => {
        if (!res.writableEnded) {
          res.write(JSON.stringify(payload) + '\n');
        }
      };

      // Ejecutamos en el CMD interno de Windows sin abrir ventana externa (windowsHide: true)
      // Usamos windowsVerbatimArguments: true + comillas externas para que Node no escape las comillas como \"
      const child = spawn('cmd.exe', ['/d', '/s', '/c', `"chcp 65001 >nul && ${parsedCommand}"`], {
        cwd: effectiveCwd,
        windowsHide: true,
        windowsVerbatimArguments: true,
        env: { ...process.env, FORCE_COLOR: '1' }
      });

      activeProcesses.set(processId, child);

      sendEvent({
        type: 'start',
        processId,
        pid: child.pid,
        command: parsedCommand,
        cwd: effectiveCwd
      });

      child.stdout.on('data', (data) => {
        sendEvent({
          type: 'stdout',
          processId,
          text: cleanTerminalOutput(data.toString('utf8'))
        });
      });

      child.stderr.on('data', (data) => {
        sendEvent({
          type: 'stderr',
          processId,
          text: cleanTerminalOutput(data.toString('utf8'))
        });
      });

      child.on('error', (err) => {
        sendEvent({
          type: 'stderr',
          processId,
          text: `\n[Error al iniciar comando]: ${err.message}\n`
        });
      });

      child.on('close', (code) => {
        activeProcesses.delete(processId);
        sendEvent({
          type: 'exit',
          processId,
          code: code !== null ? code : 0
        });
        if (!res.writableEnded) {
          res.end();
        }
      });

      // Si la ventana/cliente cierra la conexión (ej. recarga o cierre de ventana), matar el proceso activo
      res.on('close', () => {
        if (activeProcesses.has(processId)) {
          const runningChild = activeProcesses.get(processId);
          activeProcesses.delete(processId);
          if (runningChild && runningChild.pid) {
            killPidTreeAsync(runningChild.pid);
          }
        }
      });
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al procesar la petición de ejecución: ' + error.message }));
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });
};

// Detener un proceso en ejecución (incluyendo subprocesos en Windows con taskkill /T /F)
const killProcess = (req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk.toString()));
  req.on('end', () => {
    try {
      const { processId } = JSON.parse(body);
      const child = activeProcesses.get(processId);

      if (!child || !child.pid) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'not_found' }));
        return;
      }

      killPidTreeAsync(child.pid, () => {
        activeProcesses.delete(processId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'killed', processId }));
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
};

// Detener TODOS los procesos activos (endpoint HTTP)
const killAllProcesses = (req, res) => {
  try {
    const count = activeProcesses.size;
    killAllProcessesSync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'killed_all', count }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
};

// Enviar entrada estándar (stdin) a un proceso activo
const sendInputToProcess = (req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk.toString()));
  req.on('end', () => {
    try {
      const { processId, input } = JSON.parse(body);
      const child = activeProcesses.get(processId);

      if (!child || !child.stdin || child.stdin.destroyed) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proceso no disponible para entrada' }));
        return;
      }

      child.stdin.write((input || '') + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'sent' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
};

module.exports = {
  executeCommand,
  killProcess,
  killAllProcesses,
  killAllProcessesSync,
  sendInputToProcess
};