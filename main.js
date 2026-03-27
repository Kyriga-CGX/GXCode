// main.js
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { exec } = require("child_process");
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
  // Uniamo quelli creati su disco (dinamici per cartella) e i classici (se servono)
  res.json([...diskSkills, ...skills]);
});

apiApp.post("/api/skills", (req, res) => {
  const body = req.body;
  const newId = skills.length ? Math.max(...skills.map((s) => s.id)) + 100 : Math.floor(Math.random() * 100000);
  const skill = {
    id: newId,
    name: body.name,
    description: body.description ?? "",
    content: body.content ?? "",
    category: body.category ?? "general",
    isActive: body.isActive ?? true,
    slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-')
  };
  skills.push(skill);
  savePersistedData('skills', skill); // Salva fisicamente su ~/.claude/skills o simile
  res.status(201).json(skill);
});

apiApp.patch("/api/skills/:id", (req, res) => {
  const id = req.params.id;
  const idx = skills.findIndex((s) => String(s.id) === String(id));
  if (idx !== -1) {
    skills[idx] = { ...skills[idx], ...req.body };
    savePersistedData('skills', skills[idx]); // Aggiorna il file
    return res.json(skills[idx]);
  }
  return res.status(404).send("Skill not found");
});

apiApp.delete("/api/skills/:id", (req, res) => {
  const id = req.params.id;
  skills = skills.filter((s) => String(s.id) !== String(id));
  deletePersistedData('skills', id); // Cancella file fisico
  res.status(204).end();
});

// ---- ENDPOINT AGENTS ----
apiApp.get("/api/agents", (req, res) => {
  const diskAgents = loadPersistedData('agents');
  // Uniamo dischi dinamici e memoria mock
  res.json([...diskAgents, ...agents]);
});

apiApp.post("/api/agents", (req, res) => {
  const body = req.body;
  const newId = agents.length ? Math.max(...agents.map((a) => a.id)) + 100 : Math.floor(Math.random() * 100000);
  const agent = {
    id: newId,
    name: body.name,
    description: body.description ?? "",
    role: body.role ?? "general",
    parentId: body.parentId ?? null,
    avatar: body.avatar ?? "bot",
    skillIds: body.skillIds ?? "[]",
    status: body.status ?? "idle",
    slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-')
  };
  agents.push(agent);
  savePersistedData('agents', agent); // Salva in ~/.<ai>/agents
  res.status(201).json(agent);
});

apiApp.patch("/api/agents/:id", (req, res) => {
  const id = req.params.id;
  const idx = agents.findIndex((a) => String(a.id) === String(id));
  if (idx !== -1) {
    agents[idx] = { ...agents[idx], ...req.body };
    savePersistedData('agents', agents[idx]); // Update file
    return res.json(agents[idx]);
  }
  return res.status(404).send("Agent not found");
});

apiApp.delete("/api/agents/:id", (req, res) => {
  const id = req.params.id;
  agents = agents.filter((a) => String(a.id) !== String(id));
  deletePersistedData('agents', id); // Elimina file
  res.status(204).end();
});

