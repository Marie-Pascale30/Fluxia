import { expect, test } from '@playwright/test';
import { expectToast, loginAs } from './helpers';

test('nouvelle entreprise : inscription, paramètres, espace isolé et réception des emails', async ({ page, browser }) => {
    test.setTimeout(120_000);
    const email = `nina.roux.${Date.now()}@clim-express.fr`;

    // Inscription : la session s'ouvre directement sur les paramètres
    await page.goto('/login');
    await page.getByRole('link', { name: 'Créer un compte' }).click();
    await page.getByLabel('Nom de l’entreprise').fill('Clim Express');
    await page.getByLabel('Votre nom').fill('Nina Roux');
    await page.getByLabel('Email professionnel').fill(email);
    await page.getByLabel('Mot de passe (8 caractères minimum)').fill('un-mot-de-passe-solide');
    await page.getByLabel('Confirmation du mot de passe').fill('un-mot-de-passe-solide');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon espace' }).click();
    await page.waitForURL(/\/parametres/);
    await expect(page.getByText('Bienvenue sur Fluxia')).toBeVisible();
    await expect(page.locator('.side-org')).toHaveText('Clim Express');

    // Coordonnées de l'entreprise
    await page.getByLabel('Téléphone').fill('04 91 00 00 00');
    await page.getByLabel(/Mentions légales/).fill('SARL Clim Express · SIRET 111 222 333 00011');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expectToast(page, 'Paramètres enregistrés');
    await page.reload();
    await expect(page.getByLabel('Téléphone')).toHaveValue('04 91 00 00 00');

    // Espace vide : aucune donnée de l'entreprise de démo
    await page.goto('/clients');
    await expect(page.getByText('Restaurant Le Parisien')).toHaveCount(0);
    await page.goto('/inbox');
    await expect(page.getByText('climatisation en panne')).toHaveCount(0);

    // Email entrant via l'adresse de réception affichée dans les paramètres (relais du web vers l'API)
    await page.goto('/parametres');
    const webhook = (await page.getByLabel('Adresse du webhook').textContent())!.trim();
    const received = await page.request.post(webhook, {
        data: { FromFull: { Email: 'accueil@hotel-vieuxport.fr', Name: 'Hôtel Vieux-Port' }, Subject: 'VMC très bruyante', TextBody: 'La VMC des chambres fait beaucoup de bruit depuis hier soir.' },
    });
    expect(received.status()).toBe(200);
    await page.goto('/inbox');
    await expect(page.getByText('VMC très bruyante').first()).toBeVisible();

    // L'entreprise de démo ne voit pas cette demande
    const demoContext = await browser.newContext();
    const demo = await demoContext.newPage();
    await loginAs(demo, 'julien@fluxia.fr');
    await expect(demo.locator('.side-org')).toHaveText('Fluxia Maintenance');
    await demo.goto('/inbox');
    await expect(demo.getByText('climatisation en panne').first()).toBeVisible();
    await expect(demo.getByText('VMC très bruyante')).toHaveCount(0);
    await demoContext.close();

    // Export RGPD puis suppression définitive de l'entreprise
    await page.goto('/parametres');
    const download = await page.request.get('/export/donnees');
    expect(download.status()).toBe(200);
    expect((await download.json()).organization.name).toBe('Clim Express');
    await page.getByText('Supprimer l’entreprise').click();
    await page.getByLabel('Nom de l’entreprise, pour confirmer').fill('Clim Express');
    await page.getByLabel('Votre mot de passe').fill('un-mot-de-passe-solide');
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await page.waitForURL(/\/login\?supprime=1/);
    await expect(page.getByText('toutes ses données ont été supprimées')).toBeVisible();
});
