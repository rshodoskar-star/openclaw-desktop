; ═══════════════════════════════════════════════════════════
; OpenClaw Station — Custom NSIS Installer Script
; Advanced Executive General Intelligence System
; ═══════════════════════════════════════════════════════════

; ── Language Selection ──
; NOTE: electron-builder handles MUI_LANGDLL_DISPLAY automatically
; when installerLanguages has multiple entries in package.json.
; Do NOT add it here — it causes a duplicate dialog (before + after UAC).

; ── Custom Welcome Page Text ──
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "OpenClaw Station v${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "Welcome to OpenClaw Station Setup.$\r$\n$\r$\nAdvanced Executive General Intelligence System$\r$\n$\r$\nThis wizard will install OpenClaw Station on your computer.$\r$\nIt is recommended to close all other applications before continuing.$\r$\n$\r$\nClick Next to continue."
!macroend

; ── Custom Install Actions ──
!macro customInstall
  ; Create shared voice folder
  CreateDirectory "$PROFILE\clawdbot-shared\voice"

  ; Write app info to registry
  WriteRegStr SHCTX "Software\OpenClaw Station" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "Software\OpenClaw Station" "Version" "${VERSION}"

  ; Save selected language for the app to read on first launch
  ; Arabic = 1025, English = 1033
  StrCmp $LANGUAGE 1025 0 +4
    FileOpen $0 "$INSTDIR\resources\language.txt" w
    FileWrite $0 "ar"
    FileClose $0
    Goto langDone
  FileOpen $0 "$INSTDIR\resources\language.txt" w
  FileWrite $0 "en"
  FileClose $0
  langDone:
!macroend

; ── Custom Uninstall Actions ──
!macro customUnInstall
  DeleteRegKey SHCTX "Software\OpenClaw Station"
!macroend
