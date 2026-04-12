# 🎯 GXCode Studio - Piano di Sviluppo Produzione v2.0

**Versione Documento:** 1.0  
**Data:** 12 Aprile 2026  
**Obiettivo:** Rilascio produzione con architettura modulare e componentizzata

---

## 📐 Principi Architetturali

### ✅ Regola Fondamentale: NO BLOCCHI MONOLITICI

Ogni feature deve essere:
- **Componente autonomo** - File separati, responsabilità singola
- **Indipendente** - Può essere sviluppato/testato in isolamento
- **Componibile** - Si integra con il resto del sistema via API/IPC chiari
- **Testabile** - Unit test per ogni componente

### 📂 Struttura Modulare Proposta

```
src/main/
├── modules/                    # ← NUOVO: Sistema modulare
│   ├── core/                   # Moduli base sempre attivi
│   │   ├── WindowManager.js
│   │   ├── MenuManager.js
│   │   └── AppConfig.js
│   ├── editor/                 # Feature editor
│   │   ├── LSPClient.js
│   │   ├── CodeActions.js
│   │   ├── SignatureHelp.js
│   │   ├── HoverProvider.js
│   │   ├── GoToDefinition.js
│   │   └── SymbolOutline.js
│   ├── debugger/               # Debugging system
│   │   ├── DebugSession.js
│   │   ├── BreakpointManager.js
│   │   ├── VariableInspector.js
│   │   ├── CallStackManager.js
│   │   ├── WatchExpressions.js
│   │   ├── NodeDebugger.js     # ← esistente, refactoring
│   │   └── ChromeDebugger.js   # ← NUOVO
│   ├── testing/                # Testing framework
│   │   ├── TestRunner.js       # ← esistente, refactoring
│   │   ├── TestDiscovery.js
│   │   ├── CoverageReporter.js
│   │   ├── JestAdapter.js
│   │   ├── VitestAdapter.js
│   │   └── PlaywrightRunner.js # ← esistente, refactoring
│   ├── git/                    # Git integration
│   │   ├── GitService.js       # ← esistente, refactoring
│   │   ├── DiffViewer.js       # ← NUOVO
│   │   └── MergeConflictResolver.js
│   ├── terminal/               # Terminal features
│   │   ├── TerminalManager.js  # ← esistente, refactoring
│   │   ├── SplitPane.js        # ← NUOVO
│   │   └── TaskRunner.js       # ← NUOVO
│   ├── ai/                     # AI services
│   │   ├── AIOrchestrator.js
│   │   ├── OllamaService.js    # ← esistente, refactoring
│   │   ├── GeminiService.js
│   │   ├── ClaudeService.js
│   │   └── AIReactivityEngine.js # ← esistente, fix
│   └── extensions/             # Plugin system
│       ├── ExtensionManager.js
│       ├── VSCodeShim.js
│       └── ExtensionAPI.js

APP/
├── components/                 # UI Components (già modulare ✅)
│   ├── editor/                 # ← NUOVO: Split editor components
│   │   ├── EditorMain.js
│   │   ├── EditorSplit.js
│   │   ├── Breadcrumbs.js      # ← esistente, move
│   │   └── Minimap.js
│   ├── debug/                  # Debug UI (già esiste ✅)
│   │   ├── DebugPanel.js       # ← esistente
│   │   ├── DebugToolbar.js     # ← esistente
│   │   ├── BreakpointList.js   # ← NUOVO: Refactoring da debug.js
│   │   ├── VariableTree.js     # ← NUOVO
│   │   ├── WatchList.js        # ← NUOVO
│   │   └── CallStackList.js    # ← NUOVO
│   ├── testing/                # Test UI (già esiste ✅)
│   │   ├── TestExplorer.js     # ← esistente (tests.js)
│   │   ├── TestResults.js      # ← NUOVO
│   │   └── CoverageView.js     # ← NUOVO
│   └── ...                     # Altri componenti esistenti
└── core/
    ├── ModuleLoader.js         # ← NUOVO: Bootstrap modulare
    ├── EventBus.js             # ← NUOVO: Event system centralizzato
    └── ...                     # Altri core esistenti
```

---

## 🗺️ Roadmap per Fasi - v1.7 → v2.0

### 📍 Fase 1: Stabilizzazione v1.7 (Settimane 1-2)

**Obiettivo:** Sistemare ciò che esiste già, preparare terreno modulare

#### ✅ 1.1 Refactoring Infrastruttura

