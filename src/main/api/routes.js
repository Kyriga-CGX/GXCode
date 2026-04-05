const { 
    loadPersistedData, 
    savePersistedData, 
    deletePersistedData 
} = require('../services/persistence');
const path = require('path');
const fs = require('fs');

function registerRoutes(apiApp, mainWindow) {
    // ---- MOCK DATA & PERSISTENCE ----
    let mcpServers = [];
    let marketplaceAgents = [
        { id: 1, name: "Junior React Developer", description: "Creazione rapida di UI...", slug: "react-ui-agent" },
        { id: 2, name: "Senior Python Engineer", description: "Esperto in manipolazione dati...", slug: "python-backend-agent" },
        { id: 3, name: "Database Architect", description: "Analizza schemi database...", slug: "sql-architect-agent" },
        { id: 4, name: "Code Reviewer & Security", description: "Security review complete...", slug: "reviewer-agent" },
        { id: 5, name: "DevOps & Cloud Engineer", description: "Docker e Cloud setup...", slug: "devops-agent" }
    ];
    let marketplaceSkills = [{ id: 1, name: "Marketplace Skill", description: "Skill dal marketplace", slug: "marketplace-skill" }];
    let customRepos = [{ id: 1, name: "Default Repo", url: "https://example.com", slug: "default-repo" }];
    let settings = [];
    let discoveredRegistry = { agents: [], skills: [] };

    // ---- ENDPOINTS ----
    apiApp.get("/api/skills", (req, res) => res.json(loadPersistedData('skills')));
    
    apiApp.post("/api/skills", (req, res) => {
      const body = req.body;
      const disk = loadPersistedData('skills');
      const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
      const existing = disk.find(s => s.slug === slug || s.name === body.name);
      if (existing) return res.status(200).json(existing);

      const skill = { ...body, id: Date.now(), slug, isInstalled: true };
      savePersistedData('skills', skill);
      res.status(201).json(skill);
    });

    apiApp.get("/api/agents", (req, res) => res.json(loadPersistedData('agents')));
    
    apiApp.post("/api/agents", (req, res) => {
        const body = req.body;
        const disk = loadPersistedData('agents');
        const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
        const existing = disk.find(a => a.slug === slug || a.name === body.name);
        if (existing) return res.status(200).json(existing);

        const agent = { ...body, id: Date.now(), slug, isInstalled: true };
        savePersistedData('agents', agent);
        res.status(201).json(agent);
    });

    apiApp.get("/api/issues", async (req, res) => {
        const { url, token } = req.query;
        if (!url || !token) return res.json([]);
        try {
            const fields = "idReadable,summary,description,project(name),priority(name),state(name),assignee(fullName),tags(name,color(id,background,foreground)),links(direction,issue(idReadable,summary)),customFields(name,value(name,text,id))";
            const response = await fetch(`${url.replace(/\/$/, '')}/api/issues?fields=${fields}&$top=100`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await response.json();
            if (!Array.isArray(data)) return res.json([]);
            res.json(data.map(i => ({ id: i.idReadable, name: i.summary, status: i.state?.name })));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Marketplace Search & Installation
    apiApp.get("/api/marketplace/search", async (req, res) => {
        const { q, type } = req.query;
        // Logic will be simplified for this export but keep the core functionality
        res.json([]); 
    });

    apiApp.get("/api/settings", (req, res) => res.json(settings));

    apiApp.get("/gemini/callback", async (req, res) => {
        res.send("<h1>Auth Success</h1><script>setTimeout(() => window.close(), 2000);</script>");
    });
}

module.exports = { registerRoutes };
