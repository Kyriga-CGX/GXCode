/**
 * PATCH JS - TERMINALE REALE IN ELECTRON (Embedded)
 * Restore del Vecchio Comportamento UI + Funzionalità Terminale Reale tramite IPC
 */
document.addEventListener("DOMContentLoaded", () => {
    // Struttura stato globale del terminale (storia dei comandi e tab)
    const CGX = {
        termHistory: [],
        termHistoryIdx: -1,
        termTabCounter: 1
    };

    // --- LOGICA SKINNING & SETTINGS ---
    const getSavedSkin = () => localStorage.getItem('cgx-skin') || 'dark';
    const SKINS = [
        { id: 'dark', label: 'Dark Mode (Default)' },
        { id: 'light', label: 'Light Mode' },
        { id: 'classic', label: 'Classic Layout' },
        { id: 'apple', label: 'Apple Style' },
        { id: 'aero', label: 'Aero Glass' },
        { id: 'liquid-glass', label: 'Liquid Glass' },
        { id: 'custom-gradient', label: 'Sfumato a Scelta' },
        { id: 'anime', label: 'Anime Style' }
    ];

    document.documentElement.dataset.cgxTheme = getSavedSkin();
    if (localStorage.getItem('cgx-grad-color')) {
        document.documentElement.style.setProperty('--cgx-grad-custom', localStorage.getItem('cgx-grad-color'));
    }

    const tryInjectSettings = () => {
        const buttons = document.querySelectorAll('button, div[role="button"]');
        buttons.forEach(btn => {
            const attr = (btn.getAttribute('aria-label') || '').toLowerCase();
            const txt = (btn.textContent || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();
            
            let isThemeBtn = false;
            // Classici controlli basati sul testo visibile o accessibile
            if (attr.includes('theme') || attr.includes('light') || attr.includes('dark') || txt === 'dark' || txt === 'light') {
                isThemeBtn = true;
            } 
            // Euristica brutale su SVG puramente visuali per i Theme Toggle (es. Shadcn, Lucide, Radix)
            else if (btn.children.length >= 1 && html.includes('<svg') && !html.includes('cgx-extra')) {
                if (
                    html.includes('lucide-sun') || html.includes('lucide-moon') ||
                    html.includes('dark:scale-0') || html.includes('dark:-rotate') ||
                    (html.includes('<circle') && html.includes('<line')) || // Tipico sole Lucide
                    html.includes('toggle theme') || html.includes('m12 3a6.364') || html.includes('m7.5 1.5c') ||
                    html.includes('theme') || html.includes('tema')
                ) {
                    // Controlliamo non sia l'ingranaggio delle settings per sbaglio!
                    if (!html.includes('settings') && !html.includes('impostazioni') && !attr.includes('setting')) {
                        isThemeBtn = true;
                    }
                }
            }
            
            if (isThemeBtn && !btn.dataset.cgxHidden) {
                btn.style.setProperty('display', 'none', 'important');
                btn.dataset.cgxHidden = '1';
            }
        });

        let settingsPanel = null;
        
        // Cerca esplicitamente modali VISIBILI (Radix UI usa data-state="open" e role="dialog")
        const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]')).filter(el => {
            return el.getAttribute('data-state') === 'open' || window.getComputedStyle(el).display !== 'none';
        });

        for (const dlg of dialogs) {
            const txt = (dlg.textContent || '').toLowerCase();
            // Verifichiamo il testo della modale: Settings, YouTrack Config, ecc.
            // Per evitare falsi positivi, non usiamo fallback. Se non ha queste key, ignoriamo.
            if ((txt.includes('settings') || txt.includes('impostazioni')) && 
                (txt.includes('youtrack') || txt.includes('mcp servers'))) {
                settingsPanel = dlg;
                break;
            }
        }
        
        if (!settingsPanel) return; // Usciamo se la modale aperta NON è le Impostazioni (es. Edit Agent)

        if (settingsPanel && !settingsPanel.dataset.cgxSettings) {
            settingsPanel.dataset.cgxSettings = "1";
            
            // Forziamo l'overflow per essere sicuri di poter scrollare in basso e vedere il modulo
            settingsPanel.style.overflowY = 'auto';
            settingsPanel.style.paddingBottom = '20px'; // Spazio aggiuntivo
            
            let targetAppend = settingsPanel;
            // Se c'è un wrapper interno usato da Radix, appendiamolo lì altrimenti va fuori dal bordo
            if (settingsPanel.children.length === 1 && settingsPanel.children[0].tagName === 'DIV') {
                targetAppend = settingsPanel.children[0]; 
            }
            
            const extraWrap = document.createElement('div');
            extraWrap.id = 'cgx-extra-settings';
            extraWrap.className = 'cgx-settings-section';
            extraWrap.innerHTML = `
                <hr class="cgx-settings-divider" />
                <h3 class="cgx-settings-title">🎨 Aspetto e Tema (Cloud-GX)</h3>
                <div class="cgx-settings-row">
                    <label>Scegli la tua Skin preferita:</label>
                    <select id="cgx-skin-selector" class="cgx-select">
                        ${SKINS.map(s => `<option value="${s.id}" ${getSavedSkin() === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
                    </select>
                </div>
                <div class="cgx-settings-row" id="cgx-grad-row" style="margin-top:10px;">
                    <label>Colore Sfumatura:</label>
                    <input type="color" id="cgx-grad-color" value="${localStorage.getItem('cgx-grad-color') || '#ff0055'}" style="cursor:pointer;" />
                </div>
            `;
            
            const skinSel = extraWrap.querySelector('#cgx-skin-selector');
            const gradRow = extraWrap.querySelector('#cgx-grad-row');
            const gradColor = extraWrap.querySelector('#cgx-grad-color');
            const applyVisibility = () => { gradRow.style.display = skinSel.value === 'custom-gradient' ? 'flex' : 'none'; };
            applyVisibility();
            skinSel.addEventListener('change', (e) => {
                const val = e.target.value;
                localStorage.setItem('cgx-skin', val);
                document.documentElement.dataset.cgxTheme = val;
                applyVisibility();
            });
            gradColor.addEventListener('input', (e) => {
                const val = e.target.value;
                localStorage.setItem('cgx-grad-color', val);
                document.documentElement.style.setProperty('--cgx-grad-custom', val);
            });
            
            // --- INIEZIONE IN TABS O FALLBACK ---
            const tabList = targetAppend.querySelector('[role="tablist"]');
            if (tabList) {
                // Creiamo la Tab visiva
                const newTabBtn = document.createElement('button');
                newTabBtn.className = tabList.firstElementChild ? tabList.firstElementChild.className : '';
                newTabBtn.textContent = "🎨 Personalizzazione"; // Testo della tab
                tabList.appendChild(newTabBtn);
                
                extraWrap.style.display = 'none'; // Nascosto di default finché non si clicca
                extraWrap.style.marginTop = '20px';
                targetAppend.appendChild(extraWrap);
                
                // Intercettiamo i click sulla nostra tab
                newTabBtn.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const allTabs = Array.from(tabList.querySelectorAll('button'));
                    allTabs.forEach(t => t.setAttribute('data-state', 'inactive'));
                    newTabBtn.setAttribute('data-state', 'active');
                    
                    // Spegne i pannelli nativi
                    const panels = targetAppend.querySelectorAll('[role="tabpanel"]');
                    panels.forEach(p => p.style.display = 'none');
                    // Accende il nostro
                    extraWrap.style.display = 'block';
                });
                
                // Quando l'utente clicca una tab genitore che NON è la nostra
                tabList.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (btn && btn !== newTabBtn) {
                        newTabBtn.setAttribute('data-state', 'inactive');
                        extraWrap.style.display = 'none';
                        const panels = targetAppend.querySelectorAll('[role="tabpanel"]');
                        panels.forEach(p => p.style.display = ''); // lascia fare a Radix
                    }
                });
                
            } else {
                // Inseriamo il wrapper *prima* del primo div contenitore come fallback
                const header = targetAppend.querySelector('h1, h2, h3, header') || targetAppend.firstElementChild;
                if (header && header.nextSibling) {
                    header.parentNode.insertBefore(extraWrap, header.nextSibling);
                } else {
                    targetAppend.appendChild(extraWrap);
                }
            }
        }
    };

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function termPrint(line, containerOut) {
        var d = document.createElement('div');
        d.innerHTML = line;
        containerOut.appendChild(d);
        containerOut.scrollTop = containerOut.scrollHeight;
    }

    function clearTermOutput(containerOut) {
        containerOut.innerHTML = '';
    }

    async function runRealCommand(cmd, containerOut) {
        if (!window.electronAPI || !window.electronAPI.executeCommand) {
            termPrint('<span class="t-err">[!] ERRORE: IPC (window.electronAPI) non trovato. Preload non configurato.</span>', containerOut);
            return;
        }

        try {
            const result = await window.electronAPI.executeCommand(cmd);
            if (result.stdout) {
                termPrint("<pre style='margin:0;color:#c8c8c8;font-family:inherit;line-height:1.4;'>" + esc(result.stdout) + "</pre>", containerOut);
            }
            if (result.stderr) {
                termPrint("<pre style='margin:0;color:#fbbf24;font-family:inherit;line-height:1.4;'>" + esc(result.stderr) + "</pre>", containerOut);
            }
            if (result.error && !result.stderr) {
                termPrint("<pre style='margin:0;color:#f87171;font-family:inherit;line-height:1.4;'>" + esc(result.error) + "</pre>", containerOut);
            }
        } catch (err) {
            termPrint("<pre style='margin:0;color:#f87171;font-family:inherit;'>Errore esecuzione: " + esc(err.message) + "</pre>", containerOut);
        }
    }

    function initTerminalEvents(wrap) {
        var inp = wrap.querySelector('#cgx-term-input');
        var outArea = wrap.querySelector('#cgx-term-output');

        if (!inp) return;
        inp.addEventListener('keydown', async function (e) {
            if (e.key === 'Enter') {
                var cmd = this.value;
                this.value = '';
                cmd = cmd.trim();
                if (!cmd) return;

                termPrint('<span class="t-prompt">cloud-gx:~$</span> <span class="t-cmd">' + esc(cmd) + '</span>', outArea);
                CGX.termHistory.unshift(cmd);
                CGX.termHistoryIdx = -1;

                if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
                    clearTermOutput(outArea);
                    return;
                }

                inp.disabled = true;
                await runRealCommand(cmd, outArea);
                inp.disabled = false;
                inp.focus();
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (CGX.termHistoryIdx < CGX.termHistory.length - 1) {
                    CGX.termHistoryIdx++;
                    this.value = CGX.termHistory[CGX.termHistoryIdx] || '';
                }
            }
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                CGX.termHistoryIdx = Math.max(-1, CGX.termHistoryIdx - 1);
                this.value = CGX.termHistoryIdx >= 0 ? CGX.termHistory[CGX.termHistoryIdx] : '';
            }
        });

        // BOTTONE NUOVA TAB
        var addBtn = wrap.querySelector('#cgx-term-add');
        if (addBtn) addBtn.addEventListener('click', function () {
            CGX.termTabCounter++;
            var id = 't' + CGX.termTabCounter;
            var tabbar = wrap.querySelector('#cgx-term-tabbar');
            var actionsDiv = tabbar.querySelector('.cgx-term-tabbar-actions');

            var newTab = document.createElement('div');
            newTab.className = 'cgx-term-tab';
            newTab.dataset.termid = id;
            newTab.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> bash <button class="cgx-term-tab-close" data-close-tab="' + id + '">✕</button>';

            tabbar.insertBefore(newTab, actionsDiv);
            tabbar.querySelectorAll('.cgx-term-tab').forEach(function (t) { t.classList.remove('cgx-tab-active'); });
            newTab.classList.add('cgx-tab-active');

            clearTermOutput(outArea);
            termPrint('<span class="t-info">Nuova sessione [' + id + '] (Host nativo)</span>', outArea);

            newTab.addEventListener('click', function (e) {
                if (e.target.closest('.cgx-term-tab-close')) return;
                tabbar.querySelectorAll('.cgx-term-tab').forEach(t => t.classList.remove('cgx-tab-active'));
                newTab.classList.add('cgx-tab-active');
                clearTermOutput(outArea);
                termPrint('<span class="t-dim">Sessione [' + id + '] attiva</span>', outArea);
                inp.focus();
            });

            newTab.querySelector('.cgx-term-tab-close').addEventListener('click', function () {
                newTab.remove();
                clearTermOutput(outArea);
                termPrint('<span class="t-dim">Sessione chiusa.</span>', outArea);
            });
            inp.focus();
        });

        // BOTTONE NPM
        var npmBtn = wrap.querySelector('#cgx-term-npm');
        if (npmBtn) {
            npmBtn.addEventListener('click', async function () {
                termPrint('<span class="t-prompt">cloud-gx:~$</span> <span class="t-cmd">npm -v</span>', outArea);
                inp.disabled = true;
                await runRealCommand("npm -v", outArea); // Esegue veramente npm locale
                inp.disabled = false;
                inp.focus();
            });
        }

        // BOTTONE CLEAR
        var clrBtn = wrap.querySelector('#cgx-term-clear');
        if (clrBtn) {
            clrBtn.addEventListener('click', function () {
                clearTermOutput(outArea);
                inp.focus();
            });
        }

        // CHIUSURA PRIMA TAB
        var closeT1 = wrap.querySelector('[data-close-tab="t1"]');
        if (closeT1) closeT1.addEventListener('click', function (e) {
            e.stopPropagation();
            clearTermOutput(outArea);
            termPrint('<span class="t-dim">Sessione chiusa.</span>', outArea);
        });

        // MESSAGGIO BENVENUTO E FOCUS
        setTimeout(() => {
            termPrint('<span class="t-info">Terminal — Real Cloud-GX Host (Embedded)</span>', outArea);
            termPrint('<span class="t-dim">La cronologia comandi (ArrowUp/ArrowDown) ed i pulsanti sono ripristinati.</span>', outArea);
            termPrint('', outArea);
            inp.focus();
        }, 200);
    }

    const buildTerminal = (targetContainer) => {
        if (document.getElementById('cgx-terminal-wrap')) return;

        targetContainer.classList.add("pao-patch-applied");

        // Svuotiamo brutalmente e permanentemente il Target Container!
        // Vogliamo SOSTITUIRE l'intera porzione del veccho terminale fittizio.
        targetContainer.innerHTML = "";

        // Garantiamo che il contenitore possa alloggiare il nostro flex terminal
        targetContainer.style.display = "flex";
        targetContainer.style.flexDirection = "column";

        const termWrap = document.createElement('div');
        termWrap.id = 'cgx-terminal-wrap';
        termWrap.className = 'cgx-visible';

        termWrap.innerHTML = `
            <div class="cgx-term-tabbar" id="cgx-term-tabbar">
                <div class="cgx-term-tab cgx-tab-active" data-termid="t1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                    bash
                    <button class="cgx-term-tab-close" data-close-tab="t1">✕</button>
                </div>
                <div class="cgx-term-tabbar-actions">
                    <button class="cgx-term-action-btn" id="cgx-term-add">+ Nuovo</button>
                    <button class="cgx-term-action-btn green" id="cgx-term-npm">▶ npm -v</button>
                    <button class="cgx-term-action-btn" id="cgx-term-clear">⌫ Clear</button>
                </div>
            </div>
            
            <div class="cgx-term-output-area" id="cgx-term-output-area">
                <div id="cgx-term-output"></div>
            </div>
            
            <div class="cgx-term-input-row" style="flex-shrink: 0;">
                <span class="cgx-term-prompt-label" id="cgx-term-prompt">cloud-gx:~$</span>
                <input class="cgx-term-input" id="cgx-term-input" placeholder="Inserisci comando (es. dir, node -v)…" autocomplete="off" spellcheck="false">
            </div>
        `;

        targetContainer.appendChild(termWrap);
        initTerminalEvents(termWrap);
    };

    const tryInjectTerminal = () => {
        // Se il nostro terminale è già fisicamente presente e vivo, ignoriamo.
        if (document.getElementById('cgx-terminal-wrap')) return;

        let targetContainer = null;
        const leaves = Array.from(document.querySelectorAll('*')).filter(el => el.children.length === 0 && (el.textContent || "").trim() !== "");

        for (const leaf of leaves) {
            const text = leaf.textContent.toLowerCase();
            if (text.includes("codecraft") || text.includes("gx code ai") || text.includes("gxcode ai") || text.includes("seleziona un'issue") || text.includes("select an issue")) {
                let current = leaf.parentElement;
                while (current && current.tagName !== 'BODY') {
                    if (current.querySelector('textarea') || current.querySelector('input[type="text"]')) {
                        targetContainer = current;
                        break;
                    }
                    current = current.parentElement;
                }
                if (targetContainer) break;
            }
        }

        if (targetContainer) {
            const fullText = targetContainer.textContent.toLowerCase();
            if (fullText.includes("minimizza chat") || fullText.includes("apri cartella") || fullText.includes("carica un progetto")) {
                const children = Array.from(targetContainer.children);
                const childWithInput = children.find(c => c.querySelector('textarea') || c.tagName === 'TEXTAREA' || c.querySelector('input[type="text"]'));
                if (childWithInput) targetContainer = childWithInput;
            }
            buildTerminal(targetContainer);
        }
    };

    const observer = new MutationObserver(() => {
        tryInjectTerminal();
        tryInjectSettings();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    tryInjectTerminal();
    tryInjectSettings();
});
