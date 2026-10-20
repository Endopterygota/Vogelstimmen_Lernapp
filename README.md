# Vogelstimmen

Private Android-Lernapp für Amsel, Singdrossel, Nachtigall, Rotkehlchen, Zaunkönig, Mönchsgrasmücke, Kohlmeise, Blaumeise, Haussperling und Zilpzalp.

React + TypeScript + Vite + Capacitor. Helle und dunkle Gestaltung nach dem Design der KLÖM_Helferapp, mit lokal eingebundener Manrope-Schrift. Kein Konto, kein Backend, keine Telemetrie.

## Funktionen

- Lexikon mit Steckbrief, Foto, Hörhilfen und mehreren Aufnahmen je Art.
- Hörkarten mit Selbstbewertung und Quiz mit vier Antwortmöglichkeiten.
- Lokale Lernstufen mit Wiederholungsabständen von 1, 3, 7, 14 und 30 Tagen; Fehler werden sofort wieder fällig.
- Fortschritt, Quiz-Trefferquote und häufige Verwechslungen. Selbstbewertungen und Quizantworten beeinflussen die Lernstufen; die Trefferquote zählt ausschließlich Quizantworten.
- Alle Medien lokal; Quellen/Urheber/Lizenz je Datei sichtbar. Externe Quellenlinks benötigen Internet.

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

1. `artifacts/Vogelstimmen-0.0.1.apk` aufs Smartphone übertragen.
2. APK öffnen und bei Bedarf die Installation für die verwendete Datei-App erlauben.
3. Installieren. Danach funktionieren Lexikon, Bilder, Audio und Training im Flugmodus.

Dies ist eine Debug-signierte Testversion. Updates aus derselben Entwicklungsumgebung erhalten den Lernfortschritt. Für langfristige Updates muss der Signaturschlüssel gesichert und weiterverwendet werden. Löschen der App bzw. ihrer Daten löscht auch den Fortschritt.

## Medien und Quellen

`src/data/media.json` dokumentiert pro Datei Originalseite, Urheber, Lizenz, Downloadadresse und technische Änderungen. `scripts/collect-media.py` nutzt die öffentliche Wikimedia-Commons-API und speichert bereitgestellte MP3-Fassungen bzw. Bildvorschauen. Keine Xeno-canto-Massendownloads und kein API-Schlüssel nötig.

Die Medien behalten ihre jeweilige Lizenz (insbesondere CC BY und CC BY-SA). Bildausschnitte in der Oberfläche sind ausgewiesen. Lerntexte sind eigens formulierte Zusammenfassungen; weiterführende Artinformationen sind in der App verlinkt. Die Aufnahmen wurden anhand der Metadaten ausgewählt. Eine vollständige ornithologische Hörprüfung aller Dateien ist noch offen.

## Prüfen

`pnpm test` prüft Wiederholungslogik und Statistiken. `pnpm build` prüft TypeScript und baut die Oberfläche. `node scripts/check-media.mjs` prüft Vollständigkeit, lokale Dateien und Lizenzmetadaten. Android-Build: `pnpm android:apk`.

`pnpm test:ui` prüft bei laufendem `pnpm dev` sämtliche Audiodecoder und die wichtigsten Bedienabläufe im Browser. Voraussetzung: `pnpm exec playwright install chromium`, alternativ `BROWSER_EXECUTABLE` auf eine vorhandene Chrome-/Edge-Installation setzen. Der Test blockiert externe Requests und legt Screenshots unter `artifacts/` ab.

Der APK-Build und die Browserprüfung wurden durchgeführt. Die Installation und Bedienung auf einem echten Android-Gerät müssen noch geprüft werden.

Keine Veröffentlichung bei Google Play vorgesehen.
