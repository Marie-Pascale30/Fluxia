import { expect, test } from '@playwright/test';
import { acceptDialogs, createQuoteFromNewRequest, expectToast, loginAs } from './helpers';

test.describe.configure({ mode: 'serial' });

test('expéditeur inconnu : fiche client créée depuis la demande, puis réponse', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'julien@fluxia.fr');

    await page.goto('/inbox/nouvelle');
    await page.getByRole('button', { name: 'Particulier inconnu' }).click();
    await page.getByRole('button', { name: /Recevoir et analyser/ }).click();
    await page.waitForURL(/\/inbox\/c/);
    await expect(page.getByText('Expéditeur inconnu')).toBeVisible();

    // Formulaire pré-rempli avec l'expéditeur ; on complète l'adresse
    const form = page.locator('form', { has: page.getByRole('button', { name: /Créer le client/ }) });
    await expect(form.getByLabel('Nom / raison sociale')).toHaveValue('Julie Bernard');
    await form.getByLabel('Adresse').fill('25 rue de Vaugirard');
    await form.getByLabel('Code postal').fill('75015');
    await form.getByLabel('Ville').fill('Paris');
    await form.getByRole('button', { name: /Créer le client/ }).click();
    await expectToast(page, 'Fiche client créée');
    await expect(page.getByRole('button', { name: "Créer l'intervention" })).toBeEnabled();

    // Réponse rédigée par l'IA, relue puis envoyée
    await page.getByRole('button', { name: /Rédiger une réponse/ }).click();
    const body = page.getByLabel('Message');
    await expect(body).toHaveValue(/Bonjour Julie/);
    await page.getByRole('button', { name: 'Envoyer la réponse' }).click();
    await expectToast(page, 'Réponse envoyée');
    await expect(page.getByText(/envoyé/).first()).toBeVisible();
});

test('devis : les modifications non enregistrées sont enregistrées avant validation', async ({ page }) => {
    test.setTimeout(120_000);
    acceptDialogs(page);
    await loginAs(page, 'julien@fluxia.fr');

    // Devis depuis une nouvelle demande de chiffrage
    await createQuoteFromNewRequest(page);

    const firstQty = page.locator('table input[type="number"]').first();
    await firstQty.fill('2');
    await expect(page.getByText('Modifications non enregistrées')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer et valider' }).click();
    await expectToast(page, 'Devis validé');

    // La version validée contient bien la quantité modifiée
    await expect(page.locator('table tbody tr').first().locator('td').nth(1)).toHaveText('2');
});

test('gestion : nouveau client, nouvel article de catalogue', async ({ page }) => {
    await loginAs(page, 'julien@fluxia.fr');

    await page.goto('/clients/nouveau');
    await page.getByLabel('Nom / raison sociale').fill(`Brasserie Test ${Date.now() % 10000}`);
    await page.getByLabel('Nom du site').fill('Salle');
    await page.getByLabel('Adresse').fill('8 rue Oberkampf');
    await page.getByLabel('Code postal').fill('75011');
    await page.getByLabel('Ville').fill('Paris');
    await page.getByRole('button', { name: 'Créer le client' }).click();
    await page.waitForURL(/\/clients\/c/);
    await expect(page.getByText('Salle')).toBeVisible();

    await page.goto('/catalogue');
    const code = `E2E-${Date.now() % 100000}`;
    await page.getByLabel('Code').fill(code);
    await page.getByLabel('Désignation').first().fill('Joint de test');
    await page.getByLabel('Prix HT (€)').first().fill('12,50');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expectToast(page, `Article ${code} ajouté`);
    await expect(page.locator('code', { hasText: code })).toBeVisible();
});