// ---- ENDPOINT TICKETS ----
apiApp.get("/api/tickets", (req, res) => {
  res.json(tickets);   // array (anche se vuoto)
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

// Simulazione di un Live Connector intelligente
const fetchLiveMarketplace = async (type, q, category) => {
  const now = Date.now();
  
  // Ogni chiamata ha una possibilità del 70% di "scoprire" qualcosa di nuovo se il pool non è vuoto
  if (Math.random() > 0.3 && POTENTIAL_DISCOVERIES[type]) {
    const potential = POTENTIAL_DISCOVERIES[type].filter(p => 
      !discoveredRegistry[type].find(d => d.name === p.name)
    );
    
    if (potential.length > 0) {
      const item = potential[Math.floor(Math.random() * potential.length)];
      discoveredRegistry[type].push({
        id: `live-${type}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        name: item.name,
        category: item.category,
        description: item.desc,
        source: item.author,
        author: item.author,
        discoveredAt: now,
        isInstalled: false
      });
      console.log(`[SPY-DISCOVERY] Nuovo elemento scoperto: ${item.name} (${type})`);
    }
  }

  // Restituiamo tutti gli elementi scoperti finora per quel tipo
  return discoveredRegistry[type];
};

// Marketplace Search Aggregator (V5 - Persistent Discovery)
apiApp.get("/api/marketplace/search", async (req, res) => {
  const { q, type, category } = req.query;
  const searchTerm = q ? q.toLowerCase() : '';
  const searchCat = category ? category.toLowerCase() : 'all';
  
  // Base Data (Catalogo di base SEMPRE visibile)
  const localResults = {
    agents: [
      { id: 'deep-1', name: "DeepNLP Architect", category: "Architecture", description: "Design di sistemi complessi basato sulle API di DeepNLP.org.", source: "DeepNLP", author: "DeepNLP Team", isInstalled: false },
      { id: 'agensi-1', name: "Agensi Coder Pro", category: "Coding", description: "Agente ottimizzato per il formato SKILL.md e coding estremo.", source: "Agensi", author: "Agensi.ai", isInstalled: false },
      { id: 'agensi-2', name: "Agensi Python Expert", category: "Coding", description: "Esperto Python specializzato in data science e automazione.", source: "Agensi", author: "Agensi.ai", isInstalled: false },
      { id: 'apify-1', name: "Apify Crawler Agent", category: "Automation", description: "Configura e gestisce crawler Apify per estrazione dati.", source: "Apify", author: "Apify Community", isInstalled: false },
      { id: 'hf-1', name: "HuggingFace Transformer", category: "ML/AI", description: "Selection e fine-tuning di modelli LLM dall'ecosistema HF.", source: "HF Hub", author: "HuggingFace", isInstalled: false },
      { id: 'qa-1', name: "Security Auditor V3", category: "Security", description: "Analisi statica e vulnerabilità OWASP con report dettagliati.", source: "Community", author: "CyberGuard", isInstalled: false },
      { id: 'devops-1', name: "K8s Cluster Master", category: "DevOps", description: "Gestione di cluster Kubernetes e pipeline CI/CD.", source: "GX Hub", author: "CloudOps", isInstalled: false },
      { id: 'integ-1', name: "API Integration Guru", category: "Integration", description: "Specialista in orchestrazione di microservizi.", source: "Superface", author: "Integrator", isInstalled: false }
    ],
    skills: [
      { id: 'os-1', name: "Universal Skill Loader", category: "Automation", description: "Caricatore universale per skill in formato SKILL.md.", source: "OpenSkills", author: "OpenDev", isInstalled: false },
      { id: 'th-1', name: "ToolHub API Pack", category: "Tools", description: "Accesso a 10,000+ API come function tools.", source: "ToolHub", author: "ToolHub.io", isInstalled: false },
      { id: 'sf-1', name: "Superface Hub Connector", category: "Integration", description: "Mapping istantaneo di centinaia di API esterne.", source: "Superface", author: "Superface.ai", isInstalled: false },
      { id: 'cc-1', name: "Coding Standard Skill", category: "Coding", description: "Valida il codice secondo le best practices di CommandCodeAI.", source: "CommandCode", author: "CC Team", isInstalled: false },
      { id: 'mcp-1', name: "Docker Control Skill", category: "DevOps", description: "Integrazione nativa per la gestione di container Docker.", source: "Awesome MCP", author: "MCP Community", isInstalled: false },
      { id: 'sql-1', name: "SQL Optimizer Skill", category: "Tools", description: "Ottimizzazione automatica di query SQL complesse.", source: "DeepNLP", author: "DBA Pro", isInstalled: false }
    ],
    addons: []
  };

  // 1. Simula Fetch/Sync Dinamico (Aggiunge al discoveredRegistry)
  const liveAdditions = (type !== 'addons') ? await fetchLiveMarketplace(type, searchTerm, searchCat) : [];

  // 2. Fetch Live Addons (Open VSX)
  if (type === 'addons') {
    try {
      const url = searchTerm 
          ? `https://open-vsx.org/api/-/search?q=${encodeURIComponent(searchTerm)}&size=30`
          : `https://open-vsx.org/api/-/search?size=20`;
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
  // Uniamo il catalogo locale fisso con le scoperte dinamiche della sessione
  let finalItems = [...(localResults[type] || []), ...liveAdditions];
  
  // Cross-reference con gli elementi già installati su disco
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

  if (searchTerm) {
    finalItems = finalItems.filter(i => 
      i.name.toLowerCase().includes(searchTerm) || 
      (i.description && i.description.toLowerCase().includes(searchTerm))
    );
  }

  if (searchCat !== 'all') {
    finalItems = finalItems.filter(i => 
      i.category && i.category.toLowerCase() === searchCat
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
  console.log(`[SPY-PUBLISH] Richiesta pubblicazione di "${item.name}" su ${targetRepoUrl}`);

  try {
    // Simulazione di una POST a un repository esterno
    // In produzione qui si userebbe fetch(targetRepoUrl, { method: 'POST', body: ... })
    setTimeout(() => {
      res.json({ success: true, message: "Pubblicazione completata con successo!", url: targetRepoUrl });
    }, 2000);
  } catch (err) {
    res.status(500).json({ error: "Errore durante la pubblicazione: " + err.message });
  }
});

apiApp.get("/api/custom-repos", (req, res) => {
  res.json(customRepos);
});

apiApp.get("/api/settings", (req, res) => {
  res.json(settings);
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
}

app.whenReady().then(() => {
  // Handler nativo globale (fuori da whenReady per garanzia di boot)
  ipcMain.handle('open-project-folder', async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
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

  // Nuovo handler per caricare una folder specifica (es. al riavvio per la sessione)
  ipcMain.handle('open-specific-folder', async (event, folderPath) => {
    try {
        if (!fs.existsSync(folderPath)) return null;
        
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

  // Nuovo handler per leggere il contenuto di un file
  ipcMain.handle('read-file', async (event, filePath) => {
    console.log(`[IPC] Richiesta lettura file: ${filePath}`);
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > 1024 * 1024) return "File troppo grande per l'anteprima (Max 1MB).";
        const data = fs.readFileSync(filePath, 'utf-8');
        console.log(`[IPC] File letto con successo: ${filePath.split(path.sep).pop()}`);
        return data;
    } catch(e) {
        console.error(`[IPC] Errore lettura file ${filePath}:`, e.message);
        return `Errore lettura file: ${e.message}`;
    }
  });

  // ---- FILE SYSTEM OPERATIONS (Context Menu) ----
  ipcMain.handle('shell-open-path', async (event, targetPath) => {
    await shell.openPath(targetPath);
    return true;
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

  ipcMain.handle('fs-create-folder', async (event, dirPath, name) => {
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
                    } catch(e) {}
                }
            }
        } catch(e) {}
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
        } catch(e) {}
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
            } catch(e) {
                if (error) reject(new Error('Test fallito'));
                else resolve(true);
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
            } catch(e) {
                if (error) reject(new Error('Esecuzione fallita'));
                else resolve({ success: true });
            }
        });
    });
  });

  // handler per il terminale reale
  ipcMain.handle("execute-command", async (event, cmd) => {

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

  let isUpdateCheckActive = false;

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged || isUpdateCheckActive) return false;
    isUpdateCheckActive = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      isUpdateCheckActive = false;
      return !!result.updateInfo;
    } catch (err) {
      isUpdateCheckActive = false;
      // Se è già in corso un controllo interno di electron-updater, non lanciamo errore
      if (err.message && err.message.includes("Please check update first")) return true;
      return false;
    }
  });

  ipcMain.handle('perform-update', async (event) => {
    if (!app.isPackaged) return false;
    if (isUpdateCheckActive) {
      throw new Error("Verifica aggiornamenti già in corso. Attendi un istante...");
    }
    
    isUpdateCheckActive = true;
    try {
      const checkResult = await autoUpdater.checkForUpdates();
      isUpdateCheckActive = false;
      
      if (checkResult && checkResult.updateInfo) {
        await autoUpdater.downloadUpdate();
        return true;
      } else {
        return false; // Aggiornato
      }
    } catch (err) {
      isUpdateCheckActive = false;
      const msg = err.message || "";
      // Se è già in corso un controllo, proviamo a chiamare downloadUpdate direttamente se possibile
      // o almeno non blocchiamo l'utente con un errore bloccante se sappiamo che sta già caricando.
      if (msg.includes("Please check update first")) {
          try {
             await autoUpdater.downloadUpdate();
             return true;
          } catch(e) { return true; }
      }
      if (msg.includes('No published versions') || msg.includes('latest.yml')) {
        throw new Error("Errore Release: GitHub non contiene i file necessari (latest.yml).");
      }
      throw err;
    }
  });

  autoUpdater.on('update-available', () => {
    win.webContents.send('update-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('download-progress', progressObj.percent);
  });

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-ready-to-install');
  });

  ipcMain.handle('git-status', async () => {
    try {
      const { execSync } = require('child_process');
      const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: process.cwd() });
      const branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: process.cwd() }).trim();
      
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

  ipcMain.handle('git-stage', async (event, filePath) => {
    try {
      const { execSync } = require('child_process');
      execSync(`git add "${filePath}"`, { cwd: process.cwd() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-commit', async (event, message) => {
    try {
      const { execSync } = require('child_process');
      execSync(`git commit -m "${message}"`, { cwd: process.cwd() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-pull', async () => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git pull', { encoding: 'utf8', cwd: process.cwd() });
      return { success: true, output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-push', async () => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git push', { encoding: 'utf8', cwd: process.cwd() });
      return { success: true, output };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- PHASE 3: INTERACTIVE PTY TERMINAL ---
  const ptyProcesses = {};

  ipcMain.handle('terminal-create', (event, id, shellType) => {
    console.log(`[TERMINAL] Requesting new PTY - ID: ${id}, Shell: ${shellType}`);
    let shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    
    // Se l'utente chiede esplicitamente CMD o BASH
    if (shellType === 'cmd' && process.platform === 'win32') {
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
      
      shell = 'bash.exe'; // default fallback in PATH
      for (const p of paths) {
        if (fs.existsSync(p)) {
          shell = p;
          break;
        }
      }
    } else if (shellType === 'bash' && process.platform !== 'win32') {
      shell = 'bash';
    }

    console.log(`[TERMINAL] Selected shell binary: ${shell}`);
    
    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env
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
    if (ptyProcesses[id]) {
      ptyProcesses[id].write(data);
    }
  });

  ipcMain.handle('terminal-resize', (event, id, cols, rows) => {
    if (ptyProcesses[id]) {
      ptyProcesses[id].resize(cols, rows);
    }
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
      
      // Sync Breakpoints
      breakpoints.forEach((bp, index) => {
         debugWs.send(JSON.stringify({
           id: 100 + index,
           method: 'Debugger.setBreakpointByUrl',
           params: {
             lineNumber: bp.line - 1,
             urlRegex: bp.path.replace(/\\/g, '/').replace(/^[a-zA-Z]:/, '') // Cross-platform path matching
           }
         }));
      });

      debugWs.send(JSON.stringify({ id: 3, method: 'Debugger.resume' }));
    });

    debugWs.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Debugger.paused') {
        const line = msg.params.callFrames[0].location.lineNumber + 1;
        console.log('[DEBUGGER] Paused on line:', line);
        event.sender.send('debug:paused', {
          line: line,
          callStack: msg.params.callFrames.map(cf => ({
            functionName: cf.functionName || '(anonymous)',
            location: cf.location
          })),
          variables: [] // TODO: Implement scope fetching
        });
      } else if (msg.method === 'Debugger.resumed') {
        event.sender.send('debug:resumed');
      }
    });

    debugWs.on('close', () => {
      console.log('[DEBUGGER] CDP Disconnected');
    });

    debugWs.on('error', (err) => {
      console.error('[DEBUGGER] CDP Error:', err);
    });
  }

  ipcMain.handle('debug:start', async (event, filePath, breakpoints) => {
    if (debugProcess) debugProcess.kill();
    
    console.log(`[DEBUGGER] Starting debug for: ${filePath}`);
    const { spawn } = require('child_process');
    
    // Spawnamo con --inspect-brk su porta casuale o default
    debugProcess = spawn('node', ['--inspect-brk=9229', filePath]);
    
    debugProcess.stderr.on('data', (data) => {
       const str = data.toString();
       if (str.includes('Debugger listening on')) {
         const match = str.match(/ws:\/\/127\.0\.0\.1:9229\/[a-f0-9-]+/);
         if (match) {
           connectToDebugger(match[0], event, breakpoints);
         }
       }
    });

    debugProcess.on('exit', () => {
      console.log('[DEBUGGER] Process exited');
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

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  // Gestione Finestra (Minimizza, Massimizza, Chiudi)
  ipcMain.on('window-control', (event, action) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w) return;
    if (action === 'minimize') w.minimize();
    else if (action === 'maximize') {
      if (w.isMaximized()) w.unmaximize();
      else w.maximize();
    }
    else if (action === 'close') w.close();
  });

  ipcMain.on('open-devtools', (event) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (w) w.webContents.openDevTools();
  });

  ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
