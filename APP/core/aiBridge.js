import { state } from './state.js';
import { AI_POLISH_STYLES } from './aiStyles.js';

/**
 * AI Bridge for GXCode
 */

export const initAiBridge = () => {
    window.sendCodeToAI = async (provider) => {
        const activeFileId = state.activeFileId;
        if (!activeFileId) {
            window.gxToast(window.t('debug.toastOpen'), "error");
            return;
        }

        const activeFile = state.openFiles.find(f => f.path === activeFileId);
        if (!activeFile || !activeFile.content) {
            window.gxToast("Errore: Impossibile recuperare il contenuto del file", "error");
            return;
        }

        const webview = document.getElementById(`webview-${provider}`);
        if (!webview) return;

        // Assicuriamoci che il webview sia caricato
        if (webview.getURL() === "about:blank") {
            const url = provider === 'gemini' ? 'https://gemini.google.com' : 'https://claude.ai';
            webview.loadURL(url);
            window.gxToast("Caricamento in corso... riprova tra un istante", "info");
            return;
        }

        const escapedCode = activeFile.content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        
        // --- INIEZIONE CONTESTO DISCRETA (v1.4.5) ---
        const skills = (state.skills || []).map(s => s.name).join(', ');
        const guidelines = state.projectGuidelines ? `\nGUIDELINES: ${state.projectGuidelines}` : '';
        const contextHeader = `[GX-CONTEXT: Skills(${skills})${guidelines}]\n\n`;

        const prompt = `${contextHeader}Analizza questo codice:\n\n\`\`\`\n${escapedCode}\n\`\`\`\n\n`;

        // Inject script based on provider
        let script = "";
        if (provider === 'gemini') {
            script = `
                (function() {
                    const editor = document.querySelector('.ql-editor') || document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
                    if (editor) {
                        editor.innerText = \`${prompt}\`;
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                           const sendBtn = document.querySelector('.send-button') || document.querySelector('button[aria-label="Invia"]');
                           if (sendBtn) sendBtn.click();
                        }, 500);
                    }
                })();
            `;
        } else if (provider === 'claude') {
            script = `
                (function() {
                    const editor = document.querySelector('.ProseMirror') || document.querySelector('textarea');
                    if (editor) {
                        if (editor.tagName === 'TEXTAREA') {
                            editor.value = \`${prompt}\`;
                        } else {
                            editor.innerText = \`${prompt}\`;
                        }
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                            const sendBtn = document.querySelector('button[aria-label="Send Message"]') || document.querySelector('button.p-2.rounded-md');
                            if (sendBtn) sendBtn.click();
                        }, 500);
                    }
                })();
            `;
        }

        try {
            await webview.executeJavaScript(script);
            window.gxToast(`Codice inviato a ${provider}!`, "success");
        } catch (err) {
            console.error(`[AI BRIDGE] Error injecting into ${provider}:`, err);
            window.gxToast("Errore durante l'invio del codice all'AI", "error");
        }
    };

    window.polishAiWebview = (provider) => {
        const webview = document.getElementById(`webview-${provider}`);
        if (!webview) return;

        const applyPolish = () => {
            const styles = AI_POLISH_STYLES[provider];
            if (styles) {
                // Rimuovi spazi extra e newline per l'iniezione sicura
                const cleanStyles = styles.replace(/\s+/g, ' ').trim();
                
                // Usiamo sia insertCSS che executeJavaScript per massima persistenza
                webview.insertCSS(cleanStyles);
                
                // Inject MutationObserver to keep elements hidden even after SPA navigation
                const script = `
                    (function() {
                        const style = document.createElement('style');
                        style.textContent = \`${cleanStyles}\`;
                        document.head.append(style);
                        
                        // Osservatore per eliminare elementi che appaiono in ritardo
                        const observer = new MutationObserver(() => {
                            const styleExists = Array.from(document.querySelectorAll('style')).some(s => s.textContent.includes('${cleanStyles.substring(0, 20)}'));
                            if (!styleExists) {
                                document.head.append(style.cloneNode(true));
                            }
                        });
                        observer.observe(document.body, { childList: true, subtree: true });
                    })();
                `;
                webview.executeJavaScript(script);
                console.log(`[AI BRIDGE] Persistently Polished ${provider} UI`);
            }
        };

        webview.addEventListener('dom-ready', applyPolish);
        webview.addEventListener('did-finish-load', applyPolish);
        // Applichiamo subito se è già pronto
        if (webview.getURL() !== "about:blank") applyPolish();
    };
};
