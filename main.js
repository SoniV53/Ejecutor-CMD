const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs'); // Importante: Necesario para leer/guardar el archivo de estado

// Iniciamos el servidor de Node.js
require('./server.js');

let mainWindow;

// Archivo donde se guardará el estado de la ventana de forma segura (AppData)
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

// User Agent de un Google Pixel 7 para forzar el modo móvil
const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.92 Mobile Safari/537.36";

app.on('ready', () => {
  // Configuramos el User Agent global para todas las peticiones
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = MOBILE_USER_AGENT;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  let windowState = { width: 1300, height: 900 }; 

  // 2. Intentamos leer el archivo guardado con la última posición
  try {
      if (fs.existsSync(windowStateFile)) {
          windowState = JSON.parse(fs.readFileSync(windowStateFile));
      }
  } catch (error) {
      console.log("No hay posición guardada o hubo un error al leer.");
  }

  // 3. Creamos la ventana inyectando los valores (x, y, width, height)
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x, // Restaura la posición X (horizontal) en la pantalla
    y: windowState.y, // Restaura la posición Y (vertical) en la pantalla
    title: "Workspace",
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Esto permite que el navegador reporte que tiene soporte táctil
      enableRemoteModule: true,
      webSecurity: false,
      webviewTag: true,
    }
  });

  mainWindow.loadURL('http://localhost:3000');
  
  mainWindow.setMenu(null); 

  mainWindow.on('close', () => {
      const bounds = mainWindow.getBounds(); 
      try {
          fs.writeFileSync(windowStateFile, JSON.stringify(bounds));
      } catch (error) {
          console.error("Error al guardar la posición de la ventana:", error);
      }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});