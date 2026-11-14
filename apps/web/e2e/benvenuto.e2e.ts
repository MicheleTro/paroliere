import { expect, test } from '@playwright/test';

// Primo accesso: benvenuto, prima partita guidata (il bradipo suggerisce una parola), poi il benvenuto non torna più.
// Richiede l'app avviata con DEV_LOGIN (vedi playwright.config.ts).

test.use({ viewport: { width: 390, height: 780 } });

test('benvenuto e prima partita guidata', async ({ page }) => {
  test.setTimeout(90_000);
  const user = `nuovo${Date.now().toString(36)}`;
  await page.goto(`/api/auth/dev?user=${user}`);

  // Il benvenuto compare al primo ingresso; "Più tardi" lo chiude
  const welcome = page.getByRole('dialog', { name: 'Benvenuto!' });
  await expect(welcome).toBeVisible({ timeout: 30_000 });
  await welcome.getByRole('button', { name: 'Più tardi' }).click();
  await expect(welcome).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });

  // Dopo un ricaricamento torna (la prima partita non è ancora fatta) e porta alla partita guidata
  await page.reload();
  await expect(welcome).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });
  await welcome.getByRole('button', { name: 'Prima partita' }).click();

  // Il bradipo indica una parola e fa lampeggiare le sue caselle
  await expect(page.locator('.grid')).toBeVisible();
  await expect(page.locator('.coach .say')).toContainText('Trascina:');
  expect(await page.locator('.cell.hint').count()).toBeGreaterThanOrEqual(3);

  // Uscendo (con conferma) la partita non conta: il benvenuto non è ancora chiuso del tutto
  await page.getByRole('button', { name: 'Esci dalla partita' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Uscire dalla partita?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Esci e perdi tutto' }).click();
  await expect(page.getByRole('button', { name: 'Gioca', exact: true })).toBeVisible();

  // Segnata la prima partita guidata, il benvenuto non compare più
  const done = await page.request.post('/api/me/onboarded', { data: {} });
  expect(done.status()).toBe(204);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('dialog', { name: 'Benvenuto!' })).toHaveCount(0);
});
