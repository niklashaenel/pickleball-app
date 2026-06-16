# Pickleball Punktezähler — Einrichtung & Anleitung

Eine Web-App, die den Spielstand zählt, automatisch die Pickleball-Regeln anwendet und
den Stand **laut ansagt**. Bedient wird sie per Fingertipp **oder per Bluetooth-Funkknopf**,
den du am Körper trägst – so musst du nicht zum Netz laufen.

> Wichtig: Diese App läuft am besten auf einem **Android-Gerät** in **Chrome**.
> Auf dem iPhone funktioniert die Funkknopf-Steuerung leider nicht (iOS-Beschränkung).

---

## Was du brauchst

1. **Android-Handy oder -Tablet** (steht am Feldrand, zeigt den Stand an).
2. **Bluetooth-Funkknopf / „Page-Turner"** (~8–15 €) — trägst du am Handgelenk/Clip.
   - Such auf Amazon nach **„Bluetooth Page Turner"** oder **„E-Book Seitenblätterer Bluetooth"**.
   - **Am besten mit 2 Tasten** (eine pro Team).
   - ⚠️ **Möglichst KEIN reiner Kamera-Auslöser** — die senden oft die Lautstärke-Tasten,
     die das Handy abfängt. Page-Turner senden Pfeil-/Blätter-Tasten, die zuverlässig ankommen.
3. **Bluetooth-Lautsprecher** (für die laute Ansage) — optional, sonst spricht das Handy selbst.

---

## Schritt 1: Funkknopf vorab testen (wichtig!)

Bevor du dich auf einen Knopf verlässt, prüfe, ob seine Tasten beim Handy ankommen:

