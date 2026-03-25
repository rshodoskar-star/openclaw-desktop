// ═══════════════════════════════════════════════════════════
// Config Manager — Secrets Tab
// Read-only providers view + Audit + Reload
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, RefreshCw, AlertTriangle, KeyRound } from 'lucide-react';
import clsx from 'clsx';
import type { OpenClawConfig } from './types';
import { ExpandableCard } from './components';

interface SecretsTabProps {
  config: OpenClawConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider badge color by type
// ─────────────────────────────────────────────────────────────────────────────

function providerBadgeClass(type: string): string {
  switch (type) {
    case 'env':  return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
    case 'file': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
    case 'exec': return 'bg-purple-400/10 text-purple-400 border-purple-400/20';
    default:     return 'bg-aegis-elevated text-aegis-text-muted border-aegis-border';
  }
}

function providerType(cfg: Record<string, unknown>): string {
  if ('command' in cfg || 'exec' in cfg) return 'exec';
  if ('file' in cfg || 'path' in cfg)    return 'file';
  return 'env';
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast helper
// ─────────────────────────────────────────────────────────────────────────────

type ToastState = { kind: 'success' | 'error'; message: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      className={clsx(
        'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3',
        'rounded-xl border text-sm font-medium shadow-lg',
        'animate-[float-in_0.3s_ease-out] cursor-pointer',
        toast.kind === 'success'
          ? 'bg-aegis-primary/10 border-aegis-primary/20 text-aegis-primary'
          : 'bg-red-400/10 border-red-400/20 text-red-400'
      )}
      onClick={onDismiss}
    >
      {toast.kind === 'success' ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
      {toast.message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function providerTypeLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case 'env':
      return t('config.secretsTab.providerTypeEnv');
    case 'file':
      return t('config.secretsTab.providerTypeFile');
    case 'exec':
      return t('config.secretsTab.providerTypeExec');
    default:
      return type;
  }
}

export function SecretsTab({ config }: SecretsTabProps) {
  const { t } = useTranslation();

  // Audit state
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<SecretsAuditResult | null>(null);
  const [auditError, setAuditError] = useState<string>('');

  // Reload state
  const [reloading, setReloading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  // Providers
  const providers = ((config as Record<string, unknown>).secrets as Record<string, unknown> | undefined)?.providers ?? {};
  const providerEntries = Object.entries(providers as Record<string, Record<string, unknown>>);

  // Audit handler
  const handleAudit = async () => {
    setAuditing(true);
    setAuditError('');
    setAuditResult(null);
    try {
      const result = await window.aegis?.secrets?.audit();
      if (result?.success && result.data) {
        setAuditResult(result.data);
      } else {
        setAuditError(result?.error ?? t('config.secretsTab.auditFailed'));
      }
    } catch (err: unknown) {
      const e = err as Error;
      setAuditError(e?.message ?? String(err));
    } finally {
      setAuditing(false);
    }
  };

  // Reload handler
  const handleReload = async () => {
    setReloading(true);
    try {
      const result = await window.aegis?.secrets?.reload();
      if (result?.success) {
        setToast({ kind: 'success', message: t('config.secretsTab.reloadSuccess') });
      } else {
        setToast({ kind: 'error', message: result?.error ?? t('config.secretsTab.reloadFailed') });
      }
    } catch (err: unknown) {
      const e = err as Error;
      setToast({ kind: 'error', message: e?.message ?? String(err) });
    } finally {
      setReloading(false);
      setTimeout(() => setToast(null), 3500);
    }
  };

  // Audit status badge
  const auditStatusBadge = () => {
    if (!auditResult) return null;
    const { status } = auditResult;
    if (status === 'clean')
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
          {t('config.secretsTab.statusClean')}
        </span>
      );
    if (status === 'findings')
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
          {t('config.secretsTab.statusFindings')}
        </span>
      );
    if (status === 'unresolved')
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-400/10 text-red-400 border border-red-400/20">
          {t('config.secretsTab.statusUnresolved')}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-zinc-400/10 text-zinc-400 border border-zinc-400/20">
        {t('config.secretsTab.statusUnknown')}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* A) Audit Section */}
      <ExpandableCard
        title={t('config.secretsTab.auditTitle')}
        subtitle={t('config.secretsTab.auditSubtitle')}
        icon={<ShieldCheck size={15} />}
        defaultExpanded
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleAudit}
            disabled={auditing}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border',
              'bg-aegis-primary/10 text-aegis-primary border-aegis-primary/20',
              'hover:bg-aegis-primary/20 transition-all duration-200',
              auditing && 'opacity-60 cursor-not-allowed'
            )}
          >
            <ShieldCheck size={14} className={auditing ? 'animate-pulse' : ''} />
            {auditing ? t('config.secretsTab.runningAudit') : t('config.secretsTab.runAudit')}
          </button>

          {auditStatusBadge()}
        </div>

        {auditError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-400/8 border border-red-400/20 text-red-400 text-sm mt-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{auditError}</span>
          </div>
        )}

        {auditResult?.rawOutput && (
          <pre className="mt-3 p-3 rounded-lg bg-black/30 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto border border-white/5">
            {auditResult.rawOutput}
          </pre>
        )}
      </ExpandableCard>

      {/* B) Providers Section */}
      <ExpandableCard
        title={t('config.secretsTab.providersTitle')}
        subtitle={t('config.secretsTab.providersSubtitle')}
        icon={<KeyRound size={15} />}
        defaultExpanded
        badge={
          providerEntries.length > 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-aegis-primary/10 text-aegis-primary border border-aegis-primary/20">
              {providerEntries.length}
            </span>
          ) : undefined
        }
      >
        {providerEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
            <KeyRound size={24} className="text-aegis-text-muted" />
            <p className="text-sm text-aegis-text-muted">{t('config.secretsTab.noProviders')}</p>
            <p className="text-xs text-aegis-text-muted">
              {t('config.secretsTab.noProvidersHintBefore')}{' '}
              <code className="font-mono bg-aegis-elevated px-1 rounded">secrets.providers</code>{' '}
              {t('config.secretsTab.noProvidersHintAfter')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {providerEntries.map(([name, cfg]) => {
              const type = providerType(cfg);
              return (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-aegis-border bg-aegis-surface hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <KeyRound size={13} className="text-aegis-text-muted shrink-0" />
                    <span className="text-sm font-mono text-aegis-text truncate">{name}</span>
                  </div>
                  <span
                    className={clsx(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0',
                      providerBadgeClass(type)
                    )}
                  >
                    {providerTypeLabel(type, t)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ExpandableCard>

      {/* C) Reload Section */}
      <ExpandableCard
        title={t('config.secretsTab.reloadTitle')}
        subtitle={t('config.secretsTab.reloadSubtitle')}
        icon={<RefreshCw size={15} />}
        defaultExpanded
      >
        <p className="text-xs text-aegis-text-muted mb-3">{t('config.secretsTab.reloadDescription')}</p>
        <button
          onClick={handleReload}
          disabled={reloading}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border',
            'border-aegis-border text-aegis-text-secondary',
            'hover:bg-white/[0.03] hover:border-aegis-border-hover',
            'transition-all duration-200',
            reloading && 'opacity-60 cursor-not-allowed'
          )}
        >
          <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
          {reloading ? t('config.secretsTab.reloading') : t('config.secretsTab.reloadButton')}
        </button>
      </ExpandableCard>
    </div>
  );
}

export default SecretsTab;
