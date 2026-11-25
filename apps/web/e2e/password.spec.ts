import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { DEMO_PASSWORD } from './helpers';

// API de la pile de test (scripts/e2e-api.mjs) : création du compte et lecture de l'email envoyé
const API = process.env.E2E_API_URL ?? 'http://localhost:4005/api';
// Emails simulés capturés par l'API de test (le lien n'est jamais stocké en base ni visible dans « Envois »)
const MAILBOX = resolve(import.meta.dirname, '../../api/mail-capture-e2e');

async function resetLink(to: string): Promise<string> {
    for (let i = 0; i < 50; i++) {
        const files = existsSync(MAILBOX) ? readdirSync(MAILBOX).sort().reverse() : [];
        for (const f of files) {
            const mail = JSON.parse(readFileSync(join(MAILBOX, f), 'utf8')) as { to: string; text: string };
            const link = mail.to === to ? mail.text.match(/https?:\/\/\S+\/mot-de-passe\/[\w-]+/)?.[0] : undefined;
            if (link) return link;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Aucun lien de réinitialisation reçu par ${to}`);
}

test('mot de passe oublié : lien reçu par email, nouveau mot de passe, connexion', async ({ page, request }) => {
    const { token: manager } = await (await request.post(`${API}/auth/login`, { data: { email: 'julien@fluxia.fr', password: DEMO_PASSWORD } })).json();
    const auth = { authorization: `Bearer ${manager}` };
    const email = `lea.garnier.${Date.now()}@fluxia.fr`;
    expect((await request.post(`${API}/technicians`, { headers: auth, data: { firstName: 'Léa', lastName: 'Garnier', email, skills: ['VMC'] } })).status()).toBe(201);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.locator('.notice.success')).toContainText('un lien de réinitialisation');

    const link = new URL(await resetLink(email));

    await page.goto(link.pathname);
    await page.getByLabel('Nouveau mot de passe (8 caractères minimum)').fill('mon-nouveau-secret');
    await page.getByLabel('Confirmation').fill('mon-nouveau-secret');
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click();
    await page.waitForURL(/\/techniciens\//);

    // Le lien ne sert qu'une fois
    await page.context().clearCookies();
    await page.goto(link.pathname);
    await page.getByLabel('Nouveau mot de passe (8 caractères minimum)').fill('encore-un-secret');
    await page.getByLabel('Confirmation').fill('encore-un-secret');
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click();
    await expect(page.locator('.form-error')).toContainText('Lien invalide ou expiré');
});
