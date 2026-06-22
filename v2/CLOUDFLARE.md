# Online-Gruppen einrichten (kostenloser Cloudflare-Worker)

Damit du Gruppen **online teilen** kannst (andere treten per Code bei und speichern Spiele in
dieselbe Gruppe), brauchst du einen kleinen, **kostenlosen** Server: einen Cloudflare-Worker mit
KV-Speicher. Das macht man **einmal** in ~10–15 Minuten. Danach trägst du nur die Worker-URL in
die App ein.

> Die App funktioniert auch **ohne** das hier — dann gibt es nur **lokale** Gruppen (auf dem
> jeweiligen Gerät). Online braucht diesen Schritt.

## 1. Kostenloses Cloudflare-Konto
1. Auf <https://dash.cloudflare.com/sign-up> ein Gratis-Konto anlegen und E-Mail bestätigen.

## 2. KV-Speicher anlegen
1. Linke Leiste: **Storage & Databases → KV** → **Create a namespace**.
2. Name: `GROUPS` → **Add**.

## 3. Worker anlegen
1. Linke Leiste: **Workers & Pages → Create → Workers → Create Worker**.
2. Name z. B. `pickleball` → **Deploy** (der Beispielcode ist egal).
3. **Edit code** öffnen, den gesamten Inhalt von **`worker/worker.js`** (aus diesem Projekt)
   hineinkopieren (alten Code vorher löschen) → **Deploy**.

## 4. KV an den Worker binden
1. Im Worker: **Settings → Bindings (Variables) → Add binding → KV namespace**.
2. **Variable name:** `GROUPS` (genau so geschrieben).
3. **KV namespace:** den eben erstellten `GROUPS` auswählen → **Save / Deploy**.

## 5. Worker-URL in die App eintragen
1. Die URL steht oben im Worker, etwa: `https://pickleball.DEINNAME.workers.dev`
2. In der App: **Einstellungen → Gruppen & Speichern → „Online einrichten (Worker-URL)"** aufklappen
   und die URL einfügen.
3. Test: **„+ Online"** mit einem Namen → du bekommst einen **Code**. Den Code können andere unter
   **„Beitreten"** eingeben.

## Schnelltest (optional, im Browser/Terminal)
- Neue Gruppe: `curl -X POST https://DEIN-WORKER.workers.dev/api/group -H "Content-Type: application/json" -d "{\"name\":\"Test\"}"`
  → liefert `{"code":"…","adminKey":"…","name":"Test"}`.
- Lesen: `https://DEIN-WORKER.workers.dev/api/group/DEIN-CODE` im Browser öffnen.

## Admin-Übersicht (alle Gruppen sehen/löschen)
Optional: eine geschützte Seite `admin.html`, die alle Gruppen auflistet (Name, Code, Datum,
Anzahl Spiele) mit Lösch-Knopf. Schutz über ein Master-Passwort, das du im Worker hinterlegst:
1. Worker `pickleball` → **Settings → Variables and Secrets** → **Add** → Typ **Secret**.
   - **Name:** `ADMIN_MASTER` · **Value:** ein langes, eigenes Passwort → **Save/Deploy**.
2. Worker-Code aktuell halten (siehe unten) – die Endpunkte `GET /api/admin/groups` und
   `DELETE /api/admin/group/{code}` (jeweils Header `X-Admin-Master`) sind in `worker/worker.js` enthalten.
3. Aufruf: `…github.io/pickleball-app/v2/admin.html` → Master-Passwort eingeben.
Ohne gesetztes `ADMIN_MASTER` ist die Admin-Schnittstelle **deaktiviert** (liefert 403).

## Worker später aktualisieren
Wenn sich `worker/worker.js` ändert (neue Funktionen): im Worker **Edit code** → alten Code
ersetzen → **Deploy**. KV-Binding bleibt erhalten, nichts geht verloren.

## Vertrauensmodell (wichtig)
- Der **Code** ist ein gemeinsames **Lese-/Schreib-Geheimnis** der Gruppe. Wer ihn hat, kann Spiele
  sehen und hinzufügen. Gib ihn nur an Leute, denen du vertraust.
- **Einzelne Spiele** kann **jeder mit dem Code** hinzufügen **und löschen** (Code = gemeinsamer
  Schreibzugriff). API: `POST` bzw. `DELETE /api/group/{code}/games/{gid}` (ohne Admin-Key).
- Die **ganze Gruppe löschen** kann nur der **Ersteller** (`DELETE /api/group/{code}` mit `X-Admin-Key`).
- Fremde **ohne** Code kommen nicht an die Gruppe; jede Gruppe ist isoliert.
- Im App-Quellcode steht **kein** Geheimnis — nur die öffentliche Worker-URL.

## Kosten / Limits
Cloudflare Free reicht weit aus: ~100.000 Anfragen/Tag, KV 1.000 Schreib-/100.000 Lesevorgänge/Tag,
1 GB Speicher. Für einen Verein vollkommen ausreichend.
