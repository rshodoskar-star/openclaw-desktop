# Changelog

All notable changes to AEGIS Desktop are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## [5.3.2] — 2026-02-23

### Fixed
- **Installer language not applied** — app opened in Arabic regardless of installer language choice; now the selected language flows from NSIS → main process → preload → renderer synchronously before first render
- **Duplicate language dialog** — installer showed language selection twice (before and after UAC elevation); removed redundant `MUI_LANGDLL_DISPLAY` — electron-builder handles it automatically
- **Language persistence across reinstalls** — version-aware detection ensures a fresh install respects the installer language choice even when old preferences exist in localStorage

### Changed
- **Default language** — English is now the default when no installer language or saved preference is found; users can switch to Arabic from Settings

---

## [5.3.1] — 2026-02-23

### Fixed
- **BREAKING: Device Auth v2** — removed v1 signature fallback; Gateway 2026.2.22+ rejects v1. If no challenge nonce arrives, handshake proceeds with token-only auth instead of sending an invalid v1 signature
- **Hardcoded platform** — `'windows'` was sent to Gateway for all users; now auto-detected (`windows`/`macos`/`linux`) via `navigator.userAgent`
- **Hardcoded locale** — `'ar-SA'` was sent to Gateway for all users; now follows the app's language setting
- **Hardcoded Arabic strings** — 9 notification/label strings outside the i18n system now use translation keys, so English users see English text
- **Date/time locale** — `toLocaleTimeString('ar-SA')` hardcoded in MessageBubble and TokenDashboard; now follows app language
- **i18n fallback language** — changed from `'ar'` to `'en'` so missing translation keys fall back to English (the more complete locale)
- **i18n initial language** — detects system language on first run instead of defaulting to Arabic
- **Close code 1008** — WebSocket close with code 1008 now correctly detected as pairing-required, triggering the auto-pairing flow
- **Unreachable theme code** — theme initialization in App.tsx was placed after an early `return` statement and never executed; moved before cleanup return
- **Orphan WebSocket** — added `gateway.disconnect()` to useEffect cleanup, preventing duplicate connections on component remount

### Added
- **Cron delivery status** — Cron Monitor now shows separate run status and delivery status badges (Gateway 2026.2.22+ splits `lastRunStatus` from `lastDeliveryStatus`)
- **Directive tag stripping** — client-side stripping of `[[reply_to_current]]`, `[[audio_as_voice]]`, and `<<<EXTERNAL_UNTRUSTED_CONTENT>>>` from assistant messages (defense-in-depth; Gateway 2026.2.22+ strips server-side)
- **Challenge timeout** — increased from 750ms to 2s for more reliable v2 device-auth handshake on slow connections
- **Centralized version** — `src/hooks/useAppVersion.ts` exports `APP_VERSION` + `useAppVersion()` hook; version defined once in `package.json`

### Changed (i18n Audit)
- **Full i18n audit** — ~100 hardcoded strings (Arabic + English) moved to locale files across 22 source files
- **Locale keys: 278 → 431 (en), 224 → 398 (ar)** — 13 new sections: `format`, `notificationCenter`, `errors`, `code`, `media`, `thinking`, `pairing`, `settingsExtra`, `settingsTheme`, `cronDetail`, `cronTemplates`, `dashboardExtra`, `memoryExplorer`, `agentHubExtra`, `workshopExtra`, `skillsExtra`, `commandPaletteFooter`
- **format.ts** — `timeAgo()` and `formatUptime()` now use i18n
- **PairingScreen** — all `isRTL ? '...' : '...'` ternaries → `t()` calls
- **CronMonitor** — templates use `getCronTemplates(t)` instead of inline `{en, ar}` objects; all buttons/labels i18n
- **MemoryExplorer** — `CATEGORY_KEYS` with `i18nKey` pattern; all labels/empty states i18n
- **Workshop** — columns, stats, legend labels through `t()`
- **SkillsPage** — Featured, Installs, Requirements → `t()`
- **ErrorBoundary** (both) — `i18n.t()` for class components
- **NotificationCenter / TokenDashboard** — removed local `timeAgo()`, uses shared `format.ts`