| Task | Componente | File | Stato |
|------|-----------|------|-------|
| Creare ModuleLoader | `APP/core/ModuleLoader.js` | NUOVO | ⬜ |
| Creare EventBus centrale | `APP/core/EventBus.js` | NUOVO | ⬜ |
| Refactoring debugger esistente in moduli | `src/main/modules/debugger/` | REFACTOR | ⬜ |
| Refactoring testHandlers in moduli | `src/main/modules/testing/` | REFACTOR | ⬜ |
| Fix AI Reactivity Engine (disabilitato) | `src/main/services/aiReactivityEngine.js` | FIX | ⬜ |
| Fix AI Auto-Correction | `src/main/services/autoCorrectionService.js` | FIX | ⬜ |

#### 🧪 1.2 Testing E2E Completo

| Task | Componente | File | Stato |
|------|-----------|------|-------|
| Test apertura/chiusura IDE | `e2e/lifecycle.spec.js` | NUOVO | ⬜ |
| Test creazione/modifica file | `e2e/file-operations.spec.js` | NUOVO | ⬜ |
| Test editor (temi, split, syntax) | `e2e/editor.spec.js` | NUOVO | ⬜ |
| Test terminale (comandi base) | `e2e/terminal.spec.js` | NUOVO | ⬜ |
| Test Git (status, commit, push) | `e2e/git.spec.js` | NUOVO | ⬜ |
| Test breakpoint & debug session | `e2e/debug.spec.js` | NUOVO | ⬜ |
| Test AI Companion (chat base) | `e2e/ai.spec.js` | NUOVO | ⬜ |
| Test settings & persistenza | `e2e/settings.spec.js` | NUOVO | ⬜ |

#### 🐛 1.3 Bug Fixes Critici

| Task | Priorità | Stato |
|------|---------|-------|
| Fix playwright.config.ts (webServer commentato) | 🔴 Alta | ⬜ |
| Fix hardcoded paths Playwright | 🟡 Media | ⬜ |
| Fix test discovery (esclude describe blocks) | 🟡 Media | ⬜ |
| Review IPC handlers per errori non gestiti | 🟡 Media | ⬜ |

**📦 Deliverable Fase 1:**
- ✅ Architettura modulare pronta
- ✅ Tutti i componenti esistenti refactorizzati
- ✅ Suite E2E completa (minimo 50 test)
- ✅ AI features riattivate
- ✅ Zero bug critici

---

### 📍 Fase 2: Core IDE Features v1.8 (Settimane 3-5)

**Obiettivo:** Feature essenziali per IDE professionale

#### 🔧 2.1 LSP Integration (Modulare)

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| LSPClient base | `src/main/modules/editor/LSPClient.js` | Connessione server LSP, protocol handling | ✅ Unit |
| GoToDefinition | `src/main/modules/editor/GoToDefinition.js` | Provider Monaco per go-to-definition | ✅ Unit + E2E |
| FindReferences | `src/main/modules/editor/FindReferences.js` | Provider Monaco per find-references | ✅ Unit + E2E |
| RenameSymbol | `src/main/modules/editor/RenameSymbol.js` | Provider Monaco per rename | ✅ Unit + E2E |
| HoverProvider | `src/main/modules/editor/HoverProvider.js` | Info tipo su hover | ✅ Unit + E2E |
| SignatureHelp | `src/main/modules/editor/SignatureHelp.js` | Parameter hints | ✅ Unit + E2E |
| CodeActions | `src/main/modules/editor/CodeActions.js` | Quick fixes, lightbulb | ✅ Unit + E2E |
| SymbolOutline | `src/main/modules/editor/SymbolOutline.js` | Sostituisce regex attuale con LSP | ✅ Unit |

**UI Components:**
| Componente | File | Stato |
|-----------|------|-------|
| GoToDefinition handler | `APP/core/editor.js` (extend) | ⬜ |
| FindReferences panel | `APP/components/references.js` | ⬜ NUOVO |
| Rename modal | `APP/components/renameModal.js` | ⬜ NUOVO |
| Hover tooltip | Monaco native | ✅ Già supportato |

**Configurazione LSP Servers:**
```json
// .gxcode/lsp-config.json
{
  "javascript": { "command": "typescript-language-server", "args": ["--stdio"] },
  "typescript": { "command": "typescript-language-server", "args": ["--stdio"] },
  "python": { "command": "pyright-langserver", "args": ["--stdio"] },
  "java": { "command": "jdtls", "args": [] }
}
```

