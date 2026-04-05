const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');
const https = require('https');

// --- CONFIGURATION ---
const PORT = 9999;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = 'https://www.googleapis.com/auth/cloud-platform'; 

const SESSION_FILE = path.join(__dirname, '..', '..', '.gxcode', 'gemini-session.json');

/**
 * Gemini Elite CLI - Unified Edition (OAuth PRO + API Key Fallback)
 */

const state = {
    token: null,
    refreshToken: null,
    expiresAt: null,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    activeModel: 'gemini-flash-latest',
    workspace: process.cwd(),
    codeVerifier: null
};

// --- PKCE HELPERS ---
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function start() {
    process.stdout.write("\x1b[2J\x1b[0;0H"); // Clear screen
    console.log("\x1b[35m%s\x1b[0m", "--- GXCODE GEMINI ELITE (PRO EDITION) ---");
    
    if (loadSession()) {
        const isApiKey = state.token && state.token.startsWith('AIza');
        console.log(`\x1b[32mSessione caricata con successo. Modalità: ${isApiKey ? 'API KEY' : 'OAUTH'}\x1b[0m`);
        
        // Se è OAUTH e il token è scaduto, prova il refresh
        if (!isApiKey && state.expiresAt && Date.now() > state.expiresAt) {
            console.log("\x1b[33mToken scaduto. Tentativo di rinnovo...\x1b[0m");
            const refreshed = await refreshToken();
            if (!refreshed) {
                console.log("\x1b[31mImpossibile rinnovare la sessione. Effettua un nuovo login.\x1b[0m");
                return await setupAndLogin();
            }
        }
        startREPL();
    } else {
        await setupAndLogin();
    }
}

function loadSession() {
    if (fs.existsSync(SESSION_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            state.token = (data.token || '').trim();
            state.refreshToken = data.refreshToken;
            state.expiresAt = data.expiresAt;
            state.clientId = data.clientId || state.clientId;
            state.clientSecret = data.clientSecret || state.clientSecret;
            return !!state.token;
        } catch (e) { return false; }
    }
    return false;
}

function saveSession(data) {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const existing = fs.existsSync(SESSION_FILE) ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) : {};
    const updated = { ...existing, ...state, ...data, date: new Date().toISOString() };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(updated, null, 2));
}

async function setupAndLogin() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    console.log("\n\x1b[1;34mCONTROLLO ACCESSO PRO\x1b[0m");
    console.log("Seleziona il metodo di accesso:");
    console.log("1. \x1b[33mLogin con Google (OAuth)\x1b[0m - Consigliato per utenti Pro/Advanced");
    console.log("2. \x1b[33mUsa API Key\x1b[0m - Alternativo per Google AI Studio");
    
    const choice = await new Promise(r => rl.question('\nScegli un opzione (1/2) > ', r));
    
    if (choice === '2') {
        const key = (await new Promise(r => rl.question('Inserisci la Gemini API Key > ', r))).trim();
        if (key && key.startsWith('AIza')) {
            state.token = key;
            saveSession({ token: key });
            console.log("\x1b[32mChiave salvata!\x1b[0m\n");
            rl.close();
            startREPL();
            return;
        } else {
            console.log("\x1b[31mChiave non valida.\x1b[0m");
        }
    }

    // Default: OAuth
    rl.close();
    await performOAuth();
}

async function performOAuth() {
    state.codeVerifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(state.codeVerifier);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${state.clientId}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `code_challenge=${challenge}&` +
        `code_challenge_method=S256&` +
        `access_type=offline&` +
        `prompt=consent`;

    console.log("\n\x1b[1mApro il browser per l'autenticazione Pro...\x1b[0m");
    const opener = process.platform === 'win32' ? 'cmd /c start ""' : 'open';
    exec(`${opener} "${authUrl}"`);
    console.log("\x1b[34m%s\x1b[0m", authUrl);

    const server = http.createServer(async (req, res) => {
        if (req.url.startsWith('/callback')) {
            const url = new URL(req.url, `http://localhost:${PORT}`);
            const code = url.searchParams.get('code');

            if (code) {
                res.end("<html><body style='background:#06080a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;'><div><h1>Login Effettuato!</h1><p>Ora il terminale ti riconoscerà come utente Pro.</p></div></body></html>");
                console.log("\x1b[32mCodice ricevuto. Collegamento al profilo Pro in corso...\x1b[0m");
                
                try {
                    const tokenData = await exchangeCodeForToken(code);
                    state.token = tokenData.access_token;
                    state.refreshToken = tokenData.refresh_token;
                    state.expiresAt = Date.now() + (tokenData.expires_in * 1000);
                    
                    saveSession({ 
                        token: state.token, 
                        refreshToken: state.refreshToken,
                        expiresAt: state.expiresAt
                    });
                    
                    console.log("\x1b[1;32mAccesso Pro confermato! Benvenuto.\x1b[0m\n");
                    server.close();
                    startREPL();
                } catch (err) {
                    console.error("\x1b[31mErrore autenticazione:\x1b[0m", err.message);
                    res.end("Errore durante l'autenticazione. Controlla il terminale.");
                }
            }
        }
    }).listen(PORT);
}

