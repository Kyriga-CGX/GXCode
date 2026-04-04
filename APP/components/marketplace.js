// APP/components/marketplace.js
// NOTE: This file uses inline styles for the modal overlay/positioning
// because Tailwind v4 build purges dynamically-generated class names in JS template literals.
import { state, subscribe, setState } from '../core/state.js';
import { api } from '../core/api.js';

const modalsRoot = document.getElementById('modals-root');
window.__marketCache = new Map();

const renderMarketplaceContent = (items, type) => {
    if (!items || items.length === 0) {
        return `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:rgba(255,255,255,0.4);font-size:11px;border:1px dashed var(--border-dim);border-radius:12px;">${window.t('marketplace.noModules')}</div>`;
    }

    const isInstalledTab = state.activeMarketplaceTab === 'installed';

    return items.map(item => {
        const key = item.slug || String(item.id);
        window.__marketCache.set(key, item);

        const sourceBg = item.source === 'Open VSX' ? 'rgba(59,130,246,0.1)' :
                         item.source === 'skills.sh' ? 'rgba(168,85,247,0.1)' :
                         'rgba(16,185,129,0.1)';
        const sourceColor = item.source === 'Open VSX' ? '#60a5fa' :
                            item.source === 'skills.sh' ? '#c084fc' :
                            '#34d399';

        const realType = isInstalledTab ? (item.type || type) : type;

        const btnStyle = isInstalledTab 
            ? 'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);cursor:pointer;'
            : item.isInstalled
                ? 'background:#1f2937;color:#6b7280;cursor:not-allowed;'
                : 'background:#2563eb;color:#fff;cursor:pointer;';

        const btnAction = isInstalledTab 
            ? `window.uninstallMarketItem('${realType}', '${key}', event)`
            : `window.installMarketItem('${realType}', '${key}', event)`;

        const badgeColor = realType === 'agent' ? '#3b82f6' : realType === 'skill' ? '#10b981' : realType === 'addon' ? '#a855f7' : '#6e7681';
        const badgeBg = realType === 'agent' ? 'rgba(59,130,246,0.1)' : realType === 'skill' ? 'rgba(16,185,129,0.1)' : realType === 'addon' ? 'rgba(168,85,247,0.1)' : 'rgba(110,118,129,0.1)';

        return `
        <div style="padding:16px;border:1px solid var(--border-dim);border-radius:12px;background:var(--bg-side-alt);display:flex;flex-direction:column;transition:border-color 0.2s;cursor:pointer;" 
             onmouseover="this.style.borderColor='var(--accent)'" 
             onmouseout="this.style.borderColor='var(--border-dim)'"
             ondblclick="window.previewMarketItem('${realType}s', '${key}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div style="display:flex;flex-direction:column;gap:4px;overflow:hidden;">
                    <span style="font-size:8px;padding:2px 6px;border-radius:4px;border:1px solid ${sourceColor}40;background:${sourceBg};color:${sourceColor};text-transform:uppercase;font-weight:700;letter-spacing:0.1em;align-self:flex-start;">${item.source || 'GX Hub'}</span>
                    <h3 style="margin:0;font-weight:700;color:var(--text-main, #fff);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</h3>
                </div>
                <span style="font-size:9px;padding:2px 6px;border-radius:4px;background:${badgeBg};color:${badgeColor};border:1px solid ${badgeColor}40;flex-shrink:0;text-transform:uppercase;font-weight:700;">${item.category || item.role || realType}</span>
            </div>
            <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:4px 0 16px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:48px;">${item.description || 'Modulo per GXCode AI Assistant.'}</p>
            <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border-dim);">
                <div style="display:flex;flex-direction:column;">
                    <span style="font-size:9px;color:#484f58;font-family:monospace;text-transform:uppercase;letter-spacing:0.1em;">${item.author || 'Registry'}</span>
                    <span style="font-size:8px;color:#30363d;font-family:monospace;font-style:italic;">${item.version || 'v1.0.0'}</span>
                </div>
                <button onclick="${btnAction}" 
                        style="font-size:10px;padding:6px 14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-radius:6px;border:none;${btnStyle};transition:all 0.2s;"
                        ${!isInstalledTab && item.isInstalled ? 'disabled' : ''}>
                    ${isInstalledTab ? 'Rimuovi' : (item.isInstalled ? window.t('marketplace.installed') : window.t('marketplace.install'))}
                </button>
            </div>
        </div>
        `;
    }).join('');
};

