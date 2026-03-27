// APP/components/crud.js
import { state } from '../core/state.js';
import { api } from '../core/api.js';

const closeCrudModal = () => {
    const root = document.getElementById('modals-root');
    root.innerHTML = '';
    root.classList.add('pointer-events-none');
};

const openCrudModal = (type, item = null) => {
    const root = document.getElementById('modals-root');
    root.classList.remove('pointer-events-none');
    const isEdit = !!item;
    const typeLabel = type === 'agents' ? window.t('crud.agent') : (type === 'skills' ? window.t('crud.skill') : window.t('crud.addon'));
    const title = isEdit ? window.t('crud.edit').replace('{type}', typeLabel) : window.t('crud.new').replace('{type}', typeLabel);

    // Common fields
    let formHtml = `
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold" data-i18n="crud.name">${window.t('crud.name')}</label>
            <input id="crud-name" type="text" class="w-full bg-[#0d1117] border border-gray-700/50 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 transition focus:bg-[#161b22]" value="${item?.name || ''}" data-i18n="[placeholder]crud.namePlaceholder" placeholder="${window.t('crud.namePlaceholder')}" required>
        </div>
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold" data-i18n="crud.category">${window.t('crud.category')}</label>
            <input id="crud-category" type="text" class="w-full bg-[#0d1117] border border-gray-700/50 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 transition focus:bg-[#161b22]" value="${item?.category || ''}" data-i18n="[placeholder]crud.catPlaceholder" placeholder="${window.t('crud.catPlaceholder')}">
        </div>
    `;

    // Specific fields
    if (type === 'agents') {
        formHtml += `
        <div class="mb-4">
            <label class="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold" data-i18n="crud.prompt">${window.t('crud.prompt')}</label>
            <textarea id="crud-prompt" class="w-full bg-[#0d1117] border border-gray-700/50 rounded px-3 py-2 text-sm text-blue-400 outline-none focus:border-blue-500 transition focus:bg-[#161b22] resize-none h-24 font-mono" data-i18n="[placeholder]crud.promptPlaceholder" placeholder="${window.t('crud.promptPlaceholder')}">${item?.systemPrompt || item?.instructions || ''}</textarea>
        </div>
        `;
    }

    if (type === 'agents' && isEdit && state.skills?.length > 0) {
        // Skill Assignation View logic
        const assignedSkills = item.assignedSkills || [];
        const skillChecks = state.skills.map(skill => `
            <label class="flex items-center gap-2 text-sm text-gray-300 hover:bg-[#161b22] px-2 py-1.5 rounded cursor-pointer border border-transparent hover:border-gray-800 transition group">
                <input type="checkbox" value="${skill.id}" class="crud-skill-check rounded border-gray-600 outline-none accent-blue-500" ${assignedSkills.includes(String(skill.id)) || assignedSkills.includes(Number(skill.id)) ? 'checked' : ''}>
                <div class="flex flex-col">
                    <span class="font-medium">${skill.name}</span>
                    <span class="text-[9px] text-gray-500 uppercase tracking-widest font-bold opacity-0 group-hover:opacity-100 transition-opacity">Categoria: ${skill.category || 'general'}</span>
                </div>
                <span class="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-gray-500 border border-gray-800 uppercase tracking-tighter shrink-0">${skill.category || 'tool'}</span>
            </label>
        `).join('');
        
        formHtml += `
        <div class="mb-4 mt-6">
            <label class="block text-xs text-gray-400 mb-2 uppercase tracking-wider font-bold border-b border-gray-800 pb-1" data-i18n="crud.assignSkills">${window.t('crud.assignSkills')}</label>
            <div class="max-h-48 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                ${skillChecks}
            </div>
        </div>
        `;
    }

    root.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto flex items-center justify-center animate-fade-in p-4 z-50">
            <div class="bg-[#12161d] w-full max-w-lg rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-gray-800 flex flex-col scale-in">
                <div class="p-4 border-b border-gray-800 flex justify-between items-center bg-[#161b22] rounded-t-xl shrink-0">
                    <h3 class="text-base font-bold text-gray-200 tracking-wide">${title}</h3>
                    <button id="crud-close" class="text-gray-500 hover:text-white transition group"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="group-hover:rotate-90 transition-transform duration-300" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
                
                <div class="p-5 flex-1 overflow-y-auto custom-scrollbar">
                    ${formHtml}
                </div>
                
                <div class="p-4 border-t border-gray-800 flex justify-between items-center bg-[#161b22] rounded-b-xl shrink-0">
                    <button id="crud-cancel" class="px-5 py-2 hover:bg-white/5 text-[11px] uppercase tracking-widest font-bold text-gray-500 rounded-md transition" data-i18n="crud.cancel">${window.t('crud.cancel')}</button>
                    
                    <div class="flex gap-2">
                        ${isEdit ? `
                            <button id="crud-publish" class="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 text-[11px] uppercase tracking-widest font-bold rounded-md transition shadow-lg active:scale-95">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <span data-i18n="crud.publish">${window.t('crud.publish')}</span>
                            </button>
                        ` : ''}
                        <button id="crud-save" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-[11px] uppercase tracking-widest font-bold text-white rounded-md transition shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                            <span data-i18n="crud.save">${window.t('crud.save')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('crud-close').onclick = closeCrudModal;
    document.getElementById('crud-cancel').onclick = closeCrudModal;

    document.getElementById('crud-save').onclick = async () => {
        const nameVal = document.getElementById('crud-name').value.trim();
        const descVal = document.getElementById('crud-desc').value.trim();
        const catVal = document.getElementById('crud-category')?.value.trim() || 'general';
        const promptVal = type === 'agents' ? document.getElementById('crud-prompt')?.value.trim() : null;
        
        let assignedSkills = [];
        document.querySelectorAll('.crud-skill-check:checked').forEach(chk => assignedSkills.push(chk.value));

        if (!nameVal) { alert(window.t('crud.nameRequired')); return; }
        
        const payload = { 
            name: nameVal, 
            description: descVal,
            category: catVal,
            ...(type === 'agents' && { systemPrompt: promptVal, assignedSkills })
        };
        
        const btn = document.getElementById('crud-save');
        const origText = btn.innerHTML;
        btn.innerHTML = `<span class="animate-pulse">${window.t('crud.syncing')}</span>`;
        
        if (isEdit) {
            if (type === 'agents') await api.updateAgent(item.id, payload);
            else await api.updateSkill(item.id, payload);
        } else {
            if (type === 'agents') await api.createAgent(payload);
            else await api.createSkill(payload);
        }
        
        closeCrudModal();
    };

    if (isEdit && document.getElementById('crud-publish')) {
        document.getElementById('crud-publish').onclick = async () => {
            const repo = state.repositories.find(r => r.enabled);
            if (!repo) {
                alert(window.t('crud.noRepo'));
                return;
            }

            const btn = document.getElementById('crud-publish');
            const origHtml = btn.innerHTML;
            btn.innerHTML = `<span class="animate-pulse">${window.t('crud.publishing')}</span>`;
            btn.disabled = true;

            const res = await api.publishItem(item, repo.url);
            
            if (res && res.success) {
                btn.innerHTML = window.t('crud.sent');
                btn.className = "flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-[11px] uppercase tracking-widest font-bold rounded-md transition";
                setTimeout(() => {
                    btn.innerHTML = origHtml;
                    btn.disabled = false;
                    btn.className = "flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 text-[11px] uppercase tracking-widest font-bold rounded-md transition shadow-lg active:scale-95";
                }, 3000);
            } else {
                btn.innerHTML = window.t('crud.error');
                btn.disabled = false;
                setTimeout(() => btn.innerHTML = origHtml, 2000);
            }
        };
    }
};

export const initCrud = () => {
    // Il delegation event viene associato in app.js per il CRUD Edit/Delete
    window.openCrudModal = openCrudModal;
    window.closeCrudModal = closeCrudModal;
};
