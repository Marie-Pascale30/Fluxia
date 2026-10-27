import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'fluxia-demo';

export async function loginAs(page: Page, email: string) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Attend l'apparition d'un toast contenant le texte donné. */
export async function expectToast(page: Page, text: string | RegExp) {
    await expect(page.locator('.toast', { hasText: text }).last()).toBeVisible();
}

/** Accepte automatiquement les boîtes de confirmation natives. */
export const acceptDialogs = (page: Page) => page.on('dialog', (d) => d.accept());

/** Nouvelle demande de chiffrage (SCI Rivoli) reçue puis transformée en devis brouillon. */
export async function createQuoteFromNewRequest(page: Page) {
    await page.goto('/inbox/nouvelle');
    await page.getByRole('button', { name: 'Demande de devis' }).click();
    await page.getByRole('button', { name: /Recevoir et analyser/ }).click();
    await page.waitForURL(/\/inbox\/c/);
    await page.getByRole('button', { name: /Préparer le devis/ }).click();
    await page.waitForURL(/\/devis\//);
    return page.url();
}

/**
 * Nouvelle panne chez Restaurant Le Parisien, affectée au technicien recommandé et envoyée.
 * Renvoie l'URL de la vue terrain au jour de la mission et l'email du technicien affecté.
 */
/**
 * Affecte le technicien recommandé et renvoie son email de connexion.
 * La recommandation dépend de la charge du jour (donc des autres tests) : ne jamais supposer qui sera choisi.
 */
export async function assignRecommended(page: Page) {
    const best = page.locator('.reco.best');
    const name = (await best.locator('b').first().textContent())!.trim();
    await best.getByRole('button').click();
    await expectToast(page, 'Affectation enregistrée');
    const login = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '.');
    return `${login}@fluxia.fr`;
}

export async function dispatchNewMission(page: Page) {
    page.on('dialog', (d) => d.accept().catch(() => undefined));
    await page.goto('/inbox/nouvelle');
    await page.getByRole('button', { name: 'Panne clim (client connu)' }).click();
    await page.getByRole('button', { name: /Recevoir et analyser/ }).click();
    await page.waitForURL(/\/inbox\/c/);
    await page.getByRole('button', { name: "Créer l'intervention" }).click();
    await page.waitForURL(/\/interventions\//);
    const techEmail = await assignRecommended(page);
    await page.getByRole('button', { name: /Envoyer la mission/ }).click();
    await expectToast(page, 'Mission envoyée');
    const fieldUrl = (await page.getByRole('link', { name: /Ouvrir la vue technicien/ }).getAttribute('href'))!;
    return { fieldUrl, techEmail };
}
