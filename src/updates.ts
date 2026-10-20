import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { version } from '../package.json';

export const APP_VERSION = version;
export const RELEASES_URL = 'https://github.com/Endopterygota/Vogelstimmen_Lernapp/releases';
export const LATEST_RELEASE_API =
  'https://api.github.com/repos/Endopterygota/Vogelstimmen_Lernapp/releases/latest';
const ASSET_PREFIX = RELEASES_URL + '/download/';
export type UpdateInfo = {
  installedVersion: string;
  latestVersion: string;
  available: boolean;
  size: number;
};
export type DownloadProgress = { received: number; total: number };
interface UpdaterPlugin {
  check(): Promise<UpdateInfo>;
  download(): Promise<{ ready: boolean }>;
  install(): Promise<{ installerOpened: boolean }>;
  addListener(
    event: 'downloadProgress',
    callback: (progress: DownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
}
export const nativeUpdater = registerPlugin<UpdaterPlugin>('AppUpdater');
export const isAndroidApp = () => Capacitor.getPlatform() === 'android';

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    if (!/^v?\d+\.\d+\.\d+$/.test(v))
      throw new Error('Die Release-Version wird nicht unterstützt.');
    return v.replace(/^v/, '').split('.').map(Number);
  };
  const left = parse(a),
    right = parse(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

export function parseRelease(json: unknown, installedVersion = APP_VERSION): UpdateInfo {
  if (!json || typeof json !== 'object') throw new Error('Ungültige Antwort von GitHub.');
  const release = json as Record<string, unknown>;
  if (release.draft || release.prerelease || typeof release.tag_name !== 'string')
    throw new Error('Kein stabiles Release verfügbar.');
  const available = compareVersions(release.tag_name, installedVersion) > 0;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apk = assets.find((a) => {
    if (!a || typeof a !== 'object') return false;
    return (
      typeof a.name === 'string' &&
      /^Vogelstimmen-\d+\.\d+\.\d+\.apk$/.test(a.name) &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith(ASSET_PREFIX) &&
      a.browser_download_url.endsWith('.apk') &&
      a.state === 'uploaded' &&
      typeof a.size === 'number' &&
      a.size > 0 &&
      a.size <= 150 * 1024 * 1024
    );
  });
  if (available && !apk)
    throw new Error(
      'Das neueste Release enthält noch keine passende APK. Bitte später erneut prüfen.',
    );
  return {
    installedVersion,
    latestVersion: release.tag_name.replace(/^v/, ''),
    available,
    size: apk?.size || 0,
  };
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  if (isAndroidApp()) return nativeUpdater.check();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (response.status === 403 || response.status === 429)
      throw new Error('GitHub ist gerade ausgelastet. Bitte später erneut prüfen.');
    if (response.status === 404) throw new Error('Noch kein Release verfügbar.');
    if (!response.ok)
      throw new Error('GitHub konnte nicht erreicht werden. Bitte später erneut prüfen.');
    return parseRelease(await response.json());
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError'))
      throw new Error('Keine Verbindung zu GitHub. Bitte die Internetverbindung prüfen.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