#### 🎯 2.2 Command Palette

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| CommandRegistry | `APP/core/CommandRegistry.js` | Registry comandi globali | ✅ Unit |
| CommandPalette UI | `APP/components/commandPalette.js` | UI modale ricerca | ✅ E2E |
| QuickOpen files | `APP/components/quickOpen.js` | Refactoring da existing | ✅ E2E |

#### 🐛 2.3 Debugging Avanzato (Modulare)

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| BreakpointManager | `src/main/modules/debugger/BreakpointManager.js` | Gestione breakpoints, tipi | ✅ Unit |
| ConditionalBreakpoints | `src/main/modules/debugger/ConditionalBreakpoint.js` | Breakpoint con condizioni | ✅ Unit + E2E |
| Logpoints | `src/main/modules/debugger/Logpoint.js` | Log senza stop | ✅ Unit + E2E |
| WatchExpressions | `src/main/modules/debugger/WatchExpressions.js` | Espressioni custom watch | ✅ Unit + E2E |
| ExceptionBreakpoints | `src/main/modules/debugger/ExceptionBreakpoint.js` | Break su eccezioni | ✅ Unit |

**UI Components:**
| Componente | File | Stato |
|-----------|------|-------|
| BreakpointList UI | `APP/components/debug/BreakpointList.js` | ⬜ NUOVO (refactor da debug.js) |
| WatchList UI | `APP/components/debug/WatchList.js` | ⬜ NUOVO |
| Conditional breakpoint modal | `APP/components/debug/ConditionalBreakpointModal.js` | ⬜ NUOVO |

#### 📝 2.4 launch.json Support

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| LaunchConfigParser | `src/main/modules/debugger/LaunchConfig.js` | Parsing .gxcode/launch.json | ✅ Unit |
| DebugConfigurationProvider | `src/main/modules/debugger/DebugConfigProvider.js` | Fornisce config al session manager | ✅ Unit |
| launch.json schema | `.gxcode/schemas/launch.schema.json` | JSON Schema validation | ✅ Validation |

