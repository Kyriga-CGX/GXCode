import { test, expect } from '@playwright/test';

test.describe('Esempio Navigazione Web', () => {
    
    test('Navigazione su Skills.sh', async ({ page }) => {
        // Naviga al sito
        console.log('Navigazione in corso...');
        await page.goto('https://skills.sh');

        // Attendi che la pagina sia caricata
        await page.waitForLoadState('networkidle');

        // Verifica la presenza di un elemento o il titolo
        const title = await page.title();
        console.log('Titolo della pagina:', title);

        // Screenshot di verifica
        await page.screenshot({ path: 'screenshot-skills.png' });

        // Verifica che il titolo contenga "Skills" (o una parola chiave del sito)
        expect(title.toLowerCase()).toContain('skill');
    });

});
