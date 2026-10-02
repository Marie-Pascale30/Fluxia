import { expect, test } from '@playwright/test';
import { acceptDialogs, createQuoteFromNewRequest, expectToast, loginAs } from './helpers';

test('portail : le client accepte en ligne le devis reçu', async ({ page, browser }) => {
    test.setTimeout(150_000);
    acceptDialogs(page);
    await loginAs(page, 'julien@fluxia.fr');

    // Le responsable prépare, valide et envoie le devis de la SCI Rivoli
    const quoteUrl = await createQuoteFromNewRequest(page);
    await page.getByRole('button', { name: 'Valider le devis' }).click();
    await expectToast(page, 'Devis validé');
    await page.getByRole('button', { name: 'Envoyer au client' }).click();
    await expectToast(page, 'Devis envoyé au client');

    // Lien de l'espace client depuis la fiche client
    await page.getByRole('link', { name: 'SCI Rivoli' }).first().click();
    const link = await page.getByLabel("Lien de l'espace client").inputValue();
    const path = new URL(link).pathname;

    // Le client, sans compte, ouvre son espace et accepte
    const client = await browser.newContext();
    const portal = await client.newPage();
    await portal.goto(path);
    await expect(portal.getByText('Espace client · SCI Rivoli')).toBeVisible();
    await expect(portal.getByRole('button', { name: 'Accepter le devis' })).toBeDisabled();
    await portal.getByLabel('Votre nom').fill('Claire Rousseau');
    await portal.getByLabel(/J'accepte ce devis/).check();
    await portal.getByRole('button', { name: 'Accepter le devis' }).click();
    await expect(portal.getByText('Votre accord a bien été enregistré')).toBeVisible();
    const pdf = await portal.request.get(`${path}/pdf/devis/${quoteUrl.split('/').pop()}`);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    await client.close();

    // Côté responsable : le devis est accepté
    await page.goto(quoteUrl);
    await expect(page.getByText('Accepté').first()).toBeVisible();
    await expect(page.getByText(/accepté en ligne par Claire Rousseau/)).toBeVisible();
});

test('portail : un lien invalide affiche une page introuvable', async ({ page }) => {
    const res = await page.goto('/portail/lien-falsifie.abc');
    expect(res?.status()).toBe(404);
});
