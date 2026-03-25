// ═══════════════════════════════════════════════════════════
// PairingScreen — Auto-Pair with OpenClaw Gateway
//
// Shows a pairing code and waits for the user to approve
// the device in OpenClaw Gateway (CLI or web UI).
// Polls every 3 seconds until approved or cancelled.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, RefreshCw, X, Loader2, Key, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PairingScreenProps {
  /** HTTP base URL of the Gateway (derived from WS URL) */
  gatewayHttpUrl: string;
  /** Called when pairing is approved with the new token */
  onPaired: (token: string) => void;
  /** Called when user cancels pairing */
  onCancel: () => void;
  /** The scope/auth error message that triggered pairing */
  errorMessage?: string;
}

type PairingState = 'idle' | 'requesting' | 'waiting' | 'waiting-cli' | 'approved' | 'error';

export function PairingScreen({ gatewayHttpUrl, onPaired, onCancel, errorMessage }: PairingScreenProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PairingState>('idle');
  const [code, setCode] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // Start pairing automatically on mount
  useEffect(() => {
    requestPairing();
  }, []);

  const requestPairing = useCallback(async () => {
    // Stop any existing polling
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setState('requesting');
    setError('');
    setCode('');
    setDeviceId('');

    try {
      let result: { code: string; deviceId: string };

      // Try IPC first (Electron main process), fallback to direct fetch
      if (window.aegis?.pairing?.requestPairing) {
        result = await window.aegis.pairing.requestPairing(gatewayHttpUrl);
      } else {
        const res = await fetch(`${gatewayHttpUrl}/v1/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: 'openclaw-control-ui',
            clientName: 'OpenClaw Station',
            platform: navigator.platform?.toLowerCase().includes('mac') ? 'macos' : navigator.platform?.toLowerCase().includes('linux') ? 'linux' : 'windows',
            scopes: ['operator.read', 'operator.write', 'operator.admin'],
          }),
        });
        if (!res.ok) {
          if (res.status === 405) {
            throw new Error(t('pairing.pairingNotSupported'));
          }
          throw new Error(t('pairing.httpError', { status: res.status, statusText: res.statusText }));
        }
        result = await res.json();
      }

      if (!mountedRef.current) return;

      setCode(result.code);
      setDeviceId(result.deviceId);
      setState('waiting');

      // Start polling for approval
      startPolling(result.deviceId);
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('[Pairing] Request failed:', err);
      setError(err.message || t('pairing.requestPairingFailed'));
      // /v1/pair not available — fall back to CLI approval mode
      // Gateway is retrying WS connection every 5s in the background;
      // when the user approves via CLI, the next retry will succeed
      // and App.tsx onStatusChange will dismiss this screen automatically.
      setState('waiting-cli');
    }
  }, [gatewayHttpUrl, t]);

  const startPolling = useCallback((devId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        let result: { status: string; token?: string };

        if (window.aegis?.pairing?.poll) {
          result = await window.aegis.pairing.poll(gatewayHttpUrl, devId);
        } else {
          const res = await fetch(`${gatewayHttpUrl}/v1/pair/${encodeURIComponent(devId)}/status`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          result = await res.json();
        }

        if (!mountedRef.current) return;

        if (result.status === 'approved' && result.token) {
          // Stop polling
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }

          setState('approved');

          // Save token via IPC
          if (window.aegis?.pairing?.saveToken) {
            await window.aegis.pairing.saveToken(result.token);
          }

          // Notify parent after a brief success animation
          setTimeout(() => {
            if (mountedRef.current) {
              onPaired(result.token!);
            }
          }, 1200);
        } else if (result.status === 'rejected') {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          setState('error');
          setError(t('pairing.pairingRejected'));
        }
        // 'pending' → keep polling
      } catch (err: any) {
        // Network errors during poll are non-fatal — keep trying
        console.warn('[Pairing] Poll error (will retry):', err.message);
      }
    }, 3000);
  }, [gatewayHttpUrl, onPaired, t]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-aegis-bg-solid"
      dir="ltr"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgb(var(--aegis-primary)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Main card */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-aegis-card-solid border border-aegis-border shadow-2xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-aegis-primary via-aegis-accent to-aegis-primary" />

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="absolute top-4 end-4 p-1.5 rounded-lg text-aegis-text-dim hover:text-aegis-text-secondary hover:bg-aegis-glass transition-colors"
          title={t('pairing.cancel')}
        >
          <X size={18} />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-6
            ${state === 'approved'
              ? 'bg-aegis-primary/20 text-aegis-primary'
              : state === 'error'
                ? 'bg-red-500/20 text-red-400'
                : state === 'waiting-cli'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-aegis-primary/20 text-aegis-primary'}
            transition-colors duration-500
          `}>
            {state === 'approved' ? (
              <CheckCircle2 size={32} className="animate-pulse" />
            ) : state === 'error' ? (
              <AlertTriangle size={32} />
            ) : state === 'requesting' ? (
              <Loader2 size={32} className="animate-spin" />
            ) : state === 'waiting-cli' ? (
              <ShieldCheck size={32} />
            ) : (
              <Key size={32} />
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-aegis-text mb-2">
            {state === 'approved'
              ? t('pairing.pairedSuccess')
              : state === 'error'
                ? t('pairing.pairingError')
                : state === 'waiting-cli'
                  ? t('pairing.needsApproval')
                  : t('pairing.pairWithGateway')}
          </h2>

          {/* Subtitle / Error */}
          {errorMessage && state === 'idle' && (
            <p className="text-sm text-amber-400/80 mb-4 font-mono bg-amber-500/10 px-3 py-1.5 rounded-lg">
              {errorMessage}
            </p>
          )}

          {state === 'error' && error && (
            <p className="text-sm text-red-400/80 mb-4">{error}</p>
          )}

          {/* Pairing code display */}
          {(state === 'waiting' || state === 'approved') && code && (
            <div className="w-full mb-6">
              <p className="text-sm text-aegis-text-muted mb-3">
                {t('pairing.enterCode')}
              </p>

              {/* Code display */}
              <div className={`
                py-4 px-6 rounded-xl bg-aegis-bg-solid border-2 transition-colors duration-500
                ${state === 'approved' ? 'border-emerald-500/50' : 'border-aegis-primary/30'}
              `}>
                <span className="text-4xl font-mono font-bold tracking-[0.3em] text-aegis-text select-all">
                  {code}
                </span>
              </div>

              {/* Instructions */}
              {state === 'waiting' && (
                <div className="mt-5 space-y-2 text-start">
                  <p className="text-xs text-aegis-text-dim flex items-center gap-2">
                    <ShieldCheck size={14} className="text-aegis-primary shrink-0" />
                    <span>{t('pairing.openTerminal')}</span>
                  </p>
                  <p className="text-xs text-aegis-text-dim flex items-center gap-2">
                    <ShieldCheck size={14} className="text-aegis-primary shrink-0" />
                    <span>{t('pairing.orApproveFromUI')}</span>
                  </p>
                </div>
              )}

              {/* Polling indicator */}
              {state === 'waiting' && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-aegis-text-dim">
                  <Loader2 size={12} className="animate-spin text-aegis-primary" />
                  <span>{t('pairing.waitingApproval')}</span>
                </div>
              )}
            </div>
          )}

          {/* Requesting state */}
          {state === 'requesting' && (
            <div className="my-6 flex items-center gap-2 text-sm text-aegis-text-muted">
              <Loader2 size={16} className="animate-spin text-aegis-primary" />
              <span>{t('pairing.requestingPairing')}</span>
            </div>
          )}

          {/* Waiting for CLI approval state */}
          {state === 'waiting-cli' && (
            <div className="w-full mb-6">
              <p className="text-sm text-aegis-text-muted mb-4">
                {t('pairing.needsApprovalCliBody')}
              </p>

              {/* Windows command */}
              <div className="mb-3">
                <p className="text-xs text-aegis-text-dim mb-1.5 font-semibold flex items-center gap-1.5">
                  <span>💻</span> {t('pairing.windowsCmdHint')}
                </p>
                <div className="py-2.5 px-4 rounded-xl bg-aegis-bg-solid border border-aegis-border font-mono text-sm text-aegis-primary select-all" dir="ltr">
                  openclaw devices approve
                </div>
              </div>

              {/* Docker command */}
              <div className="mb-3">
                <p className="text-xs text-aegis-text-dim mb-1.5 font-semibold flex items-center gap-1.5">
                  <span>🐳</span> {t('pairing.dockerCmdHint')}
                </p>
                <div className="py-2.5 px-4 rounded-xl bg-aegis-bg-solid border border-aegis-border font-mono text-xs text-aegis-primary select-all" dir="ltr">
                  docker exec openclaw-gateway openclaw devices approve
                </div>
              </div>

              {/* Additional info */}
              <div className="mt-4 space-y-2 text-start">
                <p className="text-xs text-aegis-text-dim flex items-center gap-2">
                  <ShieldCheck size={14} className="text-aegis-primary shrink-0" />
                  <span>{t('pairing.orApproveFromUIFull')}</span>
                </p>
                <p className="text-xs text-aegis-text-dim flex items-center gap-2">
                  <ShieldCheck size={14} className="text-aegis-primary shrink-0" />
                  <span>{t('pairing.oneTimeOnly')}</span>
                </p>
              </div>

              {/* Polling indicator */}
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-aegis-text-dim">
                <Loader2 size={12} className="animate-spin text-aegis-primary" />
                <span>{t('pairing.waitingApprovalRetry')}</span>
              </div>
            </div>
          )}

          {/* Approved state */}
          {state === 'approved' && (
            <div className="my-4 flex items-center gap-2 text-sm text-aegis-primary">
              <CheckCircle2 size={16} />
              <span>{t('pairing.reconnecting')}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 w-full mt-2">
            {state === 'error' && (
              <button
                onClick={requestPairing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                  bg-aegis-primary hover:bg-[rgb(var(--aegis-primary-hover))] text-aegis-btn-primary-text font-semibold text-sm
                  transition-colors"
              >
                <RefreshCw size={16} />
                <span>{t('pairing.retry')}</span>
              </button>
            )}
            {(state === 'error' || state === 'idle' || state === 'waiting-cli') && (
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 rounded-xl border border-aegis-border
                  text-aegis-text-muted hover:text-aegis-text hover:border-aegis-border-hover text-sm
                  transition-colors"
              >
                {t('pairing.cancel')}
              </button>
            )}
          </div>
        </div>

        {/* Manual Token Entry — fallback when auto-pairing fails or CLI approval mode */}
        {(state === 'error' || state === 'waiting-cli' || showManualToken) && (
          <div className="px-8 pb-4">
            <div className="border-t border-aegis-border pt-4">
              {!showManualToken ? (
                <button
                  onClick={() => setShowManualToken(true)}
                  className="text-xs text-aegis-primary hover:text-aegis-accent transition-colors w-full text-center"
                >
                  {t('pairing.enterTokenManually')}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-aegis-text-muted text-center">
                    {t('pairing.enterTokenDesc')}
                  </p>
                  <input
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder={t('pairing.pasteToken')}
                    className="w-full px-3 py-2 rounded-lg bg-aegis-bg-solid border border-aegis-border text-sm text-aegis-text placeholder:text-aegis-text-dim focus:outline-none focus:border-aegis-primary"
                    dir="ltr"
                  />
                  <button
                    onClick={async () => {
                      if (!manualToken.trim()) return;
                      if (window.aegis?.pairing?.saveToken) {
                        await window.aegis.pairing.saveToken(manualToken.trim());
                      }
                      setState('approved');
                      setTimeout(() => onPaired(manualToken.trim()), 800);
                    }}
                    disabled={!manualToken.trim()}
                    className="w-full py-2 rounded-xl bg-aegis-primary hover:bg-[rgb(var(--aegis-primary-hover))] text-aegis-btn-primary-text font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('pairing.connect')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="px-8 pb-6">
          <div className="text-[10px] text-aegis-text-dim text-center leading-relaxed">
            {t('pairing.tokenExplanation')}
          </div>
        </div>
      </div>
    </div>
  );
}
