import { expect, test } from '@playwright/test';
import { dispatchNewMission, loginAs } from './helpers';

test('hors ligne : brouillon conservé, rapport envoyé au retour du réseau', async ({ page, browser }) => {
    test.setTimeout(150_000);
    await loginAs(page, 'julien@fluxia.fr');
    const fieldUrl = await dispatchNewMission(page);

    const techContext = await browser.newContext();
    const tech = await techContext.newPage();
    await loginAs(tech, 'thomas.martin@fluxia.fr');
    await tech.goto(fieldUrl);

    const mission = tech.locator('.card', { has: tech.getByRole('heading', { name: 'Restaurant Le Parisien' }) }).first();
    const note = mission.locator('textarea[name="voiceNote"]');
    await note.fill("J'ai nettoyé les filtres et contrôlé la pression. Tout fonctionne normalement.");

    // Le brouillon survit à un rechargement
    await tech.reload();
    await expect(note).toHaveValue(/nettoyé les filtres/);

    // Coupure réseau au moment d'envoyer
    await techContext.setOffline(true);
    await mission.getByRole('button', { name: /Générer le rapport/ }).click();
    await expect(tech.getByText(/Hors ligne/)).toBeVisible();
    await expect(tech).toHaveURL(/\/techniciens\//);

    // Retour du réseau : l'action en attente repart d'elle-même
    await techContext.setOffline(false);
    await tech.waitForURL(/\/rapports\//, { timeout: 30_000 });
    await expect(tech.getByRole('heading', { name: /Rapport #\d+/ })).toBeVisible();
    await techContext.close();
});
