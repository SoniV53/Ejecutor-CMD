const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// Iniciamos el servidor de Node.js
require('./server.js');

let mainWindow;

// User Agent de un Google Pixel 7 para forzar el modo móvil
const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.92 Mobile Safari/537.36";

app.on('ready', () => {
  // Configuramos el User Agent global para todas las peticiones
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = MOBILE_USER_AGENT;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "Workspace",
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Esto permite que el navegador reporte que tiene soporte táctil
      enableRemoteModule: true, 
      webSecurity: false
    }
  });

  // Cargamos tu hub principal
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});