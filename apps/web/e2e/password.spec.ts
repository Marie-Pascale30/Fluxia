import { expect, test } from '@playwright/test';
import { DEMO_PASSWORD } from './helpers';

// API de la pile de test (scripts/e2e-api.mjs) : création du compte et lecture de l'email envoyé
const API = process.env.E2E_API_URL ?? 'http://localhost:4005/api';

test('mot de passe oublié : lien reçu par email, nouveau mot de passe, connexion', async ({ page, request }) => {
    const { token: manager } = await (await request.post(`${API}/auth/login`, { data: { email: 'julien@fluxia.fr', password: DEMO_PASSWORD } })).json();
    const auth = { authorization: `Bearer ${manager}` };
    const email = `lea.garnier.${Date.now()}@fluxia.fr`;
    expect((await request.post(`${API}/technicians`, { headers: auth, data: { firstName: 'Léa', lastName: 'Garnier', email, skills: ['VMC'] } })).status()).toBe(201);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.getByRole('status')).toContainText('un lien de réinitialisation');

    const { messages } = await (await request.get(`${API}/messages`, { headers: auth })).json();
    const body: string = messages.find((m: { recipient: string }) => m.recipient === email).body;
    const link = new URL(body.match(/https?:\/\/\S+\/mot-de-passe\/[\w-]+/)![0]);

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
    await expect(page.getByRole('alert')).toContainText('Lien invalide ou expiré');
});
