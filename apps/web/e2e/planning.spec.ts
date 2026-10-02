import { expect, test, type Page } from '@playwright/test';
import { acceptDialogs, expectToast, loginAs } from './helpers';

const PX_PER_MINUTE = 1.1;
const DAY_START = 8 * 60;

/** Position verticale (dans une colonne) où déposer pour commencer à `hour` une intervention de `duration` min. */
const yFor = (hour: number, duration: number) => (hour * 60 - DAY_START + duration / 2) * PX_PER_MINUTE;

/** Un jour ouvré dans une semaine, sans planning existant. */
function nextWeekday(offsetDays: number) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

async function column(page: Page, technician: string) {
    return page.locator(`.planning-col[data-technician="${technician}"]`);
}

test('planning : glisser-déposer pour planifier puis réaffecter', async ({ page }) => {
    test.setTimeout(150_000);
    acceptDialogs(page);
    await loginAs(page, 'julien@fluxia.fr');

    // Une intervention à planifier
    await page.goto('/inbox/nouvelle');
    await page.getByRole('button', { name: 'Panne clim (client connu)' }).click();
    await page.getByRole('button', { name: /Recevoir et analyser/ }).click();
    await page.waitForURL(/\/inbox\/c/);
    await page.getByRole('button', { name: "Créer l'intervention" }).click();
    await page.waitForURL(/\/interventions\//);
    const number = (await page.getByRole('heading', { level: 1 }).textContent())!.match(/#(\d+)/)![1];

    const date = nextWeekday(7);
    await page.goto(`/planning?date=${date}`);
    const item = page.locator('.unscheduled-item', { hasText: `#${number}` });
    await expect(item).toBeVisible();

    // Déposer sur la colonne de Sophie à 10:00 (durée 1 h 30)
    const sophie = await column(page, 'Sophie');
    await item.dragTo(sophie, { targetPosition: { x: 60, y: yFor(10, 90) } });
    await expectToast(page, 'Affectation enregistrée');
    const slot = sophie.locator('.slot', { hasText: '10:00' });
    await expect(slot).toBeVisible();

    // La déplacer chez Thomas à 14:00
    const thomas = await column(page, 'Thomas');
    await slot.dragTo(thomas, { targetPosition: { x: 60, y: yFor(14, 90) } });
    await expect(thomas.locator('.slot', { hasText: '14:00' })).toBeVisible();
    await expect(sophie.locator('.slot', { hasText: '10:00' })).toHaveCount(0);

    // Vue semaine
    await page.getByRole('link', { name: 'Semaine' }).click();
    await expect(page.locator('.week-item', { hasText: '14:00' }).first()).toBeVisible();
});
