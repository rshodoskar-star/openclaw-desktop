import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

// ── Register only the languages we actually need (~50KB vs ~800KB) ──
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('xml', html);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('diff', diff);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('lsl', c); // LSL closest match
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('dockerfile', docker);
SyntaxHighlighter.registerLanguage('docker', docker);
SyntaxHighlighter.registerLanguage('toml', toml);
SyntaxHighlighter.registerLanguage('ini', ini);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);

// ═══════════════════════════════════════════════════════════
// Code Block — Theme-aware (dark/light) matching OpenClaw design
// Uses CSS variables: --aegis-code-bg, --aegis-code-header
// ═══════════════════════════════════════════════════════════

interface CodeBlockProps {
  language: string;
  code: string;
}

/** Build syntax theme from base (oneDark/oneLight) with OpenClaw overrides */
function buildTheme(base: Record<string, any>) {
  return {
    ...base,
    'pre[class*="language-"]': {
      ...base['pre[class*="language-"]'],
      background: 'var(--aegis-code-bg)',
      margin: 0,
      padding: '1em',
      borderRadius: 0,
      fontSize: '0.87em',
      direction: 'ltr' as const,
      textAlign: 'left' as const,
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      overflowWrap: 'break-word' as const,
    },
    'code[class*="language-"]': {
      ...base['code[class*="language-"]'],
      background: 'transparent',
      direction: 'ltr' as const,
      textAlign: 'left' as const,
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
    },
  };
}

const COLLAPSE_THRESHOLD = 30; // Lines before auto-collapse
const PREVIEW_LINES = 10;     // Lines shown when collapsed

export function CodeBlock({ language, code }: CodeBlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const totalLines = useMemo(() => code.split('\n').length, [code]);
  const isLong = totalLines > COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isLong);

  const displayCode = useMemo(() => {
    if (collapsed && isLong) {
      return code.split('\n').slice(0, PREVIEW_LINES).join('\n');
    }
    return code;
  }, [code, collapsed, isLong]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code); // Always copy FULL code
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = language || 'text';

  // Pick syntax theme based on current theme
  const isDark = !document.documentElement.classList.contains('light');
  const theme = buildTheme(isDark ? oneDark : oneLight);

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-[rgb(var(--aegis-overlay)/0.08)] group" dir="ltr"
      style={{ background: 'var(--aegis-code-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[rgb(var(--aegis-overlay)/0.06)]"
        style={{ background: 'var(--aegis-code-header)' }}>
        <span className="text-[10px] font-mono font-medium text-aegis-text-muted uppercase tracking-widest">
          {displayLang}
          {isLong && (
            <span className="ml-2 opacity-60">{totalLines} lines</span>
          )}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted hover:text-aegis-text-secondary transition-colors"
          title={t('code.copyCode')}
        >
          {copied ? (
            <>
              <Check size={11} className="text-aegis-success" />
              <span className="text-aegis-success">{t('code.copied')}</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">{t('code.copy')}</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={theme}
        showLineNumbers={totalLines > 3}
        lineNumberStyle={{
          color: 'rgb(var(--aegis-overlay) / 0.12)',
          fontSize: '0.78em',
          paddingRight: '1em',
          minWidth: '2.5em',
          textAlign: 'right',
        }}
        wrapLongLines
        customStyle={{
          background: 'var(--aegis-code-bg)',
          margin: 0,
        }}
      >
        {displayCode}
      </SyntaxHighlighter>

      {/* Collapse/Expand button */}
      {isLong && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium
            text-aegis-primary hover:text-aegis-primary/80 transition-colors
            border-t border-[rgb(var(--aegis-overlay)/0.06)]"
          style={{ background: 'var(--aegis-code-header)' }}
        >
          {collapsed ? (
            <>
              <ChevronDown size={13} />
              Show all ({totalLines} lines)
            </>
          ) : (
            <>
              <ChevronUp size={13} />
              Collapse
            </>
          )}
        </button>
      )}
    </div>
  );
}
