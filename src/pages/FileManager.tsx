// ═══════════════════════════════════════════════════════════
// FileManager — Workspace File Browser
// Header: path input + browse + refresh
// Left: file list (icon, name, size, modified)
// Right: file content preview (monospace, read-only)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderOpen,
  File,
  RefreshCw,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  FileText,
  FileJson,
  FileCode,
  AlertCircle,
  FolderSearch,
} from 'lucide-react';
import { PageTransition } from '@/components/shared/PageTransition';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  content: string;
  size: number;
  modified: string;
  ext: string;
}

// ── Helpers ───────────────────────────────────────────────

function getExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function getFileIcon(ext: string) {
  const size = 14;
  if (['json', 'jsonc'].includes(ext)) return <FileJson size={size} className="text-aegis-warning" />;
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'bash'].includes(ext))
    return <FileCode size={size} className="text-aegis-accent" />;
  if (['md', 'txt', 'log'].includes(ext)) return <FileText size={size} className="text-aegis-success" />;
  return <File size={size} className="text-aegis-text-dim" />;
}

function getLanguageLabel(ext: string): string {
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    json: 'JSON', jsonc: 'JSON', md: 'Markdown', txt: 'Plain Text',
    py: 'Python', sh: 'Shell', bash: 'Shell', log: 'Log', yaml: 'YAML', yml: 'YAML',
    css: 'CSS', html: 'HTML', toml: 'TOML',
  };
  return map[ext] || ext.toUpperCase() || 'File';
}

// ── Sub-components ────────────────────────────────────────

function FileItem({
  file,
  selected,
  onClick,
}: {
  file: FileEntry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start transition-all group',
        selected
          ? 'bg-aegis-primary/15 border border-aegis-primary/30 text-aegis-text'
          : 'hover:bg-[rgb(var(--aegis-overlay)/0.04)] border border-transparent text-aegis-text-muted'
      )}
    >
      <span className="shrink-0">{getFileIcon(file.ext)}</span>

      {/* Name */}
      <span className="flex-1 min-w-0 truncate text-[12px] font-medium">{file.name}</span>

      {/* Chevron */}
      <ChevronRight
        size={12}
        className={clsx(
          'shrink-0 transition-transform',
          selected ? 'text-aegis-primary opacity-100' : 'text-aegis-text-dim opacity-0 group-hover:opacity-50'
        )}
      />
    </button>
  );
}

function FileMeta({ file }: { file: FileEntry }) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-aegis-text-dim font-mono">
      <span>{formatSize(file.size)}</span>
      <span>·</span>
      <span>{formatDate(file.modified)}</span>
      <span>·</span>
      <span className="text-aegis-text-muted">{getLanguageLabel(file.ext)}</span>
    </div>
  );
}

function EmptyState({ path, onBrowse }: { path: string; onBrowse: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-aegis-primary/10 border border-aegis-primary/20 flex items-center justify-center">
        <FolderSearch size={24} className="text-aegis-primary" />
      </div>
      <div>
        <div className="text-[14px] font-bold text-aegis-text mb-1">
          {t('fileManager.noFiles', 'No files found')}
        </div>
        <div className="text-[12px] text-aegis-text-dim max-w-[280px] leading-relaxed">
          {path
            ? t('fileManager.noFilesDesc', 'No readable files in this folder, or the path is inaccessible.')
            : t('fileManager.noPathDesc', 'Enter a folder path above or click Browse to pick one.')}
        </div>
      </div>
      {!path && (
        <button
          onClick={onBrowse}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-aegis-primary/15 border border-aegis-primary/30 text-aegis-primary text-[12px] font-semibold hover:bg-aegis-primary/25 transition-colors"
        >
          <FolderOpen size={15} />
          {t('fileManager.browse', 'Browse Folder')}
        </button>
      )}
    </div>
  );
}

function NoBridgeState() {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-aegis-warning-surface border border-yellow-400/20 flex items-center justify-center">
        <AlertCircle size={24} className="text-aegis-warning" />
      </div>
      <div>
        <div className="text-[14px] font-bold text-aegis-text mb-1">
          {t('fileManager.noBridge', 'IPC Bridge Unavailable')}
        </div>
        <div className="text-[12px] text-aegis-text-dim max-w-[320px] leading-relaxed">
          {t(
            'fileManager.noBridgeDesc',
            'File browsing requires the Electron IPC bridge (window.aegis). This feature is only available inside the OpenClaw Station app.'
          )}
        </div>
        <div className="mt-3 px-4 py-2 rounded-lg bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] inline-block">
          <code className="text-[11px] text-aegis-text-dim font-mono">
            File browsing requires IPC bridge — coming soon
          </code>
        </div>
      </div>
    </div>
  );
}

function PreviewPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] flex items-center justify-center">
        <Eye size={20} className="text-aegis-text-dim" />
      </div>
      <div className="text-[12px] text-aegis-text-dim">
        {t('fileManager.selectFile', 'Select a file to preview')}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

const DEFAULT_PATH = '';

export function FileManagerPage() {
  const { t } = useTranslation();

  const [folderPath, setFolderPath] = useState<string>(DEFAULT_PATH);
  const [pendingPath, setPendingPath] = useState<string>(DEFAULT_PATH);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [query, setQuery] = useState('');
  const [hasAegis, setHasAegis] = useState<boolean | null>(null);

  // ── Detect IPC bridge ──
  useEffect(() => {
    const w = window as any;
    setHasAegis(
      typeof w.aegis === 'object' &&
        w.aegis !== null &&
        typeof w.aegis.memory?.readLocal === 'function'
    );
  }, []);

  // ── Load files ──
  const loadFiles = useCallback(async (dir: string) => {
    if (!dir.trim()) {
      setFiles([]);
      setSelected(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelected(null);

    try {
      const w = window as any;
      const result = await w.aegis.memory.readLocal(dir.trim());

      if (!result?.success) {
        setError(result?.error || t('fileManager.errRead', 'Failed to read folder'));
        setFiles([]);
        return;
      }

      const rawFiles: any[] = result.files || [];
      const entries: FileEntry[] = rawFiles.map((f: any) => ({
        name: f.name ?? 'untitled',
        path: f.path ?? dir + '/' + (f.name ?? ''),
        content: typeof f.content === 'string' ? f.content : '',
        size: typeof f.size === 'number' ? f.size : (f.content?.length ?? 0),
        modified: f.modified ?? f.mtime ?? '',
        ext: getExt(f.name ?? ''),
      }));

      // Sort: by extension group, then name
      entries.sort((a, b) => {
        const groupOrder = (ext: string) =>
          ['md', 'txt'].includes(ext) ? 0 :
          ['ts', 'tsx', 'js', 'jsx', 'py'].includes(ext) ? 1 :
          ['json', 'yaml', 'yml', 'toml'].includes(ext) ? 2 : 3;
        const g = groupOrder(a.ext) - groupOrder(b.ext);
        return g !== 0 ? g : a.name.localeCompare(b.name);
      });

      setFiles(entries);
    } catch (err: any) {
      setError(err?.message || t('fileManager.errUnknown', 'Unexpected error'));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // ── Browse folder ──
  const handleBrowse = useCallback(async () => {
    try {
      const w = window as any;
      const picked = await w.aegis.memory.browse();
      if (picked) {
        setPendingPath(picked);
        setFolderPath(picked);
        await loadFiles(picked);
      }
    } catch {
      // user cancelled or bridge error — silent
    }
  }, [loadFiles]);

  // ── Submit path ──
  const handleSubmit = useCallback(() => {
    setFolderPath(pendingPath);
    loadFiles(pendingPath);
  }, [pendingPath, loadFiles]);

  // ── Filtered files ──
  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter(
      (f) => f.name.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)
    );
  }, [files, query]);

  // ── Content line count ──
  const lineCount = useMemo(
    () => (selected ? selected.content.split('\n').length : 0),
    [selected]
  );

  // ─────────────────────────────────────────────────────────
  // Render — no bridge
  // ─────────────────────────────────────────────────────────
  if (hasAegis === false) {
    return (
      <PageTransition className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-[rgb(var(--aegis-overlay)/0.06)]">
          <div className="w-7 h-7 rounded-lg bg-aegis-primary/15 border border-aegis-primary/30 flex items-center justify-center">
            <FolderOpen size={15} className="text-aegis-primary" />
          </div>
          <span className="text-[15px] font-bold text-aegis-text">
            {t('fileManager.title', 'Files')}
          </span>
        </div>
        <NoBridgeState />
      </PageTransition>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render — main layout
  // ─────────────────────────────────────────────────────────
  return (
    <PageTransition className="flex flex-col flex-1 min-h-0 h-full">

      {/* ══ Header ══ */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--aegis-overlay)/0.06)]">
        {/* Icon + Title */}
        <div className="w-7 h-7 rounded-lg bg-aegis-primary/15 border border-aegis-primary/30 flex items-center justify-center shrink-0">
          <FolderOpen size={15} className="text-aegis-primary" />
        </div>
        <span className="text-[15px] font-bold text-aegis-text shrink-0">
          {t('fileManager.title', 'Files')}
        </span>

        {/* Path input */}
        <div className="flex-1 flex items-center gap-2 bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] rounded-xl px-3 py-1.5 min-w-0">
          <span className="text-aegis-text-dim text-[12px] shrink-0">📁</span>
          <input
            value={pendingPath}
            onChange={(e) => setPendingPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('fileManager.pathPlaceholder', 'Enter folder path (e.g. D:\\workspace)')}
            className="flex-1 bg-transparent text-[12px] text-aegis-text placeholder:text-aegis-text-dim focus:outline-none min-w-0 font-mono"
            spellCheck={false}
          />
        </div>

        {/* Browse button */}
        <button
          onClick={handleBrowse}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.08)] text-[11px] text-aegis-text-muted hover:text-aegis-text-secondary hover:border-aegis-primary/30 transition-colors"
        >
          <FolderOpen size={13} />
          {t('fileManager.browse', 'Browse')}
        </button>

        {/* Refresh */}
        <button
          onClick={() => loadFiles(folderPath)}
          disabled={loading || !folderPath}
          className="shrink-0 p-1.5 rounded-lg hover:bg-[rgb(var(--aegis-overlay)/0.05)] text-aegis-text-dim transition-colors disabled:opacity-30"
          title={t('fileManager.refresh', 'Refresh')}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ══ Error bar ══ */}
      {error && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-aegis-danger-surface border-b border-red-400/15 text-[11px] text-aegis-danger">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* ══ Body ══ */}
      <div className="flex flex-1 min-h-0">

        {/* ─ Left panel: file list ─ */}
        <div className="w-[260px] shrink-0 border-e border-[rgb(var(--aegis-overlay)/0.06)] flex flex-col min-h-0">

          {/* Search within files */}
          <div className="shrink-0 p-2.5 border-b border-[rgb(var(--aegis-overlay)/0.06)]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aegis-text-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('fileManager.searchFiles', 'Search files…')}
                className="w-full bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.06)] rounded-lg ps-7 pe-3 py-1.5 text-[11px] text-aegis-text placeholder:text-aegis-text-dim focus:outline-none focus:border-aegis-accent/30 transition-colors"
              />
            </div>
          </div>

          {/* File count */}
          {files.length > 0 && (
            <div className="shrink-0 px-3 py-1.5 text-[10px] text-aegis-text-dim border-b border-[rgb(var(--aegis-overlay)/0.04)]">
              {filtered.length === files.length
                ? `${files.length} ${t('fileManager.filesCount', 'files')}`
                : `${filtered.length} / ${files.length} ${t('fileManager.filesCount', 'files')}`}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-aegis-primary" />
              </div>
            ) : hasAegis === null ? (
              /* Still detecting bridge */
              <div className="flex items-center justify-center py-12">
                <Loader2 size={16} className="animate-spin text-aegis-text-dim" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState path={folderPath} onBrowse={handleBrowse} />
            ) : (
              filtered.map((file) => (
                <div key={file.path}>
                  <FileItem
                    file={file}
                    selected={selected?.path === file.path}
                    onClick={() => setSelected(file)}
                  />
                  {/* Meta below item when selected */}
                  {selected?.path === file.path && (
                    <div className="px-3 pb-1.5 -mt-0.5">
                      <FileMeta file={file} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─ Right panel: preview ─ */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {selected ? (
            <>
              {/* Preview header */}
              <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[rgb(var(--aegis-overlay)/0.06)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getFileIcon(selected.ext)}
                  <span className="text-[13px] font-semibold text-aegis-text truncate">
                    {selected.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[10px] text-aegis-text-dim font-mono">
                  <span>{lineCount} {t('fileManager.lines', 'lines')}</span>
                  <span>·</span>
                  <span>{formatSize(selected.size)}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--aegis-overlay)/0.04)] border border-[rgb(var(--aegis-overlay)/0.06)]">
                    {getLanguageLabel(selected.ext)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {selected.content ? (
                  <pre
                    className="p-4 text-[11.5px] leading-[1.65] font-mono text-aegis-text-muted whitespace-pre-wrap break-all select-text"
                    style={{ minHeight: '100%', tabSize: 2 }}
                  >
                    {selected.content}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-aegis-text-dim text-[12px]">
                    {t('fileManager.emptyFile', 'File is empty')}
                  </div>
                )}
              </div>
            </>
          ) : (
            <PreviewPlaceholder />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