1. Funkknopf mit dem Android-Handy koppeln (Bluetooth-Einstellungen → Gerät hinzufügen).
2. Im Handy-Chrome die Datei **`tastentest.html`** öffnen (bzw. den Link unten in den
   App-Einstellungen: „Klicker-Testseite öffnen").
3. Knöpfe am Funkknopf drücken.
   - **Erscheint etwas auf dem Bildschirm?** → Super, der Knopf funktioniert. 🎉
   - **Nichts passiert?** → Hat der Knopf einen Umschalter (iOS/Android oder Kamera/Musik)?
     Andere Stellung probieren. Wenn weiterhin nichts kommt, ist dieser Knopf ungeeignet.

---

## Schritt 2: App öffnen und einrichten

1. App-Adresse im Android-Chrome öffnen (deine GitHub-Pages-URL oder lokal).
2. Optional **„Zum Startbildschirm hinzufügen"** (Chrome-Menü ⋮) → die App startet dann
   wie eine echte App im Vollbild.
3. Oben rechts **⚙︎ Einstellungen** öffnen:
   - **Spielform**: Doppel (3 Zahlen) oder Einzel (2 Zahlen).
   - **Spiel bis** 11/15/21 und **2 Punkte Vorsprung**.
   - **Spielstand vorlesen** an/aus.
   - **Namen** der Teams eintragen.
   - **Funkknopf anlernen**: Bei „Taste für Team A gewann" auf **Anlernen** tippen, dann
     den gewünschten Knopf am Funkknopf drücken — fertig. Gleiches für Team B und
     (optional) „Rückgängig".

---

## Schritt 3: Lautsprecher für die Ansage

- Bluetooth-Lautsprecher mit **demselben Android-Handy** koppeln.
- Das Handy kann gleichzeitig mit Funkknopf **und** Lautsprecher verbunden sein.
- Tipp: Drück einmal irgendwo auf den Bildschirm — die Sprachausgabe startet manchmal erst
  nach der ersten Berührung zuverlässig.

---

## Stimme der Ansage verbessern

Die Vorlese-Stimme kommt vom Gerät selbst. In den **Einstellungen → Stimme** kannst du
unter den installierten Stimmen die schönste auswählen (eine Hörprobe kommt sofort).

- **iPhone:** Lade dir eine bessere deutsche Stimme:
  **Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch** und wähle
  eine **„Premium"/„Erweitert"**-Stimme (z. B. Anna, Markus, Petra). Danach taucht sie in
  der App unter „Stimme" auf — das klingt deutlich natürlicher.
- **Android:** Bessere Stimmen über **Einstellungen → Sprache/Verwaltung → Text-in-Sprache
  → Google Sprachausgabe** (deutsche Sprachdaten installieren).

Tipp: Team-Namen mit „+" werden als „und" gesprochen (z. B. „Silas + Niki" → „Silas und Niki").

## So bedienst du es im Spiel

- **Nach jedem Ballwechsel** drückst du den Knopf (oder tippst die Bildschirmseite) des
  Teams, das den Ballwechsel **gewonnen** hat.
- Die App rechnet automatisch aus, ob das ein **Punkt**, ein **Aufschlagwechsel**
  (2. Aufschläger) oder ein **Seitenaus** ist – und **sagt den Stand an**.
- Oben steht der offizielle Ruf, z. B. „0&nbsp;0&nbsp;2".
- **↩︎** macht den letzten Schritt rückgängig. **🔊/🔇** schaltet die Ansage um.
- Bei Spielende kommt ein Sieger-Banner → „Neues Spiel" oder „Weiterzählen".

---

## Offline

Wenn die App einmal über die GitHub-Pages-Adresse geladen wurde, funktioniert sie auch
**ohne Internet** weiter (z. B. auf dem Platz ohne WLAN). Einfach die zum Startbildschirm
hinzugefügte App öffnen.

---

## iPhone-Variante: mechanischer Seitenwender (Tipper-Modus)

Auf dem iPhone funktioniert eine Bluetooth-Tastatur/-Fernbedienung leider nicht in der App.
Es gibt aber einen Trick: ein **mechanischer Seitenwender**, der **physisch aufs Display
tippt** (gedacht für Kindle/E-Reader). Da das eine echte Berührung ist, läuft es auf dem
iPhone.

**Du brauchst:** iPhone, einen mechanischen Seitenwender, der **vorwärts UND rückwärts**
tippt (= zwei Tipp-Stellen) und über eine **separate Fernbedienung** ausgelöst wird,
optional einen Bluetooth-Lautsprecher.

**Einrichten:**
1. iPhone: **Einstellungen → Anzeige & Helligkeit → Automatische Sperre → „Nie".**
2. App in Safari öffnen (dafür muss sie online stehen) und „Zum Home-Bildschirm".
3. Den Seitenwender so am iPhone befestigen, dass seine zwei Tipp-Stellen **auf das
   Display** treffen.
4. In der App: **⚙︎ → Tipper-Modus an → Einrichten**, dann Einstellungen schließen.
5. **Vorwärts** am Gerät auslösen → ein **gelber Punkt** zeigt, wo es tippt → die Fläche
   **A** genau dorthin ziehen. Dann **Rückwärts** → Fläche **B** dorthin ziehen.
6. **Einrichten** wieder aus. Fertig: Vorwärts = Team A, Rückwärts = Team B
   (falls vertauscht, einfach die Flächen anders ziehen).

Die **Sprachansage** funktioniert auf dem iPhone in der Regel ebenfalls (jeder Tipp ist
eine echte Berührung). Kurz ausprobieren und ggf. den Bluetooth-Lautsprecher koppeln.

## Bekannte Grenzen

- iPhone/Safari: Eine Bluetooth-Fernbedienung als „Tastatur" wird nicht erkannt —
  auf dem iPhone deshalb den **Tipper-Modus** (mechanischer Seitenwender) nutzen,
  auf Android die normale Funkknopf-Steuerung.
- Welche Taste ein Funkknopf sendet, ist modellabhängig — deshalb der Anlern-Modus und
  der Vorab-Test (Schritt 1).
