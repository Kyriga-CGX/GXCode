import { state, setState, subscribe } from '../core/state.js';

/**
 * Tomcat Backend Setup Assistant
 * Gestisce la scoperta dei moduli Java e la configurazione di Tomcat
 */
export const tomcatAssistant = {
    init: () => {
        console.log("[GX-TOMCAT] Assistant Initialized.");
        
        // Sottoscrizione ai cambi di workspace per attivare lo scan
        subscribe((newState, oldState) => {
            if (newState.workspaceData?.path !== oldState?.workspaceData?.path) {
                if (newState.workspaceData?.path) {
                    tomcatAssistant.scanWorkspace();
                }
            }
        });

        // Avvio scan iniziale se già presente
        if (state.workspaceData?.path) {
            tomcatAssistant.scanWorkspace();
        }
    },

    /**
     * Scansiona il workspace alla ricerca di moduli Maven/Gradle
     */
    scanWorkspace: async () => {
        if (!state.workspaceData?.path) return;
        
        console.log("[GX-TOMCAT] Scanning workspace for backend modules...");
        const rootPath = state.workspaceData.path;
        
        try {
            // Utilizziamo l'API FS per cercare file chiave
            // Cerchiamo pom.xml, build.gradle, e cartelle WEB-INF
            const modules = [];
            
            // Funzione ricorsiva semplificata o via shell command per velocità
            // Per ora usiamo un approccio basato su ciò che sappiamo dell'ambiente
            const searchFiles = async (dir, depth = 0) => {
                if (depth > 3) return; // Limite profondità per performance
                
                const result = await window.electronAPI.openSpecificFolder(dir);
                if (!result || !result.files) return;

                let isModule = false;
                let moduleType = null;

                for (const file of result.files) {
                    if (file.name === 'pom.xml') {
                        isModule = true;
                        moduleType = 'maven';
                    } else if (file.name === 'build.gradle' || file.name === 'build.gradle.kts') {
                        isModule = true;
                        moduleType = 'gradle';
                    }
                    
                    if (file.type === 'directory') {
                        // Se troviamo WEB-INF, è quasi certamente un modulo web
                        if (file.name === 'WEB-INF' || file.name === 'webapp') {
                            isModule = true;
                        }
                        
                        // Evitiamo di scansionare cartelle giganti o inutili
                        if (!['node_modules', '.git', 'target', 'build', '.gradle'].includes(file.name)) {
                            await searchFiles(file.path, depth + 1);
                        }
                    }
                }

                if (isModule) {
                    const moduleName = dir.split(/[\\/]/).pop() || 'root';
                    // Evitiamo duplicati
                    if (!modules.find(m => m.path === dir)) {
                        modules.push({
                            id: btoa(dir).substring(0, 12),
                            name: moduleName,
                            path: dir,
                            type: moduleType || 'java-web'
                        });
                    }
                }
            };

            await searchFiles(rootPath);
            
            console.log(`[GX-TOMCAT] Found ${modules.length} modules:`, modules);

            // Collassiamo tutto in un unico setState per evitare doppio re-render
            const nextActiveId = (modules.length === 1 && !state.activeModuleId) ? modules[0].id : state.activeModuleId;
            setState({ detectedModules: modules, activeModuleId: nextActiveId });

        } catch (err) {
            console.error("[GX-TOMCAT] Scan Error:", err);
        }
    },

    /**
     * Carica la configurazione specifica di un modulo
     */
    getModuleConfig: async (modulePath) => {
        const configPath = `${modulePath}/.gxcode/modules/tomcat.json`.replace(/\/\//g, '/');
        try {
            const content = await window.electronAPI.readFile(configPath);
            return JSON.parse(content);
        } catch (err) {
            // Se non esiste, restituiamo i default
            return {
                enabled: false,
                tomcatHome: '',
                httpPort: 8080,
                contextPath: '/' + (modulePath.split(/[\\/]/).pop() || ''),
                artifactType: 'war',
                artifactPath: 'target/*.war',
                buildCommand: 'mvn clean package -DskipTests',
                startCommand: '',
                stopCommand: '',
                logsPath: 'logs/catalina.out',
                healthCheckUrl: ''
            };
        }
    },

    /**
     * Salva la configurazione specifica di un modulo
     */
    saveModuleConfig: async (modulePath, config) => {
        const configDir = `${modulePath}/.gxcode/modules`.replace(/\/\//g, '/');
        const configPath = `${configDir}/tomcat.json`;
        
        try {
            // Assicuriamoci che la cartella esista
            await window.electronAPI.fsCreateFolder(modulePath, '.gxcode');
            await window.electronAPI.fsCreateFolder(`${modulePath}/.gxcode`, 'modules');
            
            const content = JSON.stringify(config, null, 2);
            
            if (window.electronAPI.fsWriteFile) {
                await window.electronAPI.fsWriteFile(configPath, content);
            } else {
                throw new Error("API fsWriteFile non disponibile nel bridge.");
            }
            
            window.gxToast?.("Configurazione Tomcat salvata!", "success");
        } catch (err) {
            console.error("[GX-TOMCAT] Save Error:", err);
            window.gxToast?.("Errore salvataggio: " + err.message, "error");
        }
    },

    /**
     * Crea un modulo manuale se non rilevato
     */
    createManualModule: async () => {
        if (!state.workspaceData?.path) return null;
        
        const rootPath = state.workspaceData.path;
        const moduleName = rootPath.split(/[\\/]/).pop() || 'manual-project';
        
        const manualModule = {
            id: 'manual-' + Date.now().toString(36),
            name: moduleName + ' (Manuale)',
            path: rootPath,
            type: 'manual'
        };

        const currentModules = state.detectedModules || [];
        if (!currentModules.find(m => m.path === rootPath)) {
            const newModules = [...currentModules, manualModule];
            setState({ 
                detectedModules: newModules, 
                activeModuleId: manualModule.id 
            });
            return manualModule;
        }
        return currentModules.find(m => m.path === rootPath);
    },

    /**
     * Esegue un'azione (build, start, stop, etc)
     */
    runAction: async (module, actionType) => {
        const config = await tomcatAssistant.getModuleConfig(module.path);
        if (!config) return;

        let cmd = "";
        let label = "";

        switch (actionType) {
            case 'build':
                cmd = config.buildCommand;
                label = `BUILD ${module.name}`;
                break;
            case 'start':
                // Esempio: catalina.bat run con CATALINA_HOME impostato
                const env = `set "CATALINA_HOME=${config.tomcatHome}" && `;
                const startCmd = config.startCommand || `"${config.tomcatHome}/bin/catalina.bat" run`;
                cmd = `${env} ${startCmd}`;
                label = `TOMCAT START (${module.name})`;
                break;
            case 'stop':
                const stopEnv = `set "CATALINA_HOME=${config.tomcatHome}" && `;
                const stopCmd = config.stopCommand || `"${config.tomcatHome}/bin/catalina.bat" stop`;
                cmd = `${stopEnv} ${stopCmd}`;
                label = `TOMCAT STOP (${module.name})`;
                break;
            case 'logs':
                cmd = `powershell -Command "Get-Content -Path '${config.tomcatHome}/${config.logsPath}' -Wait -Tail 100"`;
                label = `LOGS ${module.name}`;
                break;
        }

        if (cmd) {
            console.log(`[GX-TOMCAT] Running ${actionType}: ${cmd}`);
            // Creiamo un terminale dedicato se necessario o usiamo quello attivo
            if (window.createTerminal) {
                const termId = `tomcat-${module.id}-${actionType}`;
                await window.createTerminal(termId, 'ps', module.path);
                window.electronAPI.terminalWrite(termId, `${cmd}\r`);
            }
        }
    }
};
