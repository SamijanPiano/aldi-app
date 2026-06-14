# Aldi-Sammelbestellung

Eine kleine, schöne PWA, um Sammeleinkäufe bei Aldi zu organisieren: Personen,
Artikel mit Häufigkeits-Vorschlägen, gemerkten Preisen und einem laufenden
Saldo pro Person (Über-/Unterzahlungen werden automatisch verrechnet).

Gebaut **ohne Bundler und ohne Abhängigkeiten** — reines HTML/CSS/JS. Läuft
offline, lässt sich aufs iPhone legen und funktioniert in Jahren noch.

## Funktionen

- **Einkaufsfahrten** mit Datum, je Fahrt mehrere Personen.
- **Vorschläge beim Tippen**: häufigste Artikel der Person zuerst, mit
  gemerktem Preis (zuletzt gezahlter Preis gilt).
- **Mengen** per +/– pro Artikelzeile.
- **Bezahlung**: „Bezahlt"-Häkchen oder erhaltenen Betrag eintippen → zeigt
  sofort „passt genau", „zu viel" oder „zu wenig".
- **Laufender Saldo pro Person**: Guthaben/Schuld wird beim nächsten Einkauf
  verrechnet.
- **Backup**: Daten als Datei sichern und wiederherstellen (z. B. in iCloud).
- Hell- und Dunkelmodus, vollständig auf Deutsch.

Alle Daten liegen **nur lokal** im Browser (localStorage). Kein Konto, keine
Cloud, kein Tracking.

## Lokal ansehen (am Mac)

ES-Module brauchen einen Server (nicht per Doppelklick öffnen):

```bash
cd "Aldi App"
python3 -m http.server 8124
# dann http://localhost:8124 im Browser öffnen
```

## Tests

```bash
cd "Aldi App"
node --test
```

Geprüft werden Saldo-Verrechnung, Häufigkeits-Vorschläge und Preis-Parsing.

## Aufs iPhone bringen (als App-Icon)

Damit die App als Icon auf dem Home-Bildschirm liegt und offline läuft,
braucht sie eine Web-Adresse. Der einfachste kostenlose Weg:

1. Den Ordner `Aldi App` auf einen statischen Host laden — z. B.
   [Netlify Drop](https://app.netlify.com/drop) (Ordner einfach reinziehen)
   oder GitHub Pages.
2. Die erhaltene URL in **Safari auf dem iPhone** öffnen.
3. Teilen-Symbol → **„Zum Home-Bildschirm"**.

Fertig — ab dann startet sie wie eine echte App, auch ohne Internet.

> Tipp: Vor größeren Updates über **Einstellungen → Sichern** ein Backup
> ziehen, dann nach dem Update **Wiederherstellen**.

## Aufbau

```
index.html              App-Gerüst
styles.css              Design (Tokens, Hell/Dunkel)
manifest.webmanifest    PWA-Manifest
sw.js                   Service Worker (Offline-Cache)
js/
  app.js                Router + Bootstrap
  store.js              Datenhaltung (localStorage), CRUD, Backup
  algorithm.js          Vorschläge + Saldo-Logik (das Herzstück)
  format.js             Geld-/Datumsformatierung
  ui.js                 DOM-Helfer + Icons
  views/                Bildschirme (trips, trip, person, settings, autocomplete)
tests/                  node:test
icons/                  App-Icons
```