window.previewMarketItem = (type, id) => {
    const item = window.__marketCache.get(id);
    if (!item) return;
    if (window.openCrudModal) {
        window.openCrudModal(type, item, true); 
    }
};

const renderMarketplace = () => {
    if (!state.isMarketplaceOpen) {
        const marketEl = document.getElementById('gx-market-overlay');
        if (marketEl) marketEl.remove();
        return;
    }

    const t = (key) => {
        try { return window.t(key) || key; } catch(e) { return key; }
    };

    const activeTab = state.activeMarketplaceTab || 'agents';
    const isLoading = state.isMarketplaceLoading;

    const currentSearch = (document.getElementById('market-global-search')?.value || '').toLowerCase();
    
    let mContent = '';
    let mSubFilters = '';

    if (activeTab === 'installed') {
        const cat = state.activeMarketplaceCategory || 'all';
        
        let allInstalled = [
            ...state.agents.map(a => ({ ...a, type: 'agent' })),
            ...state.skills.map(s => ({ ...s, type: 'skill' })),
            ...state.plugins.map(p => ({ ...p, type: 'ai-companion' }))
        ];

        if (cat === 'agents') allInstalled = allInstalled.filter(i => i.type === 'agent');
        else if (cat === 'skills') allInstalled = allInstalled.filter(i => i.type === 'skill');
        else if (cat === 'ai-companion') allInstalled = allInstalled.filter(i => i.type === 'ai-companion');
        else if (cat === 'addons') allInstalled = allInstalled.filter(i => i.type === 'addon');

        if (currentSearch.length > 1) {
            allInstalled = allInstalled.filter(i =>
                i.name.toLowerCase().includes(currentSearch) ||
                (i.description && i.description.toLowerCase().includes(currentSearch))
            );
        }

        mContent = renderMarketplaceContent(allInstalled, 'installed');

        const subTabs = [['all', 'Tutti'], ['agents', 'Agenti'], ['skills', 'Skill'], ['addons', 'Addon'], ['ai-companion', 'Ai Companion']];
        mSubFilters = `
            <div style="display:flex;gap:8px;margin-bottom:16px;padding:0 32px;">
                ${subTabs.map(([id, label]) => {
                    const isActive = cat === id;
                    const color = id === 'agents' ? '#3b82f6' : id === 'skills' ? '#10b981' : id === 'ai-companion' ? '#a855f7' : id === 'addons' ? '#f59e0b' : '#6e7681';
                    return `<button onclick="window.setState({ activeMarketplaceCategory: '${id}' })" 
                                    style="padding:4px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;border-radius:20px;cursor:pointer;transition:all 0.2s;
                                           ${isActive ? `background:${color}20;color:${color};border:1px solid ${color}40;` : 'background:var(--bg-side);color:rgba(255,255,255,0.3);border:1px solid var(--border-dim);'}">
                                 ${label}
                            </button>`;
                }).join('')}
            </div>
        `;
    } else {
        let itemsToRender = [];
        if (activeTab === 'agents') itemsToRender = state.marketplaceAgents || [];
        else if (activeTab === 'skills') itemsToRender = state.marketplaceSkills || [];
        else if (activeTab === 'addons') itemsToRender = state.marketplacePlugins || [];
        else if (activeTab === 'ai-companion') {
            mContent = `<div style="grid-column:1/-1;text-align:center;padding:80px 24px;background:var(--bg-side);border:1px dashed var(--border-dim);border-radius:12px;">
                <div style="font-size:32px;margin-bottom:16px;">✨</div>
                <h3 style="color:#fff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em;">Coming Soon</h3>
                <p style="color:rgba(255,255,255,0.4);font-size:11px;">La libreria ufficiale degli AI Companion specializzati è in arrivo.<br>Potrai assumere assistenti verticali per ogni tua esigenza.</p>
            </div>`;
        }

        if (currentSearch.length > 1) {
            itemsToRender = itemsToRender.filter(p =>
                p.name.toLowerCase().includes(currentSearch) ||
                (p.description && p.description.toLowerCase().includes(currentSearch))
            );
        }
        
        mContent = mContent || ((isLoading && (activeTab === 'addons' || activeTab === 'agents'))
            ? `<div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;gap:16px;">
                 <div style="width:48px;height:48px;border:4px solid rgba(59,130,246,0.2);border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;"></div>
                 <p style="color:#6e7681;font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.2em;">Connessione al registro...</p>
               </div>`
            : renderMarketplaceContent(itemsToRender, activeTab === 'addons' ? 'addon' : activeTab.slice(0, -1)));
    }

    const tabBtn = (id, label) => {
        const isActive = activeTab === id;
        const isFirst = id === 'agents';
        const isLast = id === 'installed';
        return `<button onclick="window.setState({ activeMarketplaceTab: '${id}', activeMarketplaceCategory: 'all' })" 
                    style="padding:8px 18px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border:none;cursor:pointer;border-radius:${isFirst?'8px 0 0 8px':isLast?'0 8px 8px 0':'0'};${isActive ? 'background:rgba(59,130,246,0.15);color:#60a5fa;border-bottom:2px solid #3b82f6;' : 'background:transparent;color:#6e7681;'}">
                    ${label}
                </button>`;
    };

    const tabs = [
        ['agents', t('marketplace.agentsTab')],
        ['skills', t('marketplace.skillsTab')],
        ['addons', t('marketplace.addonsTab')],
        ['ai-companion', t('marketplace.aiCompanionTab')],
        ['installed', 'Installati']
    ];

    modalsRoot.innerHTML = `
        <div id="gx-market-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,0.85);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:40px;box-sizing:border-box;">
            <div style="background:var(--bg-main);width:100%;max-width:1100px;height:85vh;border-radius:16px;border:1px solid var(--border-dim);box-shadow:0 32px 120px rgba(0,0,0,0.95);display:flex;flex-direction:column;overflow:hidden;">
                
                <div style="padding:20px 32px;border-bottom:1px solid var(--border-dim);background:var(--bg-side);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:16px;">
                        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#4338ca);display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>
                        <div>
                            <div style="font-size:12px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.15em;">Marketplace Hub</div>
                            <div style="font-size:9px;color:#484f58;font-family:monospace;text-transform:uppercase;letter-spacing:0.2em;margin-top:2px;">Discover &amp; Install</div>
                        </div>
                    </div>
                    <div style="display:flex;background:var(--bg-main);padding:4px;border-radius:10px;border:1px solid var(--border-dim);">
                        ${tabs.map(([id, label]) => tabBtn(id, label)).join('')}
                    </div>
                    <button onclick="window.closeMarketplace()" 
                            style="width:36px;height:36px;border-radius:8px;background:rgba(139,148,158,0.1);color:#8b949e;border:1px solid rgba(139,148,158,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;"
                            onmouseover="this.style.background='rgba(248,81,73,0.2)';this.style.color='#fff'"
                            onmouseout="this.style.background='rgba(139,148,158,0.1)';this.style.color='#8b949e'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>

                <div style="padding:20px 32px;border-bottom:1px solid var(--border-dim);background:rgba(0,0,0,0.2);flex-shrink:0;">
                    <div style="position:relative;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input id="market-global-search" type="text" 
                               placeholder="Cerca in ${activeTab}..." 
                               value="${currentSearch}"
                               style="width:100%;background:var(--bg-main);border:1px solid var(--border-dim);border-radius:10px;padding:10px 16px 10px 42px;font-size:12px;color:var(--text-main, #fff);outline:none;box-sizing:border-box;">
                    </div>
                </div>

                ${mSubFilters}

                <div style="flex:1;overflow-y:auto;padding:24px 32px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
                        ${mContent}
                    </div>
                </div>

                <div style="height:40px;padding:0 32px;background:var(--bg-side);border-top:1px solid var(--border-dim);display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <div style="width:6px;height:6px;border-radius:50%;background:${isLoading ? 'var(--accent)' : '#10b981'};${isLoading ? 'animation:pulse 1.5s ease-in-out infinite;' : ''}"></div>
                    <span style="font-size:8px;color:rgba(255,255,255,0.3);font-family:monospace;text-transform:uppercase;letter-spacing:0.2em;">${isLoading ? 'Syncing registries...' : 'Ready'}</span>
                </div>
            </div>
        </div>
    `;

    // Re-bind focus and event listener
    const input = document.getElementById('market-global-search');
    if (input) {
        input.setSelectionRange(input.value.length, input.value.length);
        input.focus();
        input.oninput = (e) => {
            if (activeTab === 'installed') renderMarketplace();
            else {
                if (window.__searchTimeout) clearTimeout(window.__searchTimeout);
                window.__searchTimeout = setTimeout(() => api.loadMarketplace(e.target.value), 400);
            }
        };
    }
};

