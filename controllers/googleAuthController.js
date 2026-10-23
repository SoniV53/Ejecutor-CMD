const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || path.join(__dirname, '..');
const JSON_DIR = path.join(BASE_DIR, 'json');
const AUTH_FILE = path.join(JSON_DIR, 'google_auth.json');

// Carga automática de variables de entorno desde el archivo .env
function loadEnvFile() {
    const envPath = path.join(BASE_DIR, '.env');
    if (fs.existsSync(envPath)) {
        try {
            const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.substring(0, eqIdx).trim();
                    const val = trimmed.substring(eqIdx + 1).trim();
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        } catch (e) {
            console.error('Error cargando .env:', e);
        }
    }
}
loadEnvFile();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// Helper para hacer peticiones HTTPS simples en Node.js
function httpsRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk.toString('utf8'));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '{}');
                    resolve({ statusCode: res.statusCode, data: parsed, raw: body });
                } catch {
                    resolve({ statusCode: res.statusCode, data: body, raw: body });
                }
            });
        });

        req.on('error', err => reject(err));
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

function loadAuthData() {
    try {
        if (fs.existsSync(AUTH_FILE)) {
            return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error leyendo google_auth.json:', e);
    }
    return null;
}

function saveAuthData(data) {
    try {
        if (!fs.existsSync(JSON_DIR)) {
            fs.mkdirSync(JSON_DIR, { recursive: true });
        }
        fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error guardando google_auth.json:', e);
    }
}

// Obtener un token de acceso válido (renovándolo automáticamente si expiró)
async function getValidAccessToken() {
    const auth = loadAuthData();
    if (!auth || !auth.tokens) return null;

    const { access_token, refresh_token, expires_at } = auth.tokens;

    // Si el token aún es válido (con margen de 60 segundos), usarlo
    if (expires_at && Date.now() < (expires_at - 60000)) {
        return access_token;
    }

    // Si expiró pero tenemos refresh_token, renovar
    if (refresh_token) {
        try {
            const postBody = new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refresh_token,
                grant_type: 'refresh_token'
            }).toString();

            const res = await httpsRequest({
                hostname: 'oauth2.googleapis.com',
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postBody)
                }
            }, postBody);

            if (res.statusCode === 200 && res.data.access_token) {
                auth.tokens.access_token = res.data.access_token;
                auth.tokens.expires_at = Date.now() + ((res.data.expires_in || 3600) * 1000);
                saveAuthData(auth);
                return auth.tokens.access_token;
            }
        } catch (e) {
            console.error('Error refrescando access_token de Google:', e);
        }
    }

    return null;
}

