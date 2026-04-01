// main.js
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { exec, spawn } = require("child_process");
const express = require("express");
const os = require("os");
const fs = require("fs");
let pty;
try {
  pty = require("node-pty");
} catch (e) {
  console.error("ERRORE: Impossibile caricare node-pty. Il terminale non funzionerà.", e);
}
const WebSocket = require('ws');

class NodeDebugger {
  constructor(browserWindow) {
    this.window = browserWindow;
    this.child = null;
    this.ws = null;
    this.msgId = 1;
    this.paused = false;
  }

  async start(filePath, breakpoints = []) {
    return new Promise((resolve, reject) => {
      console.log(`[Debugger] Avvio: ${filePath}`);
      
      this.child = spawn('node', ['--inspect-brk=0', filePath], {
        cwd: path.dirname(filePath),
        stdio: ['inherit', 'pipe', 'pipe']
      });

      this.child.stderr.on('data', (data) => {
        const msg = data.toString();
        const match = msg.match(/ws:\/\/127\.0\.0\.1:(\d+)\/[a-f0-9-]+/);
        if (match && !this.ws) {
          this.connect(match[0], breakpoints, resolve, reject);
        }
      });

      this.child.on('exit', () => this.stop());
    });
  }

  connect(url, breakpoints, resolve, reject) {
    this.ws = new WebSocket(url);
    this.ws.on('open', () => {
      this.send('Debugger.enable');
      this.send('Runtime.enable');
      
      breakpoints.forEach(bp => {
        this.send('Debugger.setBreakpointByUrl', {
          lineNumber: bp.line - 1,
          urlRegex: '.*' + path.basename(bp.path).replace(/\./g, '\\.')
        });
      });

      this.send('Debugger.resume');
      resolve({ success: true });
    });

    this.ws.on('message', (data) => this.handleMessage(JSON.parse(data.toString())));
  }

  handleMessage(msg) {
    // Gestione risposte alle richieste (con callback)
    if (msg.id && this._callbacks && this._callbacks[msg.id]) {
      this._callbacks[msg.id](msg.result);
      delete this._callbacks[msg.id];
      return;
    }

    if (msg.method === 'Debugger.paused') {
      this.paused = true;
      const topFrame = msg.params.callFrames[0];
      const scope = topFrame.scopeChain.find(s => s.type === 'local' || s.type === 'closure');
      
      if (scope && scope.object && scope.object.objectId) {
        this.send('Runtime.getProperties', { objectId: scope.object.objectId }, (res) => {
          if (res && res.result) {
            const vars = res.result.map(p => ({
              name: p.name,
              value: p.value ? (p.value.description || p.value.value || '...') : 'undefined',
              type: p.value ? p.value.type : 'unknown'
            }));
            this.window.webContents.send('debug-variables', vars);
          }
        });
      }

      this.window.webContents.send('debug-paused', {
        line: topFrame.location.lineNumber + 1,
        callStack: msg.params.callFrames.map(f => ({ 
          functionName: f.functionName || '(anon)', 
          location: f.location 
        }))
      });
    } else if (msg.method === 'Debugger.resumed') {
      this.paused = false;
      this.window.webContents.send('debug-resumed');
    }
  }

  send(method, params = {}, callback = null) {
    const id = this.msgId++;
    if (callback) {
      this._callbacks = this._callbacks || {};
      this._callbacks[id] = callback;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ id, method, params }));
    }
  }

  stepOver() { if (this.paused) this.send('Debugger.stepOver'); }
  continue() { if (this.paused) this.send('Debugger.resume'); }
  stop() {
    if (this.child) this.child.kill();
    if (this.ws) this.ws.close();
    this.child = null; this.ws = null; this.paused = false;
    this.window.webContents.send('debug-resumed');
  }
}

let nodeDebugger = null;

// ================== GESTIONE CONTESTO AI E DISCO Locale ==================
let currentAiContext = '.GXCODE'; // Di base usa una cartella universale

function getActiveAiPath(subfolder) {
  const home = os.homedir();
  const baseDir = path.join(home, currentAiContext, subfolder);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

function loadPersistedData(type) {
  const dir = getActiveAiPath(type);
  const results = [];
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        data._managedBy = currentAiContext; // Aggiungiamo un flag nascosto utile per la UI
        results.push(data);
      } catch (e) { console.error(`Error loading ${file}:`, e); }
    }
  } catch (e) { }
  return results;
}

function savePersistedData(type, entity) {
  const dir = getActiveAiPath(type);
  const safeName = (entity.slug || entity.name || `item_${entity.id}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filePath = path.join(dir, `${safeName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), 'utf-8');
  return filePath;
}

function deletePersistedData(type, id) {
  const dir = getActiveAiPath(type);
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const p = path.join(dir, file);
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (String(data.id) === String(id)) {
          fs.unlinkSync(p);
          return true;
        }
      } catch (e) { }
    }
  } catch (e) { }
  return false;
}

// ================== BACKEND HTTP LOCALE (API IDE) ==================

const apiApp = express();
apiApp.use(express.json());

