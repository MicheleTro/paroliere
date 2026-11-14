import { expect, test, type Page } from '@playwright/test';

// Settimana, serie, profilo e impostazioni, su uno schermo piccolo (360×640): la pagina non scorre mai.
// Richiede l'app avviata con DEV_LOGIN (vedi playwright.config.ts). Dura circa 2 minuti: si gioca una griglia vera.

test.use({ viewport: { width: 360, height: 640 } });

/** La pagina non deve mai scorrere, né avere contenuto tagliato fuori da una casella che scorre. */
async function expectNoPageScroll(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(450); // i fogli entrano con un'animazione: si misura a fine movimento
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const clipped: string[] = [];
    for (const el of document.querySelectorAll('.screen, .screen > .content, .page')) {
      const style = getComputedStyle(el);
      const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
      if (!scrolls && el.scrollHeight > el.clientHeight + 2) clipped.push(`${el.className} ${el.scrollHeight}>${el.clientHeight}`);
    }
    // il contenitore non deve essere stato fatto scorrere (focus o scrollIntoView lo sposterebbero anche con overflow nascosto)
    const moved = document.querySelector('.app-root')?.scrollTop ?? 0;
    return { page: Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight + moved, clipped };
  });
  expect(result.page, `${label}: la pagina scorre`).toBeLessThanOrEqual(1);
  expect(result.clipped, `${label}: contenuto tagliato`).toEqual([]);
}

/** Con E2E_SHOTS=1 salva uno screenshot (per guardare la grafica a occhio). */
async function shot(page: Page, name: string): Promise<void> {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `shot-${name}.png` });
}

async function drag(page: Page, path: number[]): Promise<void> {
  const cells = await page.locator('.grid .cell').all();
  const boxes = await Promise.all(cells.map((c) => c.boundingBox()));
  const center = (i: number) => ({ x: boxes[i]!.x + boxes[i]!.width / 2, y: boxes[i]!.y + boxes[i]!.height / 2 });
  await page.mouse.move(center(path[0]!).x, center(path[0]!).y);
  await page.mouse.down();
  for (const index of path.slice(1)) await page.mouse.move(center(index).x, center(index).y, { steps: 6 });
  await page.mouse.up();
}