window.closeMarketplace = () => setState({ isMarketplaceOpen: false });

window.installMarketItem = async (type, id, event) => {
    const btn = event.target;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.disabled = true;

    try {
        const item = window.__marketCache.get(id);
        if (!item) throw new Error("Item non trovato in cache");

        if (type === 'agents' || type === 'agent') await api.installAgent(item);
        else if (type === 'skills' || type === 'skill') await api.installSkill(item);
        else if (type === 'addons' || type === 'addon') await api.installPlugin(item);
        
        btn.innerHTML = '✅ OK';
        setTimeout(() => {
            btn.innerHTML = 'INSTALLATO';
            btn.style.background = '#1f2937';
            btn.style.color = '#6b7280';
            btn.style.cursor = 'not-allowed';
        }, 1000);
    } catch (err) {
        btn.innerHTML = '❌';
        btn.disabled = false;
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    }
};

window.uninstallMarketItem = async (type, id, event) => {
    if (!confirm('Sei sicuro di voler rimuovere questo modulo?')) return;
    
    const btn = event.target;
    btn.innerHTML = '🗑️...';
    btn.disabled = true;

    try {
        if (type === 'agents' || type === 'agent') await api.deleteAgent(id);
        else if (type === 'skills' || type === 'skill') await api.deleteSkill(id);
        else if (type === 'addons' || type === 'addon') await api.deletePlugin(id);
        
        window.gxToast('Modulo rimosso correttamente.', 'info');
        // renderMarketplace will be called via subscribe to loadAll() in api.deleteXXX
    } catch (err) {
        console.error("Errore disinstallazione:", err);
        btn.innerHTML = '❌';
        btn.disabled = false;
        setTimeout(() => btn.innerHTML = 'Rimuovi', 2000);
    }
};

window.setState = setState;
window.api = api;

let lastTab = null;
let lastCat = null;

export const initMarketplace = () => {
    subscribe((newState) => {
        const root = document.getElementById('modals-root');
        if (root) {
            if (newState.isMarketplaceOpen) {
                root.style.pointerEvents = 'auto';
            } else {
                root.style.pointerEvents = 'none';
            }
        }
        if (newState.isMarketplaceOpen && (newState.activeMarketplaceTab !== lastTab || newState.activeMarketplaceCategory !== lastCat)) {
            lastTab = newState.activeMarketplaceTab;
            lastCat = newState.activeMarketplaceCategory;
            if (lastTab !== 'installed') api.loadMarketplace();
        }
        renderMarketplace();
    });
};
