const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

function registerExternalRoutes(apiApp, GOOGLE_CONFIG) {
    let mcpServers = [];

    apiApp.get("/api/issues", async (req, res) => {
        const { url, token, query } = req.query;
        if (!url || !token) return res.json([]);

        try {
            const fields = "idReadable,summary,description,project(name),priority(name),state(name),assignee(fullName),tags(name,color(id,background,foreground)),links(direction,issue(idReadable,summary)),customFields(name,value(name,text,id))";
            const queryParam = query ? `&query=${encodeURIComponent(query)}` : '';
            const response = await fetch(`${url.replace(/\/$/, '')}/api/issues?fields=${fields}&$top=100${queryParam}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'User-Agent': 'GXCode-IDE'
                }
            });

            if (!response.ok) throw new Error(`YouTrack Error: ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data)) return res.json([]);

            const formatted = data.map(issue => {
                const sprintField = issue.customFields?.find(f => f.name.toLowerCase() === 'sprint');
                return {
                    id: issue.idReadable,
                    name: issue.summary,
                    description: issue.description || '',
                    project: issue.project?.name || 'Unknown',
                    priority: issue.priority?.name || 'Normal',
                    status: issue.state?.name || 'Open',
                    assignee: issue.assignee?.fullName || null,
                    tags: issue.tags?.map(t => ({
                        name: t.name,
                        color: t.color?.id || '1',
                        background: t.color?.background,
                        foreground: t.color?.foreground
                    })) || [],
                    links: issue.links?.filter(l => l.issue).map(l => ({
                        direction: l.direction,
                        id: l.issue.idReadable,
                        summary: l.issue.summary
                    })) || [],
                    sprint: sprintField?.value?.name || sprintField?.value?.text || null,
                    rawUrl: `${url.replace(/\/$/, '')}/issue/${issue.idReadable}`
                };
            });
            res.json(formatted);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    apiApp.get("/api/mcp-servers", (req, res) => res.json(mcpServers));

    apiApp.post("/api/mcp-servers", (req, res) => {
        if (Array.isArray(req.body)) {
            mcpServers = req.body;
            res.json({ success: true, count: mcpServers.length });
        } else {
            res.status(400).json({ error: "Invalid data" });
        }
    });

    apiApp.post("/api/youtrack/test", async (req, res) => {
        const { url, token } = req.body;
        if (!url || !token) return res.status(400).json({ error: "URL e token obbligatori" });
        const baseUrl = url.replace(/\/mcp\/?$/, '').replace(/\/$/, '');
        try {
            const response = await fetch(`${baseUrl}/api/users/me?fields=fullName,login`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const text = await response.text();
                return res.status(response.status).json({ error: `YouTrack error ${response.status}: ${text}` });
            }
            const user = await response.json();
            res.json({ success: true, fullName: user.fullName || user.login || 'Utente', baseUrl });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    apiApp.post("/api/youtrack/configure-mcp", (req, res) => {
        const { url, token } = req.body;
        if (!url || !token) {
            return res.status(400).json({ error: "URL e token sono obbligatori" });
        }
        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        try {
            let settings = {};
            if (fs.existsSync(claudeSettingsPath)) {
                try { settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8')); } catch (_) {}
            }
            const mcpUrl = url.replace(/\/$/, '') + '/mcp';
            settings.mcpServers = settings.mcpServers || {};
            settings.mcpServers.youtrack = {
                type: 'http',
                url: mcpUrl,
                headers: { Authorization: `Bearer ${token}` }
            };
            fs.writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
            res.json({ success: true, mcpUrl });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    apiApp.post("/api/mcp/proxy", async (req, res) => {
        const { url, tool, arguments: args } = req.body;
        try {
            const resp = await fetch(`${url.replace(/\/$/, '')}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool, arguments: args })
            });
            const result = await resp.json();
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    apiApp.get("/gemini/callback", async (req, res) => {
        const code = req.query.code;
        if (!code) return res.status(400).send("No code");

        try {
            // 1. Exchange code for tokens
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

            // 2. Fetch profile info
            const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const profile = await profileRes.json();
            
            const wins = BrowserWindow.getAllWindows();
            if (wins.length > 0) {
                wins[0].webContents.send('gemini:auth-success', { 
                    code: tokens.access_token,
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
            res.status(500).send("Errore autenticazione: " + err.message);
        }
    });
}

module.exports = { registerExternalRoutes };
