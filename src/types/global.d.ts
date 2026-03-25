// OpenClaw Station — Global Type Declarations

interface AegisAPI {
  /** Installer-selected language (set by NSIS setup wizard) */
  installerLanguage?: 'ar' | 'en' | 'zh';

  /** Notify main process of UI language (tray / native strings) */
  i18n?: {
    setLanguage: (lang: string) => void;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  config: {
    // AEGIS app settings (aegis-config.json)
    get: () => Promise<any>;
    save: (config: any) => Promise<{ success: boolean }>;
    // OpenClaw config (clawdbot.json) management
    detect: () => Promise<{ path: string; exists: boolean }>;
    read: (path?: string) => Promise<{ data: any; path: string }>;
    write: (path: string, data: any) => Promise<{ success: boolean; backupPath?: string; error?: string }>;
    restart: () => Promise<{ success: boolean; error?: string }>;
  };
  settings?: {
    save: (key: string, value: any) => Promise<{ success: boolean }>;
  };
  // Gateway IPC removed — all WS handled by src/services/gateway.ts
  artifact: {
    open: (data: { type: string; title: string; content: string }) => Promise<{ success: boolean; error?: string }>;
  };
  device: {
    getIdentity: () => Promise<{ deviceId: string; publicKey: string }>;
    sign: (params: {
      nonce?: string;
      clientId: string;
      clientMode: string;
      role: string;
      scopes: string[];
      token: string;
    }) => Promise<{
      deviceId: string;
      publicKey: string;
      signature: string;
      signedAt: number;
      nonce?: string;
    }>;
  };
  image: {
    save: (src: string, suggestedName: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  };
  screenshot: {
    capture: () => Promise<{ success: boolean; data?: string; error?: string }>;
    getWindows: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
    captureWindow: (id: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    captureSourceStream?: (sourceId: string) => Promise<string | null>;
    getSources?: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
  };
  file: {
    openDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    read: (path: string) => Promise<{
      name: string;
      path: string;
      base64: string;
      mimeType: string;
      isImage: boolean;
      size: number;
    } | null>;
    openSharedFolder: () => Promise<void>;
  };
  voice: {
    save: (filename: string, base64: string) => Promise<string | null>;
    read: (filePath: string) => Promise<string | null>;
    // Phase 3: Secure key storage via Electron keychain (optional — only in Electron)
    setKey?: (provider: string, key: string) => Promise<void>;
    getKey?: (provider: string) => Promise<string | null>;
    deleteKey?: (provider: string) => Promise<void>;
    testKey?: (provider: string, key: string) => Promise<boolean>;
  };
  calendar?: {
    getEvents: () => Promise<any[]>;
    addEvent: (event: any) => Promise<{ success: boolean; id?: string }>;
    updateEvent: (id: string, updates: any) => Promise<{ success: boolean }>;
    deleteEvent: (id: string) => Promise<{ success: boolean }>;
  };
  memory: {
    browse: () => Promise<string | null>;
    readLocal: (dirPath: string) => Promise<{ success: boolean; files: any[]; error?: string }>;
  };
  pairing: {
    getToken: () => Promise<string | null>;
    saveToken: (token: string) => Promise<{ success: boolean }>;
    requestPairing: (httpBaseUrl: string) => Promise<{ code: string; deviceId: string }>;
    poll: (httpBaseUrl: string, deviceId: string) => Promise<{ status: string; token?: string }>;
  };
  terminal: {
    create: (opts?: { cols?: number; rows?: number; cwd?: string }) => Promise<{ id: string; pid: number; error?: string }>;
    write: (id: string, data: string) => Promise<void>;
    resize: (id: string, cols: number, rows: number) => Promise<void>;
    kill: (id: string) => Promise<void>;
    onData: (callback: (id: string, data: string) => void) => () => void;
    onExit: (callback: (id: string, exitCode: number, signal?: number) => void) => () => void;
  };
  secrets: {
    audit: () => Promise<{ success: boolean; data?: SecretsAuditResult; error?: string }>;
    reload: () => Promise<{ success: boolean; error?: string }>;
  };
  notify: (title: string, body: string) => Promise<void>;
  update: {
    check: () => Promise<any>;
    download: () => Promise<any>;
    install: () => Promise<void>;
    onAvailable: (cb: (info: any) => void) => () => void;
    onUpToDate: (cb: () => void) => () => void;
    onProgress: (cb: (progress: any) => void) => () => void;
    onDownloaded: (cb: () => void) => () => void;
    onError: (cb: (msg: string) => void) => () => void;
  };
}

declare global {
  interface Window {
    aegis: AegisAPI;
  }

  interface SecretsAuditResult {
    status: 'clean' | 'findings' | 'unresolved' | 'unknown';
    rawOutput: string;
    exitCode: number;
  }
}

export {};
