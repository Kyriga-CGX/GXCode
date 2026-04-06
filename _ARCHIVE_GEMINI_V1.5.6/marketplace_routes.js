const { loadPersistedData, savePersistedData, getActiveAiPath } = require('../../services/persistence');
const fs = require('fs');
const path = require('path');

// --- DATA ARRAYS (Restored from Monolith) ---
let marketplaceAgents = [
    { 
        id: 'deep-1', 
        name: "DeepNLP Architect", 
        category: "Architecture", 
        description: "Progetta sistemi AI complessi usando le API e gli embedding di DeepNLP.org.", 
        source: "DeepNLP", 
        author: "DeepNLP Team", 
        version: "v2.3.1", 
        isInstalled: false,
        systemPrompt: "Sei un DeepNLP Architect esperto in sistemi distribuiti e AI."
    },
    { 
        id: 'hf-1', 
        name: "HuggingFace Engineer", 
        category: "ML/AI", 
        description: "Selezione, fine-tuning e deploy di modelli LLM dall'ecosistema HuggingFace.", 
        source: "HF Hub", 
        author: "HuggingFace", 
        version: "v1.9.0", 
        isInstalled: false,
        systemPrompt: "Sei un HuggingFace Engineer. Conosci ogni modello su HF Hub."
    },
    { 
        id: 'agensi-1', 
        name: "Agensi Coder Pro", 
        category: "Coding", 
        description: "Agente ottimizzato per il formato SKILL.md, refactoring avanzato e coding estremo.", 
        source: "Agensi", 
        author: "Agensi.ai", 
        version: "v3.1.0", 
        isInstalled: false,
        systemPrompt: "Sei Agensi Coder Pro, un agente di elite per lo sviluppo software professionale."
    }
];

const offlineMockPlugins = [
    { id: 991, slug: "prettier", name: "Prettier", description: "Formatta il codice automaticamente.", version: "3.2.0", author: "Prettier Core" },
    { id: 992, slug: "eslint", name: "ESLint", description: "Strumento di analisi statica per correggere problemi nel codice JS/TS.", version: "8.50.0", author: "JS Foundation" }
];

const offlineMockSkills = [
    { id: 101, slug: "langchain-core", name: "LangChain Core", description: "Core framework for developing applications powered by language models.", source: "skills.sh" },
    { id: 102, slug: "openai-api", name: "OpenAI API Client", description: "Interfaccia nativa per richiamare GPT-4 e vision.", source: "skills.sh" }
];

let discoveredRegistry = { agents: [], skills: [] };
const GX_REGISTRY_URL = 'https://raw.githubusercontent.com/GXCode-IDE/gx-registry/main/marketplace.json';
const SKILLS_SH_URL = 'https://skills.sh/marketplace.json';

// --- LIVE AGGREGATOR ENGINE (v6.0 Restored) ---
const fetchLiveMarketplace = async (type, q, category, customRegs = []) => {
    const now = Date.now();
    const results = [];
    const seen = new Set();

    const addItem = (item) => {
        const key = `${item.source || 'local'}-${item.name}-${item.slug || ''}`;
        if (!seen.has(key)) { 
            seen.add(key); 
            results.push({ ...item, discoveredAt: now, isInstalled: false }); 
        }
    };

    // 1. Registries (GX + Skills.sh + Custom)
    const allRegs = [GX_REGISTRY_URL, SKILLS_SH_URL, ...customRegs].filter(Boolean);
    for (const regUrl of allRegs) {
        try {
            const resp = await fetch(regUrl, { signal: AbortSignal.timeout(4000) });
            if (resp.ok) {
                const data = await resp.json();
                const items = data[type] || [];
                items.forEach(item => addItem({ ...item, source: regUrl.includes('skills.sh') ? 'skills.sh' : item.source }));
            }
        } catch (e) { console.warn(`[REGISTRY] ${regUrl} offline.`); }
    }

    // 2. Apify Store (Agents)
    if (type === 'agents') {
        try {
            const searchQ = q || (category !== 'all' ? category : 'automation');
            const resp = await fetch(`https://api.apify.com/v2/store?limit=15&search=${encodeURIComponent(searchQ)}&sortBy=popularity`);
            if (resp.ok) {
                const data = await resp.json();
                (data.data?.items || []).forEach(actor => addItem({
                    id: `apify-${actor.id}`, name: actor.title || actor.name, category: 'Automation',
                    description: actor.description || `Agent by ${actor.username}`, source: 'Apify Store', author: actor.username
                }));
            }
        } catch (e) { }
    }

    // 3. HuggingFace (Agents/Skills)
    try {
        const hfType = type === 'agents' ? 'spaces' : 'models';
        const hfUrl = `https://huggingface.co/api/${hfType}?limit=15&sort=likes${q ? `&search=${encodeURIComponent(q)}` : ''}`;
        const resp = await fetch(hfUrl);
        if (resp.ok) {
            const data = await resp.json();
            data.forEach(item => {
                const name = item.id?.split('/').pop() || item.id;
                addItem({
                    id: `hf-${item.id?.replace(/\//g, '-')}`, name, category: 'AI/ML',
                    description: `HuggingFace ${hfType} by ${item.author}`, source: 'HuggingFace', author: item.author
                });
            });
        }
    } catch (e) { }

    // 4. npm Registry (Skills)
    if (type === 'skills') {
        try {
            const npmSearch = q ? encodeURIComponent(q) : 'ai-agent-skill';
            const resp = await fetch(`https://registry.npmjs.org/-/v1/search?text=${npmSearch}&size=10`);
            if (resp.ok) {
                const data = await resp.json();
                (data.objects || []).forEach(pkg => addItem({
                    id: `npm-${pkg.package.name}`, name: pkg.package.name, category: 'npm Package',
                    description: pkg.package.description, source: 'npm Registry', author: pkg.package.publisher?.username || 'Community'
                }));
            }
        } catch (e) { }
    }

    return results;
};

