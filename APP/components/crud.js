import { state, setState } from '../core/state.js';
import { api } from '../core/api.js';

const closeCrudModal = () => {
    const root = document.getElementById('crud-root');
    if (root) {
        root.innerHTML = '';
        root.classList.add('pointer-events-none');
        root.style.pointerEvents = 'none';
    }
};

export const openCrudModal = (type, item = null, isPreview = false) => {
    const root = document.getElementById('crud-root');
    if (!root) return;
    
    const isEdit = !!item;
    const t = (key) => window.t(key) || key;
    
    const typeLabel = type === 'agents' ? t('crud.agent') : (type === 'skills' ? t('crud.skill') : t('crud.addon'));
    let title = isEdit ? t('crud.edit').replace('{type}', typeLabel) : t('crud.new').replace('{type}', typeLabel);
    if (isPreview) title = `${typeLabel} - Anteprima`;

    const themeClass = type === 'agents' ? 'agent-theme' : (type === 'skills' ? 'skill-theme' : 'addon-theme');
    const accentColor = type === 'agents' ? '#1f6feb' : (type === 'skills' ? '#10b981' : '#8b5cf6');

    root.classList.remove('pointer-events-none');
    root.style.pointerEvents = 'auto';
    
    const prompt = item?.systemPrompt || item?.instructions || '';
    const logic = item?.logic || item?.content || '';
    const description = item?.description || '';

    const renderSkills = () => {
        if (type !== 'agents') return '';
        const skills = state.skills || [];
        const assignedIds = item?.assignedSkills?.map(id => String(id)) || [];
        
        return `
            <div class="pt-8 border-t border-white/5 mt-8 relative w-full">
                <label class="snapshot-label mb-5 block">
                    <span class="opacity-50">CONFIGURAZIONE / </span>
                    <span class="text-blue-500/80">SKILL OPERATIVE ATTIVE</span>
                </label>
                
                <div class="relative w-full industrial-selector">
                    <!-- Industrial Trigger Box -->
                    <div id="skill-dropdown-trigger" 
                         class="snapshot-input !py-5 !px-6 flex items-center justify-between cursor-pointer transition-all select-none !border-blue-500/20 group active:scale-[0.99] w-full relative z-[201] !bg-[#0b0c10]"
                         onclick="const menu = document.getElementById('skill-dropdown-menu'); const isHidden = menu.classList.toggle('hidden'); this.style.borderColor = isHidden ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.4)'; this.classList.toggle('rounded-b-none', !isHidden); this.classList.toggle('border-b-0', !isHidden)">
                        
                        <div class="flex items-center gap-4 overflow-hidden">
                            <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            </div>
                            <div class="flex flex-col">
                                <span id="skill-selection-summary" class="text-[11px] font-black text-gray-200 uppercase tracking-[0.2em] leading-none mb-1">
                                    ${assignedIds.length > 0 ? `${assignedIds.length} SKILL ATTIVATE` : 'NESSUNA SKILL'}
                                </span>
                                <span class="text-[8px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Controllo Moduli Esterni</span>
                            </div>
                        </div>
                        
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-gray-600 group-hover:text-blue-400 transition-colors"><path d="m6 9 6 6 6-6"/></svg>
                    </div>

                    <!-- Elite Searchable Dropdown Menu (Pure blue theme, zero white artifacts) -->
                    <div id="skill-dropdown-menu" 
                         class="hidden absolute top-full left-0 right-0 bg-[#0b0c10] border-x border-b border-blue-500/40 rounded-b-2xl shadow-[0_30px_70px_rgba(0,0,0,1)] z-[200] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150 w-full">
                        
                        <!-- Search Header -->
                        <div class="p-3 bg-black/40 border-b border-blue-500/10">
                             <div class="relative">
                                 <input type="text" 
                                        placeholder="FILTRA SKILL..." 
                                        class="w-full bg-[#161b22] border border-blue-500/20 rounded-lg py-2.5 px-10 text-[10px] font-bold text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/40 transition-all uppercase tracking-widest"
                                        oninput="window.filterSkills(this.value)">
                                 <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                             </div>
                        </div>
                        
                        <!-- List Container (Limited to ~5 items height) -->
                        <div id="skill-list-container" class="overflow-y-auto custom-scrollbar p-2 flex-1 pt-3 max-h-[310px]">
                            ${skills.map(skill => {
                                const isAssigned = assignedIds.includes(String(skill.id));
                                return `
                                    <div class="skill-item flex items-center gap-4 p-3.5 hover:bg-white/[0.03] rounded-xl cursor-pointer group transition-all select-none mb-1 border ${isAssigned ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'border-transparent'}" 
                                         data-name="${skill.name.toLowerCase()}"
                                         data-category="${(skill.category || '').toLowerCase()}"
                                         onclick="window.toggleSkillSelectionUI(this)">
                                        
                                        <div class="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                                            <input type="checkbox" value="${skill.id}" class="crud-skill-check opacity-0 absolute pointer-events-none" ${isAssigned ? 'checked' : ''}>
                                            <div class="check-box w-5 h-5 rounded-md border-2 ${isAssigned ? 'bg-emerald-500 border-emerald-500' : 'border-blue-500/20 bg-black/20'} transition-all flex items-center justify-center shadow-inner">
                                                ${isAssigned ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                                            </div>
                                        </div>

                                        <div class="flex flex-col min-w-0 flex-1">
                                            <span class="text-[12px] font-bold text-gray-200 truncate tracking-tight mb-0.5 group-hover:text-white transition-colors">${skill.name}</span>
                                            <span class="text-[8px] text-emerald-500/80 font-black uppercase tracking-[0.2em] bg-emerald-500/10 px-1.5 py-1 rounded leading-none w-fit">
                                                ${skill.category || 'TOOL'}
                                            </span>
                                        </div>
                                    </div>
                                `;
                            }).join('') || `<div class="p-12 text-[9px] text-center text-gray-700 uppercase tracking-[0.4em] italic">Nessun modulo configurato</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    window.toggleSkillSelectionUI = (element) => {
        if (!element) return;
        const ck = element.querySelector('input');
        if (!ck) return;
        
        ck.checked = !ck.checked;
        const isChecked = ck.checked;
        
        element.classList.toggle('bg-emerald-500/[0.03]', isChecked);
        element.classList.toggle('border-emerald-500/20', isChecked);
        element.classList.toggle('border-transparent', !isChecked);
        
        const iconBox = element.querySelector('.check-box');
        if (iconBox) {
            if (isChecked) {
                iconBox.classList.add('bg-emerald-500', 'border-emerald-500');
                iconBox.classList.remove('border-blue-500/20', 'bg-black/20');
                iconBox.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>';
            } else {
                iconBox.classList.remove('bg-emerald-500', 'border-emerald-500');
                iconBox.classList.add('border-blue-500/20', 'bg-black/20');
                iconBox.innerHTML = '';
            }
        }

        window.updateSkillSelectionCount();
    };

    window.updateSkillSelectionCount = () => {
        const count = document.querySelectorAll('.crud-skill-check:checked').length;
        const summary = document.getElementById('skill-selection-summary');
        if (summary) {
            summary.innerText = count > 0 ? `${count} SKILL ATTIVATE` : 'NESSUNA SKILL';
        }
    };

    window.filterSkills = (query) => {
        const q = query.toLowerCase();
        document.querySelectorAll('.skill-item').forEach(item => {
            const name = item.getAttribute('data-name');
            const cat = item.getAttribute('data-category');
            if (name.includes(q) || cat.includes(q)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    };

    let formHtml = `
        <div class="animate-fade-in space-y-4">
            <div>
                <label class="snapshot-label">NOME</label>
                <input type="text" id="crud-name" class="snapshot-input" placeholder="Esempio: React Expert" value="${item?.name || ''}">
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="snapshot-label">CATEGORIA / TAG</label>
                    <input type="text" id="crud-category" class="snapshot-input" placeholder="Esempio: sviluppatore, tester..." value="${item?.category || ''}">
                </div>
                <div>
                    <label class="snapshot-label">MODULO IDENTIFICATIVO</label>
                    <input type="text" class="snapshot-input opacity-50 cursor-not-allowed" value="${item?.slug || 'Auto-generato'}" disabled>
                </div>
            </div>

            <div>
                <label class="snapshot-label">DESCRIZIONE BREVE</label>
                <textarea id="crud-description" class="snapshot-input h-20 resize-none overflow-hidden" placeholder="Spiega cosa fa questo modulo...">${description}</textarea>
            </div>

            <div>
                <label class="snapshot-label theme-accent">SYSTEM PROMPT / ISTRUZIONI</label>
                <div class="relative group">
                    <div class="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg blur opacity-25 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
                    <textarea id="crud-prompt" class="snapshot-input relative h-48 font-mono custom-scrollbar focus:ring-1 focus:ring-blue-500/30" placeholder="Sei un esperto sviluppatore...">${prompt}</textarea>
                </div>
            </div>

            ${renderSkills()}

            ${type === 'skills' ? `
                <div class="pt-4">
                    <label class="snapshot-label text-emerald-500">LOGICA JAVASCRIPT</label>
                    <div class="relative group">
                        <div class="absolute -inset-1 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 rounded-lg blur opacity-25 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
                        <textarea id="crud-logic" class="snapshot-input relative h-64 font-mono custom-scrollbar focus:ring-1 focus:ring-emerald-500/30" placeholder="Inserisci la logica...">${logic}</textarea>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    root.innerHTML = `
        <div id="crud-overlay" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <div class="snapshot-modal scale-in max-h-[90vh] ${themeClass}">
                <!-- Header Snapshot Fidelity -->
                <div class="snapshot-header">
                    <div class="flex items-center">
                        <div class="snapshot-header-box" style="background: ${accentColor} !important;">
                            <span>${type === 'agents' ? 'A' : 'S'}</span>
                        </div>
                        <div class="flex flex-col">
                            <h3 class="text-white font-bold text-lg uppercase tracking-tight leading-tight">${title}</h3>
                            <span class="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">${type === 'agents' ? 'Artificial Intelligence' : 'Logic Extension'}</span>
                        </div>
                    </div>
                    <button id="crud-close" class="p-2 text-gray-500 hover:text-white transition-all hover:bg-white/5 rounded-full">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                
                <!-- Body Snapshot Fidelity -->
                <div class="px-8 py-6 flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-main)]">
                    ${formHtml}
                </div>
                
                <!-- Footer Snapshot Fidelity -->
                <div class="snapshot-footer">
                    <button id="crud-cancel" class="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600 hover:text-gray-300 transition-colors">ANNULLA</button>
                    <button id="crud-save" class="snapshot-btn-theme shadow-2xl">
                         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                         <span>Salva Configurazione</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('crud-close').onclick = closeCrudModal;
    document.getElementById('crud-cancel').onclick = closeCrudModal;
    
    if (isPreview) {
        if (document.getElementById('crud-close-preview')) document.getElementById('crud-close-preview').onclick = closeCrudModal;
        root.querySelectorAll('input, textarea, input[type="checkbox"]').forEach(el => el.disabled = true);
        return; 
    }

    document.getElementById('crud-save').onclick = async () => {
        const nameVal = document.getElementById('crud-name').value.trim();
        const categoryVal = document.getElementById('crud-category').value.trim();
        const descVal = document.getElementById('crud-description').value.trim();
        
        if (!nameVal) {
            window.gxToast(t('crud.nameRequired'), "error");
            return;
        }

        const payload = {
            name: nameVal,
            category: categoryVal,
            description: descVal
        };

        if (type === 'agents') {
            payload.systemPrompt = document.getElementById('crud-prompt').value;
            payload.assignedSkills = Array.from(document.querySelectorAll('.crud-skill-check:checked')).map(c => c.value);
        } else if (type === 'skills') {
            payload.logic = document.getElementById('crud-logic').value;
        }

        const btn = document.getElementById('crud-save');
        const origText = btn.innerHTML;
        btn.innerHTML = `<span class="animate-pulse">${t('crud.syncing')}</span>`;
        btn.disabled = true;
        
        try {
            if (isEdit) {
                if (type === 'agents') await api.updateAgent(item.id, payload);
                else await api.updateSkill(item.id, payload);
            } else {
                if (type === 'agents') await api.createAgent(payload);
                else await api.createSkill(payload);
            }
            window.gxToast(isEdit ? "Modifiche salvate" : "Creato con successo", "success");
            closeCrudModal();
        } catch (e) {
            console.error(e);
            btn.innerHTML = origText;
            btn.disabled = false;
            window.gxToast("Errore salvataggio", "error");
        }
    };

    const publishBtn = document.getElementById('crud-publish');
    if (publishBtn) {
        publishBtn.onclick = async () => {
            const repo = state.repositories.find(r => r.enabled);
            if (!repo) {
                window.gxToast(t('crud.noRepo'), "warning");
                return;
            }

            const origHtml = publishBtn.innerHTML;
            publishBtn.innerHTML = `<span class="animate-pulse">${t('crud.publishing')}</span>`;
            publishBtn.disabled = true;

            try {
                const res = await api.publishItem(item, repo.url);
                if (res && res.success) {
                    publishBtn.innerHTML = t('crud.sent');
                    publishBtn.classList.add('bg-emerald-600', 'text-white');
                    setTimeout(() => {
                        publishBtn.innerHTML = origHtml;
                        publishBtn.disabled = false;
                        publishBtn.classList.remove('bg-emerald-600', 'text-white');
                    }, 3000);
                } else {
                    publishBtn.innerHTML = t('crud.error');
                    publishBtn.disabled = false;
                    setTimeout(() => publishBtn.innerHTML = origHtml, 2000);
                }
            } catch (e) {
                publishBtn.innerHTML = t('crud.error');
                publishBtn.disabled = false;
                setTimeout(() => publishBtn.innerHTML = origHtml, 2000);
            }
        };
    }
};

export const initCrud = () => {
    window.openCrudModal = openCrudModal;
    window.closeCrudModal = closeCrudModal;
    console.log("[GX-CRUD] Redesigned and stabilized.");
};
