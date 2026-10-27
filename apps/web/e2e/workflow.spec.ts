import { expect, test } from '@playwright/test';
import { acceptDialogs, assignRecommended, expectToast, loginAs } from './helpers';

// Parcours complet dans l'interface : demande → intervention → mission → rapport → devis.
test.describe.configure({ mode: 'serial' });

test('redirige vers la connexion sans session', async ({ page }) => {
    await page.goto('/devis');
    await expect(page).toHaveURL(/\/login\?next=%2Fdevis/);
});

test('refuse un mauvais mot de passe', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('julien@fluxia.fr');
    await page.getByLabel('Mot de passe').fill('mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.locator('.form-error')).toContainText('incorrect');
});

test('parcours du responsable puis du technicien', async ({ page, browser }) => {
    test.setTimeout(180_000); // long parcours (compilation des pages à la première visite en dev)
    acceptDialogs(page);
    await loginAs(page, 'julien@fluxia.fr');
    await expect(page.getByRole('heading', { name: /Bonjour Julien/ })).toBeVisible();

    // 1. Inbox : ouvrir la panne et créer l'intervention
    await page.goto('/inbox');
    await page.getByRole('link', { name: /climatisation en panne/ }).click();
    await expect(page.getByRole('heading', { name: /climatisation en panne/ })).toBeVisible();
    await page.getByRole('button', { name: "Créer l'intervention" }).click();
    await page.waitForURL(/\/interventions\//);
    await expectToast(page, /Intervention #\d+ créée/);

    // 2. Affecter le technicien recommandé puis envoyer la mission
    const techEmail = await assignRecommended(page);
    await page.getByRole('button', { name: /Envoyer la mission/ }).click();
    await expectToast(page, 'Mission envoyée');
    const interventionUrl = page.url();
    // Lien vers la vue terrain au jour de la mission (le créneau dépend de l'heure d'exécution)
    const fieldUrl = (await page.getByRole('link', { name: /Ouvrir la vue technicien/ }).getAttribute('href'))!;

    // 3. Le technicien se connecte dans une autre session et rédige son compte rendu
    const techContext = await browser.newContext();
    const tech = await techContext.newPage();
    await loginAs(tech, techEmail);
    await expect(tech).toHaveURL(/\/techniciens\//);
    // Accès aux écrans de gestion refusé : retour à sa vue terrain
    await tech.goto('/devis');
    await expect(tech).toHaveURL(/\/techniciens\//);

    await tech.goto(interventionUrl);
    await expect(tech).toHaveURL(/\/techniciens\//);
    await tech.goto(fieldUrl);
    const mission = tech.locator('.card', { has: tech.getByRole('heading', { name: 'Restaurant Le Parisien' }) });
    await mission.getByRole('button', { name: 'Exemple' }).click();
    await mission.getByRole('button', { name: /Générer le rapport/ }).click();
    await tech.waitForURL(/\/rapports\//);
    await expect(tech.getByText('Condensateur de démarrage climatisation').first()).toBeVisible();
    // Lecture seule pour le technicien
    await expect(tech.getByRole('button', { name: 'Valider le rapport' })).toHaveCount(0);
    await techContext.close();

    // 4. Le responsable génère le devis, le valide et l'envoie
    await page.goto(interventionUrl);
    await page.getByRole('link', { name: "Rapport d'intervention" }).click();
    await page.getByRole('button', { name: /Générer le brouillon de devis/ }).click();
    await page.waitForURL(/\/devis\//);
    await expectToast(page, /Brouillon de devis D-\d{4}-\d{3} généré/);
    await page.getByRole('button', { name: /Valider le devis/ }).click();
    await expectToast(page, 'Devis validé');
    await page.getByRole('button', { name: 'Envoyer au client' }).click();
    await expectToast(page, 'Devis envoyé au client');

    // 5. Valider et envoyer le rapport : l'intervention est clôturée
    await page.goto(interventionUrl);
    await page.getByRole('link', { name: "Rapport d'intervention" }).click();
    await page.getByRole('button', { name: 'Valider le rapport' }).click();
    await expectToast(page, 'Rapport validé');
    await page.getByRole('button', { name: 'Envoyer au client' }).click();
    await expectToast(page, /intervention clôturée/);

    await page.goto(interventionUrl);
    await expect(page.getByText('Clôturée').first()).toBeVisible();
});

test('reçoit et analyse une nouvelle demande', async ({ page }) => {
    await loginAs(page, 'julien@fluxia.fr');
    await page.goto('/inbox/nouvelle');
    await page.getByRole('button', { name: 'Panne clim (client connu)' }).click();
    await page.getByRole('button', { name: /Recevoir et analyser/ }).click();
    await page.waitForURL(/\/inbox\/c/);
    await expectToast(page, 'Demande reçue et analysée');
    await expect(page.getByText('Restaurant Le Parisien').first()).toBeVisible();
});

test('programme les entretiens préventifs depuis l’accueil', async ({ page }) => {
    await loginAs(page, 'julien@fluxia.fr');
    const card = page.locator('.card', { has: page.getByText('Entretiens à venir') });
    await expect(card.getByText('Cabinet Morel')).toBeVisible();
    await card.getByRole('button', { name: 'Programmer' }).click();
    await expectToast(page, /entretien\(s\) à planifier créé\(s\)/);
    await expect(card.getByText(/programmée/)).toBeVisible();
});
