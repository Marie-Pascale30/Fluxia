import { expect, test } from '@playwright/test';
import { acceptDialogs, createQuoteFromNewRequest, expectToast, loginAs } from './helpers';

test('facturation : devis accepté → facture émise → réglée → export comptable', async ({ page }) => {
    test.setTimeout(150_000);
    acceptDialogs(page);
    await loginAs(page, 'julien@fluxia.fr');

    await createQuoteFromNewRequest(page);
    await page.getByRole('button', { name: 'Valider le devis' }).click();
    await expectToast(page, 'Devis validé');
    await page.getByRole('button', { name: 'Envoyer au client' }).click();
    await expectToast(page, 'Devis envoyé');
    await page.getByRole('button', { name: 'Accepté par le client' }).click();
    await expectToast(page, 'accepté');

    await page.getByRole('button', { name: 'Créer la facture' }).click();
    await page.waitForURL(/\/factures\//);
    await expect(page.getByRole('heading', { name: 'Facture brouillon' })).toBeVisible();

    await page.getByRole('button', { name: 'Émettre la facture' }).click();
    await expectToast(page, /Facture F-\d{4}-\d{4} émise/);
    await expect(page.getByRole('heading', { name: /Facture F-\d{4}-\d{4}/ })).toBeVisible();

    await page.getByRole('button', { name: 'Marquer comme payée' }).click();
    await expectToast(page, 'Règlement enregistré');
    await expect(page.getByText('Payée').first()).toBeVisible();

    const pdf = await page.request.get((await page.getByRole('link', { name: 'PDF' }).getAttribute('href'))!);
    expect(pdf.headers()['content-type']).toBe('application/pdf');

    await page.goto('/factures?view=paid');
    const csv = await page.request.get('/export/ventes');
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(await csv.text()).toContain('706000');
});
