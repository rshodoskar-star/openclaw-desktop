import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  desktopCapturer,
  Notification,
  Tray,
  Menu,
  nativeImage,
  shell,
  globalShortcut,
  clipboard,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createTray } from './tray';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
// node-pty: dynamic require — graceful fallback if native module unavailable
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
} catch (err: any) {
  console.warn('[PTY] node-pty not available — Terminal disabled:', err.message);
}

// ═══════════════════════════════════════════════════════════
// Device Identity (Ed25519) — Required for Gateway operator scopes
// ═══════════════════════════════════════════════════════════

interface DeviceIdentity {
  privateKeyPem: string;
  publicKeyPem: string;
  publicKeyRawB64Url: string;
  deviceId: string;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getOrCreateDeviceIdentity(appPath: string): DeviceIdentity {
  const identityPath = path.join(appPath, 'device-identity.json');

  // Try loading existing identity
  try {
    if (fs.existsSync(identityPath)) {
      const data = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      if (data.privateKeyPem && data.publicKeyPem && data.deviceId && data.publicKeyRawB64Url) {
        return data;
      }
    }
  } catch (e) {
    console.error('[Device] Failed to load identity:', e);
  }

  // Generate new Ed25519 keypair
  console.log('[Device] Generating new Ed25519 keypair...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  // Extract raw 32-byte public key from SPKI DER
  const spkiDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
  const rawKey = spkiDer.subarray(spkiDer.length - 32);

  const identity: DeviceIdentity = {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    publicKeyRawB64Url: base64UrlEncode(rawKey),
    deviceId: crypto.createHash('sha256').update(rawKey).digest('hex'),
  };

  // Save with restrictive permissions
  fs.mkdirSync(path.dirname(identityPath), { recursive: true });
  fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2), { mode: 0o600 });
  console.log('[Device] Identity created:', identity.deviceId.substring(0, 16) + '...');

  return identity;
}

let _deviceIdentity: DeviceIdentity | null = null;
function getDeviceIdentity(): DeviceIdentity {
  if (!_deviceIdentity) {
    _deviceIdentity = getOrCreateDeviceIdentity(app.getPath('userData'));
  }
  return _deviceIdentity;
}

// ═══════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════

const CONFIG_PATH = path.join(app.getPath('userData'), 'aegis-config.json');
const isDev = !app.isPackaged;

interface AegisConfig {
  gatewayUrl: string;
  gatewayToken: string;
  sharedFolder: string;
  compressImages: boolean;
  maxImageSize: number;
  startWithWindows: boolean;
  theme: 'dark' | 'light' | 'system';
  globalHotkey: string;
  fontSize: number;
}

let config: AegisConfig = {
  gatewayUrl: 'ws://127.0.0.1:18789',
  gatewayToken: '',
  sharedFolder: 'D:\\clawdbot-shared',
  compressImages: true,
  maxImageSize: 1920,
  startWithWindows: false,
  theme: 'dark',
  globalHotkey: 'Alt+Space',
  fontSize: 14,
};

function loadConfig(): void {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      config = { ...config, ...data };
      // Backward compatibility with v2 config keys
      if (data.gatewayWsUrl && !data.gatewayUrl) {
        config.gatewayUrl = data.gatewayWsUrl;
      }
      if (data.controlUiUrl && !data.gatewayUrl) {
        config.gatewayUrl = data.controlUiUrl.replace('http', 'ws');
      }
    }
    console.log('[Config] Loaded:', CONFIG_PATH);
    console.log('[Config] Gateway URL:', config.gatewayUrl);
    console.log('[Config] Token:', config.gatewayToken ? '***set***' : '***empty***');
  } catch (e) {
    console.error('[Config] Load error:', e);
  }
}

function saveConfig(newConfig: Partial<AegisConfig>): void {
  config = { ...config, ...newConfig };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  app.setLoginItemSettings({
    openAtLogin: config.startWithWindows,
    path: app.getPath('exe'),
  });
}

