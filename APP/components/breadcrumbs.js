import { state } from '../core/state.js';
import { getEditor, getDocumentSymbols } from '../core/editor.js';

export const updateBreadcrumbs = async () => {
    const bc = document.getElementById('editor-breadcrumbs');
    const activeFileId = state.activeFileId;
    const editor = getEditor();
    
    if (!bc || !activeFileId || !editor) return;

    const model = editor.getModel();
    if (!model) return;

    const pos = editor.getPosition();
    const symbols = getDocumentSymbols(model);
    const currentSymbol = symbols?.slice().reverse().find(s => s.range.startLineNumber <= pos.lineNumber);
    
    const pathParts = activeFileId.split('\\');
    const workspaceBase = state.workspaceData?.path || '';
    const workspaceBaseMatch = workspaceBase.split('\\').pop();
    
    let startIndex = pathParts.indexOf(workspaceBaseMatch);
    if (startIndex === -1) startIndex = 0;

    let breadcrumbsHtml = '';
    let currentPath = pathParts.slice(0, startIndex).join('\\');

    for (let i = startIndex; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (!part) continue;
        
        if (currentPath) currentPath += '\\' + part;
        else currentPath = part;

        const isLast = i === pathParts.length - 1;
        const isFirst = i === startIndex;

        breadcrumbsHtml += `
            ${!isFirst ? '<span class="opacity-30">/</span>' : ''}
            <span class="${isLast ? 'text-gray-400 font-bold' : 'hover:text-blue-400 cursor-pointer transition'}" 
                  ${!isLast ? `onclick="window.revealInTree('${currentPath.replace(/\\/g, '\\\\')}')"` : ''}>
                ${part}
            </span>
        `;
    }

    bc.innerHTML = `
        <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden">
            ${breadcrumbsHtml}
            ${currentSymbol ? `
                <span class="opacity-30">/</span>
                <span class="text-blue-500 flex items-center gap-1 cursor-pointer hover:underline" onclick="window.jumpToSymbol(${currentSymbol.range.startLineNumber})">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 11l-4 4-4-4"/></svg>
                    ${currentSymbol.name}
                </span>
            ` : ''}
        </div>
    `;
};

window.jumpToSymbol = (line) => {
    const editor = getEditor();
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
};
