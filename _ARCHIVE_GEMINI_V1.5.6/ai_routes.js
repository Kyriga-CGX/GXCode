const { loadPersistedData, savePersistedData, deletePersistedData } = require('../../services/persistence');

function registerAiRoutes(apiApp) {
    apiApp.get("/api/skills", (req, res) => {
        const diskSkills = loadPersistedData('skills');
        const unique = [];
        const ids = new Set();
        for (const s of diskSkills) {
            if (!ids.has(String(s.id))) {
                ids.add(String(s.id));
                unique.push(s);
            }
        }
        res.json(unique);
    });

    apiApp.post("/api/skills", (req, res) => {
        const body = req.body;
        const diskSkills = loadPersistedData('skills');
        const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
        const existing = diskSkills.find(s => s.slug === slug || s.name === body.name);
        if (existing) return res.status(200).json(existing);

        const newId = diskSkills.length ? Math.max(...diskSkills.map((s) => s.id)) + 100 : Math.floor(Math.random() * 100000);
        const skill = {
            id: newId,
            name: body.name,
            description: body.description ?? "",
            logic: body.logic ?? body.content ?? "",
            category: body.category ?? "general",
            isActive: body.isActive ?? true,
            slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
            _managedBy: '.GXCODE'
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
        res.status(404).send("Skill not found");
    });

    apiApp.delete("/api/skills/:id", (req, res) => {
        deletePersistedData('skills', req.params.id);
        res.status(204).end();
    });

    apiApp.get("/api/agents", (req, res) => {
        const diskAgents = loadPersistedData('agents');
        const unique = [];
        const ids = new Set();
        for (const a of diskAgents) {
            if (!ids.has(String(a.id))) {
                ids.add(String(a.id));
                unique.push(a);
            }
        }
        res.json(unique);
    });

    apiApp.post("/api/agents", (req, res) => {
        const body = req.body;
        const diskAgents = loadPersistedData('agents');
        const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
        const existing = diskAgents.find(a => a.slug === slug || a.name === body.name);
        if (existing) return res.status(200).json(existing);

        const newId = diskAgents.length ? Math.max(...diskAgents.map((a) => a.id)) + 100 : Math.floor(Math.random() * 100000);
        const agent = {
            ...body,
            id: newId,
            slug,
            _managedBy: '.GXCODE'
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
        res.status(404).send("Agent not found");
    });

    apiApp.delete("/api/agents/:id", (req, res) => {
        deletePersistedData('agents', req.params.id);
        res.status(204).end();
    });
}

module.exports = { registerAiRoutes };
