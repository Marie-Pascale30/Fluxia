import { expect, test } from '@playwright/test';
import { acceptDialogs, expectToast, loginAs } from './helpers';

// PNG 1×1 valide
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('terrain : sur place, photo, signature du client, rapport et PDF', async ({ page }) => {
    test.setTimeout(150_000);
    acceptDialogs(page);
    await loginAs(page, 'thomas.martin@fluxia.fr');

    // Mission du jour (données de démo) : entretien à la Boulangerie ABC
    const mission = page.locator('.card', { has: page.getByRole('heading', { name: 'Boulangerie ABC' }) });
    await mission.getByRole('button', { name: 'Je suis sur place' }).click();
    await expectToast(page, 'Intervention démarrée');

    // Photo
    await mission.getByPlaceholder('Légende (facultatif)').fill('Unité intérieure');
    await mission.locator('input[type="file"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await expectToast(page, 'Photo ajoutée');
    await expect(mission.locator('.gallery img')).toHaveCount(1);

    // Signature tracée sur le pavé
    const pad = mission.locator('canvas.signature-pad');
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 100);
    await page.mouse.down();
    for (const [dx, dy] of [[60, -40], [120, 30], [180, -30], [240, 20]]) await page.mouse.move(box.x + dx + 30, box.y + 100 + dy, { steps: 5 });
    await page.mouse.up();
    await mission.getByPlaceholder('Nom du signataire').fill('Paul Martin');
    await mission.getByRole('button', { name: 'Valider la signature' }).click();
    await expectToast(page, 'Signature de Paul Martin enregistrée');
    await expect(mission.getByText('Signé par')).toBeVisible();

    // Compte rendu → rapport
    await mission.getByRole('button', { name: 'Exemple' }).click();
    await mission.getByRole('button', { name: /Générer le rapport/ }).click();
    await page.waitForURL(/\/rapports\//);
    await expect(page.locator('.gallery img')).toHaveCount(1);
    await expect(page.getByText('Signé par')).toBeVisible();

    // PDF accessible au technicien
    const href = await page.getByRole('link', { name: 'Aperçu PDF' }).getAttribute('href');
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
