import { describe, expect, it } from 'vitest';
import { compareVersions, parseRelease } from './updates';
const release = (version = 'v0.0.3') => ({
  tag_name: version,
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
describe('GitHub-Updates', () => {
  it('vergleicht Zahlen statt Zeichenketten und behandelt gleiche und ältere Releases korrekt', () => {
    expect(compareVersions('v0.0.10', '0.0.2')).toBe(1);
    expect(compareVersions('0.0.2', 'v0.0.2')).toBe(0);
    expect(compareVersions('0.0.1', '0.0.2')).toBe(-1);
    expect(() => compareVersions('v0.0.3-rc1', '0.0.2')).toThrow();
    expect(parseRelease(release(), '0.0.2')).toMatchObject({
      available: true,
      latestVersion: '0.0.3',
    });
    expect(parseRelease(release('v0.0.1'), '0.0.2').available).toBe(false);
  });
  it('lehnt nicht veröffentlichte Releases und fehlende oder fremde APKs ab', () => {
    expect(() => parseRelease({ ...release(), draft: true }, '0.0.2')).toThrow();
    expect(() => parseRelease({ ...release(), prerelease: true }, '0.0.2')).toThrow();
    expect(() => parseRelease({ ...release(), assets: [] }, '0.0.2')).toThrow('keine passende APK');
    const bad = release();
    bad.assets[0].browser_download_url = 'https://example.org/update.apk';
    expect(() => parseRelease(bad, '0.0.2')).toThrow('keine passende APK');
    expect(() => parseRelease(null)).toThrow();
  });
  it('bietet keine übergroße oder noch hochgeladene Datei an', () => {
    const bad = release();
    bad.assets[0].size = 200 * 1024 * 1024;
    expect(() => parseRelease(bad, '0.0.2')).toThrow('keine passende APK');
    bad.assets[0].size = 1000;
    bad.assets[0].state = 'starter';
    expect(() => parseRelease(bad, '0.0.2')).toThrow('keine passende APK');
  });
});