function registerMarketplaceRoutes(apiApp) {
    apiApp.get("/api/marketplace/search", async (req, res) => {
        const { q, type, category, registries } = req.query;
        const searchTerm = (q || '').toLowerCase();
        const searchCat = (category || 'all').toLowerCase();
        const customRegs = registries ? registries.split(',') : [];

        const localResults = {
            agents: marketplaceAgents,
            skills: offlineMockSkills,
            addons: []
        };

        if (type === 'addons') {
            try {
                const vsxUrl = `https://open-vsx.org/api/-/search?q=${encodeURIComponent(searchTerm || 'theme')}&size=30`;
                const resp = await fetch(vsxUrl, { headers: { 'User-Agent': 'GXCode-IDE' } });
                const json = await resp.json();
                localResults.addons = json.extensions.map(ext => ({
                    id: `${ext.namespace}.${ext.name}`, name: ext.displayName || ext.name, author: ext.namespace,
                    category: "IDE Addon", description: ext.description || "Nessuna descrizione.", source: "Open VSX"
                }));
            } catch (e) { localResults.addons = offlineMockPlugins; }
        }

        const liveAdditions = (type !== 'addons') ? await fetchLiveMarketplace(type, searchTerm, searchCat, customRegs) : [];
        let finalItems = [...(localResults[type] || []), ...liveAdditions];

        // Sync with disk
        const diskAgents = loadPersistedData('agents');
        const diskSkills = loadPersistedData('skills');
        const diskPlugins = loadPersistedData('plugins');

        finalItems = finalItems.map(item => {
            let isInstalled = false;
            if (type === 'agents') isInstalled = diskAgents.some(a => String(a.id) === String(item.id) || a.slug === item.slug);
            else if (type === 'skills') isInstalled = diskSkills.some(s => String(s.id) === String(item.id) || s.slug === item.slug);
            else if (type === 'addons') isInstalled = diskPlugins.some(p => String(p.id) === String(item.id) || p.slug === item.slug);
            return { ...item, isInstalled };
        });

        if (searchTerm) {
            finalItems = finalItems.filter(i => i.name.toLowerCase().includes(searchTerm) || (i.description && i.description.toLowerCase().includes(searchTerm)));
        }

        res.json(finalItems);
    });

    apiApp.get("/api/marketplace-agents", (req, res) => res.json(marketplaceAgents));
    apiApp.get("/api/plugins", (req, res) => res.json(offlineMockPlugins));

    apiApp.post("/api/marketplace/publish", (req, res) => {
        const { item } = req.body;
        const exportPath = path.join(process.cwd(), '.gxcode', 'exports');
        if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });
        const filePath = path.join(exportPath, `${item.name.toLowerCase().replace(/\s+/g, '-')}.json`);
        fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
        res.json({ success: true, message: `Exported to ${filePath}` });
    });

    // --- INSTALLATION HANDLERS ---
    apiApp.patch("/api/marketplace-agents/:id", (req, res) => {
        const item = req.body;
        savePersistedData('agents', item);
        res.json({ success: true, item });
    });

    apiApp.patch("/api/marketplace-skills/:id", (req, res) => {
        const item = req.body;
        savePersistedData('skills', item);
        res.json({ success: true, item });
    });

    apiApp.patch("/api/plugins/:id", (req, res) => {
        const item = req.body;
        savePersistedData('plugins', item);
        res.json({ success: true, item });
    });
}

module.exports = { registerMarketplaceRoutes };


module.exports = { registerMarketplaceRoutes };
