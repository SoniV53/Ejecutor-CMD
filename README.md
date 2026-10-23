# Workspace Hub — ConsoleFlow

Aplicación de escritorio para gestión de comandos, emulador, documentación y automatización local con sincronización en la nube (Google Drive).

---

## 🔐 Configuración de Variables de Entorno (`.env`)

Para habilitar la autenticación e integración con **Google Drive**, es necesario tener un archivo `.env` en la raíz del proyecto.

### 1. Crear el archivo `.env`
Copia o renombra el archivo `.env.example`:
```bash
cp .env.example .env
```

### 2. Configurar las credenciales de Google Cloud
Edita el archivo `.env` con tus credenciales de [Google Cloud Console](https://console.cloud.google.com/):

```env
# Credenciales de Google OAuth 2.0
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### 3. Requisitos en Google Cloud Console
En tu proyecto de Google Cloud:
* **Google Drive API**: Debe estar habilitada en la biblioteca de APIs.
* **Pantalla de consentimiento de OAuth**:
  * Tipo de usuario: *Externo*.
  * Scope: `.../auth/drive.file`, `.../auth/userinfo.profile`, `.../auth/userinfo.email`.
  * *Usuarios de prueba* (mientras esté en desarrollo): Agrega tu correo de Gmail.
* **Credenciales (ID de cliente OAuth - Aplicación web)**:
  * **Orígenes autorizados de JavaScript**:
    * `http://localhost:3000`
    * `http://localhost:4200`
  * **URIs de redireccionamiento autorizados**:
    * `http://localhost:3000/api/auth/google/callback`

> [!NOTE]
> El archivo `.env` está protegido en `.gitignore` para evitar subir contraseñas o secretos a repositorios públicos.

---

## 🚀 Comandos de Ejecución y Compilación

### Modo Desarrollo
Iniciar el servidor de desarrollo Angular:
```bash
npm run dev
```

Iniciar la app de escritorio en Electron:
```bash
npm start
```

### Compilación Web (Frontend)
Compilar los paquetes estáticos de Angular:
```bash
npm run build:web
```

### Generación del Ejecutable Portable (.exe)
Compilar la web y empaquetar el ejecutable portable de Windows:
```bash
npm run build
```
O manualmente:
```bash
npm run build:web
npx electron-builder --win portable
```
El archivo ejecutable generado se guardará en la carpeta `dist/` con el nombre `Workspace-Hub.exe`.

```
El archivo ejecutable generado se guardará en la carpeta `dist/` con el nombre `Workspace-Hub.exe`.
npx electron-builder --win portable