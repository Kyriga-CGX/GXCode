// APP/core/i18n.js
// Lightweight i18n engine for GXCode

let currentLocale = {};
let currentLang = localStorage.getItem('gx-language') || 'it';
const listeners = new Set();

/**
 * Load a locale file and set it as active.
 * @param {string} lang - 'it' or 'en'
 */
export const loadLocale = async (lang) => {
    try {
        const basePath = import.meta.url.replace(/core\/i18n\.js.*$/, '');
        const res = await fetch(`${basePath}locales/${lang}.json`);
        if (!res.ok) throw new Error(`Locale ${lang} not found`);
        currentLocale = await res.json();
        currentLang = lang;
        localStorage.setItem('gx-language', lang);
        // Aggiorna tutti gli elementi con data-i18n
        updateDOMTranslations();
        // Notifica i subscriber
        for (const fn of listeners) fn(lang);
    } catch (err) {
        console.warn(`[i18n] Failed to load locale '${lang}':`, err);
    }
};

/**
 * Get translation for a key. Supports nested keys with dot notation.
 * Falls back to the key itself if not found.
 * @param {string} key - e.g. 'settings.preferences'
 * @returns {string}
 */
export const t = (key) => {
    const parts = key.split('.');
    let val = currentLocale;
    for (const p of parts) {
        if (val && typeof val === 'object' && p in val) {
            val = val[p];
        } else {
            return key; // Fallback: mostra la chiave
        }
    }
    return typeof val === 'string' ? val : key;
};

/**
 * Get current language code
 */
export const getLang = () => currentLang;

/**
 * Subscribe to language changes
 */
export const onLangChange = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

/**
 * Scan DOM for [data-i18n] attributes and replace content.
 * Supports: 
 * - plain key: sets textContent
 * - [html]key: sets innerHTML
 * - [attrName]key: sets specific attribute (e.g. [placeholder], [title])
 * - Multiple tasks: data-i18n="key; [title]tooltipKey"
 */
const updateDOMTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const rawValue = el.getAttribute('data-i18n');
        if (!rawValue) return;

        const tasks = rawValue.split(';');
        tasks.forEach(task => {
            task = task.trim();
            if (!task) return;

            let target = 'text'; // Default
            let key = task;

            if (task.startsWith('[')) {
                const match = task.match(/^\[(.*?)\](.*)$/);
                if (match) {
                    target = match[1].toLowerCase();
                    key = match[2].trim();
                }
            }

            const translated = t(key);
            if (translated === key && !key.includes('.')) return; // Safety: don't overwrite with key itself if not a real key

            if (target === 'text') {
                el.textContent = translated;
            } else if (target === 'html' || target === 'inner') {
                el.innerHTML = translated;
            } else if (target === 'placeholder') {
                el.placeholder = translated;
            } else if (target === 'title') {
                el.title = translated;
            } else {
                el.setAttribute(target, translated);
            }
        });
    });
};

// Esponi globale per l'uso inline
window.t = t;
window.loadLocale = loadLocale;
window.getLang = getLang;
