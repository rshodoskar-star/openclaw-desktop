import { useEffect, useCallback, useState, useRef, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/Layout/AppLayout';
import { PairingScreen } from '@/components/PairingScreen';
import { ToastContainer } from '@/components/Toast/ToastContainer';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.DashboardPage })));
const ChatPage = lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })));
const WorkshopPage = lazy(() => import('@/pages/Workshop').then(m => ({ default: m.WorkshopPage })));
const FullAnalyticsPage = lazy(() => import('@/pages/FullAnalytics').then(m => ({ default: m.FullAnalyticsPage })));
const CronMonitorPage = lazy(() => import('@/pages/CronMonitor').then(m => ({ default: m.CronMonitorPage })));
const AgentHubPage = lazy(() => import('@/pages/AgentHub').then(m => ({ default: m.AgentHubPage })));
const MemoryExplorerPage = lazy(() => import('@/pages/MemoryExplorer').then(m => ({ default: m.MemoryExplorerPage })));
const SkillsPageFull = lazy(() => import('@/pages/SkillsPage').then(m => ({ default: m.SkillsPage })));
const TerminalPage = lazy(() => import('@/pages/TerminalPage').then(m => ({ default: m.TerminalPage })));
const SettingsPageFull = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPageFull })));
const ConfigManagerPage = lazy(() => import('@/pages/ConfigManager').then(m => ({ default: m.ConfigManagerPage })));
const SessionManagerPage = lazy(() => import('@/pages/SessionManager').then(m => ({ default: m.SessionManagerPage })));
const LogsViewerPage = lazy(() => import('@/pages/LogsViewer').then(m => ({ default: m.LogsViewerPage })));
const MultiAgentViewPage = lazy(() => import('@/pages/MultiAgentView').then(m => ({ default: m.MultiAgentViewPage })));
const FileManagerPage = lazy(() => import('@/pages/FileManager').then(m => ({ default: m.FileManagerPage })));
const CalendarPage = lazy(() => import('@/pages/Calendar'));
const CodeInterpreterPage = lazy(() => import('@/pages/CodeInterpreter').then(m => ({ default: m.CodeInterpreterPage })));
const McpToolsPage = lazy(() => import('@/pages/McpTools').then(m => ({ default: m.McpToolsPage })));
const PixelAgentsPage = lazy(() => import('@/pages/PixelAgents').then(m => ({ default: m.PixelAgentsPage })));
const PluginsPage = lazy(() => import('@/pages/PluginsPage').then(m => ({ default: m.PluginsPage })));
const VoiceLivePage = lazy(() => import('@/pages/VoiceLive').then(m => ({ default: m.VoiceLivePage })));
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { gateway } from '@/services/gateway/index';
import { notifications } from '@/services/notifications';
import { changeLanguage } from '@/i18n';

// ═══════════════════════════════════════════════════════════
// OpenClaw Station v4.0 — Mission Control
// ═══════════════════════════════════════════════════════════

