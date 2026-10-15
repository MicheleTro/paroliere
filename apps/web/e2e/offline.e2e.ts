import { expect, test } from '@playwright/test';

test('modalità offline: allenamento e storico senza richieste al server', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (req) => {
    const { hostname, port } = new URL(req.url());
    // L'app gira su localhost:5199; il backend sarebbe su un'altra porta/host.
    if (port !== '5199' || hostname !== 'localhost') apiRequests.push(req.url());
  });

  await page.goto('/');

  const training = page.getByRole('button', { name: /Allenamento/ });
  await expect(training).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByText('Sfide')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Esci' })).toHaveCount(0);
  await expect(page.getByText('Accedi')).toHaveCount(0);

  await training.click();
  await page.getByRole('button', { name: '0:30', exact: true }).click();
  await page.getByRole('button', { name: 'Inizia' }).click();

  await expect(page.getByRole('heading', { name: 'Riepilogo' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Segnala/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Torna alla home' }).click();
  await page.getByRole('button', { name: /Storico/ }).click();
  await expect(page.getByRole('heading', { name: 'Storico' })).toBeVisible();
  await expect(page.getByText(/punti/).first()).toBeVisible();

  expect(apiRequests).toEqual([]);
});