test('settimana, profilo e impostazioni', async ({ page }) => {
  test.setTimeout(240_000);
  const user = `wk${Date.now().toString(36)}`;
  await page.goto(`/api/auth/dev?user=${user}&onboarded=1`);

  // Ogni giornata si sblocca solo giocando la precedente: si chiudono (a vuoto) quelle di prima di oggi
  const origin = new URL(page.url()).origin;
  const overview = (await (await page.request.get(`${origin}/api/week`)).json()) as { todayIndex: number };
  for (let day = 0; day < overview.todayIndex; day++) {
    const begun = (await (await page.request.post(`${origin}/api/week/${day}/start`, { data: {}, headers: { origin } })).json()) as { id: string };
    await page.request.post(`${origin}/api/plays/${begun.id}/finish`, { data: { words: [] }, headers: { origin } });
  }
  if (overview.todayIndex > 0) await page.reload();

  const playButton = page.getByRole('button', { name: 'Gioca', exact: true });
  await expect(playButton).toBeEnabled({ timeout: 30_000 });
  await expectNoPageScroll(page, 'home');

  // --- La scena: sette giorni sul ramo, oggi è da giocare; le sfide sono bloccate al livello 1 ---
  await expect(page.locator('g.node[role="button"]')).toHaveCount(7);
  await expect(page.getByRole('button', { name: /Sfide, bloccate fino al livello 5/ })).toBeVisible();
  const today = page.locator('g.node[role="button"]', { hasText: /LUN|MAR|MER|GIO|VEN|SAB|DOM/ }).filter({ has: page.locator('.pulse') });
  await expect(today).toHaveCount(1);

  // --- Il giorno di oggi: regole, un pulsante per giocare ---
  await today.click({ force: true }); // il nodo pulsa: non è mai "fermo"
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Gioca', exact: true })).toBeVisible();
  await expectNoPageScroll(page, 'foglio del giorno');

  const startResponse = page.waitForResponse((r) => /\/api\/week\/\d\/start$/.test(r.url()) && r.request().method() === 'POST');
  await sheet.getByRole('button', { name: 'Gioca', exact: true }).click();
  const started = (await (await startResponse).json()) as { solutions: { word: string; path: number[] }[]; remainingMs: number };
  await expect(page.locator('.grid')).toBeVisible();
  await expectNoPageScroll(page, 'partita');

  // --- Tre parole trascinando sulla griglia, poi si lascia scadere il tempo ---
  const words = started.solutions.filter((s) => s.path.length >= 3).slice(0, 3);
  for (const word of words) await drag(page, word.path);
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible({ timeout: started.remainingMs + 30_000 });
  await expect(page.getByText('XP', { exact: true })).toBeVisible();

  // Prima partita e prima Settimana: le medaglie arrivano una alla volta, a riepilogo aperto
  const next = page.getByRole('button', { name: 'Continua' });
  await expect(next.first()).toBeVisible({ timeout: 10_000 });
  await shot(page, 'medaglia');
  let medals = 0;
  while ((await next.count()) > 0) {
    medals++;
    await next.first().click();
    await page.waitForTimeout(500);
  }
  expect(medals).toBeGreaterThanOrEqual(3);
  await shot(page, 'riepilogo');
  await expectNoPageScroll(page, 'riepilogo della settimana');

  // Le parole mancate non si vedono nella Settimana, solo in Gioca
  await page.getByRole('button', { name: 'Parole' }).click();
  await expect(page.getByRole('button', { name: /Mancate/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Trovate|^[a-zàèéìòù]/i }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi' }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();

  // --- Di nuovo a casa: oggi è giocata, il tentativo è uno solo ---
  await expect(page.getByRole('button', { name: /oggi/ })).toHaveCount(0);
  await expect(page.locator('svg text', { hasText: /\d+ pt/ })).toHaveCount(overview.todayIndex + 1);
  await page.getByRole('button', { name: /fatta/ }).nth(overview.todayIndex).click({ force: true });
  await expect(page.getByRole('dialog').getByText('Il tuo punteggio')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Gioca', exact: true })).toHaveCount(0);
  await expectNoPageScroll(page, 'foglio del giorno giocato');
  await page.keyboard.press('Escape');

  // --- Classifica della settimana ---
  await page.getByRole('button', { name: "Classifica di Sloth's week" }).click();
  await expect(page.getByRole('dialog', { name: 'Classifica' }).getByText(user)).toBeVisible();
  await shot(page, 'classifica');
  await page.keyboard.press('Escape');

  // --- Serie ---
  await page.getByRole('button', { name: /Serie 1 su 10/ }).click();
  await expect(page.getByRole('dialog', { name: 'Serie 1/10' })).toBeVisible();
  await page.keyboard.press('Escape');

  // --- Profilo: livello, parole, medaglie ---
  await page.getByRole('button', { name: 'Profilo' }).click();
  await expect(page.getByText(/Livello \d/).first()).toBeVisible();
  await expect(page.locator('.medals .m:not(.off)').first()).toBeVisible();
  await shot(page, 'profilo');
  await expectNoPageScroll(page, 'profilo');
  await page.locator('.ptile', { hasText: 'parole' }).click();
  await expect(page.getByRole('dialog').locator('.wchip').first()).toBeVisible();
  await expectNoPageScroll(page, 'elenco parole');
  await page.keyboard.press('Escape');

  // --- Impostazioni: si salvano sul server e restano dopo il ricaricamento ---
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await expectNoPageScroll(page, 'impostazioni');
  const sound = page.getByRole('button', { name: 'Suoni', exact: true });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await page.getByRole('button', { name: 'Notte', exact: true }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole('button', { name: 'Profilo' }).click();
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await expect(page.getByRole('button', { name: 'Suoni', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Notte', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