**Formato Configurazione:**
```json
// .gxcode/launch.json
{
  "configurations": [
    {
      "name": "Debug Current File (Node)",
      "type": "node",
      "request": "launch",
      "program": "${file}",
      "cwd": "${workspaceFolder}",
      "env": {},
      "args": [],
      "console": "integratedTerminal",
      "stopOnEntry": false
    },
    {
      "name": "Run Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

**📦 Deliverable Fase 2:**
- ✅ LSP working per JS/TS/Python
- ✅ Command Palette (Ctrl+Shift+P)
- ✅ Conditional breakpoints, logpoints, watch
- ✅ launch.json support
- ✅ Find References panel
- ✅ Rename Symbol modal
- ✅ E2E tests per tutte le feature nuove

---

### 📍 Fase 3: Testing & Git Avanzato v1.9 (Settimane 6-7)

**Obiettivo:** Testing professionale e Git features

#### 🧪 3.1 Multi-Test Framework (Modulare)

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| TestAdapter base | `src/main/modules/testing/TestAdapter.js` | Interfaccia adapter | ✅ Unit |
| JestAdapter | `src/main/modules/testing/JestAdapter.js` | Supporto Jest | ✅ Unit + E2E |
| VitestAdapter | `src/main/modules/testing/VitestAdapter.js` | Supporto Vitest | ✅ Unit + E2E |
| MochaAdapter | `src/main/modules/testing/MochaAdapter.js` | Supporto Mocha | ✅ Unit |
| CoverageReporter | `src/main/modules/testing/CoverageReporter.js` | Coverage visualization | ✅ Unit |
| TestDiscovery | `src/main/modules/testing/TestDiscovery.js` | Auto-detect framework | ✅ Unit |

**UI Components:**
| Componente | File | Stato |
|-----------|------|-------|
| TestResults view | `APP/components/testing/TestResults.js` | ⬜ NUOVO |
| Coverage view | `APP/components/testing/CoverageView.js` | ⬜ NUOVO |
| Test output panel | `APP/components/testing/TestOutput.js` | ⬜ NUOVO |

#### 🔀 3.2 Git Avanzato (Modulare)

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| DiffViewer | `src/main/modules/git/DiffViewer.js` | Genera diff, parse | ✅ Unit |
| InlineDiffRenderer | `APP/components/git/InlineDiff.js` | UI diff inlinea | ✅ E2E |
| MergeConflictResolver | `src/main/modules/git/MergeConflictResolver.js` | Detect e resolve conflitti | ✅ Unit + E2E |
| StashManager | `src/main/modules/git/StashManager.js` | Git stash UI | ✅ Unit |
| GitGraph | `APP/components/git/GitGraph.js` | Visualizza graph commit | ✅ E2E |

**📦 Deliverable Fase 3:**
- ✅ Jest/Vitest/Mocha support
- ✅ Coverage visualization
- ✅ Inline diff viewer
- ✅ Merge conflict resolver
- ✅ Git stash management
- ✅ Git graph visualization

---

### 📍 Fase 4: Terminal & Chrome Debug v2.0 RC (Settimane 8-9)

**Obiettivo:** Features avanzate e release candidate

#### 🖥️ 4.1 Terminal Avanzato (Modulare)

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| SplitPaneManager | `src/main/modules/terminal/SplitPane.js` | Gestione split UI | ✅ Unit |
| TaskRunner | `src/main/modules/terminal/TaskRunner.js` | Tasks da tasks.json | ✅ Unit + E2E |
| OutputChannel | `src/main/modules/terminal/OutputChannel.js` | Canali output (build, lint, etc) | ✅ Unit |

**UI Components:**
| Componente | File | Stato |
|-----------|------|-------|
| Terminal split UI | `APP/components/terminal/SplitView.js` | ⬜ NUOVO |
| Task selector | `APP/components/terminal/TaskSelector.js` | ⬜ NUOVO |
| Output panel | `APP/components/output/OutputPanel.js` | ⬜ NUOVO |

#### 🌐 4.2 Chrome/Browser Debugging

| Componente | File | Responsabilità | Test |
|-----------|------|---------------|------|
| ChromeDebugger | `src/main/modules/debugger/ChromeDebugger.js` | CDP connection Chrome | ✅ Unit |
| BrowserLauncher | `src/main/modules/debugger/BrowserLauncher.js` | Launch Chrome con flags | ✅ Unit |
| SourceMapSupport | `src/main/modules/debugger/SourceMap.js` | Source maps per TS/bundled | ✅ Unit |

**📦 Deliverable Fase 4:**
- ✅ Terminal splitting
- ✅ Task runner (tasks.json)
- ✅ Output channels
- ✅ Chrome/browser debugging
- ✅ Source maps support

---

### 📍 Fase 5: Produzione v2.0 (Settimana 10)

**Obiettivo:** Hardening, testing finale, rilascio

#### 🔒 5.1 Security & Performance

| Task | Componente | Stato |
|------|-----------|-------|
| Workspace trust model | `src/main/modules/core/WorkspaceTrust.js` | ⬜ NUOVO |
| Rate limiting AI requests | AI services | ⬜ |
| Memory profiling | Main process | ⬜ |
| Startup time optimization | ModuleLoader | ⬜ |
| Crash reporting | Error handler | ⬜ |

#### 🧪 5.2 Testing Finale

| Task | Stato |
|------|-------|
| E2E completo (min 200 test) | ⬜ |
| Load testing (file grandi, tanti file) | ⬜ |
| Cross-platform testing (Win/Mac/Linux) | ⬜ |
| Accessibility audit | ⬜ |
| Performance benchmarks | ⬜ |

#### 📦 5.3 Release Preparation

| Task | Stato |
|------|-------|
| Update README con nuove features | ⬜ |
| Changelog v2.0 | ⬜ |
| Migration guide da v1.x | ⬜ |
| Build installer tutti i platform | ⬜ |
| Auto-update setup | ⬜ |
| Beta testing program | ⬜ |

---

## 📊 Dipendenze tra Moduli

```
Fase 1 (Stabilizzazione)
  ├── ModuleLoader ──────────────────────────────┐
  ├── EventBus ──────────────────────────────────┤
  └── Refactoring esistenti ─────────────────────┤
                                                  ↓
Fase 2 (Core IDE)                            Tutti i moduli
  ├── LSPClient ──→ GoToDefinition ────────────┐
  ├── LSPClient ──→ FindReferences ────────────┤
  ├── LSPClient ──→ RenameSymbol ──────────────┤
  ├── LSPClient ──→ HoverProvider ─────────────┤  Richiede
  ├── LSPClient ──→ SignatureHelp ─────────────┤  Fase 1 ✅
  ├── LSPClient ──→ CodeActions ───────────────┤
  ├── CommandPalette ──────────────────────────┤
  └── Debug avanzato ──────────────────────────┘
                                                  ↓