async function exchangeCodeForToken(code) {
    const data = `code=${code}&` +
        `client_id=${state.clientId}&` +
        `client_secret=${state.clientSecret}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `grant_type=authorization_code&` +
        `code_verifier=${state.codeVerifier}`;

    return exchangeToken(data);
}

async function refreshToken() {
    if (!state.refreshToken) return false;

    const data = `client_id=${state.clientId}&` +
        `client_secret=${state.clientSecret}&` +
        `refresh_token=${state.refreshToken}&` +
        `grant_type=refresh_token`;

    try {
        const tokenData = await exchangeToken(data);
        state.token = tokenData.access_token;
        state.expiresAt = Date.now() + (tokenData.expires_in * 1000);
        saveSession({ 
            token: state.token, 
            expiresAt: state.expiresAt
        });
        return true;
    } catch (e) {
        console.error("Errore rinnovo sessione:", e.message);
        return false;
    }
}

async function exchangeToken(postData) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    return reject(new Error("Errore parsing risposta token: " + body));
                }
                
                if (data.error) {
                    const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                    const desc = data.error_description || "";
                    reject(new Error(`${msg} ${desc}`));
                } else {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

const toolHandlers = {
    list_files: async ({ directory }) => {
        const dir = directory || '.';
        const fullDir = path.resolve(state.workspace, dir);
        if (!fs.existsSync(fullDir)) return `Errore: Cartella ${dir} non trovata.`;
        return fs.readdirSync(fullDir).join('\n');
    },
    read_file: async ({ path: filePath }) => {
        const fullPath = path.resolve(state.workspace, filePath);
        if (!fs.existsSync(fullPath)) return `Errore: File ${filePath} non trovato.`;
        return fs.readFileSync(fullPath, 'utf8');
    },
    write_file: async ({ path: filePath, content }) => {
        const fullPath = path.resolve(state.workspace, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content);
        return `File ${filePath} scritto con successo.`;
    },
    execute_command: async ({ command }) => {
        return new Promise((r) => {
            exec(command, { cwd: state.workspace }, (err, stdout, stderr) => {
                r(stdout || stderr || (err ? err.message : "Comando eseguito."));
            });
        });
    }
};

async function callAgent(messages) {
    const isApiKey = state.token && state.token.startsWith('AIza');
    const headers = { 'Content-Type': 'application/json' };
    
    let url;
    if (isApiKey) {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${state.activeModel}:generateContent?key=${state.token}`;
    } else {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${state.activeModel}:generateContent`;
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    const payload = JSON.stringify({
        contents: messages,
        tools: [{
            function_declarations: [
                { name: "list_files", description: "Elenca file nel progetto", parameters: { type: "object", properties: { directory: { type: "string" } } } },
                { name: "read_file", description: "Leggi contenuto file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
                { name: "write_file", description: "Scrivi/Crea file", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
                { name: "execute_command", description: "Esegui comando shell", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } }
            ]
        }],
        tool_config: { function_calling_config: { mode: "AUTO" } }
    });

    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'POST', headers }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', async () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) { return reject(new Error("Errore parsing risposta server.")); }

                if (data.error) {
                    if (data.error.message.includes("quota")) {
                        return reject(new Error("Quota superata. Se sei Pro, verifica di aver abilitato le API nel Cloud Console del progetto."));
                    }
                    return reject(new Error(data.error.message));
                }
                
                if (!data.candidates || data.candidates.length === 0) {
                    return reject(new Error("Nessuna risposta ricevuta."));
                }

                const part = data.candidates[0].content.parts[0];
                if (part.functionCall) {
                    const { name, args } = part.functionCall;
                    console.log(`\x1b[33m[AGENT]\x1b[0m Eseguo: ${name}`);
                    const result = await toolHandlers[name](args);
                    
                    const nextMessages = [
                        ...messages,
                        data.candidates[0].content,
                        { role: "function", parts: [{ functionResponse: { name, response: { content: result } } }] }
                    ];
                    
                    // Piccola pausa per non bruciare la quota
                    await new Promise(r => setTimeout(r, 2000));
                    return resolve(await callAgent(nextMessages));
                }
                resolve(part.text);
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function startREPL() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const messages = [];

    console.log("\x1b[35mPronto per i tuoi comandi. Digita 'exit' per uscire.\x1b[0m");

    const ask = () => {
        rl.question('\n\x1b[1;32mgx-gemini >\x1b[0m ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                rl.close();
                process.exit(0);
            }
            
            process.stdout.write("\x1b[2mSto pensando...\x1b[0m");
            messages.push({ role: 'user', parts: [{ text: input }] });
            
            try {
                const response = await callAgent(messages);
                messages.push({ role: 'model', parts: [{ text: response }] });
                process.stdout.write("\r\x1b[K"); // Clear the thinking line
                console.log(response);
            } catch (err) {
                process.stdout.write("\r\x1b[K");
                console.error("\x1b[31mERRORE >\x1b[0m", err.message);
            }
            ask();
        });
    };
    ask();
}

start();
