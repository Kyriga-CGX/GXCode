# PROJECT GUIDELINES & TOOLS (GXCode)

## STANDARDS & COMMANDS
- **Skills**: Invocabili via terminale con `gx-skill run "<nome>"`
- **Agenti**: Info dettagliate in `.claudecode/GX_IDENTITY.md`

### AVAILABLE SKILLS
- `AI Context File Generator`: Genera automaticamente CLAUDE.md, GEMINI.md, GX_IDENTITY.md nei workspace. Struttura progetto, guidelines AI, context injection per agenti.
- `Brief Analyzer`: Analizza il brief del sito, estrae obiettivi, target, tono, vincoli e segnala eventuali informazioni mancanti prima della progettazione del mockup.
- `Claude CLI Integration`: Integra Anthropic Claude via CLI (npx @anthropic-ai/claude-code). Terminal integration, context files (.claudecode/), session management.
- `Creative Direction Builder`: Definisce la direzione visiva del mockup: mood, palette, tipografia, stile UI e tone of voice, coerenti con brand, target e obiettivo.
- `Cross-Platform Path Handler`: Gestisce path in modo cross-platform. Usa sempre path.join, path.resolve, os.platform(). Mai hardcoded C:\\ o /Users. Supporta Windows, macOS, Linux.
- `Dynamic Port Allocation`: Trova porte libere dinamicamente. Fallback da porta default (9999) a successive. Evita conflitti con altri servizi. Net.createServer per check disponibilità.
- `Electron Security Best Practices`: Applica best practices di sicurezza Electron: contextIsolation: true, nodeIntegration: false, contextBridge per IPC, CSP headers, no eval/unsafe-inline.
- `Express API Server Integration`: Integra Express API server locale (porta 5000) con Electron. Route registration, middleware, CORS, error handling. API per agents, skills, marketplace.
- `File System Watcher`: Watcher file system con fs.watch ricorsivo. Debounce 800ms per evitare flood. Eventi: created, modified, deleted, renamed. Multi-root workspace support.
- `Full-Text Search Engine`: Motore ricerca full-text con regex. Opzioni: case-sensitive, match whole word, use regex, include/exclude patterns. Max 250 risultati per performance.
- `Git Diff Viewer`: Visualizza diff Git con syntax highlighting. Confronta working tree vs HEAD, staged vs HEAD. Inline diff viewer con righe added/removed colorate.
- `Git Porcelain Parser`: Parsa output git --porcelain per stati file. M: modified, A: added, D: deleted, R: renamed, U: untracked, S: staged. Mapping icone e colori.
- `Google Gemini OAuth Integration`: Integra Google Gemini con OAuth 2.0. Login flow, session persistence, multi-model support (Flash, Pro), webview injection, callback handler.
- `IPC Handler Pattern`: Implementa correttamente handler IPC con error handling, logging, e validazione input. Ogni handler deve usare try/catch, log con prefisso [GX-XXX], e validare parametri.
- `LangChain Core`: Core framework for developing applications powered by language models.
- `Layout Architect`: Progetta la struttura della pagina e organizza le sezioni del mockup in un ordine strategico, in base a obiettivo, contenuti e tipo di sito.
- `Modular Service Architecture`: Implementa servizi come singleton modulari. Ogni servizio in src/main/services/ esporta istanza singola. Usa pattern registerXxxHandlers() per IPC.
- `Monaco Editor Integration`: Integra Monaco Editor con GXCode. Syntax highlighting, IntelliSense, minimap, breadcrumbs, split view, tab management, auto-save, word wrap.
- `Multi-Terminal Session Manager`: Gestisce multiple terminal sessions. ID univoco per istanza, switch tra terminali, persistenza sessioni, cwd per ogni terminale, shell detection.
- `node-pty Terminal Manager`: Gestisce pseudo-terminal con node-pty. Creazione istanze, write input, resize handling, stdout/stderr streaming, PTY lifecycle management.
- `Ollama Local AI Integration`: Integra Ollama locale con GXCode. Hardware diagnostics, installazione automatica, model pulling, start/stop service, OLLAMA_MODELS env var, porta 11434.
- `Playwright Test Scanner`: Scansiona workspace per test Playwright. Pattern: .spec/.test.(js|ts|jsx|tsx). Regex: test('name')/it('name'). Esclude describe. De-duplication per file.
- `Plugin Lifecycle Manager`: Gestisce lifecycle plugin: install, uninstall, enable, disable, update. Validazione compatibilità versione GXCode. Persistence in ~/.GXCODE/plugins/.
- `Recursive File Scanner`: Scansiona directory ricorsivamente con filtri. Skip: node_modules, .git, dist, build. fs.promises.readdir con withFileTypes. Gestione errori permissive.
- `Registry Aggregator`: Aggrega risultati da multiple registries: GX Registry, Skills.sh, Open VSX, Apify, HuggingFace, npm. Merge, deduplicate, sort by relevance.
- `Resizable Panel Handler`: Implementa pannelli ridimensionabili con drag bar. Classe .resizing-active durante drag, cursor row/col-resize, constraints min/max size, debounce resize events.
- `Responsive Mockup Planner`: Adatta il mockup alla visualizzazione mobile e tablet, definendo il comportamento responsive delle sezioni e la priorità dei contenuti.
- `TailwindCSS v4 Component Builder`: Crea componenti UI con TailwindCSS v4. Usa classi compatte text-[7-13px], rounded-lg/xl, hover:bg-white/5, active:scale-90, transition-all. Coerente con design system GXCode.
- `Test Debug Instrumentation`: Instrumenta file test per debugging. Crea temp file, inietta WebSocket bridge, aggiunge gxPause() prima di ogni await. Cleanup automatico post-debug.
- `Theme System Manager`: Gestisce sistema temi GXCode: Dark, Light, Classic, Apple, Aero Glass, Liquid Glass, Anime, Custom Gradient. Variabili CSS custom, theme switching, persistence.
- `UI Copy Generator`: Genera headline, subheadline, CTA, microcopy e testi chiave del mockup, mantenendo coerenza con target, prodotto e tone of voice.
- `V8 Inspector Protocol Debugger`: Implementa debugger via Chrome DevTools Protocol. WebSocket bridge, breakpoints, step/continue/stop, variable inspection, call stack.
- `Wireframe Writer`: Converte la struttura del sito in un wireframe testuale dettagliato, descrivendo il layout di ogni sezione in modo chiaro per designer e sviluppatori.
- `xterm.js Renderer Integration`: Integra xterm.js nel renderer. addon-fit per resize, theming coerente, copy/paste, scrollback buffer, multiple terminal tabs.

## MODEL SELECTION STRATEGY
Per ottimizzare costi e prestazioni, Claude deve seguire queste linee guida nella scelta del modello:
- **Claude 3 Haiku**: Analisi di file esistenti, analisi del brief di progetto (es: `Brief Analyzer`) e compiti di sola lettura.
- **Claude 3.5 Sonnet**: Generazione di nuovo codice, creazione di layout e documenti (es: `UI Copy Generator`, `Layout Architect`), applicazione di modifiche e refactoring.
- **Claude 3 Opus**: Gestione di agenti complessi, delega di compiti a skill esterne e creazione/orchestrazione di sotto-agenti specializzati.