Fase 3 (Testing & Git)                       Tutti i moduli
  ├── TestAdapter ──→ Jest/Vitest/Mocha ───────┐  Richiedono
  ├── CoverageReporter ────────────────────────┤  Fase 1-2 ✅
  ├── DiffViewer ──→ InlineDiff ───────────────┤
  └── MergeConflictResolver ───────────────────┘
                                                  ↓
Fase 4 (Avanzato)                            Tutti i moduli
  ├── Terminal Split ──────────────────────────┐  Richiedono
  ├── TaskRunner ──────────────────────────────┤  Fase 1-3 ✅
  ├── ChromeDebugger ──────────────────────────┤
  └── SourceMapSupport ────────────────────────┘
                                                  ↓
Fase 5 (Produzione)                          Tutti i moduli
  └── Hardening + Testing + Release ──────────→  Richiede
                                                  Fase 1-4 ✅
```

---

## ✅ Checklist Produzione v2.0

### Feature Complete
- [ ] LSP integration (JS/TS/Python minimo)
- [ ] Command Palette funzionante
- [ ] Conditional breakpoints + logpoints
- [ ] Watch expressions
- [ ] launch.json support
- [ ] Multi-test framework (Jest/Vitest)
- [ ] Coverage visualization
- [ ] Inline diff viewer
- [ ] Merge conflict resolver
- [ ] Terminal splitting
- [ ] Chrome debugging
- [ ] AI features tutte attive e funzionanti

### Testing Complete
- [ ] Minimo 200 test E2E passing
- [ ] Coverage > 80% su main process
- [ ] Coverage > 60% su renderer
- [ ] Zero crash report
- [ ] Performance benchmarks within targets

### Documentation Complete
- [ ] README aggiornato
- [ ] Guida utente (almeno base)
- [ ] API docs per extension developers
- [ ] Migration guide
- [ ] Changelog completo

### Build & Release
- [ ] Installer Windows (.exe NSIS)
- [ ] Build Linux (AppImage/deb)
- [ ] Build Mac (se applicabile)
- [ ] Auto-update configurato
- [ ] GitHub Actions CI/CD
- [ ] Beta testing feedback incorporati

---

## 📋 Regole di Sviluppo Modulari

### ✅ DO:
1. **Un file = Una responsabilità** - Se un file supera 300 righe, splittare
2. **Test per ogni modulo** - Ogni componente ha i suoi unit test
3. **IPC/API chiari** - Interfacce ben definite tra moduli
4. **Error handling** - Ogni modulo gestisce i propri errori
5. **Logging** - Ogni modulo logga con prefisso proprio (es: `[LSPClient]`)

### ❌ DON'T:
1. **NO file monolitici** - Nada da 1000+ righe (come index.js da 54K)
2. **NO dipendenze circolari** - A → B → C, mai A → B → A
3. **NO stato globale condiviso** - Usare EventBus per comunicazione
4. **NO hardcoded paths/configs** - Tutto configurabile
5. **NO features senza test** - Se non è testabile, non è pronto

---

## 🎯 Metriche di Successo

| Metrica | Target Attuale | Target v2.0 |
|---------|---------------|-------------|
| Test E2E | 2 | 200+ |
| File > 500 righe | ~15 | 0 |
| Coverage main process | ~30% | 80%+ |
| Coverage renderer | ~20% | 60%+ |
| Startup time | ~3s | < 2s |
| Crash rate | Sconosciuto | < 0.1% |
| Features LSP | 0 | 7+ |
| Debuggers support | 1 (Node) | 3+ (Node, Chrome, Attach) |
| Test frameworks | 1 (Playwright) | 5+ (Jest, Vitest, Mocha, Playwright, Pytest) |

---

## 🚀 Prossimi Steps

1. **Review piano** - Confermare priorità e scope
2. **Setup branch `develop-v2`** - Branch separato da main
3. **Iniziare Fase 1** - Partire con ModuleLoader + EventBus
4. **Weekly check-ins** - Review progress ogni settimana
5. **CI setup** - GitHub Actions per test automatici

---

**Nota:** Questo piano è vivo. Va aggiornato man mano che si scoprono complessità o si cambiano priorità.

**Ultimo Aggiornamento:** 12 Aprile 2026