---

## [5.3.0] — 2026-02-22

### Added
- **Skills Page** — browse and search 3,286+ skills from ClawHub with vector search, categories, and detail panel
- **Integrated Terminal** — PowerShell / Bash via xterm.js + node-pty, multi-tab, auto-resize, clickable links
- **Pairing UX** — auto-detects when Gateway requires pairing, shows CLI instructions with auto-retry
- **Connection Settings** — Gateway URL and Token editable in Settings (no config file needed)
- **Thinking Stream UI** — reasoning bubble for future Gateway WebSocket reasoning support

### Fixed
- **Cron Monitor** — 12 fixes: ref-based caching, batched loading, responsive grid, reduced tick interval
- **Table Overflow** — wide markdown tables scroll horizontally instead of breaking chat bubbles
- **CompactDivider** — context compaction detected from agent events instead of polling
- **CSP** — Google Fonts (IBM Plex Sans Arabic) no longer blocked
- **PTY Crash** — "Object has been destroyed" on app close resolved

---

## [5.2.1] — 2026-02-21

### Fixed
- **Command Palette i18n** — all entries translated correctly
- **Pairing error** — clearer error message + auto-detect system language

---

## [5.2.0] — 2026-02-20

### Added
- **Smart Quick Reply Buttons** — AI presents clickable chips via `[[button:Label]]` for decisions. Works with any model, no gateway config needed
- **Auto-load chat history** — conversation loads on connect (no blank screen)
- **Clean history display** — Desktop metadata stripped from user messages
- **Dynamic version** — single source of truth from `package.json`
- **Optimized system prompt** — context injection reduced ~33%

### Security
- **`webSecurity` always enabled** — Origin header rewriting replaces the old workaround of disabling Chromium web security
- **Broader Origin rewrite** — covers WS + HTTP protocols (previously WebSocket only)

### Fixed
- **Cron Monitor** — disabled/paused jobs now visible
- **Full Analytics** — `Promise.allSettled` for resilience, tiered fetching (30d → 90d → 365d), preset workflow redesign, cache bug fix, "This Month" day-31 fix, "All Time" uses server totals
- **Chat** — user messages restored in history (noise filter was over-filtering)
- Removed duplicate `call()` method in gateway client

---

## [5.1.0] — 2026-02-17

### Added
- **Dashboard** — rewritten with cost-first design, hero cards, agent panel, live sessions feed
- **Full Analytics** — 17-file suite replacing Cost Tracker (date ranges, model/agent/token breakdowns, daily table, CSV export)
- **Model Picker** — switch AI models from the title bar
- **Thinking Picker** — change reasoning level (off / low / medium / high)
- **Tool Intent View** — collapsible cards showing tool calls with params and results
- **Light Mode** — complete theme with custom palette
- **Theme System** — CSS variable architecture (`--aegis-*`), zero hardcoded colors
- **1M Context Toggle** — extended context for Anthropic API
- **`gateway.call()`** — public RPC method for direct gateway communication

### Fixed
- All hardcoded colors replaced with theme tokens
- Code blocks auto-switch between `oneLight` and `oneDark` syntax themes
- Model detection uses exact match instead of `includes()`
- Central Zustand store with smart polling intervals (10s / 30s / 120s)
- Cost Tracker removed — fully replaced by Full Analytics

---

## [5.0.0] — 2026-02-16

### Added
- **Artifacts Preview** — HTML, React, SVG, and Mermaid in a sandboxed window
- **Video playback** — inline video players for URL attachments
- **Workshop** — Kanban board manageable by AI via text commands
- **RTL/LTR overhaul** — logical CSS properties throughout

---

## [4.0.0] — 2026-02-09

### Added
- **Mission Control Dashboard** — agent monitoring and status overview
- **Bilingual UI** — Arabic (RTL) and English (LTR) with logical CSS
- **Notification Center** — bell badge, history panel, chime sound
- **Memory Explorer** — browse and search agent memories
- **Emoji Picker** — categories, search, and direction-aware positioning
- **Ed25519 device identity** — auto-generated keypair for gateway authentication
- **Challenge-response handshake** — secure WebSocket connection
