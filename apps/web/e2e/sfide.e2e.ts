import { expect, test, type Browser, type Page } from '@playwright/test';

// Sfida 1 contro 1 tra due amici (utenti di sviluppo: tutti amici tra loro, a livello 5 grazie a ?xp=). Richiede l'app avviata con DEV_LOGIN.

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `shot-${name}.png` });
}

async function enter(browser: Browser, user: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/api/auth/dev?user=${user}&xp=2000&onboarded=1`);
  // Il dizionario si carica: finché non è pronto il pulsante Gioca è disattivato
  await expect(page.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });
  return page;
}

test('sfida un amico: invito, accettazione, partita di entrambi, risultato', async ({ browser }) => {
  const suffix = Date.now().toString(36);
  const a = `ale${suffix}`;
  const b = `bea${suffix}`;
  const pageB0 = await enter(browser, b); // b deve esistere nel gioco prima di poter essere sfidata (amici di sviluppo)
  const pageA = await enter(browser, a);

  // A lancia la sfida a B
  await pageA.getByRole('button', { name: 'Sfide', exact: true }).click();
  await pageA.getByRole('button', { name: '+ Sfida un amico' }).click();
  await pageA.getByRole('button', { name: b, exact: true }).click();
  await pageA.getByRole('button', { name: '0:30', exact: true }).click();
  await pageA.getByRole('button', { name: 'Lancia la sfida' }).click();
  await expect(pageA.getByRole('heading', { name: `Sfida con ${b}` })).toBeVisible();
  await expect(pageA.getByText('In attesa di risposta')).toBeVisible();
  await expect(pageA.getByRole('button', { name: 'Ritira la sfida' })).toBeVisible();
  await shot(pageA, 'sfida-dettaglio');

  // B vede l'invito tra le notizie (campanello) e accetta
  await pageB0.reload();
  await expect(pageB0.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });
  await pageB0.getByRole('button', { name: 'Notizie' }).click();
  await expect(pageB0.getByText('1 invito di sfida')).toBeVisible();
  await pageB0.locator('.drow', { hasText: '1 invito di sfida' }).getByRole('button', { name: 'Vai' }).click();
  await pageB0.getByRole('button', { name: new RegExp(`${a} ti ha sfidato`) }).click();
  await pageB0.getByRole('button', { name: 'Accetta' }).click();
  await expect(pageB0.getByRole('button', { name: 'Gioca', exact: true })).toBeVisible();

  // B gioca (30 secondi) e invia
  await pageB0.getByRole('button', { name: 'Gioca', exact: true }).click();
  await expect(pageB0.getByRole('heading', { name: 'Partita inviata' })).toBeVisible({ timeout: 60_000 });
  await expect(pageB0.getByText('quando avrà giocato anche il tuo avversario')).toBeVisible();
  await shot(pageB0, 'sfida-inviata');

  // A gioca e chiude la sfida
  await pageA.getByRole('button', { name: 'Torna alle sfide' }).click();
  await pageA.getByRole('button', { name: new RegExp(`Sfida con ${b}`) }).click();
  await expect(pageA.getByRole('button', { name: 'Gioca', exact: true })).toBeVisible();
  await pageA.getByRole('button', { name: 'Gioca', exact: true }).click();
  await expect(pageA.getByRole('heading', { name: 'Partita inviata' })).toBeVisible({ timeout: 60_000 });
  await expect(pageA.getByText('La sfida è conclusa')).toBeVisible();

  // Dettaglio finale: i due punteggi (senza parole inviate: 0 a 0, pareggio)
  await pageA.getByRole('button', { name: 'Torna alla sfida' }).click();
  await expect(pageA.getByText('Conclusa')).toBeVisible();
  await expect(pageA.getByText('Pareggio!')).toBeVisible();
  await shot(pageA, 'sfida-esito');
});
