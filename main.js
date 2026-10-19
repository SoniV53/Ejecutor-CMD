const { app, BrowserWindow, session, Tray, Menu, ipcMain, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

// Iniciamos el servidor de Node.js
require('./server.js');
const { killAllProcessesSync } = require('./controllers/executeController');
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow;
let tray = null; // Variable para el icono de la bandeja
let isQuiting = false; // Flag para manejar la salida real
let runInBackground = true; // Controla si al cerrar (X) se minimiza a la bandeja o se cierra por completo

const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');
const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.92 Mobile Safari/537.36";

const saveWindowState = () => {
  try {
    const bounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : { width: 1300, height: 900 };
    fs.writeFileSync(windowStateFile, JSON.stringify({ ...bounds, runInBackground }));
  } catch (error) { }
};

app.on('ready', () => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = MOBILE_USER_AGENT;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  let windowState = { width: 1300, height: 900 };

  try {
    if (fs.existsSync(windowStateFile)) {
      windowState = JSON.parse(fs.readFileSync(windowStateFile));
      if (typeof windowState.runInBackground === 'boolean') {
        runInBackground = windowState.runInBackground;
      }
    }
  } catch (error) { }

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    title: "Workspace",
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      webviewTag: true,
      nodeIntegrationInSubFrames: true,
    }
  });

 mainWindow.loadURL('http://localhost:3000');
 // mainWindow.loadFile('index.html');
  //mainWindow.webContents.openDevTools();
  mainWindow.setMenu(null);

  // --- INTEGRACIÓN DE SYSTEM TRAY ---
  const iconPath = path.join(__dirname, 'assets/icon.ico');
  tray = new Tray(iconPath);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar / Ocultar', click: () => {
        if (mainWindow.isVisible()) { mainWindow.hide(); }
        else { mainWindow.show(); mainWindow.focus(); }
      }
    },
    { type: 'separator' },
    {
      label: 'Inicio (Hub)', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'hub-view');
      }
    },
    {
      label: 'Panel Local (CMD)', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'cmd-view');
      }
    },
    {
      label: 'Doc Generator', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'doc-view');
      }
    },
    {
      label: 'Redes', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'redes-view');
      }
    },
    {
      label: 'API Docs', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'api-view');
      }
    },
    {
      label: 'Repo Docs', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'repo-view');
      }
    },
    {
      label: 'Emulador', click: () => {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('navigate', 'emu-view');
      }
    },
    { type: 'separator' },
    { label: 'Salir', click: () => { isQuiting = true; killAllProcessesSync(); app.quit(); } }
  ]);

  tray.setToolTip('ConsoleFlow Workspace');
  tray.setContextMenu(contextMenu);

  // --- LÓGICA DE MINIMIZADO O CIERRE TOTAL ---
  mainWindow.on('close', (event) => {
    saveWindowState();
    if (!isQuiting && runInBackground) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      isQuiting = true;
      killAllProcessesSync();
      if (tray) {
        try { tray.destroy(); } catch (e) { }
        tray = null;
      }
      app.quit();
    }
  });


});

ipcMain.on('set-run-in-background', (_event, enabled) => {
  runInBackground = !!enabled;
  saveWindowState();
});

ipcMain.on('abrir-emulador', () => {
  let emuWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Emulador",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true // Permisos completos
    }
  });
  // Cargamos la ruta Angular del emulador
  emuWindow.loadURL('http://localhost:3000/emulador');

  // Ocultar la barra de menú por defecto si lo deseas
  emuWindow.setMenuBarVisibility(false);
});

// Garantizar limpieza de todos los procesos CMD activos al salir o cerrar la app
app.on('before-quit', () => {
  isQuiting = true;
  killAllProcessesSync();
});

app.on('will-quit', () => {
  killAllProcessesSync();
});

app.on('quit', () => {
  killAllProcessesSync();
});

// Permite restaurar al hacer clic en el icono de la bandeja
app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});