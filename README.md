# Vogelstimmen

Private Android-Lernapp mit 20 Arten: Amsel, Singdrossel, Nachtigall, Rotkehlchen, Zaunkönig, Mönchsgrasmücke, Kohlmeise, Blaumeise, Haussperling, Zilpzalp, Buchfink, Ringeltaube, Türkentaube, Kuckuck, Kleiber, Buntspecht, Elster, Rabenkrähe, Stockente und Mauersegler.

React + TypeScript + Vite + Capacitor. Helle und dunkle Gestaltung nach dem Design der KLÖM_Helferapp, mit lokal eingebundener Manrope-Schrift. Kein Konto, kein Backend, keine Telemetrie.

## Funktionen

- Lexikon mit Steckbrief, Foto, Hörhilfen und mehreren Aufnahmen je Art.
- Hörkarten mit Selbstbewertung und Quiz mit vier Antwortmöglichkeiten.
- Lokale Lernstufen mit Wiederholungsabständen von 1, 3, 7, 14 und 30 Tagen; Fehler werden sofort wieder fällig.
- Fortschritt, Quiz-Trefferquote und häufige Verwechslungen. Selbstbewertungen und Quizantworten beeinflussen die Lernstufen; die Trefferquote zählt ausschließlich Quizantworten.
- Alle Medien lokal; Quellen/Urheber/Lizenz je Datei sichtbar. Externe Quellenlinks benötigen Internet.
- Unter Einstellungen nach GitHub-Updates suchen, neue APK herunterladen und den Android-Installer öffnen.

## Entwickeln

Node 22+, pnpm, JDK 21, Android SDK 36 und Android Build Tools. Android 7+ mit aktueller System-WebView.

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm android:apk
```

`scripts/build-android.ps1` verwendet vorhandene Werkzeuge unter `.tools/`, alternativ `JAVA_HOME` und `ANDROID_HOME`. Werkzeuge und APKs werden nicht ins Repository eingecheckt. `android/` enthält das vollständige native Projekt; `pnpm android:sync` aktualisiert die gebündelte Oberfläche.

## Privat auf Android installieren

1. `artifacts/Vogelstimmen-0.0.2.apk` aufs Smartphone übertragen.
2. APK öffnen und bei Bedarf die Installation für die verwendete Datei-App erlauben.
3. Installieren. Danach funktionieren Lexikon, Bilder, Audio und Training im Flugmodus.

Dies ist eine Debug-signierte Testversion. Updates aus derselben Entwicklungsumgebung erhalten den Lernfortschritt. Für langfristige Updates muss der Signaturschlüssel gesichert und weiterverwendet werden. Löschen der App bzw. ihrer Daten löscht auch den Fortschritt.

## Updates ab 0.0.2

Version 0.0.1 enthält noch keinen Update-Button. Version 0.0.2 deshalb einmal manuell aus dem GitHub-Release installieren, ohne die vorhandene App zu deinstallieren. Danach: **Einstellungen → App aktualisieren → Nach Updates suchen**.

Die Prüfung erfolgt nur auf Klick über die öffentliche GitHub-API. Die App berücksichtigt das neueste stabile Release und lädt ausschließlich APKs aus `Endopterygota/Vogelstimmen_Lernapp`. Downloadfortschritt, Verbindungsfehler und fehlende Berechtigungen werden angezeigt. Vor dem Öffnen des Installers werden Dateigröße, gegebenenfalls GitHubs SHA-256-Digest, Paketname, höhere Versionsnummer und übereinstimmendes Signaturzertifikat geprüft. Die APK bleibt im privaten App-Cache; es wird keine Speicherberechtigung benötigt.

Android verlangt gegebenenfalls einmal **Apps aus dieser Quelle zulassen** für Vogelstimmen. Nach der Rückkehr öffnet die App den Installer. Die eigentliche Installation wird immer vom Benutzer im Android-Dialog bestätigt. Abbrechen löscht keine Lerndaten; über **Installation öffnen** lässt sich der Dialog erneut aufrufen.

Für neue Releases immer den bisherigen lokalen Signaturschlüssel verwenden und `versionCode` erhöhen. Die APKs aus den GitHub-Actions-Testbuilds verwenden einen anderen, temporären Debug-Schlüssel und sind nicht zum Aktualisieren der veröffentlichten APKs geeignet. Der Updater lehnt solche Dateien ab.

## Medien und Quellen

`src/data/media.json` dokumentiert pro Datei Originalseite, Urheber, Lizenz, Downloadadresse und technische Änderungen. `scripts/collect-media.py` nutzt die öffentliche Wikimedia-Commons-API und speichert bereitgestellte MP3-Fassungen bzw. Bildvorschauen. Keine Xeno-canto-Massendownloads und kein API-Schlüssel nötig.

Die Medien behalten ihre jeweilige Lizenz (insbesondere CC BY und CC BY-SA). Bildausschnitte in der Oberfläche sind ausgewiesen. Lerntexte sind eigens formulierte Zusammenfassungen; weiterführende Artinformationen sind in der App verlinkt. Die Aufnahmen wurden anhand der Metadaten ausgewählt. Eine vollständige ornithologische Hörprüfung aller Dateien ist noch offen.

## Prüfen

`pnpm test` prüft Wiederholungslogik und Statistiken. `pnpm build` prüft TypeScript und baut die Oberfläche. `node scripts/check-media.mjs` prüft Vollständigkeit, lokale Dateien und Lizenzmetadaten. Android-Build: `pnpm android:apk`.

`pnpm test:ui` prüft bei laufendem `pnpm dev` sämtliche Audiodecoder und die wichtigsten Bedienabläufe im Browser. Voraussetzung: `pnpm exec playwright install chromium`, alternativ `BROWSER_EXECUTABLE` auf eine vorhandene Chrome-/Edge-Installation setzen. Der Test blockiert externe Requests und legt Screenshots unter `artifacts/` ab.

Der APK-Build und die Browserprüfung wurden durchgeführt. Die Installation und Bedienung auf einem echten Android-Gerät müssen noch geprüft werden.

`pnpm test:updates` testet die Update-Oberfläche mit simulierten GitHub-Antworten und einer simulierten Capacitor-Bridge. `android/gradlew -p android :app:testDebugUnitTest` prüft die native Versions- und Downloadrichtlinie. Diese Tests ersetzen keinen Android-Gerätetest des Installers.

Keine Veröffentlichung bei Google Play vorgesehen.