// ═══════════════════════════════════════════════════════════
// Window
// ═══════════════════════════════════════════════════════════

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Installer language (read once at startup, passed to renderer via additionalArguments)
let installerLangGlobal: string | null = null;
function detectInstallerLanguage(): void {
  try {
    const langFile = path.join(process.resourcesPath, 'language.txt');
    if (fs.existsSync(langFile)) {
      const lang = fs.readFileSync(langFile, 'utf-8').trim();
      if (lang === 'ar' || lang === 'en') installerLangGlobal = lang;
    }
  } catch { /* dev mode — no resources dir */ }
}

// ═══════════════════════════════════════════════════════════
// PTY (Pseudo-Terminal) Management
// ═══════════════════════════════════════════════════════════

const ptyProcesses = new Map<string, any>();
let ptyCounter = 0;

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        background: rgba(10,10,20,0.95);
        border-radius: 20px;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-app-region: drag;
        overflow: hidden;
      }
      .logo {
        width: 72px; height: 72px; border-radius: 18px;
        background: linear-gradient(135deg, #4EC9B0, #6C9FFF);
        display: flex; align-items: center; justify-content: center;
        font-size: 32px; font-weight: 700; color: white;
        box-shadow: 0 8px 32px rgba(78,201,176,0.3);
        animation: float 2s ease-in-out infinite;
      }
      @keyframes float {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      .title { color: #e0e0e0; font-size: 18px; font-weight: 600; margin-top: 20px; letter-spacing: 1px; }
      .subtitle { color: #5a6370; font-size: 11px; margin-top: 6px; }
      .spinner {
        margin-top: 28px; width: 24px; height: 24px;
        border: 2px solid rgba(78,201,176,0.15);
        border-top-color: #4EC9B0;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    </head>
    <body>
      <div class="logo">A</div>
      <div class="title">AEGIS Desktop</div>
      <div class="subtitle">جاري التحميل...</div>
      <div class="spinner"></div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 600,
    minHeight: 500,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    transparent: false,
    backgroundColor: '#0a0a14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,  // Always enabled — Origin rewrite handles file:// → ws:// below
      // Pass installer language to preload via process.argv (works in sandbox mode)
      ...(installerLangGlobal ? { additionalArguments: [`--installer-lang=${installerLangGlobal}`] } : {}),
    },
    show: false,
  });

  // Rewrite Origin header for WebSocket + HTTP connections (file:// → localhost)
  // This allows the packaged app (file:// origin) to connect to any Gateway
  // without disabling webSecurity
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['ws://*/*', 'wss://*/*', 'http://*/*', 'https://*/*'] },
    (details, callback) => {
      // Only rewrite Origin when it's null/file (packaged app)
      const origin = details.requestHeaders['Origin'];
      if (!origin || origin === 'null' || origin.startsWith('file://')) {
        try {
          const url = new URL(details.url);
          details.requestHeaders['Origin'] = `http://${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
        } catch {
          details.requestHeaders['Origin'] = 'http://127.0.0.1:18789';
        }
      }
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Allow loading external images (Wikipedia, Cloudinary, etc.)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
          "style-src-elem 'self' 'unsafe-inline' https:; " +
          "img-src 'self' data: blob: https: http:; " +
          "media-src 'self' data: blob: https: http:; " +
          "connect-src 'self' ws: wss: http: https:; " +
          "font-src 'self' data: https:;"
        ],
      },
    });
  });

  // Load Vite dev server or built files
  if (isDev) {
    console.log('[Window] Loading dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    console.log('[Window] Loading:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // ── Right-click Context Menu (Copy/Paste/Cut/Select All) ──
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags, isEditable, selectionText, linkURL } = params;

    const menuItems: Electron.MenuItemConstructorOptions[] = [];

    if (linkURL) {
      menuItems.push({
        label: '🔗 فتح الرابط',
        click: () => shell.openExternal(linkURL),
      });
      menuItems.push({
        label: '📋 نسخ الرابط',
        click: () => clipboard.writeText(linkURL),
      });
      menuItems.push({ type: 'separator' });
    }

    if (isEditable) {
      menuItems.push({
        label: 'قص',
        accelerator: 'CmdOrCtrl+X',
        enabled: editFlags.canCut,
        role: 'cut',
      });
    }

    if (selectionText || isEditable) {
      menuItems.push({
        label: 'نسخ',
        accelerator: 'CmdOrCtrl+C',
        enabled: editFlags.canCopy,
        role: 'copy',
      });
    }

    if (isEditable) {
      menuItems.push({
        label: 'لصق',
        accelerator: 'CmdOrCtrl+V',
        enabled: editFlags.canPaste,
        role: 'paste',
      });
    }

    if (isEditable || selectionText) {
      menuItems.push({ type: 'separator' });
      menuItems.push({
        label: 'تحديد الكل',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectAll',
      });
    }

    if (menuItems.length > 0) {
      const contextMenu = Menu.buildFromTemplate(menuItems);
      contextMenu.popup({ window: mainWindow! });
    }
  });

  // Show window gracefully — close splash
  mainWindow.once('ready-to-show', () => {
    console.log('[Window] Ready to show');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Log load errors
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[Window] Failed to load:', code, desc);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] Loaded successfully');
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// Gateway connection is handled by React renderer (browser WebSocket)

// ═══════════════════════════════════════════════════════════
// IPC Handlers
// ═══════════════════════════════════════════════════════════

function setupIPC(): void {
  // ── Window Controls ──
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
    return mainWindow?.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

  // ── Config ──
  ipcMain.handle('config:get', () => {
    // Check for installer language file on first run
    let installerLang: string | undefined;
    try {
      const langFile = path.join(process.resourcesPath, 'language.txt');
      const fs = require('fs');
      if (fs.existsSync(langFile)) {
        installerLang = fs.readFileSync(langFile, 'utf-8').trim();
      }
    } catch { /* ignore */ }
    return { ...config, configPath: CONFIG_PATH, ...(installerLang ? { installerLanguage: installerLang } : {}) };
  });
  ipcMain.handle('config:save', (_e, newConfig: Partial<AegisConfig>) => {
    saveConfig(newConfig);
    return { success: true };
  });

  // Gateway is handled by React renderer — these are no-op stubs to prevent IPC errors
  // Gateway IPC removed — all WS communication handled by src/services/gateway.ts (renderer-side)

  // ── Pairing (Auto-Pair with Gateway) ──
  ipcMain.handle('pairing:get-token', () => {
    return config.gatewayToken || null;
  });

  ipcMain.handle('pairing:save-token', (_e, token: string) => {
    saveConfig({ gatewayToken: token });
    console.log('[Pairing] Token saved to config');
    return { success: true };
  });

  ipcMain.handle('pairing:request', async (_e, httpBaseUrl: string) => {
    try {
      const url = `${httpBaseUrl}/v1/pair`;
      console.log('[Pairing] POST', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'openclaw-control-ui',
          clientName: 'AEGIS Desktop',
          platform: process.platform,
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 405) {
          throw new Error('Gateway does not support pairing API. Make sure OpenClaw v2026.2.19+ is running and the Gateway is started.');
        }
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('[Pairing] Request error:', err.message);
      throw err;
    }
  });

  ipcMain.handle('pairing:poll', async (_e, httpBaseUrl: string, deviceId: string) => {
    try {
      const url = `${httpBaseUrl}/v1/pair/${encodeURIComponent(deviceId)}/status`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('[Pairing] Poll error:', err.message);
      throw err;
    }
  })

  // ── Artifacts Preview Window ──
  ipcMain.handle('artifact:open', async (_e, data: { type: string; title: string; content: string }) => {
    try {
      // Always copy latest preview-container.html to dist-electron
      const htmlSrc = path.join(__dirname, '..', 'electron', 'preview-container.html');
      const htmlDst = path.join(__dirname, 'preview-container.html');
      if (fs.existsSync(htmlSrc)) {
        fs.copyFileSync(htmlSrc, htmlDst);
      }

      const htmlPath = fs.existsSync(htmlDst) ? htmlDst : htmlSrc;

      if (!previewWindow || previewWindow.isDestroyed()) {
        previewWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          minWidth: 600,
          minHeight: 400,
          title: `AEGIS Preview — ${data.title}`,
          backgroundColor: '#0d1117',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload-preview.js'),
          },
        });

        previewWindow.loadFile(htmlPath);
        previewWindow.on('closed', () => { previewWindow = null; });

        // Send content after page loads
        previewWindow.webContents.on('did-finish-load', () => {
          previewWindow?.webContents.send('artifact:content', data);
        });
      } else {
        // Window exists — update content and focus
        previewWindow.webContents.send('artifact:content', data);
        previewWindow.setTitle(`AEGIS Preview — ${data.title}`);
        previewWindow.focus();
      }

      return { success: true };
    } catch (err: any) {
      console.error('[Preview] Failed to open:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Clipboard (for preview window sandbox fallback) ──
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text);
  });

  // ── Image Save (download to local filesystem) ──
  ipcMain.handle('image:save', async (_e, src: string, suggestedName: string) => {
    try {
      // Determine file extension from source or name
      const ext = (suggestedName.match(/\.(\w+)$/) || [, 'png'])[1];
      const filterMap: Record<string, { name: string; extensions: string[] }> = {
        png: { name: 'PNG Image', extensions: ['png'] },
        jpg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
        jpeg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
        gif: { name: 'GIF Image', extensions: ['gif'] },
        webp: { name: 'WebP Image', extensions: ['webp'] },
        svg: { name: 'SVG Image', extensions: ['svg'] },
        bmp: { name: 'BMP Image', extensions: ['bmp'] },
      };

      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'حفظ الصورة',
        defaultPath: suggestedName,
        filters: [
          filterMap[ext.toLowerCase()] || { name: 'Image', extensions: [ext] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      let imageBuffer: Buffer;

      if (src.startsWith('data:')) {
        // Base64 data URL → decode to buffer
        const base64 = src.split(',')[1];
        imageBuffer = Buffer.from(base64, 'base64');
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        // HTTP URL → fetch and save
        const { net } = require('electron');
        const response = await net.fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else if (src.startsWith('aegis-media:')) {
        // Local file path via aegis-media protocol
        const localPath = src.replace('aegis-media:', '');
        imageBuffer = fs.readFileSync(localPath);
      } else if (fs.existsSync(src)) {
        // Direct filesystem path
        imageBuffer = fs.readFileSync(src);
      } else {
        return { success: false, error: 'Unsupported image source' };
      }

      fs.writeFileSync(result.filePath, imageBuffer);
      console.log('[Image] Saved to:', result.filePath);

      // Show notification
      if (Notification.isSupported()) {
        new Notification({
          title: 'تم حفظ الصورة',
          body: path.basename(result.filePath),
          silent: true,
        }).show();
      }

      return { success: true, path: result.filePath };
    } catch (err: any) {
      console.error('[Image] Save failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Native Notifications ──
  ipcMain.handle('notification:show', (_e, title: string, body: string) => {
    if (Notification.isSupported()) {
      const notif = new Notification({ title, body, silent: true });
      notif.on('click', () => {
        // Bring window to front when notification is clicked
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });
      notif.show();
    }
  });

  // ── Device Identity (Ed25519 signing for Gateway auth) ──
  ipcMain.handle('device:getIdentity', () => {
    const identity = getDeviceIdentity();
    return {
      deviceId: identity.deviceId,
      publicKey: identity.publicKeyRawB64Url,
    };
  });

  ipcMain.handle('device:sign', (_e, params: {
    nonce?: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    token: string;
  }) => {
    // v2 only — Gateway 2026.2.22+ rejects v1 signatures
    // If no challenge nonce was received, return identity without signature
    // so the handshake falls back to token-only auth
    if (!params.nonce) {
      const identity = getDeviceIdentity();
      return {
        deviceId: identity.deviceId,
        publicKey: identity.publicKeyRawB64Url,
        signature: null,
        signedAt: null,
        nonce: null,
      };
    }

    const identity = getDeviceIdentity();
    const signedAt = Date.now();
    const scopesStr = params.scopes.join(',');

    const parts = [
      'v2',
      identity.deviceId,
      params.clientId,
      params.clientMode,
      params.role,
      scopesStr,
      String(signedAt),
      params.token || '',
      params.nonce,
    ];

    const payload = parts.join('|');
    const key = crypto.createPrivateKey(identity.privateKeyPem);
    const signature = base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf8'), key));

    return {
      deviceId: identity.deviceId,
      publicKey: identity.publicKeyRawB64Url,
      signature,
      signedAt,
      nonce: params.nonce,
    };
  })

  // ── Memory: Local Files ──
  ipcMain.handle('memory:browse', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Memory Folder',
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('memory:readLocal', async (_e, dirPath: string) => {
    const fs = require('fs');
    const path = require('path');
    try {
      const files: { name: string; content: string; modified: string; size: number }[] = [];
      // Read MEMORY.md if exists
      const memoryMd = path.join(dirPath, 'MEMORY.md');
      if (fs.existsSync(memoryMd)) {
        const stat = fs.statSync(memoryMd);
        files.push({ name: 'MEMORY.md', content: fs.readFileSync(memoryMd, 'utf-8'), modified: stat.mtime.toISOString(), size: stat.size });
      }
      // Read all .md files in directory
      const entries = fs.readdirSync(dirPath).filter((f: string) => f.endsWith('.md') && f !== 'MEMORY.md').sort().reverse();
      for (const fname of entries.slice(0, 100)) {
        const fpath = path.join(dirPath, fname);
        const stat = fs.statSync(fpath);
        if (stat.isFile() && stat.size < 500_000) {
          files.push({ name: fname, content: fs.readFileSync(fpath, 'utf-8'), modified: stat.mtime.toISOString(), size: stat.size });
        }
      }
      // Also check memory/ subfolder
      const memDir = path.join(dirPath, 'memory');
      if (fs.existsSync(memDir) && fs.statSync(memDir).isDirectory()) {
        const memFiles = fs.readdirSync(memDir).filter((f: string) => f.endsWith('.md')).sort().reverse();
        for (const fname of memFiles.slice(0, 100)) {
          const fpath = path.join(memDir, fname);
          const stat = fs.statSync(fpath);
          if (stat.isFile() && stat.size < 500_000) {
            files.push({ name: `memory/${fname}`, content: fs.readFileSync(fpath, 'utf-8'), modified: stat.mtime.toISOString(), size: stat.size });
          }
        }
      }
      return { success: true, files };
    } catch (e: any) {
      return { success: false, error: e.message, files: [] };
    }
  });

  // ── Screenshot ──

  // Native PowerShell screen capture — reliable on all Windows setups
  const captureScreenPowerShell = (): string | null => {
    const pngPath = path.join(app.getPath('temp'), `aegis-ss-${Date.now()}.png`);
    try {
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
        '$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)',
        '$g = [System.Drawing.Graphics]::FromImage($bmp)',
        '$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
        `$bmp.Save('${pngPath}')`,
        '$g.Dispose()',
        '$bmp.Dispose()',
      ].join('; ');

      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        windowsHide: true,
        timeout: 10000,
      });

      const imgData = fs.readFileSync(pngPath);
      const dataUrl = `data:image/png;base64,${imgData.toString('base64')}`;
      try { fs.unlinkSync(pngPath); } catch {}
      return dataUrl;
    } catch (err: any) {
      console.error('[Screenshot] PowerShell capture failed:', err.message);
      try { fs.unlinkSync(pngPath); } catch {}
      return null;
    }
  };

  ipcMain.handle('screenshot:capture', async () => {
    try {
      // Minimize AEGIS for clean screen capture
      const wasVisible = mainWindow!.isVisible() && !mainWindow!.isMinimized();
      if (wasVisible) mainWindow!.minimize();
      await new Promise((r) => setTimeout(r, 500));

      // Try PowerShell native capture first (most reliable)
      const psResult = captureScreenPowerShell();
      if (psResult) {
        if (wasVisible) { mainWindow!.restore(); mainWindow!.focus(); }
        return { success: true, data: psResult };
      }

      // Fallback to desktopCapturer
      console.log('[Screenshot] PowerShell failed, trying desktopCapturer...');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      if (wasVisible) { mainWindow!.restore(); mainWindow!.focus(); }

      if (sources.length > 0) {
        return { success: true, data: sources[0].thumbnail.toDataURL() };
      }
      return { success: false, error: 'No screen found' };
    } catch (err: any) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.restore();
        mainWindow.focus();
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('screenshot:windows', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 400, height: 280 },
        fetchWindowIcons: true,
      });
      // Return all windows (including AEGIS Desktop)
      return sources
        .filter((s) => s.thumbnail && !s.thumbnail.isEmpty())
        .map((s) => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL(),
        }));
    } catch (err: any) {
      return [];
    }
  });

  ipcMain.handle('screenshot:captureWindow', async (_e, windowId: string) => {
    try {
      // For AEGIS own window, use native capture
      const ownWindowId = `window:${mainWindow!.getMediaSourceId()}`;
      const isOwnWindow = windowId === ownWindowId || windowId.includes(String(mainWindow!.id));

      if (isOwnWindow) {
        const img = await mainWindow!.webContents.capturePage();
        return { success: true, data: img.toDataURL() };
      }

      // For screen sources — use PowerShell (reliable) with desktopCapturer fallback
      if (windowId.startsWith('screen:')) {
        const wasVisible = mainWindow!.isVisible() && !mainWindow!.isMinimized();
        if (wasVisible) mainWindow!.minimize();
        await new Promise((r) => setTimeout(r, 500));

        const psResult = captureScreenPowerShell();
        if (psResult) {
          if (wasVisible) { mainWindow!.restore(); mainWindow!.focus(); }
          return { success: true, data: psResult };
        }

        // Fallback to desktopCapturer
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 },
        });
        if (wasVisible) { mainWindow!.restore(); mainWindow!.focus(); }
        const source = sources.find((s) => s.id === windowId);
        if (source) {
          return { success: true, data: source.thumbnail.toDataURL() };
        }
      }

      // For other windows — get high-res thumbnail
      // Minimize AEGIS briefly so it doesn't cover the target
      const wasVisible = mainWindow!.isVisible() && !mainWindow!.isMinimized();
      if (wasVisible) mainWindow!.minimize();
      await new Promise((r) => setTimeout(r, 400));

      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      const source = sources.find((s) => s.id === windowId);

      // Restore AEGIS
      if (wasVisible) {
        mainWindow!.restore();
        mainWindow!.focus();
      }

      if (source && !source.thumbnail.isEmpty()) {
        return { success: true, data: source.thumbnail.toDataURL() };
      }

      return { success: false, error: 'Window not found or empty capture' };
    } catch (err: any) {
      // Restore window on error
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.restore();
        mainWindow.focus();
      }
      return { success: false, error: err.message };
    }
  });

  // ── Files ──
  ipcMain.handle('file:openDialog', async () => {
    return dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
    });
  });

  ipcMain.handle('file:read', async (_e, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        // Images
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp', '.ico': 'image/x-icon',
        // Documents
        '.pdf': 'application/pdf',
        '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
        '.json': 'application/json', '.xml': 'application/xml',
        '.html': 'text/html', '.htm': 'text/html',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Audio
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.webm': 'audio/webm',
        // Video
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        // Archives
        '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed', '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        // Code
        '.js': 'text/javascript', '.ts': 'text/typescript', '.py': 'text/x-python',
        '.css': 'text/css', '.log': 'text/plain',
      };
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
      return {
        name: path.basename(filePath),
        path: filePath,
        base64: data.toString('base64'),
        mimeType: mimeMap[ext] || 'application/octet-stream',
        isImage,
        size: data.length,
      };
    } catch (err: any) {
      return null;
    }
  });

  // ── Shared Folder ──
  ipcMain.handle('file:openSharedFolder', () => {
    if (!fs.existsSync(config.sharedFolder)) {
      fs.mkdirSync(config.sharedFolder, { recursive: true });
    }
    shell.openPath(config.sharedFolder);
  });

  // ── Voice Recording — Save to shared folder ──
  ipcMain.handle('voice:save', async (_e, filename: string, base64: string) => {
    try {
      const voiceDir = path.join(config.sharedFolder, 'voice');
      if (!fs.existsSync(voiceDir)) {
        fs.mkdirSync(voiceDir, { recursive: true });
      }
      const filePath = path.join(voiceDir, filename);
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      console.log('[Voice] Saved:', filePath, `(${Math.round(base64.length * 0.75 / 1024)}KB)`);
      return filePath;
    } catch (err: any) {
      console.error('[Voice] Save error:', err.message);
      return null;
    }
  });

  ipcMain.handle('voice:read', async (_e, filePath: string) => {
    try {
      // Support both absolute paths and shared folder relative paths
      let resolvedPath = filePath;

      // If it's a relative filename, look in shared voice folder
      if (!path.isAbsolute(filePath)) {
        resolvedPath = path.join(config.sharedFolder, 'voice', filePath);
      }

      if (!fs.existsSync(resolvedPath)) {
        console.error('[Voice] File not found:', resolvedPath);
        return null;
      }

      const buffer = fs.readFileSync(resolvedPath);
      const base64 = buffer.toString('base64');
      console.log('[Voice] Read:', resolvedPath, `(${Math.round(buffer.length / 1024)}KB)`);
      return base64;
    } catch (err: any) {
      console.error('[Voice] Read error:', err.message);
      return null;
    }
  });

  // ═══════════════════════════════════════════════════════════
  // PTY — Integrated Terminal (xterm.js ←IPC→ node-pty)
  // ═══════════════════════════════════════════════════════════

  ipcMain.handle('pty:create', (_e, options?: { cols?: number; rows?: number; cwd?: string }) => {
    if (!pty) return { id: null, error: 'Terminal not available — node-pty module not loaded' };
    try {
      const id = `pty-${++ptyCounter}`;
      const shell = process.platform === 'win32'
        ? 'powershell.exe'
        : (process.env.SHELL || '/bin/bash');

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: options?.cols || 80,
        rows: options?.rows || 24,
        cwd: options?.cwd || process.env.USERPROFILE || process.env.HOME || '.',
        env: { ...process.env } as Record<string, string>,
      });

      ptyProcesses.set(id, ptyProcess);
      console.log(`[PTY] Created ${id} (shell: ${shell}, pid: ${ptyProcess.pid})`);

      // Forward data from PTY → renderer (guard against destroyed window on quit)
      ptyProcess.onData((data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty:data', id, data);
        }
      });

      // Notify renderer when PTY exits
      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[PTY] ${id} exited (code: ${exitCode}, signal: ${signal})`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty:exit', id, exitCode, signal);
        }
        ptyProcesses.delete(id);
      });

      return { id, pid: ptyProcess.pid };
    } catch (err: any) {
      console.error('[PTY] Create failed:', err.message);
      return { id: null, error: err.message };
    }
  });

  ipcMain.handle('pty:write', (_e, id: string, data: string) => {
    ptyProcesses.get(id)?.write(data);
  });

  ipcMain.handle('pty:resize', (_e, id: string, cols: number, rows: number) => {
    try {
      ptyProcesses.get(id)?.resize(cols, rows);
    } catch { /* ignore resize errors on dead PTYs */ }
  });

  ipcMain.handle('pty:kill', (_e, id: string) => {
    const p = ptyProcesses.get(id);
    if (p) {
      console.log(`[PTY] Killing ${id}`);
      p.kill();
      ptyProcesses.delete(id);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// Global Hotkey
// ═══════════════════════════════════════════════════════════

function registerHotkey(): void {
  try {
    globalShortcut.unregisterAll();
    if (config.globalHotkey) {
      globalShortcut.register(config.globalHotkey, () => {
        if (mainWindow?.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
      });
    }
  } catch (e) {
    console.error('[Hotkey] Registration failed:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// App Lifecycle
// ═══════════════════════════════════════════════════════════

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    loadConfig();
    detectInstallerLanguage();
    createSplashWindow();
    createWindow();
    setupIPC();
    tray = createTray(mainWindow!, app);
    registerHotkey();

    // Gateway connection is now handled by React renderer
    // No auto-connect from main process needed
  });
}

app.on('window-all-closed', () => {
  // Don't quit — we have tray icon
  console.log('[App] All windows closed — staying in tray');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  // Kill all PTY processes
  for (const [id, p] of ptyProcesses) {
    try { p.kill(); console.log(`[PTY] Killed ${id} on quit`); } catch {}
  }
  ptyProcesses.clear();
});

console.log('🛡️ AEGIS Desktop v5.3 started');

