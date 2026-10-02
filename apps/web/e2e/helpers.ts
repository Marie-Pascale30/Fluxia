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
