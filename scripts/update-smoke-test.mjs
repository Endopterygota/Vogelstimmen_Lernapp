import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const release = (tag) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'Vogelstimmen-0.0.3.apk',
      browser_download_url:
        'https://github.com/Endopterygota/Vogelstimmen_Lernapp/releases/download/v0.0.3/Vogelstimmen-0.0.3.apk',
      state: 'uploaded',
      size: 32112675,
    },
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  let scenario = 'current',
    requests = 0;
  await page.route('https://api.github.com/**', async (route) => {
    requests++;
    if (scenario === 'offline') return route.abort();
    if (scenario === 'limit') return route.fulfill({ status: 429, body: '{}' });
    if (scenario === 'missing')
      return route.fulfill({ status: 200, json: { ...release('v0.0.3'), assets: [] } });
    return route.fulfill({
      status: 200,
      json: release(scenario === 'current' ? 'v' + version : 'v0.0.3'),
    });
  });
  await page.goto('http://127.0.0.1:5173');
  await page
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .filter({ visible: true })
    .click();
  assert.equal(requests, 0, 'keine automatische Netzwerkprüfung');
  const check = page.getByRole('button', { name: 'Nach Updates suchen' });
  await check.click();
  await page.getByText(/Du bist auf dem neuesten Stand/).waitFor();
  scenario = 'new';
  await check.click();
  await page.getByText('Version 0.0.3 ist verfügbar.', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Update herunterladen & installieren' }).count(),
    0,
    'Browser startet keinen Android-Installer',
  );
  scenario = 'offline';
  await check.click();
  await page.getByRole('alert').filter({ hasText: 'Keine Verbindung zu GitHub' }).waitFor();
  scenario = 'limit';
  await check.click();
  await page.getByRole('alert').filter({ hasText: 'ausgelastet' }).waitFor();
  scenario = 'missing';
  await check.click();
  await page.getByRole('alert').filter({ hasText: 'keine passende APK' }).waitFor();
  await page.close();

  // Simulate the Capacitor bridge to exercise the Android-specific UI and failure recovery.
  // APK validation and Android intents are native code; this does not replace a device test.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await context.addInitScript(
    ({ version }) => {
      window.androidBridge = {};
      window.updateCalls = [];
      window.updateFailure = '';
      const listeners = {};
      window.Capacitor = {
        PluginHeaders: [
          {
            name: 'AppUpdater',
            methods: [
              { name: 'check', rtype: 'promise' },
              { name: 'download', rtype: 'promise' },
              { name: 'install', rtype: 'promise' },
              { name: 'addListener', rtype: 'callback' },
              { name: 'removeListener', rtype: 'promise' },
            ],
          },
          {
            name: 'App',
            methods: [
              { name: 'addListener', rtype: 'callback' },
              { name: 'removeListener', rtype: 'promise' },
              { name: 'minimizeApp', rtype: 'promise' },
            ],
          },
        ],
        nativeCallback: (plugin, method, options, callback) => {
          listeners[options.eventName] = callback;
          return Promise.resolve('test-listener');
        },
        nativePromise: async (plugin, method) => {
          if (plugin !== 'AppUpdater') return {};
          window.updateCalls.push(method);
          if (method === 'check')
            return {
              installedVersion: version,
              latestVersion: '0.0.3',
              available: true,
              size: 32112675,
            };
          if (method === 'download') {
            listeners.downloadProgress?.({ received: 16000000, total: 32112675 });
            await new Promise((r) => setTimeout(r, 150));
            if (window.updateFailure === 'download') throw new Error('Download fehlgeschlagen.');
            return { ready: true };
          }
          if (method === 'install') {
            if (window.updateFailure === 'permission')
              throw new Error('Die Installation wurde noch nicht erlaubt.');
            return { installerOpened: true };
          }
          return {};
        },
      };
    },
    { version },
  );
  const native = await context.newPage();
  await native.goto('http://127.0.0.1:5173');
  await native
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .filter({ visible: true })
    .click();
  await native.getByRole('button', { name: 'Nach Updates suchen' }).click();
  await native.evaluate(() => {
    window.updateFailure = 'download';
  });
  await native.getByRole('button', { name: 'Update herunterladen & installieren' }).click();
  await native.getByRole('alert').filter({ hasText: 'Download fehlgeschlagen' }).waitFor();
  assert.equal(
    await native.evaluate(() => window.updateCalls.filter((c) => c === 'install').length),
    0,
  );
  await native.evaluate(() => {
    window.updateFailure = 'permission';
  });
  await native.getByRole('button', { name: 'Update herunterladen & installieren' }).click();
  await native
    .getByRole('alert')
    .filter({ hasText: 'Installation wurde noch nicht erlaubt' })
    .waitFor();
  await native.evaluate(() => {
    window.updateFailure = '';
  });
  await native.getByRole('button', { name: 'Installation öffnen', exact: true }).click();
  await native.getByText(/Der Android-Installer wurde geöffnet/).waitFor();
  await native.screenshot({ path: 'artifacts/mobile-update.png', fullPage: true });
  assert.equal(
    await native.evaluate(() => window.updateCalls.filter((c) => c === 'download').length),
    2,
    'Installationswiederholung lädt nicht erneut',
  );
  assert(
    await native.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Update-Karte läuft über',
  );
  await context.close();
  console.log(
    'OK: Update-Prüfung nur auf Klick, aktuelle/neue Version, offline, Rate-Limit, fehlende APK; Android-UI mit Bridge-Mock: Downloadfehler, Installationsberechtigung, Wiederholung ohne neuen Download.',
  );
} finally {
  await browser.close();
}