export default function App() {
  const { t } = useTranslation();
  const { theme } = useSettingsStore();
  const {
    addMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    setConnectionStatus,
    setIsTyping,
    setSessions,
    setTokenUsage,
    setCurrentModel,
    setCurrentThinking,
    setAvailableModels,
    manualModelOverride,
  } = useChatStore();

  // ── Auto-Pairing State ──
  const [needsPairing, setNeedsPairing] = useState(false);
  const [scopeError, setScopeError] = useState<string>('');
  const [gatewayHttpUrl, setGatewayHttpUrl] = useState('http://127.0.0.1:18789');
  const pairingTriggeredRef = useRef(false);

  // Sync UI language to Electron main process (tray / native strings) on mount
  useEffect(() => {
    const lang = useSettingsStore.getState().language;
    window.aegis?.i18n?.setLanguage?.(lang);
  }, []);

  // ── Load Sessions from Gateway ──
  const loadSessions = useCallback(async () => {
    try {
      const result = await gateway.getSessions();
      const rawSessions = Array.isArray(result?.sessions) ? result.sessions : [];
      if (rawSessions.length > 0) {
        const sessions = rawSessions.map((s: any) => {
          const key = s.key || s.sessionKey || 'unknown';
          let label = s.label || s.name || key;
          if (key === 'agent:main:main') label = t('dashboard.mainSession');
          else if (key.startsWith('agent:main:')) label = key.split(':').pop() || key;
          return {
            key, label,
            lastMessage: s.lastMessage?.content?.substring?.(0, 60),
            lastTimestamp: s.lastMessage?.timestamp || s.updatedAt,
            kind: s.kind,
          };
        });
        setSessions(sessions);
      }
    } catch { /* silent */ }
  }, [setSessions]);

  // ── Token Usage ──
  const loadTokenUsage = useCallback(async () => {
    try {
      const result = await gateway.getSessions();
      const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
      const main = sessions.find((s: any) => (s.key || '') === 'agent:main:main');
      if (main) {
        const used = main.totalTokens ?? 0;
        const max = main.contextTokens ?? 200000;
        const pct = max > 0 ? Math.round((used / max) * 100) : 0;
        if (used > 0 || max > 0) {
          setTokenUsage({ contextTokens: used, maxTokens: max, percentage: pct, compactions: main.compactions ?? 0 });
        }
        // Update model from polling ONLY if user hasn't manually selected one
        if (main.model && !manualModelOverride) setCurrentModel(main.model);
        // Always update thinking level from session
        if (main.thinkingLevel !== undefined) setCurrentThinking(main.thinkingLevel ?? null);
      }
    } catch { /* silent */ }
  }, [setTokenUsage, setCurrentModel, setCurrentThinking, manualModelOverride]);

  // ── Load Available Models from Gateway ──
  // Multi-strategy: config.get → agents.list + session → fallback
  // Labels are formatted in TitleBar via formatModelName(), so we just store IDs.
  const loadAvailableModels = useCallback(async () => {
    // ── Strategy 1: config.get → agents.defaults.models (most reliable) ──
    try {
      const raw = await gateway.call('config.get', {});
      // Response may be config directly OR wrapped: { config: {...} }
      const config = raw?.agents?.defaults?.models ? raw : raw?.config;
      const modelsSection: Record<string, any> = config?.agents?.defaults?.models ?? {};
      const fromConfig = Object.entries(modelsSection)
        .filter(([, cfg]: [string, any]) => cfg?.alias)
        .map(([id, cfg]: [string, any]) => ({
          id,
          label: id,           // Raw — formatted in TitleBar
          alias: cfg.alias as string,
        }));
      if (fromConfig.length > 0) {
        console.log('[Models] Loaded from config.get:', fromConfig.length);
        setAvailableModels(fromConfig);
        return;
      }
    } catch (e) {
      console.warn('[Models] config.get failed, trying agents.list:', e);
    }

    // ── Strategy 2: Collect unique models from agents + session ──
    try {
      const modelMap = new Map<string, { id: string; label: string; alias?: string }>();

      // Main session model
      const sessionsResult = await gateway.getSessions();
      const sessions = Array.isArray(sessionsResult?.sessions) ? sessionsResult.sessions : [];
      const main = sessions.find((s: any) => (s.key || '') === 'agent:main:main');
      if (main?.model) modelMap.set(main.model, { id: main.model, label: main.model });

      // Agent models
      const agentsResult = await gateway.getAgents();
      const agents = Array.isArray(agentsResult?.agents) ? agentsResult.agents : [];
      for (const agent of agents) {
        const modelId = agent?.model?.primary;
        if (modelId && !modelMap.has(modelId)) {
          modelMap.set(modelId, { id: modelId, label: modelId });
        }
      }

      if (modelMap.size > 0) {
        const fromAgents = [...modelMap.values()];
        console.log('[Models] Loaded from agents/sessions:', fromAgents.length);
        setAvailableModels(fromAgents);
        return;
      }
    } catch (e) {
      console.warn('[Models] agents.list failed:', e);
    }

    // ── Strategy 3: FALLBACK_MODELS in TitleBar ──
    console.warn('[Models] All strategies failed — using hardcoded fallback');
  }, [setAvailableModels]);

  // ── Apply theme to document root ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Request notification permission (Web Notification API) ──
  useEffect(() => { notifications.requestPermission(); }, []);

  // ── Gateway Setup ──
  useEffect(() => {
    gateway.setCallbacks({
      onMessage: (msg) => {
        setIsTyping(false);
        addMessage(msg);
        // Notify when app is minimized/background OR user is on a different page
        const isOnChat = window.location.hash === '#/chat' || window.location.hash.startsWith('#/chat?');
        if (!document.hasFocus() || !isOnChat) {
          notifications.notify({
            type: 'message',
            title: t('notifications.newMessage'),
            body: msg.content.substring(0, 120),
          });
        }
      },
      onStreamChunk: (messageId, content, media) => {
        updateStreamingMessage(messageId, content, media ? { mediaUrl: media.mediaUrl, mediaType: media.mediaType } : undefined);
      },
      onStreamEnd: (messageId, content, media) => {
        finalizeStreamingMessage(messageId, content, media ? { mediaUrl: media.mediaUrl, mediaType: media.mediaType } : undefined);
        loadTokenUsage();
        // Notify (sound + toast) when app is minimized/background OR user is on a different page
        const isOnChat = window.location.hash === '#/chat' || window.location.hash.startsWith('#/chat?');
        if (!document.hasFocus() || !isOnChat) {
          notifications.notify({
            type: 'task_complete',
            title: t('notifications.replyComplete'),
            body: content.substring(0, 120),
          });
        }
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        if (status.connected) {
          // Successfully connected — dismiss pairing screen if showing
          if (needsPairing) {
            setNeedsPairing(false);
            pairingTriggeredRef.current = false;
          }
          loadSessions();
          loadTokenUsage();
          loadAvailableModels();
          // Fetch agent identity (avatar + name)
          gateway.getAgentIdentity().then((identity: any) => {
            if (identity) {
              useChatStore.getState().setAgentIdentity(
                identity.name || null,
                identity.avatarUrl || identity.avatar || null
              );
            }
          }).catch(() => {});
        }
      },
      onScopeError: (error) => {
        console.warn('[App] 🔑 Scope error — triggering pairing flow:', error);
        // Only trigger pairing once per connection attempt
        if (!pairingTriggeredRef.current) {
          pairingTriggeredRef.current = true;
          setScopeError(error);
          setNeedsPairing(true);
        }
      },
    });

    // Initialize gateway connection
    (async () => {
      const DEFAULT_URL = 'ws://127.0.0.1:18789';
      const settings = useSettingsStore.getState();
      const userUrl = settings.gatewayUrl?.trim() || '';
      const userToken = settings.gatewayToken?.trim() || '';

      try {
        if (window.aegis?.config) {
          const config = await window.aegis.config.get();
          const configUrl = config.gatewayUrl || config.gatewayWsUrl || DEFAULT_URL;
          const configToken = config.gatewayToken || '';
          const wsUrl = userUrl || configUrl;
          const token = userToken || configToken;
          const httpUrl = wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
          setGatewayHttpUrl(httpUrl);
          localStorage.setItem('aegis-gateway-http', httpUrl);
          if (!localStorage.getItem('aegis-language') && config.installerLanguage) {
            const lang = config.installerLanguage;
            if (lang === 'ar' || lang === 'en' || lang === 'zh') {
              changeLanguage(lang);
              useSettingsStore.getState().setLanguage(lang);
            }
          }
          gateway.connect(wsUrl, token);
        } else {
          gateway.connect(userUrl || DEFAULT_URL, userToken || '');
        }
      } catch {
        gateway.connect(userUrl || DEFAULT_URL, userToken || '');
      }
    })();

    // Listen for model changes → refresh session metadata (maxTokens, contextTokens)
    const handleModelChanged = () => loadTokenUsage();
    window.addEventListener('aegis:model-changed', handleModelChanged);

    // Cleanup — prevent orphan WebSocket connections on remount
    return () => {
      window.removeEventListener('aegis:model-changed', handleModelChanged);
      gateway.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps — intentional run-once effect
  }, []);

  // ── Pairing Handlers ──
  const handlePairingComplete = useCallback(async (token: string) => {
    console.log('[App] 🔑 Pairing complete — reconnecting with new token');
    // Save token to config via IPC
    if (window.aegis?.pairing?.saveToken) {
      await window.aegis.pairing.saveToken(token);
    }
    // Also update config via the existing config:save IPC
    if (window.aegis?.config?.save) {
      await window.aegis.config.save({ gatewayToken: token });
    }
    // Reconnect gateway with new token
    gateway.reconnectWithToken(token);
    setNeedsPairing(false);
    pairingTriggeredRef.current = false;
  }, []);

  const handlePairingCancel = useCallback(() => {
    console.log('[App] Pairing cancelled by user');
    setNeedsPairing(false);
    pairingTriggeredRef.current = false;
    // Stop gateway pairing retry loop — user chose to dismiss
    gateway.stopPairingRetry();
  }, []);

  return (
    <>
      {/* Pairing overlay — shown when Gateway rejects due to missing scopes */}
      {needsPairing && (
        <PairingScreen
          gatewayHttpUrl={gatewayHttpUrl}
          onPaired={handlePairingComplete}
          onCancel={handlePairingCancel}
          errorMessage={scopeError}
        />
      )}

      <HashRouter>
        {/* In-app toast notifications — always visible, above all routes */}
        <ToastContainer />
        <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/workshop" element={<WorkshopPage />} />
              <Route path="/costs" element={<FullAnalyticsPage />} />
              <Route path="/analytics" element={<FullAnalyticsPage />} />
              <Route path="/cron" element={<CronMonitorPage />} />
              <Route path="/agents" element={<AgentHubPage />} />
              <Route path="/skills" element={<SkillsPageFull />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/memory" element={<MemoryExplorerPage />} />
              <Route path="/config" element={<ConfigManagerPage />} />
              <Route path="/sessions" element={<SessionManagerPage />} />
              <Route path="/logs" element={<LogsViewerPage />} />
              <Route path="/agents/live" element={<MultiAgentViewPage />} />
              <Route path="/files" element={<FileManagerPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/sandbox" element={<CodeInterpreterPage />} />
              <Route path="/tools" element={<McpToolsPage />} />
              <Route path="/settings" element={<SettingsPageFull />} />
              <Route path="/pixel-agents" element={<PixelAgentsPage />} />
              <Route path="/plugins" element={<PluginsPage />} />
            </Route>
            <Route path="/voice" element={<VoiceLivePage />} />
          </Routes>
      </HashRouter>
    </>
  );
}
