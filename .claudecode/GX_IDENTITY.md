# GXCODE SYSTEM IDENTITY

Questo file definisce le capacità operative dell'ambiente GXCode. Tutte le AI (Claude, Qwen, Gemini) devono farvi riferimento.

## PROJECT GUIDELINES
*Nessuna linea guida specifica definita.*

## GX-SKILLS (TOOLING)
Le seguenti competenze possono essere invocate tramite il comando `gx-skill run "<nome>"`.
### AI Context File Generator
- **Descrizione**: Genera automaticamente CLAUDE.md, GEMINI.md, GX_IDENTITY.md nei workspace. Struttura progetto, guidelines AI, context injection per agenti.
- **Invocazione**: `gx-skill run "AI Context File Generator"`

### Brief Analyzer
- **Descrizione**: Analizza il brief del sito, estrae obiettivi, target, tono, vincoli e segnala eventuali informazioni mancanti prima della progettazione del mockup.
- **Invocazione**: `gx-skill run "Brief Analyzer"`

### Claude CLI Integration
- **Descrizione**: Integra Anthropic Claude via CLI (npx @anthropic-ai/claude-code). Terminal integration, context files (.claudecode/), session management.
- **Invocazione**: `gx-skill run "Claude CLI Integration"`

### Creative Direction Builder
- **Descrizione**: Definisce la direzione visiva del mockup: mood, palette, tipografia, stile UI e tone of voice, coerenti con brand, target e obiettivo.
- **Invocazione**: `gx-skill run "Creative Direction Builder"`

### Cross-Platform Path Handler
- **Descrizione**: Gestisce path in modo cross-platform. Usa sempre path.join, path.resolve, os.platform(). Mai hardcoded C:\\ o /Users. Supporta Windows, macOS, Linux.
- **Invocazione**: `gx-skill run "Cross-Platform Path Handler"`

### Dynamic Port Allocation
- **Descrizione**: Trova porte libere dinamicamente. Fallback da porta default (9999) a successive. Evita conflitti con altri servizi. Net.createServer per check disponibilità.
- **Invocazione**: `gx-skill run "Dynamic Port Allocation"`

### Electron Security Best Practices
- **Descrizione**: Applica best practices di sicurezza Electron: contextIsolation: true, nodeIntegration: false, contextBridge per IPC, CSP headers, no eval/unsafe-inline.
- **Invocazione**: `gx-skill run "Electron Security Best Practices"`

### Express API Server Integration
- **Descrizione**: Integra Express API server locale (porta 5000) con Electron. Route registration, middleware, CORS, error handling. API per agents, skills, marketplace.
- **Invocazione**: `gx-skill run "Express API Server Integration"`

### File System Watcher
- **Descrizione**: Watcher file system con fs.watch ricorsivo. Debounce 800ms per evitare flood. Eventi: created, modified, deleted, renamed. Multi-root workspace support.
- **Invocazione**: `gx-skill run "File System Watcher"`

### Full-Text Search Engine
- **Descrizione**: Motore ricerca full-text con regex. Opzioni: case-sensitive, match whole word, use regex, include/exclude patterns. Max 250 risultati per performance.
- **Invocazione**: `gx-skill run "Full-Text Search Engine"`

### Git Diff Viewer
- **Descrizione**: Visualizza diff Git con syntax highlighting. Confronta working tree vs HEAD, staged vs HEAD. Inline diff viewer con righe added/removed colorate.
- **Invocazione**: `gx-skill run "Git Diff Viewer"`

### Git Porcelain Parser
- **Descrizione**: Parsa output git --porcelain per stati file. M: modified, A: added, D: deleted, R: renamed, U: untracked, S: staged. Mapping icone e colori.
- **Invocazione**: `gx-skill run "Git Porcelain Parser"`

### Google Gemini OAuth Integration
- **Descrizione**: Integra Google Gemini con OAuth 2.0. Login flow, session persistence, multi-model support (Flash, Pro), webview injection, callback handler.
- **Invocazione**: `gx-skill run "Google Gemini OAuth Integration"`

### IPC Handler Pattern
- **Descrizione**: Implementa correttamente handler IPC con error handling, logging, e validazione input. Ogni handler deve usare try/catch, log con prefisso [GX-XXX], e validare parametri.
- **Invocazione**: `gx-skill run "IPC Handler Pattern"`

### LangChain Core
- **Descrizione**: Core framework for developing applications powered by language models.
- **Invocazione**: `gx-skill run "LangChain Core"`

### Layout Architect
- **Descrizione**: Progetta la struttura della pagina e organizza le sezioni del mockup in un ordine strategico, in base a obiettivo, contenuti e tipo di sito.
- **Invocazione**: `gx-skill run "Layout Architect"`

### Modular Service Architecture
- **Descrizione**: Implementa servizi come singleton modulari. Ogni servizio in src/main/services/ esporta istanza singola. Usa pattern registerXxxHandlers() per IPC.
- **Invocazione**: `gx-skill run "Modular Service Architecture"`

### Monaco Editor Integration
- **Descrizione**: Integra Monaco Editor con GXCode. Syntax highlighting, IntelliSense, minimap, breadcrumbs, split view, tab management, auto-save, word wrap.
- **Invocazione**: `gx-skill run "Monaco Editor Integration"`

