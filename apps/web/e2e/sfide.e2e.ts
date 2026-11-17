import { expect, test, type Browser, type Page } from '@playwright/test';

// Sfida 1 contro 1 tra due amici (utenti di sviluppo: tutti amici tra loro, a livello 5 grazie a ?xp=). Richiede l'app avviata con DEV_LOGIN.

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `shot-${name}.png` });
}

async function enter(browser: Browser, user: string, admin = false): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/api/auth/dev?user=${user}&xp=2000&onboarded=1${admin ? '&admin=1' : ''}`);
  // Il dizionario si carica: finché non è pronto il pulsante Gioca è disattivato
  await expect(page.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });
  return page;
}

/** Traccia sulla griglia le prime quattro caselle della prima riga (quasi sempre una parola che non esiste). */
async function traceFirstRow(page: Page, size: number): Promise<void> {
  const box = (await page.locator('.grid').first().boundingBox())!;
  const cell = box.width / size;
  const y = box.y + cell / 2;
  await page.mouse.move(box.x + cell / 2, y);
  await page.mouse.down();
  for (let i = 1; i < 4; i++) await page.mouse.move(box.x + cell * i + cell / 2, y, { steps: 4 });
  await page.mouse.up();
}

test('sfida: chi lancia gioca subito, aggiornamenti in tempo reale, bilancio, filtri, segnalazione', async ({ browser }) => {
  const suffix = Date.now().toString(36);
  const a = `ale${suffix}`;
  const b = `bea${suffix}`;
  const pageB = await enter(browser, b); // b deve esistere nel gioco prima di poter essere sfidata (amici di sviluppo)
  const pageA = await enter(browser, a);

  // A lancia la sfida a B (4×4 per poter tracciare una riga)
  await pageA.getByRole('button', { name: 'Sfide', exact: true }).click();
  await pageA.getByRole('button', { name: '+ Sfida un amico' }).click();
  await pageA.getByRole('button', { name: b, exact: true }).click();
  await pageA.getByRole('button', { name: '4×4', exact: true }).click();
  await pageA.getByRole('button', { name: '0:30', exact: true }).click();
  await pageA.getByRole('button', { name: 'Lancia la sfida' }).click();
  await expect(pageA.getByRole('heading', { name: `Sfida con ${b}` })).toBeVisible();
  await expect(pageA.getByText('In attesa di risposta')).toBeVisible();
  await shot(pageA, 'sfida-dettaglio');

  // B riceve l'avviso dentro il gioco senza ricaricare la pagina (tempo reale), e l'invito è tra le notizie
  await expect(pageB.getByRole('button', { name: /Nuova sfida/ })).toBeVisible({ timeout: 10_000 });
  await pageB.getByRole('button', { name: 'Notizie' }).click();
  await expect(pageB.getByText('1 invito di sfida')).toBeVisible();
  await pageB.keyboard.press('Escape');

  // A gioca subito, prima che B accetti, e traccia una parola che non esiste
  await pageA.getByRole('button', { name: 'Gioca', exact: true }).click();
  await traceFirstRow(pageA, 4);
  await expect(pageA.getByRole('heading', { name: 'Partita inviata' })).toBeVisible({ timeout: 60_000 });
  await expect(pageA.getByRole('heading', { name: /Trovate/ })).toBeVisible();
  await expect(pageA.getByRole('heading', { name: /Mancate/ })).toBeVisible();
  await shot(pageA, 'sfida-inviata');

  // Segnala: la parola rifiutata compare, si conferma e risulta segnalata
  const report = pageA.locator('.report');
  await expect(report.getByRole('heading', { name: /Segnala/ })).toBeVisible();
  const chip = report.locator('.word-chip').first();
  if (await chip.count()) {
    await chip.click();
    await report.getByRole('button', { name: 'Segnala', exact: true }).click();
    await expect(report.getByText('segnalata')).toBeVisible();
  }

  // B apre la sfida dall'avviso, accetta e gioca; A, sul dettaglio, vede il risultato arrivare da solo
  await pageA.getByRole('button', { name: 'Torna alla sfida' }).click();
  await expect(pageA.getByText(/Hai giocato\. Aspetta che/)).toBeVisible();
  await pageB.goto('/');
  await expect(pageB.getByRole('button', { name: 'Gioca', exact: true })).toBeEnabled({ timeout: 30_000 });
  await pageB.getByRole('button', { name: 'Sfide', exact: true }).click();
  await pageB.getByRole('button', { name: new RegExp(`${a} ti ha sfidato`) }).click();
  await pageB.getByRole('button', { name: 'Accetta' }).click();
  await pageB.getByRole('button', { name: 'Gioca', exact: true }).click();
  await expect(pageB.getByRole('heading', { name: 'Partita inviata' })).toBeVisible({ timeout: 60_000 });
  await expect(pageB.getByText('La sfida è conclusa')).toBeVisible();

  await expect(pageA.getByText('Conclusa', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(pageA.getByText('Pareggio!')).toBeVisible();
  await expect(pageA.getByLabel(`Bilancio contro ${b}`)).toContainText('0 perse');
  await expect(pageA.getByRole('heading', { name: /Mancate da entrambi/ })).toBeVisible();
  await shot(pageA, 'sfida-esito');

  // Elenco: filtri per giocatore e risultato
  await pageA.getByRole('button', { name: 'Torna alle sfide' }).click();
  await pageA.getByLabel('Filtra per giocatore').selectOption({ label: b });
  await pageA.getByRole('button', { name: 'Pari', exact: true }).click();
  await expect(pageA.getByRole('button', { name: new RegExp(`Sfida con ${b}`) })).toBeVisible();
  await pageA.getByRole('button', { name: 'Vinte', exact: true }).click();
  await expect(pageA.getByText('Nessuna sfida con questi filtri.')).toBeVisible();
});

test('admin: approva una parola segnalata, che entra nel dizionario', async ({ browser }) => {
  const word = `zq${Date.now().toString(36).replace(/[0-9]/g, 'x')}`;
  const player = await enter(browser, `seg${Date.now().toString(36)}`);
  // Le richieste che modificano devono venire dalla stessa origine (come quelle del browser)
  const res = await player.request.post('/api/reports/words', { data: { word }, headers: { Origin: new URL(player.url()).origin } });
  expect(res.status()).toBe(204);

  const admin = await enter(browser, `adm${Date.now().toString(36)}`, true);
  await admin.getByRole('button', { name: 'Profilo' }).click();
  await admin.getByRole('button', { name: 'Amministrazione' }).click();
  await admin.getByRole('button', { name: /Gestione parole/ }).click();
  const row = admin.locator('li', { hasText: word });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Aggiungi al dizionario' }).click();
  await expect(row).toHaveCount(0);

  const additions = await (await admin.request.get('/api/dictionary/additions')).json();
  expect(additions.words).toContain(word);
});
