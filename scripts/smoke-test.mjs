import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const names = {
  amsel: 'Amsel',
  singdrossel: 'Singdrossel',
  nachtigall: 'Nachtigall',
  rotkehlchen: 'Rotkehlchen',
  zaunkoenig: 'Zaunkönig',
  moenchsgrasmuecke: 'Mönchsgrasmücke',
  kohlmeise: 'Kohlmeise',
  blaumeise: 'Blaumeise',
  haussperling: 'Haussperling',
  zilpzalp: 'Zilpzalp',
  buchfink: 'Buchfink',
  ringeltaube: 'Ringeltaube',
  tuerkentaube: 'Türkentaube',
  kuckuck: 'Kuckuck',
  kleiber: 'Kleiber',
  buntspecht: 'Buntspecht',
  elster: 'Elster',
  rabenkraehe: 'Rabenkrähe',
  stockente: 'Stockente',
  mauersegler: 'Mauersegler',
};
const media = JSON.parse(readFileSync('src/data/media.json', 'utf8'));
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
const errors = [];
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
await context.route('**/*', (route) =>
  new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
);
const page = await context.newPage();
try {
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('heading', { name: 'Die Natur hat viel zu erzählen.' }).waitFor();
  await page.screenshot({ path: 'artifacts/mobile-start.png', fullPage: true });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'horizontaler Überlauf',
  );
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('button', { name: 'Vögel', exact: true })
    .click();
  assert.equal(await page.locator('.bird-card').count(), Object.keys(names).length);
  for (const [id, name] of Object.entries(names)) {
    await page.getByLabel('Vogel suchen').fill(name);
    await page.locator('.bird-card').first().click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    for (const width of [320, 360, 390, 412]) {
      await page.setViewportSize({ width, height: 844 });
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${id}: Steckbrief läuft bei ${width}px über`,
      );
    }
    await page.setViewportSize({ width: 360, height: 844 });
    const image = page.locator('.detail-photo img');
    assert(
      await image.evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth > 0;
      }),
      `${id}: Foto`,
    );
    const audio = page.locator('audio');
    await page.locator('.audio-credit summary').click();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${id}: Quellen laufen über`,
    );
    await page.locator('.audio-credit summary').click();
    await page.waitForFunction(() => Number.isFinite(document.querySelector('audio')?.duration));
    assert(await audio.evaluate((a) => a.duration > 0), `${id}: Audio-Metadaten`);
    await page.getByRole('button', { name: 'Aufnahme abspielen', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio')?.currentTime > 0.05);
    await page.getByRole('button', { name: 'Pausieren', exact: true }).click();
    for (let i = 1; i < media[id].recordings.length; i++) {
      await page.getByRole('button', { name: new RegExp(`Aufnahme ${i + 1}`) }).click();
      await page.waitForFunction(() => Number.isFinite(document.querySelector('audio')?.duration));
      assert(
        await page.locator('audio').evaluate((a) => a.duration > 0),
        `${id}: Aufnahme ${i + 1}`,
      );
    }
    if (id === 'rotkehlchen')
      await page.screenshot({ path: 'artifacts/mobile-steckbrief.png', fullPage: true });
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  }
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('button', { name: 'Lernen', exact: true })
    .click();
  await page.getByLabel('Anzahl Fragen').selectOption('5');
  await page.getByRole('button', { name: 'Hörquiz starten', exact: true }).click();
  for (let i = 0; i < 5; i++) {
    const src = await page.locator('.session-overlay audio').getAttribute('src');
    const id = Object.keys(names).find((key) => src.startsWith(`/media/${key}-`));
    assert(id, src);
    assert.equal(
      await page.locator('.answer:not([disabled])').count(),
      0,
      'Antwort vor Abspielen gesperrt',
    );
    await page.getByRole('button', { name: 'Aufnahme abspielen', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.session-overlay audio')?.currentTime > 0.05,
    );
    if (i === 0) await page.screenshot({ path: 'artifacts/mobile-quiz.png', fullPage: true });
    if (i < 4)
      await page
        .locator('.answers')
        .getByRole('button', { name: new RegExp(names[id] + '$') })
        .click();
    else await page.locator('.answer').filter({ hasNotText: names[id] }).first().click();
    await page
      .getByRole('button', { name: i === 4 ? 'Ergebnis ansehen' : 'Nächste Stimme', exact: true })
      .click();
  }
  await page.getByText('Du hast 4 von 5 Stimmen richtig erkannt.').waitFor();
  await page.getByRole('button', { name: 'Meinen Fortschritt ansehen' }).click();
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vogelstimmen.progress.v1')),
  );
  assert.equal(saved.answers, 5);
  assert.equal(saved.correct, 4);
  assert.equal(saved.rounds, 1);
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('button', { name: 'Lernen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Mit Hörkarten lernen' }).click();
  await page.getByRole('button', { name: 'Aufnahme abspielen', exact: true }).click();
  await page.getByRole('button', { name: 'Art aufdecken' }).click();
  await page.getByRole('button', { name: 'Noch unsicher' }).click();
  await page.getByRole('button', { name: 'Lernrunde schließen' }).click();
  await page.getByRole('button', { name: 'Runde beenden', exact: true }).click();
  const afterLearning = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vogelstimmen.progress.v1')),
  );
  assert.equal(afterLearning.answers, 6);
  assert.equal(afterLearning.rounds, 1);
  assert.equal(afterLearning.quizAnswers, 5);
  assert.equal(afterLearning.quizCorrect, 4);
  assert(!Object.keys(afterLearning.confusions).some((k) => k.includes('unsicher')));
  await page
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Dunkler Modus', exact: true }).click();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await page.screenshot({ path: 'artifacts/mobile-dunkel.png', fullPage: true });
  await page
    .getByRole('button', { name: 'Quellen & Lizenzen', exact: true })
    .filter({ visible: true })
    .click();
  assert.equal(await page.locator('.sources-card').count(), Object.keys(names).length);
  await page
    .locator('.sources-card')
    .first()
    .getByText('Aufnahme 1 · Gesang', { exact: true })
    .click();
  assert(
    (await page
      .locator('.sources-card')
      .first()
      .locator('a[href^="https://creativecommons.org"]')
      .count()) > 0,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator('.desktop-sidebar')
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await page.screenshot({ path: 'artifacts/desktop-start.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 740 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '360px Überlauf',
  );
  assert.deepEqual(errors, []);
  console.log(
    'OK: 20 Steckbriefe ohne seitlichen Überlauf bei 320/360/390/412px, alle Audios decodiert, Playback, Quiz, Hörkarten, Persistenz, Quellen, Dunkelmodus; keine externen Requests nötig.',
  );
} finally {
  await browser.close();
}