### Multi-Terminal Session Manager
- **Descrizione**: Gestisce multiple terminal sessions. ID univoco per istanza, switch tra terminali, persistenza sessioni, cwd per ogni terminale, shell detection.
- **Invocazione**: `gx-skill run "Multi-Terminal Session Manager"`

### node-pty Terminal Manager
- **Descrizione**: Gestisce pseudo-terminal con node-pty. Creazione istanze, write input, resize handling, stdout/stderr streaming, PTY lifecycle management.
- **Invocazione**: `gx-skill run "node-pty Terminal Manager"`

### Ollama Local AI Integration
- **Descrizione**: Integra Ollama locale con GXCode. Hardware diagnostics, installazione automatica, model pulling, start/stop service, OLLAMA_MODELS env var, porta 11434.
- **Invocazione**: `gx-skill run "Ollama Local AI Integration"`

### Playwright Test Scanner
- **Descrizione**: Scansiona workspace per test Playwright. Pattern: .spec/.test.(js|ts|jsx|tsx). Regex: test('name')/it('name'). Esclude describe. De-duplication per file.
- **Invocazione**: `gx-skill run "Playwright Test Scanner"`

### Plugin Lifecycle Manager
- **Descrizione**: Gestisce lifecycle plugin: install, uninstall, enable, disable, update. Validazione compatibilità versione GXCode. Persistence in ~/.GXCODE/plugins/.
- **Invocazione**: `gx-skill run "Plugin Lifecycle Manager"`

### Recursive File Scanner
- **Descrizione**: Scansiona directory ricorsivamente con filtri. Skip: node_modules, .git, dist, build. fs.promises.readdir con withFileTypes. Gestione errori permissive.
- **Invocazione**: `gx-skill run "Recursive File Scanner"`

### Registry Aggregator
- **Descrizione**: Aggrega risultati da multiple registries: GX Registry, Skills.sh, Open VSX, Apify, HuggingFace, npm. Merge, deduplicate, sort by relevance.
- **Invocazione**: `gx-skill run "Registry Aggregator"`

### Resizable Panel Handler
- **Descrizione**: Implementa pannelli ridimensionabili con drag bar. Classe .resizing-active durante drag, cursor row/col-resize, constraints min/max size, debounce resize events.
- **Invocazione**: `gx-skill run "Resizable Panel Handler"`

### Responsive Mockup Planner
- **Descrizione**: Adatta il mockup alla visualizzazione mobile e tablet, definendo il comportamento responsive delle sezioni e la priorità dei contenuti.
- **Invocazione**: `gx-skill run "Responsive Mockup Planner"`

### TailwindCSS v4 Component Builder
- **Descrizione**: Crea componenti UI con TailwindCSS v4. Usa classi compatte text-[7-13px], rounded-lg/xl, hover:bg-white/5, active:scale-90, transition-all. Coerente con design system GXCode.
- **Invocazione**: `gx-skill run "TailwindCSS v4 Component Builder"`

### Test Debug Instrumentation
- **Descrizione**: Instrumenta file test per debugging. Crea temp file, inietta WebSocket bridge, aggiunge gxPause() prima di ogni await. Cleanup automatico post-debug.
- **Invocazione**: `gx-skill run "Test Debug Instrumentation"`

### Theme System Manager
- **Descrizione**: Gestisce sistema temi GXCode: Dark, Light, Classic, Apple, Aero Glass, Liquid Glass, Anime, Custom Gradient. Variabili CSS custom, theme switching, persistence.
- **Invocazione**: `gx-skill run "Theme System Manager"`

### UI Copy Generator
- **Descrizione**: Genera headline, subheadline, CTA, microcopy e testi chiave del mockup, mantenendo coerenza con target, prodotto e tone of voice.
- **Invocazione**: `gx-skill run "UI Copy Generator"`

### V8 Inspector Protocol Debugger
- **Descrizione**: Implementa debugger via Chrome DevTools Protocol. WebSocket bridge, breakpoints, step/continue/stop, variable inspection, call stack.
- **Invocazione**: `gx-skill run "V8 Inspector Protocol Debugger"`

### Wireframe Writer
- **Descrizione**: Converte la struttura del sito in un wireframe testuale dettagliato, descrivendo il layout di ogni sezione in modo chiaro per designer e sviluppatori.
- **Invocazione**: `gx-skill run "Wireframe Writer"`

### xterm.js Renderer Integration
- **Descrizione**: Integra xterm.js nel renderer. addon-fit per resize, theming coerente, copy/paste, scrollback buffer, multiple terminal tabs.
- **Invocazione**: `gx-skill run "xterm.js Renderer Integration"`

## ACTIVE AGENTS
- **AI Integration Specialist**: general
- **DeepNLP Architect**: Assistant
- **File System & Search Specialist**: general
- **Git & Version Control Pro**: general
- **GXCore Architect**: general
- **Marketplace & Plugin Manager**: general
- **Mockup Master Architect**: general
- **Terminal & PTY Expert**: general
- **Testing & Debugging Master**: general
- **UI/UX Evolution Designer**: general
