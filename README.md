# Saldo

Eine kleine, ruhige PWA, um festzuhalten, was du für andere ausgelegt hast –
egal ob Einkauf, Konzertticket oder ausgelegtes Mittagessen. Sie führt einen
laufenden Saldo pro Person, sodass du jederzeit siehst, **wer dir noch was
schuldet** (und was du selbst schuldest). Über-/Unterzahlungen werden
automatisch mit dem nächsten Eintrag verrechnet.

Gebaut **ohne Bundler und ohne Abhängigkeiten** — reines HTML/CSS/JS. Läuft
offline, lässt sich aufs iPhone legen und funktioniert in Jahren noch.

## Funktionen

- **Übersicht als Kontostand**: oben die Summe, die dir geschuldet wird,
  darunter alle Personen nach Saldo sortiert (wer dir am meisten schuldet zuerst).
- **Schneller Eintrag** für eine Person: **Artikel** (mit Vorschlägen nach
  Häufigkeit und gemerktem Preis) oder **Betrag** (einmalige Auslage mit freiem
  Text, z. B. „Konzertticket").
- **Mehrere auf einmal**: ein Sammeleinkauf für mehrere Personen in einem Rutsch.
- **Mengen** per +/– pro Zeile.
- **Bezahlung**: „Erhalten"-Häkchen oder erhaltenen Betrag eintippen → zeigt
  sofort „passt genau", „zu viel" oder „zu wenig".
- **Laufender Saldo pro Person**: Guthaben/Schuld wird beim nächsten Eintrag
  verrechnet.
- **Backup**: Daten als Datei sichern und wiederherstellen (z. B. in iCloud).
- Hell- und Dunkelmodus, vollständig auf Deutsch.

Alle Daten liegen **nur lokal** im Browser (localStorage). Kein Konto, keine
Cloud, kein Tracking. Beim ersten Start wird ein vorhandener Datenstand der
früheren Aldi-Version automatisch übernommen.

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

Geprüft werden Saldo-Verrechnung, Häufigkeits-Vorschläge, freie Auslagen und
Preis-Parsing.

## Aufs iPhone bringen (als App-Icon)

Damit die App als Icon auf dem Home-Bildschirm liegt und offline läuft,
braucht sie eine Web-Adresse. Der einfachste kostenlose Weg:

1. Den Projektordner auf einen statischen Host laden — z. B.
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
  views/
    overview.js         Startseite: Kontostand-Übersicht
    entry.js            Schnell-Eintrag (eine Person)
    trip.js             Sammeleinkauf (mehrere Personen)
    person.js           Personen-Detail (Saldo, Verlauf)
    settings.js         Backup + Personen
    shared.js           geteilte Bausteine (Artikelzeile, Bezahlung)
    autocomplete.js     Tipp-mit-Vorschlägen-Eingabe
tests/                  node:test
icons/                  App-Icons
```
