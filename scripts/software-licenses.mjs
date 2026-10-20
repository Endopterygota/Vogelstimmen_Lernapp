import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const names = [
  'react',
  'react-dom',
  'scheduler',
  'lucide-react',
  '@capacitor/core',
  '@capacitor/app',
  '@capacitor/android',
];
let output = 'Vogelstimmen · Software-Lizenzen\n\n';
for (const name of names) {
  const dir = `node_modules/${name}`;
  const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((x) => `${dir}/${x}`).find(existsSync);
  if (file)
    output += `\n${'='.repeat(70)}\n${name}\n${'='.repeat(70)}\n${readFileSync(file, 'utf8')}\n`;
}
writeFileSync('public/licenses/THIRD-PARTY.txt', output);