// Iniciar sesión: Redirige al navegador a Google OAuth
const login = (req, res) => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&access_type=offline` +
        `&prompt=consent`;

    res.writeHead(302, { Location: authUrl });
    res.end();
};

// Callback de Google tras la autorización en el navegador
const callback = async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');

    if (error || !code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <title>Error de Autenticación</title>
                <style>
                    body { background: #020617; color: #f1f5f9; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #0a0f1d; border: 1px solid #e11d48; border-radius: 16px; padding: 36px; text-align: center; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                    h2 { margin: 0 0 10px; color: #f43f5e; font-size: 20px; }
                    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
                    .btn { display: inline-block; background: #334155; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; font-size: 13px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>No se completó la autenticación</h2>
                    <p>Ocurrió un problema: ${error || 'Código no recibido'}.</p>
                    <a href="javascript:window.close()" class="btn">Cerrar pestaña</a>
                </div>
            </body>
            </html>
        `);
        return;
    }

    try {
        // Canjear code por tokens
        const postData = new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }).toString();

        const tokenRes = await httpsRequest({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, postData);

        if (tokenRes.statusCode !== 200 || !tokenRes.data.access_token) {
            throw new Error(tokenRes.data.error_description || tokenRes.data.error || 'Error al obtener tokens de Google');
        }

        const tokens = tokenRes.data;
        const expiresAt = Date.now() + ((tokens.expires_in || 3600) * 1000);

        // Obtener datos del perfil del usuario
        const userRes = await httpsRequest({
            hostname: 'www.googleapis.com',
            path: '/oauth2/v3/userinfo',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        const userData = userRes.data || {};
        const userProfile = {
            name: userData.name || userData.given_name || 'Usuario Google',
            email: userData.email || '',
            picture: userData.picture || ''
        };

        // Guardar sesión
        saveAuthData({
            tokens: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || (loadAuthData()?.tokens?.refresh_token) || '',
                expires_at: expiresAt
            },
            user: userProfile,
            connectedAt: Date.now()
        });

        // Mostrar pantalla de éxito moderna en el navegador
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <title>¡Conexión Exitosa con Google Drive!</title>
                <style>
                    body {
                        background: #020617;
                        color: #f1f5f9;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: #0a0f1d;
                        border: 1px solid #1e293b;
                        border-radius: 20px;
                        padding: 40px;
                        text-align: center;
                        max-width: 440px;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                    }
                    .avatar {
                        width: 64px;
                        height: 64px;
                        border-radius: 50%;
                        border: 2px solid #10b981;
                        margin: 0 auto 16px;
                        display: block;
                    }
                    .check-circle {
                        width: 52px;
                        height: 52px;
                        background: rgba(16, 185, 129, 0.15);
                        border: 1px solid rgba(16, 185, 129, 0.4);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 16px;
                        color: #10b981;
                        font-size: 24px;
                        font-weight: bold;
                    }
                    h2 {
                        margin: 0 0 8px;
                        font-size: 22px;
                        font-weight: 700;
                        color: #fff;
                    }
                    p {
                        color: #94a3b8;
                        font-size: 14px;
                        line-height: 1.5;
                        margin: 0 0 24px;
                    }
                    .badge {
                        display: inline-block;
                        padding: 6px 14px;
                        background: #1e293b;
                        border-radius: 9999px;
                        font-size: 12px;
                        color: #cbd5e1;
                        font-weight: 600;
                        margin-bottom: 20px;
                    }
                    .close-notice {
                        font-size: 12px;
                        color: #64748b;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    ${userProfile.picture ? `<img src="${userProfile.picture}" class="avatar" alt="Avatar"/>` : `<div class="check-circle">✓</div>`}
                    <h2>¡Conexión Exitosa!</h2>
                    <div class="badge">${userProfile.name} &bull; ${userProfile.email}</div>
                    <p>Tu cuenta de Google Drive ha quedado vinculada con <strong>Workspace Hub</strong>. Tus archivos de <code style="color:#10b981">api_docs/</code>, <code style="color:#6366f1">bat/</code> y <code style="color:#f59e0b">json/</code> ya pueden sincronizarse.</p>
                    <div class="close-notice">Ya puedes cerrar esta pestaña y volver a la app.</div>
                </div>
                <script>
                    setTimeout(() => {
                        try { window.close(); } catch(e){}
                    }, 4000);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error en callback de Google OAuth:', err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <title>Error de Servidor</title>
                <style>
                    body { background: #020617; color: #f1f5f9; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #0a0f1d; border: 1px solid #e11d48; border-radius: 16px; padding: 36px; text-align: center; max-width: 440px; }
                    h2 { margin: 0 0 10px; color: #f43f5e; }
                    p { color: #94a3b8; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Error de autenticación</h2>
                    <p>${err.message || err}</p>
                    <a href="javascript:window.close()" style="color:#60a5fa">Cerrar pestaña</a>
                </div>
            </body>
            </html>
        `);
    }
};

// Estado de la sesión actual
const status = async (req, res) => {
    const auth = loadAuthData();
    if (!auth || !auth.tokens || !auth.user) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ isLoggedIn: false, user: null }));
        return;
    }

    const token = await getValidAccessToken();
    if (!token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ isLoggedIn: false, user: null }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        isLoggedIn: true,
        user: auth.user,
        connectedAt: auth.connectedAt,
        token
    }));
};

// Obtener token fresco
const getToken = async (req, res) => {
    const token = await getValidAccessToken();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token: token || null }));
};

// Cerrar sesión
const logout = (req, res) => {
    try {
        if (fs.existsSync(AUTH_FILE)) {
            fs.unlinkSync(AUTH_FILE);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'Sesión cerrada' }));
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: e.message || e }));
    }
};

module.exports = {
    login,
    callback,
    status,
    getToken,
    logout,
    getValidAccessToken,
    CLIENT_ID,
    REDIRECT_URI
};
