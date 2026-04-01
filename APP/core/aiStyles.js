/**
 * AI CSS Injection for Polished Webview
 */

export const AI_POLISH_STYLES = {
    gemini: `
        /* Nascondi TUTTI gli elementi di navigazione e sidebar della versione web */
        header, 
        .gb_1d, .gb_6d, .gb_3d, .gb_nd, .gb_ud,
        .side-nav-container, .side-nav, hospitality-nav,
        .gb_xc, .gb_rd, .gb_pd, .gb_od,
        aside, .navigation, 
        .header-container,
        [aria-label="Menu principale"],
        [aria-label="Impostazioni"],
        [aria-label="Nuova chat"],
        .gb_Id { display: none !important; }
        
        /* Forza l'espansione del corpo principale */
        main, .chat-container, .gemini-viewer-main { 
            padding-top: 0 !important; 
            margin-left: 0 !important; 
            max-width: 100% !important;
            width: 100% !important;
        }
        
        /* Nascondi footer e disclaimer */
        .agreement-container, .gemini-viewer-footer, .disclaimer-container,
        footer, .gb_7d { display: none !important; }

        /* Rimuovi bordi e ombre inutili */
        .chat-history { border: none !important; box-shadow: none !important; }
    `,
    claude: `
        /* Claude: Nascondi nav e sidebar */
        nav, header, [aria-label="Sidebar"], aside { display: none !important; }
        .flex.flex-col.h-full.min-h-0 { margin-left: 0 !important; }
        .mt-auto.p-4.text-center { display: none !important; }
    `
};
