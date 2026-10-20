import { readFileSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
const media = JSON.parse(readFileSync('src/data/media.json', 'utf8'));
assert.equal(Object.keys(media).length, 20);
let files = 0,
  bytes = 0;
for (const [id, data] of Object.entries(media)) {
  assert(data.image, `${id}: Foto fehlt`);
  assert(data.recordings.length >= 2, `${id}: mindestens zwei Aufnahmen erwartet`);
  for (const m of [data.image, ...data.recordings]) {
    for (const key of ['author', 'license', 'licenseUrl', 'sourceUrl', 'path', 'changes'])
      assert(m[key], `${id}: ${key} fehlt`);
    assert(m.license.startsWith('CC BY') || m.license === 'CC0' || m.license === 'Public domain');
    assert(m.path.startsWith('/media/'));
    const size = statSync('public' + m.path).size;
    assert(size > 5000, `${m.path}: Datei leer`);
    bytes += size;
    files++;
  }
}
console.log(
  `${Object.keys(media).length} Arten, ${files} geprüfte Medien, ${(bytes / 1048576).toFixed(1)} MiB`,
);
