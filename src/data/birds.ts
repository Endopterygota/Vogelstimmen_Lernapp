import media from './media.json';
export type Credit = {
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  originalUrl: string;
  description: string;
  changes: string;
  path: string;
};
export type Recording = Credit & { kind: string };
export type Bird = {
  id: string;
  name: string;
  scientific: string;
  habitat: string;
  appearance: string;
  voice: string;
  mnemonic: string;
  compare: string;
  season: string;
  level: string;
  image: Credit | null;
  recordings: Recording[];
};
const entries = [
  [
    'amsel',
    'Amsel',
    'Turdus merula',
    'Gärten, Parks und lichte Wälder',
    'Das Männchen ist schwarz mit gelbem Schnabel, das Weibchen unauffällig braun.',
    'Warme, flötende Strophen mit deutlichen Pausen. Jede Strophe klingt etwas anders.',
    'Ein ruhiger Flötenspieler auf dem Dach.',
    'Die Singdrossel wiederholt einzelne Motive öfter direkt hintereinander.',
    'Februar bis Juli',
    'Leicht',
  ],
  [
    'singdrossel',
    'Singdrossel',
    'Turdus philomelos',
    'Wälder, Parks und strukturreiche Gärten',
    'Braune Oberseite und helle Brust mit dunklen, pfeilförmigen Flecken.',
    'Kräftige, abwechslungsreiche Motive, die oft zwei- bis viermal wiederholt werden.',
    'Ein Motiv – gleich noch einmal, noch einmal!',
    'Die Amsel singt meist weichere Strophen ohne diese auffälligen Wiederholungsblöcke.',
    'März bis Juli',
    'Mittel',
  ],
  [
    'nachtigall',
    'Nachtigall',
    'Luscinia megarhynchos',
    'Dichtes Gebüsch, Auwälder und Parks',
    'Unscheinbar braun, mit rostbraunem Schwanz und heller Unterseite.',
    'Sehr kräftiger, vielseitiger Gesang: klare Pfeiftöne, rollende und schlagende Folgen.',
    'Flöten, Rollen, Schlagen – ein ganzes Orchester.',
    'Auch das Rotkehlchen singt in der Dämmerung, klingt aber feiner und weniger kraftvoll.',
    'April bis Juni',
    'Mittel',
  ],
  [
    'rotkehlchen',
    'Rotkehlchen',
    'Erithacus rubecula',
    'Unterholz, Hecken, Parks und Gärten',
    'Orange-rote Brust und Gesicht, rundlicher Körper und große dunkle Augen.',
    'Feine, perlende und etwas melancholische Strophen mit wechselndem Tempo.',
    'Eine kleine, silberne Perlenkette.',
    'Der Zaunkönig klingt deutlich lauter, kompakter und trillert markant.',
    'Fast ganzjährig, besonders Frühjahr und Herbst',
    'Mittel',
  ],
  [
    'zaunkoenig',
    'Zaunkönig',
    'Troglodytes troglodytes',
    'Dichtes Unterholz, Hecken und Bachufer',
    'Winzig, braun gebändert und oft mit steil aufgerichtetem kurzem Schwanz.',
    'Erstaunlich laute, rasche Strophen mit klaren Trillern.',
    'Kleiner Vogel, große Stimme, ratternder Triller.',
    'Das Rotkehlchen klingt zarter und lässt mehr Raum zwischen den Tonfolgen.',
    'Fast ganzjährig, besonders März bis Juli',
    'Mittel',
  ],
  [
    'moenchsgrasmuecke',
    'Mönchsgrasmücke',
    'Sylvia atricapilla',
    'Gebüschreiche Wälder, Parks und Gärten',
    'Grau gefärbt; das Männchen trägt eine schwarze, das Weibchen eine rotbraune Kappe.',
    'Beginnt oft leise schwatzend und endet in klaren, kräftigen Flötentönen.',
    'Erst ein Schwätzchen, dann ein Flötensolo.',
    'Die Amsel singt meist gemächlicher und mit deutlicher getrennten Strophen.',
    'März bis Juli',
    'Anspruchsvoll',
  ],
  [
    'kohlmeise',
    'Kohlmeise',
    'Parus major',
    'Wälder, Parks, Gärten und Siedlungen',
    'Schwarzer Kopf mit weißen Wangen, gelbe Unterseite und schwarzer Bauchstreif.',
    'Rhythmische Wiederholung von zwei oder drei klaren Tönen; viele Varianten.',
    'Zi-zi-bäh, zi-zi-bäh – wie eine kleine Schaukel.',
    'Die Blaumeise hat häufig hohe Anfangstöne und einen anschließenden Triller.',
    'Januar bis Juni',
    'Leicht',
  ],
  [
    'blaumeise',
    'Blaumeise',
    'Cyanistes caeruleus',
    'Laubwälder, Parks und Gärten',
    'Blaue Kopfplatte, weiße Wangen, blaue Flügel und gelber Bauch.',
    'Hohe, feine Anfangstöne, oft gefolgt von einem hellen, schnellen Triller.',
    'Zi-zi – sirrrrr.',
    'Die Kohlmeise klingt meist kräftiger und wiederholt deutlicher getrennte Tonpaare.',
    'Februar bis Juni',
    'Mittel',
  ],
  [
    'haussperling',
    'Haussperling',
    'Passer domesticus',
    'Siedlungen, Höfe und Gärten in Gebäudenähe',
    'Kräftiger Schnabel; Männchen mit grauem Scheitel und schwarzem Latz, Weibchen graubraun.',
    'Kurze, wiederholte Tschilp-Rufe, oft von mehreren Vögeln durcheinander.',
    'Tschilp, tschilp – das Gespräch an der Dachrinne.',
    'Der Zilpzalp reiht zwei unterschiedlich hohe Silben regelmäßig aneinander.',
    'Ganzjährig',
    'Leicht',
  ],
  [
    'zilpzalp',
    'Zilpzalp',
    'Phylloscopus collybita',
    'Wälder, Parks und Gärten mit höheren Bäumen',
    'Kleiner olivbrauner Laubsänger mit hellem Überaugenstreif und meist dunklen Beinen.',
    'Regelmäßig wechselnde, schlichte Zilp- und Zalp-Töne.',
    'Er singt seinen Namen: zilp-zalp-zilp-zalp.',
    'Der Fitis, eine später ergänzbare Art, singt eine weich abfallende Strophe.',
    'März bis August',
    'Leicht',
  ],
];
export const birds: Bird[] = entries.map(
  ([id, name, scientific, habitat, appearance, voice, mnemonic, compare, season, level]) => ({
    id,
    name,
    scientific,
    habitat,
    appearance,
    voice,
    mnemonic,
    compare,
    season,
    level,
    ...(media as unknown as Record<string, { image: Credit | null; recordings: Recording[] }>)[id],
  }),
);