// Logger globale + CORS Middleware
apiApp.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!req.url.includes('socket.io') && !req.url.includes('polling')) {
    console.log(`[SPY-HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// ---- MOCK DATA IN MEMORIA ----
let skills = [];

let agents = [];

let marketplaceAgents = [
  {
    id: 1,
    name: "Junior React Developer",
    description: "Creazione rapida di UI, bottoni, modali e intere landing page in React e Tailwind CSS.",
    slug: "react-ui-agent",
  },
  {
    id: 2,
    name: "Senior Python Engineer",
    description: "Esperto in manipolazione dati, script di automazione e API backend (FastAPI/Django).",
    slug: "python-backend-agent",
  },
  {
    id: 3,
    name: "Database Architect",
    description: "Analizza, ottimizza e progetta complessi schemi per database relazionali come Postgres e MySQL.",
    slug: "sql-architect-agent",
  },
  {
    id: 4,
    name: "Code Reviewer & Security",
    description: "Non scrive codice, ma fa review complete al tuo progetto per trovare falle di sicurezza e bug.",
    slug: "reviewer-agent",
  },
  {
    id: 5,
    name: "DevOps & Cloud Engineer",
    description: "Configura i tuoi Dockerfile, crea pipeline GitHub Actions ed esegue i deploy sui server AWS/GCP.",
    slug: "devops-agent",
  },
];

let marketplaceSkills = [
  {
    id: 1,
    name: "Marketplace Skill",
    description: "Skill dal marketplace",
    slug: "marketplace-skill",
  },
];

let customRepos = [
  {
    id: 1,
    name: "Default Repo",
    url: "https://example.com",
    slug: "default-repo",
  },
];

// L'app React originale utilizza `Array.prototype.find` sulle settings. DEVE essere un array, non un oggetto vuoto!
let settings = [];

// Tickets (Vuoti di default per caricamento via MCP)
let tickets = [];
let mcpServers = [];   // idem

// ---- ENDPOINT SKILLS ----
apiApp.get("/api/skills", (req, res) => {
  const diskSkills = loadPersistedData('skills');
  res.json(diskSkills);
});

apiApp.post("/api/skills", (req, res) => {
  const body = req.body;
  const diskSkills = loadPersistedData('skills');
  const newId = diskSkills.length ? Math.max(...diskSkills.map((s) => s.id)) + 100 : Math.floor(Math.random() * 100000);
  const skill = {
    id: newId,
    name: body.name,
    description: body.description ?? "",
    logic: body.logic ?? body.content ?? "",
    category: body.category ?? "general",
    isActive: body.isActive ?? true,
    slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-')
  };
  savePersistedData('skills', skill);
  res.status(201).json(skill);
});

apiApp.patch("/api/skills/:id", (req, res) => {
  const id = req.params.id;
  const diskSkills = loadPersistedData('skills');
  const target = diskSkills.find((s) => String(s.id) === String(id));
  if (target) {
    const updated = { ...target, ...req.body };
    savePersistedData('skills', updated);
    return res.json(updated);
  }
  return res.status(404).send("Skill not found");
});

apiApp.delete("/api/skills/:id", (req, res) => {
  const id = req.params.id;
  deletePersistedData('skills', id);
  res.status(204).end();
});

// ---- ENDPOINT AGENTS ----
apiApp.get("/api/agents", (req, res) => {
  const diskAgents = loadPersistedData('agents');
  res.json(diskAgents);
});

apiApp.post("/api/agents", (req, res) => {
  const body = req.body;
  const diskAgents = loadPersistedData('agents');
  const newId = diskAgents.length ? Math.max(...diskAgents.map((a) => a.id)) + 100 : Math.floor(Math.random() * 100000);
  const agent = {
    id: newId,
    name: body.name,
    description: body.description ?? "",
    systemPrompt: body.systemPrompt ?? "",
    role: body.role ?? "general",
    parentId: body.parentId ?? null,
    avatar: body.avatar ?? "bot",
    skillIds: body.skillIds ?? "[]",
    assignedSkills: body.assignedSkills ?? [],
    status: body.status ?? "idle",
    slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-')
  };
  savePersistedData('agents', agent);
  res.status(201).json(agent);
});

apiApp.patch("/api/agents/:id", (req, res) => {
  const id = req.params.id;
  const diskAgents = loadPersistedData('agents');
  const target = diskAgents.find((a) => String(a.id) === String(id));
  if (target) {
    const updated = { ...target, ...req.body };
    savePersistedData('agents', updated);
    return res.json(updated);
  }
  return res.status(404).send("Agent not found");
});

apiApp.delete("/api/agents/:id", (req, res) => {
  const id = req.params.id;
  deletePersistedData('agents', id);
  res.status(204).end();
});

// ---- ENDPOINT TICKETS (YouTrack Real Integration) ----
apiApp.get("/api/tickets", async (req, res) => {
  const { url, token } = req.query;

  if (!url || !token) {
    return res.json(tickets); // Restituisce l'array vuoto (mock) se mancano i parametri
  }

  try {
    const issuesUrl = `${url.replace(/\/$/, '')}/api/issues?fields=idReadable,summary,description,project(name),priority(name),state(name),assignee(fullName)`;
    console.log(`[SPY-YOUTRACK] Sto contattando: ${issuesUrl}`);

    const response = await fetch(issuesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'GXCode-IDE'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[SPY-YOUTRACK] Errore API:", errorData);
      throw new Error(`YouTrack Error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[SPY-YOUTRACK] Trovati ${data.length} ticket.`);
    
    // Formattiamo per la nostra UI (opzionale se l'app si aspetta già il formato YouTrack)
    const formatted = data.map(issue => ({
      id: issue.idReadable,
      name: issue.summary,
      description: issue.description,
      project: issue.project?.name,
      priority: issue.priority?.name,
      status: issue.state?.name,
      assignee: issue.assignee?.fullName
    }));

    res.json(formatted);
  } catch (err) {
    console.error("[SPY-YOUTRACK] Fetch failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- ENDPOINT MCP SERVERS ----
apiApp.get("/api/mcp-servers", (req, res) => {
  res.json(mcpServers);  // array (anche se vuoto)
});

// ---- ENDPOINT MARKETPLACE / REPOS / SETTINGS E PLUGINS ----
const offlineMockPlugins = [
  { id: 991, slug: "prettier", name: "Prettier", description: "Formatta il codice automaticamente.", version: "3.2.0", author: "Prettier Core" },
  { id: 992, slug: "eslint", name: "ESLint", description: "Strumento di analisi statica per correggere problemi nel codice JS/TS.", version: "8.50.0", author: "JS Foundation" },
  { id: 993, slug: "tailwindcss-intellisense", name: "Tailwind CSS IntelliSense", description: "Autocompletamento per Tailwind.", version: "0.10.1", author: "Tailwind Labs" },
  { id: 994, slug: "gitlens", name: "GitLens - Git supercharged", description: "Capisci e naviga meglio nel codice.", version: "14.0.0", author: "GitKraken" },
  { id: 995, slug: "github-copilot", name: "GitHub Copilot", description: "Il tuo compagno programmatore basato sull'AI.", version: "1.0.0", author: "GitHub" },
  { id: 996, slug: "python", name: "Python Extended", description: "Supporto esteso al linguaggio Python.", version: "2023.0", author: "Microsoft" }
];

const offlineMockSkills = [
  { id: 101, slug: "langchain-core", name: "LangChain Core", description: "Core framework for developing applications powered by language models." },
  { id: 102, slug: "openai-api", name: "OpenAI API Client", description: "Interfaccia nativa per richiamare GPT-4 e vision." },
  { id: 103, slug: "auto-gpt", name: "Auto-GPT Skill", description: "Permette all'agente di avere autonomia sequenziale sui task." },
  { id: 104, slug: "web-scraper", name: "Web Scraper AI", description: "Naviga il web e converte le pagine in dataset compatti." },
  { id: 105, slug: "database-analyst", name: "Database Analyst", description: "Analizza schemi SQL e propone ottimizzazioni complesse." }
];

// Pool di elementi "potenziali" pronti per essere scoperti live (Simulazione Registry Esterna)
const POTENTIAL_DISCOVERIES = {
  agents: [
    { name: "Apify Auto-Scraper", author: "Apify Team", category: "Automation", desc: "Configurazione automatica di attori Apify per siti complessi." },
    { name: "DeepNLP Architect Pro", author: "DeepNLP.org", category: "Architecture", desc: "Motore di ragionamento avanzato per architetture cloud-native." },
    { name: "HF Multi-Model Agent", author: "HuggingFace", category: "ML/AI", desc: "Sceglie dinamicamente tra 100+ modelli basandosi sul task." },
    { name: "ToolHub Strategist", author: "ToolHub.io", category: "Tools", desc: "Orchestra chiamate API complesse usando il catalogo ToolHub." },
    { name: "Agensi Coding Master", author: "Agensi.ai", category: "Coding", desc: "Focus su unit testing e refactoring di massa." },
    { name: "OpenSkills Researcher", author: "OpenSkills", category: "Integration", desc: "Trova e adatta skill esterne al tuo specifico contesto." }
  ],
  skills: [
    { name: "Superface Payment API", author: "Superface.ai", category: "Integration", desc: "Integrazione universale Stripe/PayPal via Superface Hub." },
    { name: "Agensi Docker Optimizer", author: "Agensi.ai", category: "DevOps", desc: "Skill per la riduzione delle dimensioni delle immagini Docker." },
    { name: "ToolHub Weather Service", author: "ToolHub.io", category: "Tools", desc: "Dati meteo globali pronti per function calling." },
    { name: "DeepNLP SQL Validator", author: "DeepNLP.org", category: "Architecture", desc: "Analisi semantica di query SQL per prevenire injection." },
    { name: "OpenSkills Git Flow", author: "OpenDev", category: "Automation", desc: "Automazione completa di branch management e pull requests." }
  ]
};

// Registro dei nuovi elementi scoperti durante questa sessione (Persistenza in memoria)
let discoveredRegistry = { agents: [], skills: [] };

// URL del registro GXCode (Esempio pubblico)
const GX_REGISTRY_URL = 'https://raw.githubusercontent.com/GXCode-IDE/gx-registry/main/marketplace.json';

// ═══════════════════════════════════════════════════════════════════
// LIVE MARKETPLACE AGGREGATOR v6.0 - Multi-Source, Daily Updated
// Sources: Apify Store | HuggingFace Hub | npm Registry | GitHub
// ═══════════════════════════════════════════════════════════════════
const fetchLiveMarketplace = async (type, q, category, customRegs = []) => {
  const now = Date.now();
  const results = [];
  const seen = new Set();

  const addItem = (item) => {
    const key = `${item.source}-${item.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ ...item, discoveredAt: now, isInstalled: false });
    }
  };

  // ─── 1. GX Registry + Custom Registries ──────────────────────────
  const allRegs = [GX_REGISTRY_URL, ...customRegs].filter(Boolean);
  for (const regUrl of allRegs) {
    try {
      console.log(`[SPY-DISCOVERY] Interrogazione registro: ${regUrl} (${type})...`);
      const resp = await fetch(regUrl, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const externalData = await resp.json();
        (externalData[type] || []).forEach(item => addItem(item));
      }
    } catch (err) {
      console.warn(`[SPY-DISCOVERY] Registro ${regUrl} non raggiungibile.`);
    }
  }

  // ─── 2. Apify Store (AGENTI) ─────────────────────────────────────
  // Apify is a real marketplace with 3000+ automation actors/agents, updated daily
  if (type === 'agents') {
    try {
      const searchQ = q || (category !== 'all' ? category : 'web-scraper');
      const apifyUrl = `https://api.apify.com/v2/store?limit=20&search=${encodeURIComponent(searchQ)}&sortBy=popularity`;
      const apifyResp = await fetch(apifyUrl, {
        headers: { 'User-Agent': 'GXCode-IDE/3.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (apifyResp.ok) {
        const apifyData = await apifyResp.json();
        (apifyData.data?.items || []).forEach(actor => {
          addItem({
            id: `apify-${actor.id}`,
            name: actor.title || actor.name,
            category: actor.categories?.[0] || 'Automation',
            description: actor.description || `Automation agent by ${actor.username}. ${actor.totalRuns ? actor.totalRuns + ' runs.' : ''}`,
            source: 'Apify Store',
            author: actor.username,
            version: actor.currentPublicVersion?.versionNumber || 'latest',
            link: `https://apify.com/${actor.username}/${actor.name}`,
            stats: actor.totalRuns ? `${(actor.totalRuns/1000).toFixed(0)}k runs` : null
          });
        });
        console.log(`[SPY-APIFY] Trovati ${apifyData.data?.items?.length || 0} agenti da Apify Store.`);
      }
    } catch (err) {
      console.warn('[SPY-APIFY] Apify Store non raggiungibile:', err.message);
    }
  }

  // ─── 3. HuggingFace Spaces (AGENTI) ──────────────────────────────
  // HF Spaces: thousands of live AI demos/agents, updated constantly
  if (type === 'agents') {
    try {
      const hfSearch = q ? `&search=${encodeURIComponent(q)}` : '';
      const hfSpacesUrl = `https://huggingface.co/api/spaces?limit=15&sort=likes${hfSearch}&full=false`;
      const hfResp = await fetch(hfSpacesUrl, {
        headers: { 'User-Agent': 'GXCode-IDE/3.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (hfResp.ok) {
        const spaces = await hfResp.json();
        spaces.forEach(space => {
          const tags = space.tags || [];
          const cat = tags.find(t => ['nlp','cv','audio','tabular','code'].includes(t)) || 'ML/AI';
          addItem({
            id: `hf-space-${space.id?.replace('/', '-')}`,
            name: space.id?.split('/')[1] || space.id,
            category: cat.toUpperCase().replace('NLP','Text AI').replace('CV','Vision AI').replace('CODE','Code AI'),
            description: `🤗 HuggingFace Space by ${space.author}. ${space.likes || 0} likes.${space.sdk ? ` [${space.sdk}]` : ''}`,
            source: 'HuggingFace',
            author: space.author,
            version: 'live',
            link: `https://huggingface.co/spaces/${space.id}`
          });
        });
        console.log(`[SPY-HF-SPACES] Trovati ${spaces.length} spaces da HuggingFace.`);
      }
    } catch (err) {
      console.warn('[SPY-HF-SPACES] HuggingFace Spaces non raggiungibile:', err.message);
    }
  }

  // ─── 4. HuggingFace Models (SKILL) ───────────────────────────────
  // HF Models: 500k+ models, with tags acting as skill categories, updated daily
  if (type === 'skills') {
    try {
      const hfSearch = q ? `&search=${encodeURIComponent(q)}` : '';
      const pipeline = category !== 'all' ? `&pipeline_tag=${encodeURIComponent(category)}` : '';
      const hfModelsUrl = `https://huggingface.co/api/models?limit=20&sort=downloads&direction=-1${hfSearch}${pipeline}&full=false`;
      const hfResp = await fetch(hfModelsUrl, {
        headers: { 'User-Agent': 'GXCode-IDE/3.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (hfResp.ok) {
        const models = await hfResp.json();
        models.forEach(model => {
          const task = model.pipeline_tag || 'ML/AI';
          const taskLabel = task.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const dl = model.downloads ? `${(model.downloads/1000).toFixed(0)}k downloads` : '';
          addItem({
            id: `hf-model-${model.id?.replace('/', '-')}`,
            name: model.id?.split('/').pop() || model.id,
            category: taskLabel,
            description: `HuggingFace model for ${taskLabel}. By ${model.id?.split('/')[0] || 'Community'}. ${dl}`,
            source: 'HuggingFace',
            author: model.id?.split('/')[0] || 'HuggingFace',
            version: 'latest',
            link: `https://huggingface.co/${model.id}`
          });
        });
        console.log(`[SPY-HF-MODELS] Trovati ${models.length} modelli da HuggingFace.`);
      }
    } catch (err) {
      console.warn('[SPY-HF-MODELS] HuggingFace Models non raggiungibile:', err.message);
    }
  }

  // ─── 5. npm Registry (SKILL) ──────────────────────────────────────
  // npm: real packages as skills (langchain, openai, etc.), updated constantly
  if (type === 'skills') {
    try {
      const npmKeywords = q
        ? encodeURIComponent(q)
        : encodeURIComponent('langchain OR ai-agent OR llm OR openai OR anthropic OR skill');
      const npmUrl = `https://registry.npmjs.org/-/v1/search?text=${npmKeywords}&size=15&quality=0.65&popularity=0.98&maintenance=0.5`;
      const npmResp = await fetch(npmUrl, {
        headers: { 'User-Agent': 'GXCode-IDE/3.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (npmResp.ok) {
        const npmData = await npmResp.json();
        (npmData.objects || []).forEach(pkg => {
          const p = pkg.package;
          addItem({
            id: `npm-${p.name}`,
            name: p.name,
            category: p.keywords?.find(k => ['ai','ml','nlp','tools','automation','integration'].some(kw => k.includes(kw)))?.toUpperCase() || 'npm Package',
            description: p.description || `npm skill package. ${pkg.score?.detail?.popularity ? `Popularity: ${(pkg.score.detail.popularity * 100).toFixed(0)}%` : ''}`,
            source: 'npm Registry',
            author: p.publisher?.username || p.author?.name || 'Community',
            version: p.version || 'latest',
            link: p.links?.npm
          });
        });
        console.log(`[SPY-NPM] Trovati ${npmData.objects?.length || 0} pacchetti da npm.`);
      }
    } catch (err) {
      console.warn('[SPY-NPM] npm Registry non raggiungibile:', err.message);
    }
  }

  // ─── 6. GitHub Topics Search ──────────────────────────────────────
  try {
    const topic = type === 'agents' ? 'ai-agent' : type === 'skills' ? 'llm-tool' : 'vscode-extension';
    const searchQuery = q ? `${q}+topic:${topic}` : `topic:${topic}+topic:gxcode`;
    const ghUrl = `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=8`;
    const ghResp = await fetch(ghUrl, {
      headers: { 'User-Agent': 'GXCode-IDE', 'Accept': 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(5000)
    });
    if (ghResp.ok) {
      const ghData = await ghResp.json();
      (ghData.items || []).forEach(repo => {
        addItem({
          id: `gh-${repo.id}`,
          name: repo.name,
          category: repo.language || 'GitHub Community',
          description: repo.description || `${repo.stargazers_count}⭐  GitHub repository by ${repo.owner.login}`,
          source: 'GitHub',
          author: repo.owner.login,
          version: `${repo.stargazers_count}★`,
          link: repo.html_url
        });
      });
    }
  } catch (err) {
    console.warn('[SPY-GITHUB] GitHub Search API non raggiungibile.');
  }

  return results;
};

// Marketplace Search Aggregator (V5.1 - Multi-Registry & GitHub Support)
apiApp.get("/api/marketplace/search", async (req, res) => {
  const { q, type, category, registries } = req.query;
  const searchTerm = q ? q.toLowerCase() : '';
  const searchCat = category ? category.toLowerCase() : 'all';
  const customRegs = registries ? registries.split(',') : [];

  // Base Data (Catalogo di base SEMPRE visibile)
  const localResults = {
    agents: [
      // AI & Architecture
      { 
        id: 'deep-1', 
        name: "DeepNLP Architect", 
        category: "Architecture", 
        description: "Progetta sistemi AI complessi usando le API e gli embedding di DeepNLP.org. Genera diagrammi architetturali e piani di implementazione.", 
        source: "DeepNLP", 
        author: "DeepNLP Team", 
        version: "v2.3.1", 
        isInstalled: false,
        systemPrompt: "Sei un DeepNLP Architect esperto in sistemi distribuiti e AI. Il tuo obiettivo è progettare architetture che utilizzano RAG (Retrieval-Augmented Generation) e Vector Databases. Fornisci sempre diagrammi in formato Mermaid e piani di implementazione divisi per fasi."
      },
      { 
        id: 'hf-1', 
        name: "HuggingFace Engineer", 
        category: "ML/AI", 
        description: "Selezione, fine-tuning e deploy di modelli LLM dall'ecosistema HuggingFace. Supporta Llama, Mistral, Phi e tutti i modelli GGUF.", 
        source: "HF Hub", 
        author: "HuggingFace", 
        version: "v1.9.0", 
        isInstalled: false,
        systemPrompt: "Sei un HuggingFace Engineer. Conosci ogni modello su HF Hub. Aiuta l'utente a scegliere il modello giusto in base alle performance (MMLU score) e al formato (GGUF/ExLlama). Suggerisci script di fine-tuning usando la libreria 'transformers' e 'PEFT'."
      },
      { 
        id: 'mlflow-1', 
        name: "MLflow Orchestrator", 
        category: "ML/AI", 
        description: "Tracciamento esperimenti, versioning modelli e deployment pipeline ML con MLflow. Integrazione nativa con PyTorch e TensorFlow.", 
        source: "GX Hub", 
        author: "MLOps Guild", 
        version: "v1.4.2", 
        isInstalled: false,
        systemPrompt: "Sei un esperto di MLOps specializzato in MLflow. Gestisci il tracking degli esperimenti (metrics, params) e l'organizzazione del Model Registry. Assicurati che ogni modello abbia una firma (signature) corretta per il deployment."
      },
      { 
        id: 'langchain-1', 
        name: "LangChain Builder", 
        category: "ML/AI", 
        description: "Costruisce catene LLM complesse con LangChain: RAG, agent loops, tool calling e memory management avanzato.", 
        source: "Community", 
        author: "LangDev Team", 
        version: "v0.9.5", 
        isInstalled: false,
        systemPrompt: "Sei un LangChain Builder certificato. Progetta catene (Chains) e grafi (LangGraph) per gestire flussi decisionali autonomi. Usa preferibilmente la sintassi LCEL (LangChain Expression Language)."
      },
      // Coding & Development
      { 
        id: 'agensi-1', 
        name: "Agensi Coder Pro", 
        category: "Coding", 
        description: "Agente ottimizzato per il formato SKILL.md, refactoring avanzato e coding estremo multi-linguaggio con analisi contestuale profonda.", 
        source: "Agensi", 
        author: "Agensi.ai", 
        version: "v3.1.0", 
        isInstalled: false,
        systemPrompt: "Sei Agensi Coder Pro, un agente di elite per lo sviluppo software professionale. Segui rigorosamente i princìpi SOLID e Clean Code. Quando ricevi una skill in formato SKILL.md, interpretala per estendere le tue capacità e applicarla ai file dell'utente."
      },
      { 
        id: 'agensi-2', 
        name: "Agensi Python Expert", 
        category: "Coding", 
        description: "Esperto Python specializzato in data science, FastAPI, automazione e scripting ad alte prestazioni. Suggerisce Type Hints e docstring.", 
        source: "Agensi", 
        author: "Agensi.ai", 
        version: "v2.7.3", 
        isInstalled: false,
        systemPrompt: "Sei un Python Expert veterano. Scrivi codice idomatico (Pythonic), usa sempre Type Hints (typing) e Pydantic per la validazione dei dati. Sei un maestro nell'ottimizzazione di performance con NumPy e Pandas."
      },
      { 
        id: 'ts-1', 
        name: "TypeScript Sentinel", 
        category: "Coding", 
        description: "Auditing TypeScript avanzato: tipizzazione generica, narrowing, decoratori e pattern architetturali per codebase enterprise.", 
        source: "GX Hub", 
        author: "TSMasters", 
        version: "v2.0.1", 
        isInstalled: false,
        systemPrompt: "Sei TypeScript Sentinel. La tua missione è eliminare gli 'any' non necessari e implementare una tipizzazione forte e sicura. Suggerisci l'uso di Generics, Discriminated Unions e Type Guards per rendere il codice robusto."
      },
      { 
        id: 'rust-1', 
        name: "Rust Systems Coder", 
        category: "Coding", 
        description: "Specialista in Rust: gestione del borrow checker, async/await con Tokio, FFI e sistemi embedded. Zero-cost abstractions.", 
        source: "Community", 
        author: "RustLabs", 
        version: "v1.2.0", 
        isInstalled: false,
        systemPrompt: "Sei un Rustacean esperto. Aiuta l'utente a navigare tra le regole del Borrow Checker, suggerisci l'uso corretto di 'smart pointers' come Arc/Mutex e progetta API efficienti e prive di 'unsafe' quando possibile."
      },
      // DevOps & Security
      { 
        id: 'devops-1', 
        name: "K8s Cluster Master", 
        category: "DevOps", 
        description: "Gestione di cluster Kubernetes: Helm charts, RBAC, NetworkPolicy, HPA/VPA e monitoraggio con Prometheus/Grafana.", 
        source: "GX Hub", 
        author: "CloudOps", 
        version: "v2.5.0", 
        isInstalled: false,
        systemPrompt: "Sei un K8s SRE (Site Reliability Engineer). Genera manifesti YAML puliti, configura Ingress controllers e assicura che ogni pod abbia limiti di risorse (requests/limits) definiti per evitare problemi di noisy neighbor."
      },
      { 
        id: 'qa-1', 
        name: "Security Auditor V3", 
        category: "Security", 
        description: "Analisi statica SAST, rilevamento vulnerabilità OWASP Top 10, CVE scanning e generazione di report dettagliati con remediation.", 
        source: "Community", 
        author: "CyberGuard", 
        version: "v3.4.1", 
        isInstalled: false,
        systemPrompt: "Sei un Security Auditor. La tua priorità è trovare falle di sicurezza prima che vengano sfruttate. Esegui scansioni SAST su ogni riga di codice e segnala injection, XSS e configurazioni insicure con alta severità."
      },
    ],
    skills: [
      // Core Skills
      { 
        id: 'os-1', 
        name: "Universal Skill Loader", 
        category: "Automation", 
        description: "Caricatore universale per skill in formato SKILL.md. Gestione versioning e conflitti tra skill.", 
        source: "OpenSkills", 
        author: "OpenDev", 
        version: "v3.0.0", 
        isInstalled: false,
        logic: "function loadSkill(path) {\n  console.log('[SKILL] Loading from:', path);\n  return { status: 'active', entry: 'index.js' };\n}"
      },
      { 
        id: 'sql-1', 
        name: "SQL Optimizer Skill", 
        category: "Data", 
        description: "Ottimizzazione automatica di query SQL complesse: analisi execution plan e suggerimento indici.", 
        source: "DeepNLP", 
        author: "DBA Pro", 
        version: "v3.1.0", 
        isInstalled: false,
        logic: "SELECT * FROM queries WHERE execution_time > 1s ORDER BY cost DESC; -- EXPLAIN ANALYZE focus"
      },
      { 
        id: 'docker-sk-1', 
        name: "Docker Control Skill", 
        category: "DevOps", 
        description: "Integrazione nativa per la gestione di container Docker: build ottimizzate e networking.", 
        source: "Awesome MCP", 
        author: "MCP Community", 
        version: "v2.3.0", 
        isInstalled: false,
        logic: "docker build -t gx-service . && docker run --rm -p 8080:8080 gx-service"
      }
    ],
    addons: []
  };

  // 1. Simula Fetch/Sync Dinamico (Aggiunge al discoveredRegistry)
  const liveAdditions = (type !== 'addons') ? await fetchLiveMarketplace(type, searchTerm, searchCat, customRegs) : [];

  // 2. Fetch Live Addons (Open VSX)
  if (type === 'addons') {
    try {
      // Potenziamento: dimensioni maggiori e supporto categoria
      let vsxQuery = searchTerm || '';
      if (searchCat !== 'all') {
          vsxQuery += ` category:"${searchCat}"`;
      }

      const url = `https://open-vsx.org/api/-/search?q=${encodeURIComponent(vsxQuery)}&size=100`;
      
      const response = await fetch(url, { headers: { 'User-Agent': 'GXCode-IDE' } });
      const json = await response.json();
      localResults.addons = json.extensions.map(ext => ({
        id: `${ext.namespace}.${ext.name}`,
        name: ext.displayName || ext.name,
        category: (ext.categories && ext.categories[0]) || "IDE Addon",
        description: ext.description || "Nessuna descrizione.",
        source: "Open VSX",
        author: ext.namespace,
        isInstalled: false
      }));
    } catch (e) {
      localResults.addons = offlineMockPlugins;
    }
  }

  // Merge & Filter
  let finalItems = [...(localResults[type] || []), ...liveAdditions];

  // Cross-reference con gli elementi installati
  const diskAgents = loadPersistedData('agents');
  const diskSkills = loadPersistedData('skills');
  const diskPlugins = loadPersistedData('plugins');

  finalItems = finalItems.map(item => {
    let isInstalled = false;
    if (type === 'agents') isInstalled = diskAgents.some(a => String(a.id) === String(item.id));
    else if (type === 'skills') isInstalled = diskSkills.some(s => String(s.id) === String(item.id));
    else if (type === 'addons') isInstalled = diskPlugins.some(p => String(p.id) === String(item.id));

    return { ...item, isInstalled };
  });

  // Filtro categoria post-merge per i registri custom che non la supportano in query
  if (searchCat !== 'all') {
    finalItems = finalItems.filter(i =>
      i.category && i.category.toLowerCase().includes(searchCat)
    );
  }

  if (searchTerm) {
    finalItems = finalItems.filter(i =>
      i.name.toLowerCase().includes(searchTerm) ||
      (i.description && i.description.toLowerCase().includes(searchTerm))
    );
  }

  res.json(finalItems);
});

apiApp.get("/api/marketplace-agents", (req, res) => {
  const diskAgents = loadPersistedData('agents');
  const merged = marketplaceAgents.map(a => {
    const isSaved = diskAgents.some(da => da.id === a.id || da.name === a.name || da.slug === a.slug);
    return isSaved ? { ...a, isInstalled: true } : a;
  });
  res.json(merged);
});

apiApp.patch("/api/marketplace-agents/:id", (req, res) => {
  const id = req.params.id;
  const body = req.body;

  console.log(`[SPY-INSTALL] Installando AGENTE: ${id}`);

  // Troviamo l'originale tra quelli locali o nel catalogo marketplace
  const diskAgents = loadPersistedData('agents');
  // Nota: marketplaceAgents è definito sopra come array di mock. 
  // Dobbiamo cercarlo anche nel discoveredRegistry per i live items.
  const allAvailable = [...diskAgents, ...marketplaceAgents, ...discoveredRegistry.agents];
  const original = allAvailable.find(a => String(a.id) === String(id)) || { name: "Agent_" + id };

  const agentPatch = {
    ...original,
    avatar: original.avatar || "bot",
    status: "idle",
    parentId: null,
    skillIds: "[]",
    ...body,
    id: id,
    isInstalled: true
  };

  savePersistedData('agents', agentPatch);
  res.json(agentPatch);
});

apiApp.patch("/api/marketplace-skills/:id", (req, res) => {
  const id = req.params.id;
  const body = req.body;

  console.log(`[SPY-INSTALL] Installando SKILL: ${id}`);

  const diskSkills = loadPersistedData('skills');
  const allAvailable = [...diskSkills, ...marketplaceSkills, ...discoveredRegistry.skills];
  const original = allAvailable.find(s => String(s.id) === String(id)) || { name: "Skill_" + id };

  const skillPatch = {
    ...original,
    type: "javascript",
    ...body,
    id: id,
    isInstalled: true
  };

  savePersistedData('skills', skillPatch);
  res.json(skillPatch);
});

// Aggiungiamo l'endpoint PATCH per quando cliccano Installa sui plugins
apiApp.patch("/api/plugins/:id", (req, res) => {
  const body = req.body;
  const idStr = String(req.params.id);

  // Per i plugin, usiamo lo slug come ID per il file per evitare numeri seriali fragili
  const safeSlug = (body.slug || `plugin-${idStr}`).replace(/[^a-z0-9.]+/g, '-');
  const dir = getActiveAiPath('plugins');
  const filePath = path.join(dir, `${safeSlug}.json`);

  const pluginData = {
    id: idStr,
    ...body,
    _managedBy: 'open-vsx'
  };

  fs.writeFileSync(filePath, JSON.stringify(pluginData, null, 2), 'utf-8');
  res.json(pluginData);
});

apiApp.delete("/api/plugins/:id", (req, res) => {
  const id = req.params.id;
  // Per i plugin potremmo dover cercare per ID o per slug
  if (deletePersistedData('plugins', id)) {
    res.status(204).end();
  } else {
    res.status(404).json({ error: "Plugin not found" });
  }
});

apiApp.get("/api/plugins", async (req, res) => {
  const savedPlugins = loadPersistedData('plugins');
  const query = req.query.q || '';

  const mergeWithSaved = (baseArray) => {
    return baseArray.map(p => {
      const saved = savedPlugins.find(s => s.slug === p.slug);
      return saved ? { ...p, ...saved, isInstalled: true } : p;
    });
  };

  try {
    const url = query
      ? `https://open-vsx.org/api/-/search?q=${encodeURIComponent(query)}&size=30`
      : `https://open-vsx.org/api/-/search?size=20`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'GXCode-IDE' }
    });
    if (!response.ok) throw new Error("Open VSX API error");
    const json = await response.json();

    const fetchedPlugins = json.extensions.map((ext, i) => {
      const namespace = ext.namespace || ext.publisher || 'unknown';
      const slug = `${namespace}.${ext.name}`;
      return {
        id: slug, // Usiamo lo slug come ID primario per coerenza tra search/install
        slug: slug,
        name: ext.displayName || ext.name,
        description: ext.description || "Nessuna descrizione disponibile.",
        version: ext.version,
        author: namespace,
        downloads: ext.downloadCount || 0,
        link: `https://open-vsx.org/extension/${namespace}/${ext.name}`
      };
    });

    res.json(mergeWithSaved(fetchedPlugins));
  } catch (err) {
    console.error("Errore fetch Open VSX (fallback offline):", err);
    res.json(mergeWithSaved(offlineMockPlugins));
  }
});

apiApp.patch("/api/marketplace-skills/:id", (req, res) => {
  const id = req.params.id;
  const body = req.body;

  const diskSkills = loadPersistedData('skills');
  const allAvailable = [...diskSkills, ...marketplaceSkills, ...offlineMockSkills, ...discoveredRegistry.skills];
  const original = allAvailable.find(s => String(s.id) === String(id)) || { name: "Skill_" + id, category: "general" };

  const skillPatch = { ...original, category: original.category || "general", content: original.content || "", ...body, id };
  savePersistedData('skills', skillPatch);
  res.json(skillPatch);
});

apiApp.get("/api/marketplace-skills", async (req, res) => {
  const diskSkills = loadPersistedData('skills');
  const markInstalled = (arr) => arr.map(s => {
    const isSaved = diskSkills.some(ds => ds.id === s.id || ds.slug === s.slug || ds.name === s.name);
    return isSaved ? { ...s, isInstalled: true } : s;
  });

  try {
    const response = await fetch('https://registry.npmjs.org/-/v1/search?text=keywords:ai-agent,langchain,ai-skill&size=10', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error("Network error fetching skills");
    const json = await response.json();

    const remoteSkills = json.objects.map((obj, i) => ({
      id: i + 200,
      slug: obj.package.name,
      name: obj.package.name,
      description: obj.package.description || "Skill scaricata da Internet (Proxy)."
    }));

    res.json(markInstalled([...marketplaceSkills, ...offlineMockSkills, ...remoteSkills]));
  } catch (err) {
    console.error("Errore fetch marketplace skills (usando fallback offline):", err);
    res.json(markInstalled([...marketplaceSkills, ...offlineMockSkills]));
  }
});

// Publishing Hub (Mappa verso repository esterne)
apiApp.post("/api/marketplace/publish", async (req, res) => {
  const { item, targetRepoUrl } = req.body;
  console.log(`[SPY-PUBLISH] Richiesta pubblicazione di "${item.name}"...`);

  try {
    const exportPath = path.join(process.cwd(), '.gxcode', 'exports');
    if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });

    const fileName = `${item.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    const filePath = path.join(exportPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify({
        ...item,
        publishedAt: new Date().toISOString(),
        registryTarget: targetRepoUrl || 'GX-Default'
    }, null, 2));

    console.log(`[SPY-PUBLISH] Item esportato con successo in: ${filePath}`);

    res.json({ 
        success: true, 
        message: `Pubblicazione (Export) completata! Il file è pronto in .gxcode/exports/${fileName}`, 
        url: targetRepoUrl || 'Local Export' 
    });
  } catch (err) {
    console.error("[SPY-PUBLISH] Errore:", err);
    res.status(500).json({ error: "Errore durante la pubblicazione: " + err.message });
  }
});

apiApp.get("/api/custom-repos", (req, res) => {
  res.json(customRepos);
});

apiApp.get("/api/settings", (req, res) => {
  res.json(settings);
});

// ---- ENDPOINT GOOGLE OAUTH CALLBACK (GEMINI) ----
const GOOGLE_CONFIG = {
  clientId: "411114937479-jfa96807lfiuo4rlnqd362598s7dj5va.apps.googleusercontent.com",
  clientSecret: "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", // <--- DEVI INCOLLARE IL SEGRETO QUI!
  redirectUri: "http://localhost:5000/gemini/callback"
};

apiApp.get("/gemini/callback", async (req, res) => {
  const code = req.query.code;

  if (code) {
    try {
      // 1. Scambio codice per token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CONFIG.clientId,
          client_secret: GOOGLE_CONFIG.clientSecret,
          redirect_uri: GOOGLE_CONFIG.redirectUri,
          grant_type: "authorization_code"
        })
      });
      const tokens = await tokenRes.json();

      if (tokens.error) throw new Error(tokens.error_description || tokens.error);

      // 2. Recupero info profilo
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const profile = await profileRes.json();

      // 3. Comunichiamo al renderer i dati reali
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        wins[0].webContents.send('gemini:auth-success', {
          code: tokens.access_token, // Usiamo il token invece del codice
          email: profile.email,
          name: profile.name,
          picture: profile.picture
        });
      }

      res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #0d1117; color: white; height: 100vh;">
          <h1 style="color: #4285F4;">Benvenuto, ${profile.name}!</h1>
          <p>Autenticazione completata con successo.</p>
          <script>setTimeout(() => window.close(), 2000);</script>
        </div>
      `);
    } catch (err) {
      console.error("[OAuth] Error during token exchange:", err);
      res.status(500).send("Errore durante il recupero del profilo: " + err.message);
    }
  } else {
    res.status(400).send("Errore: codice mancante.");
  }
});

// ---- AVVIO SERVER API SU :5000 ----
const API_PORT = 5000;
apiApp.listen(API_PORT, () => {
  console.log(`API IDE su http://localhost:${API_PORT}`);
});

// ================== PARTE ELECTRON (COMANDI + FINESTRA) ==================

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false, // Rimuove la barra di sistema
    title: "GXCode Native Environment",
    icon: path.join(__dirname, "APP", "assets", "logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
    },
  });

  // carica l'index dalla cartella app/
  win.loadFile(path.join(__dirname, "APP", "index.html"));

  // Se ti servono i devtools (solo in dev):
  /* 
  // Disabilitiamo l'apertura automatica in dev su richiesta dell'utente
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
  */

  // Rimuove i menu di default (File, Edit, etc) come richiesto
  Menu.setApplicationMenu(null);

  // Fallback: Apri DevTools con F12 (utile in dev e per il debug dell'utente)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });
  return win;
}

app.whenReady().then(() => {
  const mainWindow = createWindow();



  ipcMain.handle('open-project-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const folderPath = result.filePaths[0];
    try {
      const files = fs.readdirSync(folderPath, { withFileTypes: true }).map(f => ({
        name: f.name,
        isDirectory: f.isDirectory(),
        path: path.join(folderPath, f.name)
      }));

      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return { name: path.basename(folderPath), path: folderPath, files };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('open-project-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Tutti i file', extensions: ['*'] },
        { name: 'JavaScript', extensions: ['js', 'jsx'] },
        { name: 'TypeScript', extensions: ['ts', 'tsx'] },
        { name: 'HTML/CSS', extensions: ['html', 'css'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    return { path: filePath, isFile: true };
  });

  ipcMain.handle('open-project-workspace', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleziona Workspace',
      properties: ['openFile', 'showHiddenFiles'],
      filters: [
        { name: 'GXCode Workspace', extensions: ['code-workspace'] },
        { name: 'Tutti i file', extensions: ['*'] }
      ]
    });

    if (canceled || filePaths.length === 0) return null;
    const wsPath = filePaths[0];

    try {
      const content = fs.readFileSync(wsPath, 'utf8');
      const config = JSON.parse(content);
      const folders = [];

      if (config.folders && Array.isArray(config.folders)) {
        for (const item of config.folders) {
          let folderPath = item.path;
          if (!path.isAbsolute(folderPath)) {
            folderPath = path.resolve(path.dirname(wsPath), folderPath);
          }

          if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath, { withFileTypes: true }).map(f => ({
              name: f.name,
              isDirectory: f.isDirectory(),
              path: path.join(folderPath, f.name)
            }));
            
            files.sort((a, b) => {
              if (a.isDirectory && !b.isDirectory) return -1;
              if (!a.isDirectory && b.isDirectory) return 1;
              return a.name.localeCompare(b.name);
            });

            folders.push({
              name: item.name || path.basename(folderPath),
              path: folderPath,
              files: files
            });
          }
        }
      }

      return { 
        name: path.basename(wsPath, '.code-workspace'),
        path: wsPath,
        isWorkspace: true, 
        folders 
      };
    } catch (e) {
      console.error("[Workspace Error]", e);
      return { error: e.message };
    }
  });

  ipcMain.handle('open-specific-folder', async (event, folderPath) => {
    try {
      if (!fs.existsSync(folderPath)) return null;

      if (folderPath.endsWith('.code-workspace')) {
        const content = fs.readFileSync(folderPath, 'utf8');
        const config = JSON.parse(content);
        const folders = [];

        if (config.folders && Array.isArray(config.folders)) {
          for (const item of config.folders) {
            let fp = item.path;
            if (!path.isAbsolute(fp)) {
              fp = path.resolve(path.dirname(folderPath), fp);
            }

            if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
              const files = fs.readdirSync(fp, { withFileTypes: true }).map(f => ({
                name: f.name,
                isDirectory: f.isDirectory(),
                path: path.join(fp, f.name)
              }));
              
              files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
              });

              folders.push({
                name: item.name || path.basename(fp),
                path: fp,
                files: files
              });
            }
          }
        }
        return { 
          name: path.basename(folderPath, '.code-workspace'),
          path: folderPath,
          isWorkspace: true, 
          folders 
        };
      }

      const files = fs.readdirSync(folderPath, { withFileTypes: true }).map(f => ({
        name: f.name,
        isDirectory: f.isDirectory(),
        path: path.join(folderPath, f.name)
      }));

      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return { name: path.basename(folderPath), path: folderPath, files };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    console.log(`[IPC] Richiesta lettura file: ${filePath}`);
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 1024 * 1024) return "File troppo grande per l'anteprima (Max 1MB).";
      const data = fs.readFileSync(filePath, 'utf-8');
      return data;
    } catch (e) {
      console.error(`[IPC] Errore lettura file ${filePath}:`, e.message);
      return `Errore lettura file: ${e.message}`;
    }
  });

  // ---- FILE SYSTEM OPERATIONS (Context Menu) ----
  ipcMain.handle('shell-open-path', async (event, targetPath) => {
    await shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle('open-gxcode-folder', async () => {
    const p = path.join(os.homedir(), currentAiContext);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    await shell.openPath(p);
    return true;
  });

  ipcMain.handle('fs-write-file', async (event, filePath, content) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  });

  ipcMain.handle('debug-start', async (event, filePath, breakpoints) => {
    if (nodeDebugger) nodeDebugger.stop();
    nodeDebugger = new NodeDebugger(mainWindow);
    return await nodeDebugger.start(filePath, breakpoints);
  });

  ipcMain.handle('debug-stop', async () => {
    if (nodeDebugger) nodeDebugger.stop();
    return true;
  });

  ipcMain.handle('debug-step', async () => {
    if (nodeDebugger) nodeDebugger.stepOver();
    return true;
  });

  ipcMain.handle('debug-continue', async () => {
    if (nodeDebugger) nodeDebugger.continue();
    return true;
  });

  ipcMain.handle('set-breakpoint', async (event, { path: filePath, line }) => {
    // Logica per gestire i breakpoint
    return { success: true };
  });

  ipcMain.handle('fs-create-file', async (event, dirPath, name) => {
    try {
      const filePath = path.join(dirPath, name);
      if (fs.existsSync(filePath)) return { error: 'File già esistente.' };
      fs.writeFileSync(filePath, '', 'utf-8');
      return { success: true, path: filePath };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('fs-create-folder-v2', async (event, dirPath, name) => {
    try {
      const folderPath = path.join(dirPath, name);
      if (fs.existsSync(folderPath)) return { error: 'Cartella già esistente.' };
      fs.mkdirSync(folderPath, { recursive: true });
      return { success: true, path: folderPath };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('fs-delete', async (event, targetPath) => {
    try {
      if (!fs.existsSync(targetPath)) return { error: 'Percorso non trovato.' };
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  // --- GEMINI REAL OAUTH HANDLER ---
  ipcMain.handle('gemini:login', async () => {
    if (GOOGLE_CONFIG.clientId.includes("YOUR_GOOGLE_CLIENT_ID") || GOOGLE_CONFIG.clientSecret.includes("INSERISCI_QUI")) {
      return {
        success: false,
        error: "CONFIG_MISSING",
        message: "Configurazione Google incompleta. Inserisci Client ID e Secret in main.js per procedere."
      };
    }

    const SCOPE = encodeURIComponent("openid email profile https://www.googleapis.com/auth/cloud-platform");
    console.log("[GX OAuth] Starting Auth with main-v8-final-fix...");

    // URL di autorizzazione Google
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CONFIG.clientId}&redirect_uri=${GOOGLE_CONFIG.redirectUri}&response_type=code&scope=${SCOPE}&access_type=offline&prompt=consent`;

    // Apriamo il browser dell'utente
    shell.openExternal(authUrl);
    return { success: true };
  });

  // Handler per Ricerca Globale nei file
  ipcMain.handle('search-files', async (event, folderPath, query) => {
    if (!folderPath || !query) return [];
    const results = [];
    const MAX_RESULTS = 200;

    const searchRecursively = (dir) => {
      if (results.length >= MAX_RESULTS) return;
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          if (results.length >= MAX_RESULTS) return;
          const fullPath = path.join(dir, file.name);

          if (file.isDirectory()) {
            if (['node_modules', '.git', 'dist', 'build', '.next', '.claude', '.gemini'].includes(file.name)) continue;
            searchRecursively(fullPath);
          } else {
            if (file.name.match(/\\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|tar|gz|exe|dll|class|jar|woff2?|eot|ttf|mp3|mp4)$/i)) continue;
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file: fullPath,
                    relativePath: path.relative(folderPath, fullPath),
                    line: i + 1,
                    text: lines[i].trim().substring(0, 150)
                  });
                  if (results.length >= MAX_RESULTS) return;
                }
              }
            } catch (e) { }
          }
        }
      } catch (e) { }
    };

    searchRecursively(folderPath);
    console.log(`[IPC] Ricerca completata per "${query}", trovati ${results.length} risultati.`);
    return results;
  });

  // Handler per scansionare e trovare tutti i test nei file .spec.js o .test.js
  ipcMain.handle('scan-tests', async (event, folderPath) => {
    if (!folderPath) return [];
    const testFiles = [];
    const MAX_FILES = 100;

    const searchRecursively = (dir) => {
      if (testFiles.length >= MAX_FILES) return;
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          if (testFiles.length >= MAX_FILES) return;
          const fullPath = path.join(dir, file.name);

          if (file.isDirectory()) {
            if (['node_modules', '.git', 'dist', 'build', '.next', '.claude', '.gemini'].includes(file.name)) continue;
            searchRecursively(fullPath);
          } else {
            if (file.name.match(/\\.(spec|test)\\.(js|ts|jsx|tsx)$/i)) {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              const testMatches = [];

              const testRegex = /(?:test|it)\s*\(['"`](.*?)['"`]/;

              for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(testRegex);
                if (match && match[1]) {
                  testMatches.push({
                    name: match[1],
                    line: i + 1,
                    status: 'idle'
                  });
                }
              }

              if (testMatches.length > 0) {
                testFiles.push({
                  file: file.name,
                  fullPath: fullPath,
                  relativePath: path.relative(folderPath, fullPath),
                  testMatches
                });
              }
            }
          }
        }
      } catch (e) { }
    };

    searchRecursively(folderPath);
    return testFiles;
  });

  // Handler per eseguire un test specifico usando Playwright
  ipcMain.handle('run-test', async (event, workspacePath, filePath, testName) => {
    return new Promise((resolve, reject) => {
      const escapedName = testName.replace(/"/g, '\\"');
      const cmd = `npx playwright test "${filePath}" -g "${escapedName}" --reporter=json`;

      console.log(`[IPC] Esecuzione test: ${cmd}`);

      exec(cmd, { cwd: workspacePath, env: process.env }, (error, stdout, stderr) => {
        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);

            // Simple Playwright JSON logic: if errors.length === 0, it passed
            const pass = result.errors ? result.errors.length === 0 : true;
            if (error && !pass) {
              reject(new Error('Test fallito'));
            } else {
              resolve(true); // Test passed
            }
          } else {
            if (error) reject(new Error(stderr || stdout || 'Errore Test'));
            else resolve(true);
          }
        } catch (e) {
          if (error) reject(new Error('Test fallito'));
          else resolve(true);
        }
      });
    });
  });

  // Handler per eseguire tutti i test in un file specifico
  ipcMain.handle('run-file-tests', async (event, workspacePath, filePath) => {
    return new Promise((resolve, reject) => {
      const cmd = `npx playwright test "${filePath}" --reporter=json`;
      console.log(`[IPC] Esecuzione tutti i test nel file: ${cmd}`);

      exec(cmd, { cwd: workspacePath, env: process.env }, (error, stdout, stderr) => {
        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
            resolve(JSON.parse(jsonStr));
          } else {
            if (error) reject(new Error(stderr || stdout || 'Errore Test'));
            else resolve({ success: true });
          }
        } catch (e) {
          if (error) reject(new Error('Test fallito'));
          else resolve({ success: true });
        }
      });
    });
  });

  // Handler per il Debug di un test (lancia Playwright Inspector)
  ipcMain.handle('debug-test', async (event, workspacePath, filePath, testName) => {
    return new Promise((resolve, reject) => {
      const escapedName = testName.replace(/"/g, '\\"');
      const cmd = `npx playwright test "${filePath}" -g "${escapedName}" --headed`;

      console.log(`[IPC] DEBUG TEST: ${cmd}`);

      // Lanciamo con variabile d'ambiente PWDEBUG=1
      const debugEnv = { ...process.env, PWDEBUG: '1' };

      exec(cmd, { cwd: workspacePath, env: debugEnv }, (error, stdout, stderr) => {
        if (error) {
          console.error("[IPC] Debug Error:", stderr);
          resolve(false); // Il debug può essere chiuso dall'utente, non lo consideriamo errore fatale
        } else {
          resolve(true);
        }
      });
    });
  });

  // Handler per eseguire tutti i test nel progetto
  ipcMain.handle('run-all-tests', async (event, workspacePath) => {
    return new Promise((resolve, reject) => {
      const cmd = `npx playwright test --reporter=json`;
      console.log(`[IPC] Esecuzione tutti i test: ${cmd}`);

      exec(cmd, { cwd: workspacePath, env: process.env }, (error, stdout, stderr) => {
        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
            resolve(JSON.parse(jsonStr));
          } else {
            if (error) reject(new Error(stderr || stdout || 'Errore Test'));
            else resolve({ success: true });
          }
        } catch (e) {
          if (error) reject(new Error('Esecuzione fallita'));
          else resolve({ success: true });
        }
      });
    });
  });

  // handler per il terminale reale (ora supporta CWD dinamico per l'Agente)
  ipcMain.handle("execute-command", async (event, cmd, customCwd) => {
    const cwd = customCwd || __dirname;

    // Intelligenza AI Context Interceptor: aggiorna in quale ecosistema siamo
    const lowerCmd = cmd.toLowerCase().trim();
    if (lowerCmd.startsWith('claude')) currentAiContext = '.claude';
    else if (lowerCmd.startsWith('gemini')) currentAiContext = '.gemini';
    else if (lowerCmd.startsWith('cursor')) currentAiContext = '.cursor';
    else if (lowerCmd.startsWith('chatgpt')) currentAiContext = '.chatgpt';
    else if (lowerCmd.startsWith('auto-gpt')) currentAiContext = '.auto-gpt';

    return new Promise((resolve) => {
      exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        resolve({ error: error ? error.message : null, stdout, stderr });
      });
    });
  });

  // --- AUTO-UPDATER SYSTEM (Professional GitHub Releases) ---

  // Configurazione base per l'auto-updater
  autoUpdater.autoDownload = false; // Chiediamo prima di scaricare
  autoUpdater.logger = console;

  ipcMain.handle('get-app-version', () => app.getVersion());

  // --- SHARED PROMISE LOCK (Elimina race condition "Please check update first") ---
  let pendingCheck = null; // Promise condivisa tra check e perform

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) return false;

    // Se c'è già un controllo in corso, riusa la stessa Promise
    if (pendingCheck) {
      try { return !!(await pendingCheck).updateInfo; } catch { return false; }
    }

    pendingCheck = autoUpdater.checkForUpdates();
    try {
      const result = await pendingCheck;
      return !!result.updateInfo;
    } catch (err) {
      return false;
    } finally {
      pendingCheck = null;
    }
  });

  ipcMain.handle('perform-update', async () => {
    if (!app.isPackaged) return false;

    try {
      let checkResult;
      if (pendingCheck) {
        // Un controllo è già in corso (background), aspettiamo il suo risultato
        checkResult = await pendingCheck;
      } else {
        // Nessun controllo in corso, ne lanciamo uno nuovo
        pendingCheck = autoUpdater.checkForUpdates();
        checkResult = await pendingCheck;
        pendingCheck = null;
      }

      // Helper per confronto versioni semver-like
      const isNewer = (latest, current) => {
        if (!latest || !current) return false;
        const l = latest.split('.').map(Number);
        const c = current.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (l[i] > c[i]) return true;
          if (l[i] < c[i]) return false;
        }
        return false;
      };

      if (latestVersion && isNewer(latestVersion, currentVersion)) {
        console.log(`[UPDATER] Versione superiore trovata: ${latestVersion} > ${currentVersion}. Avvio download...`);
        await autoUpdater.downloadUpdate();
        return true;
      } else {
        console.log(`[UPDATER] Nessun aggiornamento necessario. Versione corrente: ${currentVersion} (Latest su GitHub: ${latestVersion || 'nessuna'}).`);
        return false;
      }
    } catch (err) {
      pendingCheck = null;
      const msg = err.message || "";
      if (msg.includes('No published versions') || msg.includes('latest.yml')) {
        throw new Error("Errore Release: GitHub non contiene i file necessari (latest.yml).");
      }
      throw err;
    }
  });

  // Configurazione per sbloccare download non firmati
  autoUpdater.fullChangelog = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.autoDownload = false; // Lo gestiamo noi manualmente
  
  autoUpdater.on('error', (err) => {
    console.error('[UPDATER ERROR]', err);
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) wins[0].webContents.send('updater-error', err.message);
  });

  autoUpdater.on('update-available', (info) => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) wins[0].webContents.send('update-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[UPDATER] Download: ${progressObj.percent}%`);
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) wins[0].webContents.send('download-progress', progressObj.percent);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) wins[0].webContents.send('update-ready-to-install', info);
  });

  ipcMain.handle('git-status', async (event, workspacePath) => {
    try {
      const { execSync } = require('child_process');
      const cwd = workspacePath || process.cwd();
      const status = execSync('git status --porcelain', { encoding: 'utf8', cwd });
      const branch = execSync('git branch --show-current', { encoding: 'utf8', cwd }).trim();

      const lines = status.split('\n').filter(l => l.trim());
      const files = lines.map(line => {
        const code = line.substring(0, 2);
        const path = line.substring(3);
        return { path, status: code.trim() };
      });

      return { success: true, files, branch };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-stage', async (event, workspacePath, filePath) => {
    try {
      const { execSync } = require('child_process');
      execSync(`git add "${filePath}"`, { cwd: workspacePath || process.cwd() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-commit', async (event, workspacePath, message) => {
    try {
      const { execSync } = require('child_process');
      execSync(`git commit -m "${message}"`, { cwd: workspacePath || process.cwd() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-pull', async (event, workspacePath) => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git pull', { encoding: 'utf8', cwd: workspacePath || process.cwd() });
      return { success: true, output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-push', async (event, workspacePath) => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git push', { encoding: 'utf8', cwd: workspacePath || process.cwd() });
      return { success: true, output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('clipboard-read', () => {
    const { clipboard } = require('electron');
    return clipboard.readText();
  });

  ipcMain.handle('git-diff', async (event, workspacePath, filePath) => {
    try {
      const { execSync } = require('child_process');
      const output = execSync(`git diff "${filePath}"`, { encoding: 'utf8', cwd: workspacePath || process.cwd() });
      // Se non ci sono differenze in git diff (es. file untracked), proviamo con diff vs null per prendersi il contenuto
      if (!output) {
         // Verifichiamo se è un file nuovo (untracked)
         const status = execSync(`git status --porcelain "${filePath}"`, { encoding: 'utf8', cwd: workspacePath || process.cwd() });
         if (status.includes('??')) {
            // Per i file untracked, il diff è l'intero file
            const content = fs.readFileSync(filePath, 'utf8');
            return { success: true, diff: content, isUntracked: true };
         }
      }
      return { success: true, diff: output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-show-head', async (event, workspacePath, filePath) => {
    try {
      const { execSync } = require('child_process');
      const relativePath = path.relative(workspacePath || process.cwd(), filePath).replace(/\\/g, '/');
      const output = execSync(`git show "HEAD:${relativePath}"`, { encoding: 'utf8', cwd: workspacePath || process.cwd() });
      return { success: true, content: output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- PHASE 3: INTERACTIVE PTY TERMINAL ---
  const ptyProcesses = {};

  ipcMain.handle('terminal-create', (event, id, shellType, workspacePath, apiKey) => {
    console.log(`[TERMINAL] Requesting new PTY - ID: ${id}, Shell: ${shellType}, Workspace: ${workspacePath}`);
    let shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    let args = [];

    if (shellType === 'claude') {
      shell = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      args = ['@anthropic-ai/claude-code'];
    } else if (shellType === 'cmd' && process.platform === 'win32') {
      shell = 'cmd.exe';
    } else if (shellType === 'bash' && process.platform === 'win32') {
      const paths = [
        path.join(process.env.USERPROFILE || '', 'AppData\\Local\\Programs\\Git\\bin\\bash.exe'),
        path.join(process.env.USERPROFILE || '', 'AppData\\Local\\Programs\\Git\\git-bash.exe')
      ];
      const drives = ['C', 'D', 'E', 'F', 'G'];
      for (const drive of drives) {
        paths.push(`${drive}:\\Program Files\\Git\\bin\\bash.exe`);
        paths.push(`${drive}:\\Program Files (x86)\\Git\\bin\\bash.exe`);
        paths.push(`${drive}:\\Git\\bin\\bash.exe`);
      }
      shell = 'bash.exe';
      for (const p of paths) {
        if (fs.existsSync(p)) {
          shell = p;
          break;
        }
      }
    } else if (shellType === 'bash' && process.platform !== 'win32') {
      shell = 'bash';
    }

    try {
      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workspacePath || process.cwd(),
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey || process.env.ANTHROPIC_API_KEY }
      });

      ptyProcesses[id] = ptyProcess;
      ptyProcess.onData((data) => {
        event.sender.send(`terminal-stdout-${id}`, data);
      });
      return { success: true };
    } catch (err) {
      console.error(`[TERMINAL] Error spawning ${shell}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('terminal-write', (event, id, data) => {
    if (ptyProcesses[id]) ptyProcesses[id].write(data);
  });

  ipcMain.handle('terminal-resize', (event, id, cols, rows) => {
    if (ptyProcesses[id]) ptyProcesses[id].resize(cols, rows);
  });

  // --- PHASE 4: NODE.JS DEBUGGER (CDP) ---
  let debugProcess = null;
  let debugWs = null;

  async function connectToDebugger(url, event, breakpoints) {
    if (debugWs) debugWs.close();
    debugWs = new WebSocket(url);

    debugWs.on('open', () => {
      console.log('[DEBUGGER] CDP Connected');
      debugWs.send(JSON.stringify({ id: 1, method: 'Debugger.enable' }));
      debugWs.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

      breakpoints.forEach((bp, index) => {
        const sanitizedPath = bp.path.replace(/\\/g, '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        debugWs.send(JSON.stringify({
          id: 100 + index,
          method: 'Debugger.setBreakpointByUrl',
          params: {
            lineNumber: bp.line - 1,
            urlRegex: `.*${sanitizedPath}`
          }
        }));
      });
      debugWs.send(JSON.stringify({ id: 3, method: 'Debugger.resume' }));
    });

    debugWs.on('message', async (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Debugger.paused') {
        const frame = msg.params.callFrames[0];
        event.sender.send('debug:paused', {
          line: frame.location.lineNumber + 1,
          callStack: msg.params.callFrames.map(cf => ({
            functionName: cf.functionName || '(anonymous)',
            location: cf.location
          }))
        });

        const localScope = frame.scopeChain.find(s => s.type === 'local');
        if (localScope && localScope.object && localScope.object.objectId) {
          debugWs.send(JSON.stringify({
            id: 500,
            method: 'Runtime.getProperties',
            params: { objectId: localScope.object.objectId, ownProperties: true }
          }));
        }
      } else if (msg.id === 500 && msg.result) {
        const vars = msg.result.result.map(p => ({
          name: p.name,
          value: p.value ? (p.value.description || p.value.value || String(p.value.type)) : 'undefined',
          type: p.value ? p.value.type : 'unknown'
        }));
        event.sender.send('debug:variables', vars);
      } else if (msg.method === 'Debugger.resumed') {
        event.sender.send('debug:resumed');
      }
    });

    debugWs.on('error', (err) => console.error('[DEBUGGER] WebSocket error:', err));
  }

  ipcMain.handle('debug:start', async (event, filePath, breakpoints) => {
    if (debugProcess) debugProcess.kill();
    const { spawn } = require('child_process');
    debugProcess = spawn('node', ['--inspect-brk=9229', filePath]);

    debugProcess.stderr.on('data', (data) => {
      const str = data.toString();
      if (str.includes('Debugger listening on')) {
        const match = str.match(/ws:\/\/127\.0\.0\.1:9229\/[a-f0-9-]+/);
        if (match) connectToDebugger(match[0], event, breakpoints);
      }
    });

    debugProcess.on('exit', () => {
      debugProcess = null;
      if (debugWs) debugWs.close();
      event.sender.send('debug:resumed');
    });
    return { success: true };
  });

  ipcMain.handle('debug:step', () => {
    if (debugWs) debugWs.send(JSON.stringify({ id: 10, method: 'Debugger.stepInto' }));
  });

  ipcMain.handle('debug:continue', () => {
    if (debugWs) debugWs.send(JSON.stringify({ id: 11, method: 'Debugger.resume' }));
  });

  ipcMain.handle('debug:stop', () => {
    if (debugProcess) debugProcess.kill();
  });

  ipcMain.handle('file-lint', async (event, filePath) => {
    try {
      const { execSync } = require('child_process');
      const projectPath = path.dirname(filePath); // Or workspace root
      
      // Cerchiamo di eseguire eslint locale o globale
      let cmd = `npx eslint "${filePath}" --format json`;
      
      try {
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return { success: true, problems: JSON.parse(output) };
      } catch (err) {
        // ESLint esce con codice 1 se trova errori, ma l'output è comunque valido JSON in stdout
        if (err.stdout) {
          try {
            return { success: true, problems: JSON.parse(err.stdout) };
          } catch (e) {
            return { success: false, error: "Failed to parse linter output" };
          }
        }
        return { success: false, error: err.message };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-active-ports', async () => {
    try {
      const { execSync } = require('child_process');
      const cmd = process.platform === 'win32' 
        ? 'netstat -ano' 
        : 'lsof -i -P -n | grep LISTEN';
      
      const output = execSync(cmd, { encoding: 'utf8' });
      const lines = output.split('\n');
      const ports = [];

      if (process.platform === 'win32') {
        // Formato:  TCP    127.0.0.1:5000         0.0.0.0:0              LISTENING       24816
        lines.forEach(line => {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              const addr = parts[1];
              const port = addr.split(':').pop();
              const pid = parts[4];
              ports.push({ protocol: parts[0], address: addr, port, pid });
            }
          }
        });
      } else {
        // Formato lsof: node  34512 user  13u  IPv6 0x...      0t0  TCP *:5000 (LISTEN)
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 9) {
            const pid = parts[1];
            const name = parts[0];
            const addr = parts[8];
            const port = addr.split(':').pop();
            ports.push({ protocol: 'TCP', address: addr, port, pid, name });
          }
        });
      }

      // Rimuoviamo duplicati di porte identiche per PIDs diversi (accade su Windows)
      const uniquePorts = Array.from(new Set(ports.map(p => p.port)))
        .map(port => ports.find(p => p.port === port));

      return { success: true, ports: uniquePorts };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('kill-process', async (event, pid) => {
    try {
      const { execSync } = require('child_process');
      const cmd = process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
      execSync(cmd);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });


  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.on('window-control', (event, action) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w) return;
    if (action === 'minimize') w.minimize();
    else if (action === 'maximize') {
      if (w.isMaximized()) w.unmaximize();
      else w.maximize();
    } else if (action === 'close') w.close();
  });

  ipcMain.on('open-devtools', (event) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (w) w.webContents.openDevTools();
  });

  ipcMain.on('quit-and-install', () => autoUpdater.quitAndInstall());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
