/* =========================================================================
   Pickleball Punktezähler
   - Du signalisierst nur, WER den Ballwechsel gewonnen hat (Team A oder B).
   - Die App rechnet Punkt / 2. Aufschläger / Seitenaus automatisch aus,
     führt Aufschlagteam, Server-Nummer und Aufschlagseite mit und sagt an.
   ========================================================================= */

'use strict';

/* ---- Speicher-Schlüssel ---- */
const KEY_SETTINGS = 'pb-settings-v1';
const KEY_GAME     = 'pb-game-v1';
const KEY_MATCH    = 'pb-match-v1';
const KEY_HISTORY  = 'pb-history-v1';
const KEY_QUEUE    = 'pb-queue-v1';   // Offline-Warteschlange (Online-Upload)

/* ---- Standard-Einstellungen ---- */
const DEFAULT_SETTINGS = {
  mode: 'doubles',        // 'doubles' | 'singles'
  target: 11,
  winBy2: true,
  announce: true,
  announceTeam: true,
  voiceURI: '',
  sound: true,
  volume: 'laut',       // Lautstärke der Ansagen/Töne: 'normal' | 'laut' | 'sehr-laut' | 'maximal'
  callStyle: 'natur',   // Ansage-Stil: 'natur' ("eins zu eins, zwei") | 'ziffern' ("null null eins")
  announceServer: false,// bei jedem Punkt zusätzlich "Aufschlag <Name>" ansagen
  scoreOnly: false,     // nur den aktuellen Stand ansagen (ohne Name/Seitenwechsel/Verlängerung)
  naturalVoice: true,   // vorab erzeugte natürliche Audio-Schnipsel verwenden, wenn vorhanden
  ringControl: false,   // Bluetooth-Ring (Mausrad/Scroll)
  watchControl: false,  // Smartwatch über Media Session
  swipeControl: false,  // Wisch-Overlay (Finger): hoch=A, runter=B, seitlich=Undo, Tipp=Wiederholen
  matchBestOf: 1,   // 1 = Einzelspiel, 3 = Best of 3, 5 = Best of 5
  startServer: 'A', // welches Team zuerst aufschlägt
  showStartChooser: true, // Aufschlag-Auswahl beim Spielstart zeigen
  alternateServe: true,   // nächstes Spiel automatisch anderes Team aufschlagen lassen
  lastStartServer: '',    // welches Team im letzten Spiel begonnen hat (für Auto-Wechsel)
  swapSides: false,
  theme: 'neon',     // Design-Stil
  palette: 'auto',   // Farbpalette ('auto' = Farben des Designs)
  groups: [{ id: 'local', name: 'Lokal', scope: 'local' }], // Speicher-Gruppen
  activeGroup: 'local',   // Spiele landen in dieser Gruppe
  autoSave: true,         // beendete Spiele automatisch speichern
  workerBase: '',         // leer = fest hinterlegten WORKER_URL nutzen (Override nur via localStorage)
  names: { A: 'Team A', B: 'Team B' },
  roster: { A: [], B: [] } // geordnete Spieler je Team (Spieler 1 startet rechts) - für Aufschläger-Name
};

// Feste Tastatur-Kürzel (unsichtbarer Desktop-Komfort): A/B zählen, Undo, Wiederholen
const KEYBOARD = { A: 'ArrowLeft', B: 'ArrowRight', undo: 'Backspace', repeat: 'Enter' };

/* ---- Design-Stile (Farben + Schrift + Form über die body-Klasse design-<id>) ---- */
const FD = { orbitron: "'Orbitron', system-ui, sans-serif", rajdhani: "'Rajdhani', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif", poppins: "'Poppins', system-ui, sans-serif",
  anton: "'Anton', system-ui, sans-serif", fredoka: "'Fredoka', system-ui, sans-serif" };
const THEMES = [
  { id: 'neon', name: 'Neon', bg: '#05060d', text: '#eaf6ff', muted: '#8aa6c0', a: '#00e5ff', b: '#fdff2f', accent: '#fdff6a', aRgb: '0,229,255', bRgb: '250,255,0',
    fd: FD.orbitron, fu: FD.rajdhani, surface: 'rgba(10,15,28,.98)', surface2: '#05060d', backdrop: 'rgba(2,4,10,.72)', line: 'rgba(0,229,255,.25)' },
  { id: 'klassik', name: 'Klassik', bg: '#0c3b2e', text: '#f3ead3', muted: '#b7c2a8', a: '#e9c879', b: '#e8a07a', accent: '#e9c879', aRgb: '233,200,121', bRgb: '232,160,122',
    fd: FD.playfair, fu: FD.poppins, surface: 'rgba(14,46,36,.98)', surface2: '#0a3024', backdrop: 'rgba(4,20,15,.7)', line: 'rgba(233,200,121,.3)' },
  { id: 'elegant', name: 'Elegant', bg: '#16131a', text: '#ecd9a8', muted: '#b7a98a', a: '#e8c97a', b: '#bda0d8', accent: '#e8c97a', aRgb: '232,201,122', bRgb: '189,160,216',
    fd: FD.playfair, fu: FD.poppins, surface: 'rgba(28,24,34,.98)', surface2: '#161219', backdrop: 'rgba(8,6,10,.72)', line: 'rgba(232,201,122,.28)' },
  { id: 'minimal', name: 'Minimal', bg: '#f6f7f5', text: '#1a1c1e', muted: '#6b7177', a: '#2e7bff', b: '#ff7a2e', accent: '#2e7bff', aRgb: '46,123,255', bRgb: '255,122,46',
    fd: FD.poppins, fu: FD.poppins, surface: '#ffffff', surface2: '#eef0ed', backdrop: 'rgba(20,22,26,.4)', line: 'rgba(20,30,40,.16)' },
  { id: 'sport', name: 'Sport', bg: '#0a0a0d', text: '#f5f6f8', muted: '#8a8f99', a: '#ff3b46', b: '#2e8bff', accent: '#ffd23f', aRgb: '255,59,70', bRgb: '46,139,255',
    fd: FD.anton, fu: FD.poppins, surface: 'rgba(18,18,22,.98)', surface2: '#101014', backdrop: 'rgba(0,0,0,.72)', line: 'rgba(255,255,255,.16)' },
  { id: 'pastell', name: 'Pastell', bg: '#fff5f0', text: '#5b4a52', muted: '#a98f99', a: '#ff7d97', b: '#34bca8', accent: '#d4537e', aRgb: '255,125,151', bRgb: '52,188,168',
    fd: FD.fredoka, fu: FD.fredoka, surface: '#fffaf7', surface2: '#fdeee8', backdrop: 'rgba(80,50,60,.34)', line: 'rgba(150,90,110,.2)' }
];
/* ---- Farbpaletten: überschreiben Team-A/B + Akzent über jedes Design ---- */
/* Mitteltöne, damit sie auf dunklen (Glühen) UND hellen (Text) Designs gut aussehen. */
const PALETTES = [
  { id: 'auto', name: 'Original' },
  { id: 'cyangold',   name: 'Cyan/Gold',     a: '#00cfe5', b: '#f2c200', aRgb: '0,207,229',   bRgb: '242,194,0' },
  { id: 'blauorange', name: 'Blau/Orange',   a: '#3b82f6', b: '#fb923c', aRgb: '59,130,246',  bRgb: '251,146,60' },
  { id: 'lilatuerkis',name: 'Lila/Türkis',   a: '#8b5cf6', b: '#22d3ee', aRgb: '139,92,246',  bRgb: '34,211,238' },
  { id: 'pinkgruen',  name: 'Pink/Grün',     a: '#ec4899', b: '#22c55e', aRgb: '236,72,153',  bRgb: '34,197,94' },
  { id: 'rotblau',    name: 'Rot/Blau',      a: '#ef4444', b: '#3b82f6', aRgb: '239,68,68',   bRgb: '59,130,246' },
  { id: 'gruengold',  name: 'Grün/Gold',     a: '#16a34a', b: '#eab308', aRgb: '22,163,74',   bRgb: '234,179,8' },
  { id: 'korallminze',name: 'Koralle/Minze', a: '#fb7185', b: '#2dd4bf', aRgb: '251,113,133', bRgb: '45,212,191' },
  { id: 'magentacyan',name: 'Magenta/Cyan',  a: '#d946ef', b: '#06b6d4', aRgb: '217,70,239',  bRgb: '6,182,212' },
  { id: 'orangerot',  name: 'Orange/Rot',    a: '#ff7a1a', b: '#e11d48', aRgb: '255,122,26',  bRgb: '225,29,72' },
  { id: 'blaugruen',  name: 'Blau/Grün',     a: '#2563eb', b: '#10b981', aRgb: '37,99,235',   bRgb: '16,185,129' },
  { id: 'goldroyal',  name: 'Gold/Royal',    a: '#ffcf33', b: '#2563eb', aRgb: '255,207,51',  bRgb: '37,99,235' },
  { id: 'goldrose',   name: 'Gold/Rosé',     a: '#ffcf33', b: '#ff4d8d', aRgb: '255,207,51',  bRgb: '255,77,141' },
  { id: 'goldtuerkis',name: 'Gold/Türkis',   a: '#ffcf33', b: '#17c3b2', aRgb: '255,207,51',  bRgb: '23,195,178' },
  { id: 'goldgruen',  name: 'Gold/Grün',     a: '#ffcf33', b: '#21c45d', aRgb: '255,207,51',  bRgb: '33,196,93' },
  { id: 'bernsteinviolett', name: 'Bernstein/Violett', a: '#f59e0b', b: '#8b5cf6', aRgb: '245,158,11', bRgb: '139,92,246' },
  { id: 'limettecyan',name: 'Limette/Cyan',  a: '#a3e635', b: '#06b6d4', aRgb: '163,230,53',  bRgb: '6,182,212' }
];
function applyPaletteColors() {
  const p = PALETTES.find((x) => x.id === settings.palette);
  if (!p || p.id === 'auto') return; // Farben des Designs behalten (schon gesetzt)
  const r = document.documentElement.style;
  r.setProperty('--cyan', p.a); r.setProperty('--gold', p.b); r.setProperty('--accent', p.a);
  r.setProperty('--cyan-rgb', p.aRgb); r.setProperty('--gold-rgb', p.bRgb);
}
function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg); r.setProperty('--text', t.text); r.setProperty('--muted', t.muted);
  r.setProperty('--cyan', t.a); r.setProperty('--gold', t.b); r.setProperty('--accent', t.accent);
  r.setProperty('--cyan-rgb', t.aRgb); r.setProperty('--gold-rgb', t.bRgb);
  r.setProperty('--surface', t.surface); r.setProperty('--surface-2', t.surface2);
  r.setProperty('--backdrop', t.backdrop); r.setProperty('--line', t.line);
  r.setProperty('--font-display', t.fd); r.setProperty('--font-ui', t.fu);
  applyPaletteColors(); // ggf. Farben überschreiben
  const b = document.body;
  if (b) { b.className = b.className.replace(/\bdesign-\S+/g, '').trim(); b.classList.add('design-' + t.id); }
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.theme === t.id));
  document.querySelectorAll('.pswatch').forEach((s) => s.classList.toggle('active', s.dataset.palette === (settings.palette || 'auto')));
  // Original-Chip zeigt die nativen Design-Farben (unabhängig von der gewählten Palette)
  const autoSw = document.querySelector('.pswatch[data-palette="auto"]');
  if (autoSw) { autoSw.style.setProperty('--pa', t.a); autoSw.style.setProperty('--pb', t.b); }
}
function buildThemeGrid() {
  const grid = document.querySelector('#themeGrid');
  if (!grid) return;
  grid.innerHTML = THEMES.map((t) =>
    '<button type="button" class="swatch" data-theme="' + t.id + '" title="' + t.name +
    '" style="--sw-bg:' + t.bg + ';--sw-a:' + t.a + ';--sw-b:' + t.b + ';--sw-text:' + t.text + '">' +
    '<span class="sw-prev"></span><span class="sw-name">' + t.name + '</span></button>').join('');
  grid.querySelectorAll('.swatch').forEach((s) => s.addEventListener('click', () => {
    settings.theme = s.dataset.theme; saveSettings(); applyTheme(settings.theme);
  }));
}
function buildPaletteGrid() {
  const grid = document.querySelector('#paletteGrid');
  if (!grid) return;
  grid.innerHTML = PALETTES.map((p) => {
    const pa = p.id === 'auto' ? 'var(--cyan)' : p.a;
    const pb = p.id === 'auto' ? 'var(--gold)' : p.b;
    return '<button type="button" class="pswatch" data-palette="' + p.id + '" title="' + p.name +
      '" style="--pa:' + pa + ';--pb:' + pb + '"><span class="pchip"></span><span class="pname">' + p.name + '</span></button>';
  }).join('');
  grid.querySelectorAll('.pswatch').forEach((s) => s.addEventListener('click', () => {
    settings.palette = s.dataset.palette; saveSettings(); applyTheme(settings.theme);
  }));
}

// Vorübergehende Zustände (nicht gespeichert)
let startChosen = false; // wurde der Startaufschlag für das aktuelle Spiel schon bestätigt?

/* ---- Zahlwörter für die deutsche Ansage ---- */
const WORDS = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun',
  'zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn',
  'neunzehn','zwanzig','einundzwanzig','zweiundzwanzig','dreiundzwanzig','vierundzwanzig',
  'fünfundzwanzig','sechsundzwanzig','siebenundzwanzig','achtundzwanzig','neunundzwanzig','dreißig'];
const say = (n) => WORDS[n] !== undefined ? WORDS[n] : String(n);
const other = (t) => (t === 'A' ? 'B' : 'A');

/* ---- Zustand ---- */
let settings = loadSettings();
applyTheme(settings.theme); // Farb-Design früh setzen (kein Aufblitzen)
let game = loadGame() || newGame();
let history = [];
let match = (() => { try { return JSON.parse(localStorage.getItem(KEY_MATCH)) || { A: 0, B: 0 }; } catch (e) { return { A: 0, B: 0 }; } })();
function saveMatch() { localStorage.setItem(KEY_MATCH, JSON.stringify(match)); }
function teamName(t) { return settings.names[t] || ('Team ' + t); }
function gamesNeeded() { return settings.matchBestOf > 1 ? Math.ceil(settings.matchBestOf / 2) : 1; }

// ---- Verlauf gespielter Spiele ----
function loadHistory() { try { return JSON.parse(localStorage.getItem(KEY_HISTORY)) || []; } catch (e) { return []; } }
function parsePlayers(nm) {
  return String(nm).split('+').map((s) => s.trim()).filter(Boolean);
}
function addHistory(entry) {
  entry.ts = Date.now();
  entry.gid = entry.gid || (entry.ts + '-' + Math.random().toString(36).slice(2, 8));
  entry.group = settings.activeGroup || 'local';
  entry.names = { A: teamName('A'), B: teamName('B') };
  entry.players = { A: parsePlayers(teamName('A')), B: parsePlayers(teamName('B')) };
  entry.by = entry.by || memberId();   // wer das Spiel eingetragen hat (für "eigene löschen")
  let h = loadHistory();
  h.unshift(entry);
  if (h.length > 200) h = h.slice(0, 200);
  localStorage.setItem(KEY_HISTORY, JSON.stringify(h));
}
// Ergebnis bei Spielende: automatisch speichern oder fürs manuelle Speichern merken.
let pendingResult = null;
function finishResult(entry) { pendingResult = entry; if (settings.autoSave) saveResult(); }
function saveResult() {
  if (!pendingResult) return;
  addHistory(pendingResult);   // lokal speichern (taggt Gruppe + gid)
  saveOnline(pendingResult);   // ggf. an Online-Gruppe anhängen (sonst Warteschlange)
  pendingResult = null;
  flash('Gespeichert');
  updateWinnerSave();
}
function updateWinnerSave() {
  const b = document.querySelector('#winnerSave');
  if (!b) return;
  if (pendingResult) {            // noch nicht gespeichert -> Knopf zum manuellen Speichern
    b.textContent = 'Spiel speichern'; b.disabled = false; b.style.display = '';
  } else if (settings.autoSave && game.over) {  // automatisch gespeichert -> Bestätigung
    b.textContent = '✓ Gespeichert'; b.disabled = true; b.style.display = '';
  } else {
    b.style.display = 'none';
  }
}

// ---- #5a Statistik (Lesen) + Matchmaker + Export/Import ----
let onlineMatches = [];     // Spiele der aktiven Online-Gruppe (vom Worker geladen)
let viewAllGroups = false;  // Verlauf/Statistik: nur aktive Gruppe oder alle (lokal)

// ---- Gruppen-Helfer ----
// Fest hinterlegter Online-Speicher (eigener Cloudflare-Worker). Online funktioniert dadurch
// out-of-the-box - kein Einrichten nötig. settings.workerBase (per localStorage) gewinnt weiterhin
// als verstecktes Ausweichventil (z. B. für einen URL-Umzug), ist aber nicht mehr per UI setzbar.
const WORKER_URL = 'https://pickleball.2v5dyky8dy.workers.dev';
function apiBase() { return ((settings.workerBase || WORKER_URL).trim()).replace(/\/+$/, ''); }
function activeGroupObj() { return (settings.groups || []).find((g) => g.id === settings.activeGroup) || settings.groups[0]; }
function isOnlineGroup() { const g = activeGroupObj(); return !!(g && g.scope === 'online' && g.code); }
function onlineReady() { return !!apiBase(); }
function loadQueue() { try { return JSON.parse(localStorage.getItem(KEY_QUEUE)) || []; } catch (e) { return []; } }
function saveQueue(q) { localStorage.setItem(KEY_QUEUE, JSON.stringify(q)); }

// Stabile Geräte-/Mitglieds-ID (für "nur eigene Spiele löschen"). Kein Geheimnis, nur eine Marke.
function memberId() {
  let id = localStorage.getItem('pb-member-id');
  if (!id) { id = 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('pb-member-id', id); }
  return id;
}
// gids, die DIESES Gerät online beigesteuert hat (für die Lösch-Sichtbarkeit im Verlauf).
const KEY_MYGIDS = 'pb-my-online-gids';
function loadMyGids() { try { return new Set(JSON.parse(localStorage.getItem(KEY_MYGIDS)) || []); } catch (e) { return new Set(); } }
function rememberMyGid(gid) { if (!gid) return; const s = loadMyGids(); s.add(String(gid)); localStorage.setItem(KEY_MYGIDS, JSON.stringify([...s].slice(-2000))); }
function isMyGid(gid) { return loadMyGids().has(String(gid)); }

// Ein Spiel an die aktive Online-Gruppe anhängen; bei Fehler/offline in die Warteschlange.
async function saveOnline(entry) {
  if (!isOnlineGroup() || !onlineReady()) return;
  const g = activeGroupObj();
  if (!entry.by) entry.by = memberId();
  try {
    const r = await fetch(apiBase() + '/api/group/' + g.code + '/games', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: entry }) });
    if (!r.ok) throw 0;
    rememberMyGid(entry.gid);
  } catch (e) { const q = loadQueue(); q.push({ code: g.code, game: entry }); saveQueue(q); }
}
// Warteschlange abarbeiten (beim Start + wenn wieder online)
async function flushQueue() {
  if (!onlineReady()) return;
  let q = loadQueue(); if (!q.length) return;
  const rest = [];
  for (const it of q) {
    try {
      const r = await fetch(apiBase() + '/api/group/' + it.code + '/games', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: it.game }) });
      if (!r.ok) throw 0;
      rememberMyGid(it.game && it.game.gid);
    } catch (e) { rest.push(it); }
  }
  saveQueue(rest);
}
// Spiele der aktiven Online-Gruppe laden (ersetzt das frühere matches.json-Laden)
async function fetchOnlineMatches() {
  if (!isOnlineGroup() || !onlineReady()) { onlineMatches = []; return; }
  const g = activeGroupObj();
  try {
    const r = await fetch(apiBase() + '/api/group/' + g.code + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.status === 404) { removeDeadGroup(g, true); return; } // vom Ersteller gelöscht -> auto-entfernen
    if (r.ok) { const d = await r.json(); onlineMatches = Array.isArray(d.games) ? d.games : []; }
  } catch (e) { /* offline -> nichts entfernen */ }
}
// Eine nicht mehr existierende Online-Gruppe lokal entfernen (auf jedem Gerät).
function removeDeadGroup(g, notify) {
  if (!g) return;
  settings.groups = settings.groups.filter((x) => x.id !== g.id);
  if (settings.activeGroup === g.id) settings.activeGroup = 'local';
  saveQueue(loadQueue().filter((it) => it.code !== g.code));
  saveSettings(); onlineMatches = []; renderGroups();
  const hd = document.querySelector('#historyDlg'); if (hd && hd.open) renderHistory();
  if (notify) flash('Gruppe „' + g.name + '" wurde vom Ersteller gelöscht');
}
// Alle eigenen Online-Gruppen prüfen und gelöschte (404) automatisch entfernen.
async function pruneDeletedGroups() {
  if (!onlineReady()) return;
  for (const g of settings.groups.filter((x) => x.scope === 'online' && x.code)) {
    try {
      const r = await fetch(apiBase() + '/api/group/' + encodeURIComponent(g.code) + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.status === 404) removeDeadGroup(g, false);
    } catch (e) { /* offline -> nicht anfassen */ }
  }
}
async function deleteOnlineGame(gid) {
  if (!isOnlineGroup() || !onlineReady()) return false;
  const g = activeGroupObj();
  try {
    const r = await fetch(apiBase() + '/api/group/' + g.code + '/games/' + encodeURIComponent(gid),
      { method: 'DELETE', headers: { 'X-Admin-Key': g.adminKey || '', 'X-Member-Id': memberId() } });
    return r.ok;
  } catch (e) { return false; }
}
// Ganze Online-Gruppe serverseitig löschen (nur Ersteller, der den adminKey hat).
async function deleteOnlineGroupServer(g) {
  if (!g || g.scope !== 'online' || !g.adminKey) return false;
  try {
    const r = await fetch(apiBase() + '/api/group/' + encodeURIComponent(g.code),
      { method: 'DELETE', headers: { 'X-Admin-Key': g.adminKey } });
    return r.ok;
  } catch (e) { return false; }
}
async function createOnlineGroup(name) {
  if (!onlineReady()) { flash('Erst Worker-URL in den Einstellungen eintragen'); return; }
  try {
    const r = await fetch(apiBase() + '/api/group', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name || 'Gruppe' }) });
    if (!r.ok) throw 0;
    const d = await r.json();
    const g = { id: 'g' + Date.now(), name: name || d.name || 'Gruppe', scope: 'online', code: d.code, adminKey: d.adminKey, role: 'owner', created: Date.now() };
    settings.groups.push(g); settings.activeGroup = g.id; saveSettings();
    await fetchOnlineMatches(); renderGroups();
    flash('Gruppe „' + g.name + '" angelegt – Code: ' + d.code);
  } catch (e) { flash('Anlegen fehlgeschlagen'); }
}
async function joinOnlineGroup(code) {
  code = (code || '').trim();
  if (!code) return;
  if (!onlineReady()) { flash('Erst Worker-URL in den Einstellungen eintragen'); return; }
  if (settings.groups.some((g) => g.code === code)) { flash('Gruppe ist schon da'); return; }
  try {
    const r = await fetch(apiBase() + '/api/group/' + encodeURIComponent(code) + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw 0;
    const d = await r.json();
    const g = { id: 'g' + Date.now(), name: d.name || ('Gruppe ' + code), scope: 'online', code: code, role: 'member', created: Date.now() };
    settings.groups.push(g); settings.activeGroup = g.id; saveSettings();
    await fetchOnlineMatches(); renderGroups();
    flash('Beigetreten: „' + g.name + '"');
  } catch (e) { flash('Code nicht gefunden'); }
}

// Lokale Gruppe online stellen: neue Online-Gruppe anlegen, alle Spiele dieser lokalen Gruppe
// hochladen (gid dedupt), zur Online-Gruppe wechseln. Lokale Gruppe bleibt als Backup erhalten.
async function convertGroupToOnline() {
  const src = activeGroupObj();
  if (!src || src.scope === 'online') { flash('Diese Gruppe ist bereits online'); return; }
  const games = loadHistory().filter((m) => (m.group || 'local') === src.id);
  flash('Stelle „' + src.name + '" online …');
  try {
    const r = await fetch(apiBase() + '/api/group', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: src.name || 'Gruppe' }) });
    if (!r.ok) throw 0;
    const d = await r.json();
    // älteste zuerst hochladen, damit die neuesten oben landen; gid verhindert Doppelte
    let up = 0;
    for (const game of games.slice().reverse()) {
      if (!game.by) game.by = memberId();
      try {
        const rr = await fetch(apiBase() + '/api/group/' + d.code + '/games', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game }) });
        if (rr.ok) { up++; rememberMyGid(game.gid); }
      } catch (e) { /* einzelnes Spiel übersprungen -> kann später erneut hoch */ }
    }
    const g = { id: 'g' + Date.now(), name: src.name, scope: 'online', code: d.code, adminKey: d.adminKey, role: 'owner', created: Date.now() };
    settings.groups.push(g); settings.activeGroup = g.id; saveSettings();
    await fetchOnlineMatches(); renderGroups();
    const hd = document.querySelector('#historyDlg'); if (hd && hd.open) renderHistory();
    flash('Online gestellt: „' + g.name + '" · Code ' + d.code + ' (' + up + '/' + games.length + ' Spiele)');
  } catch (e) { flash('Online stellen fehlgeschlagen'); }
}

function matchKey(m) { return m.gid ? ('g:' + m.gid) : ((m.ts || '') + '|' + (m.names ? m.names.A + '/' + m.names.B : '')); }
function inActiveGroup(m) { return viewAllGroups ? true : ((m.group || 'local') === (settings.activeGroup || 'local')); }
function allMatches() {
  const seen = new Set(), out = [];
  onlineMatches.concat(loadHistory().filter(inActiveGroup)).forEach((m) => {
    const k = matchKey(m); if (seen.has(k)) return; seen.add(k); out.push(m);
  });
  return out;
}
function renderGroups() {
  const sel = document.querySelector('#setActiveGroup');
  if (!sel) return;
  sel.innerHTML = settings.groups.map((g) =>
    '<option value="' + g.id + '">' + g.name + (g.scope === 'online' ? ' ☁' : '') + '</option>').join('');
  sel.value = settings.activeGroup;
  const as = document.querySelector('#setAutoSave'); if (as) as.checked = !!settings.autoSave;
  const wb = document.querySelector('#setWorkerBase'); if (wb) wb.value = settings.workerBase || '';
  const info = document.querySelector('#groupInfo');
  const g = activeGroupObj();
  if (info) {
    if (g && g.scope === 'online') {
      info.textContent = 'Online-Gruppe · Code zum Teilen: ' + g.code + (g.role === 'owner' ? ' (Ersteller)' : '');
    } else {
      info.textContent = 'Lokale Gruppe (nur auf diesem Gerät).';
    }
  }
  // "Online stellen"-Knopf nur bei lokaler aktiver Gruppe zeigen (mit Spielanzahl)
  const ob = document.querySelector('#groupOnlineBtn');
  if (ob) {
    const isLocal = g && g.scope !== 'online';
    if (isLocal) {
      const n = loadHistory().filter((m) => (m.group || 'local') === g.id).length;
      ob.textContent = 'Diese Gruppe online stellen' + (n ? ' (' + n + ')' : '');
    }
    ob.style.display = isLocal ? '' : 'none';
  }
  // "Endgültig löschen" nur dem Ersteller einer Online-Gruppe zeigen (hat adminKey)
  const db = document.querySelector('#delGroupServerBtn');
  if (db) db.style.display = (g && g.scope === 'online' && g.role === 'owner' && g.adminKey) ? '' : 'none';
}
function computeStats() {
  const stats = {};
  const ensure = (p) => stats[p] || (stats[p] = { player: p, games: 0, wins: 0, diff: 0 });
  allMatches().forEach((m) => {
    const pa = (m.players && m.players.A) || parsePlayers(m.names ? m.names.A : '');
    const pb = (m.players && m.players.B) || parsePlayers(m.names ? m.names.B : '');
    let da = 0, db = 0;
    const mm = String(m.score || m.sets || '').match(/(\d+)\D+(\d+)/);
    if (mm) { da = +mm[1]; db = +mm[2]; }
    const winA = m.winner === 'A';
    pa.forEach((p) => { const s = ensure(p); s.games++; if (winA) s.wins++; s.diff += (da - db); });
    pb.forEach((p) => { const s = ensure(p); s.games++; if (!winA) s.wins++; s.diff += (db - da); });
  });
  return Object.values(stats)
    .map((s) => Object.assign(s, { quote: s.games ? Math.round(100 * s.wins / s.games) : 0 }))
    .sort((a, b) => b.quote - a.quote || b.wins - a.wins || b.diff - a.diff);
}
function renderStats() {
  const list = computeStats();
  const total = allMatches().length;
  $('#statsSource').textContent = (onlineMatches.length ? 'Online + lokal' : 'Lokal') + ': ' + total + ' Spiele';
  const el = $('#statsList');
  if (!list.length) { el.innerHTML = '<p class="muted">Noch keine Spiele gespeichert.</p>'; return; }
  el.innerHTML = list.map((s, i) =>
    '<div class="stat-row"><span class="stat-rank">' + (i + 1) + '</span>' +
    '<span><span class="stat-name">' + s.player + '</span><br>' +
    '<span class="stat-sub">' + s.wins + '/' + s.games + ' Siege · Diff ' + (s.diff >= 0 ? '+' : '') + s.diff + '</span></span>' +
    '<span class="stat-quote">' + s.quote + '%</span></div>').join('');
}
function populateMatchmaker() {
  const ps = CLUB_PLAYERS.slice().sort((a, b) => a.localeCompare(b, 'de'));
  ['#mm1', '#mm2', '#mm3', '#mm4'].forEach((id, idx) => {
    const sel = $(id);
    if (sel) sel.innerHTML = '<option value="">— Spieler ' + (idx + 1) + '</option>' +
      ps.map((p) => '<option value="' + p + '">' + p + '</option>').join('');
  });
}
function playerQuote(p) {
  const s = computeStats().find((x) => x.player === p);
  return s && s.games ? s.quote : 50; // unbekannt -> 50 %
}
function runMatchmaker() {
  const sel = ['#mm1', '#mm2', '#mm3', '#mm4'].map((id) => $(id).value).filter(Boolean);
  if (sel.length !== 4 || new Set(sel).size !== 4) {
    $('#mmResult').textContent = 'Bitte vier verschiedene Spieler wählen.'; return;
  }
  const q = {}; sel.forEach((p) => (q[p] = playerQuote(p)));
  const splits = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  let best = null;
  splits.forEach((sp) => {
    const tA = sp[0].map((i) => sel[i]), tB = sp[1].map((i) => sel[i]);
    const diff = Math.abs((q[tA[0]] + q[tA[1]]) - (q[tB[0]] + q[tB[1]]));
    if (!best || diff < best.diff) best = { tA, tB, diff };
  });
  mmBest = best;
  $('#mmResult').innerHTML = 'Team A: <b>' + best.tA.join(' + ') + '</b><br>Team B: <b>' + best.tB.join(' + ') +
    '</b><br><button type="button" id="mmApply" class="ghost small" style="margin-top:.5rem">In Team A/B übernehmen</button>';
  $('#mmApply').addEventListener('click', () => {
    settings.names.A = mmBest.tA.slice().sort((a, b) => slug(a).localeCompare(slug(b))).join(' + ');
    settings.names.B = mmBest.tB.slice().sort((a, b) => slug(a).localeCompare(slug(b))).join(' + ');
    saveSettings(); render(); $('#statsDlg').close();
  });
}
let mmBest = null;
function exportMatches() {
  const data = JSON.stringify(allMatches(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pickleball-matches.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importMatches(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw 0;
      const seen = new Set(), out = [];
      arr.concat(loadHistory()).forEach((m) => { const k = matchKey(m); if (seen.has(k)) return; seen.add(k); out.push(m); });
      localStorage.setItem(KEY_HISTORY, JSON.stringify(out.slice(0, 200)));
      renderStats();
      flash('Import: ' + arr.length + ' Spiele');
    } catch (e) { flash('Import fehlgeschlagen'); }
  };
  reader.readAsText(file);
}

/* =========================================================================
   Persistenz
   ========================================================================= */
function loadSettings() {
  let s = null;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_SETTINGS));
    if (raw) s = Object.assign({}, DEFAULT_SETTINGS, raw,
      { names: Object.assign({}, DEFAULT_SETTINGS.names, raw.names) });
  } catch (e) { /* ignorieren */ }
  if (!s) s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  // Einmalige Migration: Smartwatch-Steuerung standardmäßig aktivieren,
  // auch bei bestehenden Installationen (die ein gespeichertes "aus" hätten).
  if (!s.inputV2) { s.watchControl = true; s.inputV2 = true; }
  // Ring-/Scroll-Steuerung hat keine UI mehr -> immer dormant (Wheel-Handler inaktiv).
  s.ringControl = false;
  // Gruppen sicherstellen: Array vorhanden, eingebaute "Lokal"-Gruppe immer dabei.
  if (!Array.isArray(s.groups)) s.groups = [];
  if (!s.groups.some((g) => g.id === 'local')) s.groups.unshift({ id: 'local', name: 'Lokal', scope: 'local' });
  if (!s.groups.some((g) => g.id === s.activeGroup)) s.activeGroup = 'local';
  if (typeof s.autoSave !== 'boolean') s.autoSave = true;
  if (typeof s.workerBase !== 'string') s.workerBase = '';
  return s;
}
function saveSettings() { localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); }

function loadGame() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY_GAME));
    if (g && typeof g.srvEven === 'undefined') g.srvEven = true;     // Migration: Aufschläger-Position
    if (g && !g.players) g.players = { A: rosterOf('A'), B: rosterOf('B') };
    return g;
  } catch (e) { return null; }
}
function saveGame() { localStorage.setItem(KEY_GAME, JSON.stringify(game)); }

/* =========================================================================
   Spiel
   ========================================================================= */
function newGame() {
  return {
    scores: { A: 0, B: 0 },
    serving: settings.startServer || 'A',
    // Doppel startet als "2. Aufschläger" -> Ruf 0-0-2; Einzel hat keine Servernummer
    server: settings.mode === 'doubles' ? 2 : 1,
    // Aufschläger-Position: srvEven = aktueller Aufschläger ist der "gerade-Court"-Spieler (Spieler 1,
    // steht bei geradem Team-Stand rechts). Spielstart 0-0 (gerade) -> rechts -> Spieler 1.
    srvEven: true,
    // Roster fürs ganze Spiel einfrieren (Reihenfolge: [gerade-Court, ungerade-Court])
    players: { A: rosterOf('A'), B: rosterOf('B') },
    over: false,
    winner: null,
    counted: false
  };
}

function snapshot() { return JSON.parse(JSON.stringify(game)); }

/* Kern: Team `team` hat den Ballwechsel gewonnen */
function rallyWonBy(team) {
  if (game.over) return;
  history.push(snapshot());

  let event;
  if (team === game.serving) {
    // Aufschlagteam gewinnt -> Punkt
    game.scores[game.serving]++;
    event = 'point';
    flash('Punkt');
    checkOver();
  } else {
    // Aufschlagteam verliert -> Fehler
    if (settings.mode === 'doubles' && game.server === 1) {
      game.server = 2;
      game.srvEven = !game.srvEven; // 2. Aufschläger = Partner
      event = 'secondServer';
      flash('2. Aufschläger');
    } else {
      game.serving = other(game.serving);
      game.server = 1;
      // Neuer Aufschläger ist der Spieler auf der rechten Seite -> gerade-Court-Spieler bei geradem Stand
      game.srvEven = (game.scores[game.serving] % 2 === 0);
      event = 'sideout';
      flash('Seitenwechsel');
    }
  }
  // Spiel beendet -> Match (Satz) zählen und Ergebnis (auto/manuell) speichern
  if (game.over && !game.counted) {
    game.counted = true;
    let entry = null;
    if (settings.matchBestOf > 1) {
      match[game.winner]++; saveMatch();
      if (match[game.winner] >= gamesNeeded()) entry = { type: 'match', winner: game.winner, sets: match.A + ':' + match.B };
    } else {
      entry = { type: 'game', winner: game.winner, score: game.scores.A + ':' + game.scores.B };
    }
    if (entry) finishResult(entry);
  }

  saveGame();
  render();
  if (event === 'point') { popScore(team); flashScore(team); }
  // Tonsignal
  if (game.over) winJingle(); else soundFor(event);
  announce(event);
}

// Vollflächiger Farb-Blitz in der Team-Farbe (aus Distanz sichtbar)
function flashScore(team) {
  const el = document.querySelector('#scoreFlash');
  if (!el) return;
  el.classList.remove('flash', 'teamA', 'teamB');
  void el.offsetWidth; // Animation neu starten
  el.classList.add('flash', team === 'A' ? 'teamA' : 'teamB');
}

// Kleine "Plopp"-Animation auf der Punktzahl
function popScore(team) {
  const el = document.querySelector(`[data-score="${team}"]`);
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth; // Animation neu starten
  el.classList.add('pop');
}

function checkOver() {
  const a = game.scores.A, b = game.scores.B;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  const reached = hi >= settings.target;
  const margin = settings.winBy2 ? (hi - lo >= 2) : true;
  if (reached && margin) {
    game.over = true;
    game.winner = a > b ? 'A' : 'B';
  }
}

function undo() {
  if (!history.length) { flash('Nichts rückgängig'); return; }
  game = history.pop();
  undoTone(); // kleiner Bestätigungston beim Zurücknehmen
  saveGame();
  render();
  announce(undefined, true); // neuen Stand nach der Rücknahme ansagen (z.B. von 1-4-1 zurück -> "0-4-1")
}

// Startaufschlag fürs nächste Spiel: bei "automatisch abwechseln" anderes Team als zuletzt.
// Gibt true zurück, wenn automatisch gewechselt wurde (dann keinen Chooser zeigen).
function prepareNextStarter() {
  if (settings.alternateServe && settings.lastStartServer) {
    settings.startServer = other(settings.lastStartServer);
    settings.lastStartServer = settings.startServer;
    saveSettings();
    return true;
  }
  return false;
}
function resetGame() {
  const auto = prepareNextStarter();
  history = [];
  game = newGame();
  match = { A: 0, B: 0 };
  saveMatch();
  saveGame();
  startChosen = auto;     // bei Auto-Wechsel keinen "Wer beginnt?"-Dialog zeigen
  hide('winner');
  render();
}
// Nächstes Spiel im Match (Satzstand bleibt erhalten)
function nextGame() {
  const auto = prepareNextStarter();
  history = [];
  game = newGame();
  saveGame();
  startChosen = auto;
  hide('winner');
  render();
}

// Startaufschlag bei einem frischen Spiel sofort übernehmen
function applyStartServer() {
  if (game.scores.A === 0 && game.scores.B === 0 && !history.length && !game.over) {
    game.serving = settings.startServer;
    saveGame();
  }
}
// Münzwurf: zufälliges Team schlägt zuerst auf
function coinToss() {
  ensureAudio();
  settings.startServer = Math.random() < 0.5 ? 'A' : 'B';
  settings.lastStartServer = settings.startServer; // für Auto-Wechsel im nächsten Spiel
  saveSettings();
  const sel = document.querySelector('#setStartServer');
  if (sel) sel.value = settings.startServer;
  applyStartServer();
  render();
  flash('Aufschlag: ' + teamName(settings.startServer));
  if (settings.announce) {
    const tk = teamClipKey(settings.startServer);
    speakKeysOrText(tk ? ['aufschlag', tk] : null, 'Aufschlag ' + speakName(teamName(settings.startServer)));
  }
}

// Verlauf-Liste füllen
function renderHistory() {
  const el = document.querySelector('#historyList');
  if (!el) return;
  const localKeys = new Set(loadHistory().map(matchKey));
  const list = allMatches();
  if (!list.length) { el.innerHTML = '<p class="muted">Noch keine Spiele gespeichert.</p>'; return; }
  const ag = activeGroupObj();
  const isOwner = !!(ag && ag.scope === 'online' && ag.role === 'owner');
  el.innerHTML = list.map((e) => {
    const d = new Date(e.ts);
    const date = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const w = (e.names && e.names[e.winner]) || ('Team ' + e.winner);
    const res = e.type === 'match' ? ('Match ' + e.sets) : ('Spiel ' + e.score);
    const teams = e.names ? (e.names.A + ' vs ' + e.names.B) : '';
    const src = localKeys.has(matchKey(e)) ? 'local' : 'online';
    const id = e.gid || e.ts || '';
    // Lokal: immer löschbar. Online: nur Ersteller ODER wer das Spiel selbst eingetragen hat.
    const canDel = (src === 'local') || isOwner || isMyGid(id);
    const delBtn = canDel ? ('<button class="hist-del" data-gid="' + id + '" data-src="' + src +
           '" title="Spiel löschen" aria-label="Spiel löschen">✕</button>') : '<span class="hist-del-spacer"></span>';
    return '<div class="hist-row">' + delBtn +
           '<span class="hist-date">' + date + (src === 'online' ? ' · ☁' : '') + '</span>' +
           '<span class="hist-teams">' + teams + '</span>' +
           '<span class="hist-res">' + res + ' · 🏆 ' + w + '</span></div>';
  }).join('');
  el.querySelectorAll('.hist-del').forEach((b) => b.addEventListener('click', () => deleteGame(b.dataset.gid, b.dataset.src)));
}
async function deleteGame(gid, src) {
  if (!gid) return;
  if (!window.confirm('Dieses Spiel wirklich löschen?\nDas kann nicht rückgängig gemacht werden.')) return;
  if (src === 'online') {
    const ok = await deleteOnlineGame(gid);
    if (!ok) { flash('Nur eigene Spiele oder als Ersteller löschbar'); return; }
    await fetchOnlineMatches();
  } else {
    const h = loadHistory().filter((m) => String(m.gid || m.ts) !== String(gid));
    localStorage.setItem(KEY_HISTORY, JSON.stringify(h));
  }
  renderHistory();
  const sd = document.querySelector('#statsDlg');
  if (sd && sd.open) renderStats();
}

/* Manuelle Korrekturen */
function flipServe() { history.push(snapshot()); game.serving = other(game.serving); saveGame(); render(); }
function flipServer() {
  if (settings.mode !== 'doubles') return;
  history.push(snapshot());
  game.server = game.server === 1 ? 2 : 1;
  saveGame(); render();
}

/* =========================================================================
   Anzeige
   ========================================================================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function callText() {
  const sv = game.scores[game.serving];
  const rc = game.scores[other(game.serving)];
  if (settings.mode === 'doubles') return [sv, rc, game.server];
  return [sv, rc];
}

function serveSide(team) {
  // Aufschlag von rechts bei geradem eigenen Punktestand (gerade-Court-Spieler), sonst links.
  // Beim aufschlagenden Team zusätzlich srvEven berücksichtigen (2. Aufschläger = Partner = andere Seite).
  const even = game.scores[team] % 2 === 0;
  const onRight = (team === game.serving && game.srvEven === false) ? !even : even;
  return onRight ? 'rechts' : 'links';
}

function render() {
  // Seiten ggf. tauschen
  document.querySelector('#court').classList.toggle('swapped', !!settings.swapSides);

  // Namen + Punkte
  for (const t of ['A', 'B']) {
    $(`[data-name="${t}"]`).textContent = settings.names[t] || ('Team ' + t);
    $(`[data-score="${t}"]`).textContent = game.scores[t];
  }

  // Match (Satz)-Anzeige: gefüllte/leere Punkte
  const need = gamesNeeded();
  for (const t of ['A', 'B']) {
    const g = $(`[data-games="${t}"]`);
    if (settings.matchBestOf > 1) {
      let s = '';
      for (let i = 0; i < need; i++) s += (i < match[t] ? '●' : '○');
      g.textContent = s;
    } else {
      g.textContent = '';
    }
  }

  // Aufschlag-Markierung
  $$('.side').forEach((el) => el.classList.remove('serving'));
  $$('.serve').forEach((el) => el.classList.remove('show'));
  $$('.hint').forEach((el) => (el.textContent = ''));

  if (!game.over) {
    const s = game.serving;
    $(`.side${s === 'A' ? 'A' : 'B'}`).classList.add('serving');
    const serveEl = $(`[data-serve="${s}"]`);
    serveEl.classList.add('show');
    if (settings.mode === 'doubles') {
      $(`[data-srvnum="${s}"]`).textContent = game.server;
      $(`[data-srvnum="${s}"]`).style.display = '';
    } else {
      $(`[data-srvnum="${s}"]`).style.display = 'none';
    }
    $(`[data-hint="${s}"]`).textContent = 'Aufschlag ' + serveSide(s);
  }

  // Offizieller Ruf oben
  $('#call').textContent = callText().join(' '); // schmales Leerzeichen

  // Sieger-Banner
  if (game.over) {
    const wName = teamName(game.winner);
    const newBtn = $('#winnerNew');
    const matchOver = settings.matchBestOf > 1 && match[game.winner] >= need;
    if (matchOver) {
      $('#winnerText').textContent = '🏆 ' + wName + ' gewinnt das Match!  (' + match.A + ':' + match.B + ')';
      newBtn.textContent = 'Neues Match';
      newBtn.onclick = resetGame;
    } else if (settings.matchBestOf > 1) {
      $('#winnerText').textContent = '🏆 Spiel für ' + wName + '  (Sätze ' + match.A + ':' + match.B + ')';
      newBtn.textContent = 'Nächstes Spiel';
      newBtn.onclick = nextGame;
    } else {
      $('#winnerText').textContent = '🏆 ' + wName + ' gewinnt!';
      newBtn.textContent = 'Neues Spiel';
      newBtn.onclick = resetGame;
    }
    updateWinnerSave(); // „Spiel speichern" anzeigen, falls noch nicht gespeichert
    show('winner');
  }

  // Start-Aufschlag-Auswahl (nur bei frischem Spiel, wenn Intro nicht offen ist)
  const fresh = !game.over && game.scores.A === 0 && game.scores.B === 0 && !history.length;
  const introHidden = $('#intro').classList.contains('hidden');
  // Bei Auto-Wechsel (und vorhandenem letzten Starter) keinen Dialog mehr zeigen
  const autoServe = settings.alternateServe && settings.lastStartServer;
  const showChooser = fresh && introHidden && settings.showStartChooser && !startChosen && !autoServe;
  const ss = $('#startServe');
  ss.classList.toggle('hidden', !showChooser);
  if (showChooser) {
    $('#ssA').textContent = teamName('A');
    $('#ssB').textContent = teamName('B');
    $('#ssA').classList.toggle('chosen', settings.startServer === 'A');
    $('#ssB').classList.toggle('chosen', settings.startServer === 'B');
  }

  // Mute-Symbol
  $('#muteBtn').textContent = settings.announce ? '🔊' : '🔇';
}

function flash(msg, dur) {
  const el = $('#feedback');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove('show'), dur || 1100);
}

function show(id) { $('#' + id).classList.remove('hidden'); }
function hide(id) { $('#' + id).classList.add('hidden'); }

/* =========================================================================
   Sprachansage (Text-to-Speech)
   ========================================================================= */
// Spielstand als fließende Phrase: Kommas = kurze Atempausen (nicht abgehackt),
// aber ohne große Lücken wie bei getrennten Ansagen.
function scorePhrase() {
  const nums = callText(); // [sv, rc] oder [sv, rc, server]
  if (settings.callStyle === 'ziffern') {
    // Reine Ziffern, z.B. "null null eins" (= 0 0 1) - Leerzeichen = kurze Pausen
    return settings.mode === 'doubles'
      ? say(nums[0]) + ' ' + say(nums[1]) + ' ' + say(nums[2])
      : say(nums[0]) + ' ' + say(nums[1]);
  }
  if (settings.mode === 'doubles') {
    // Klingt wie eine Spielstand-Ansage, z.B. "drei zu null, zwei" (= 3 0 2)
    return say(nums[0]) + ' zu ' + say(nums[1]) + ', ' + say(nums[2]);
  }
  return say(nums[0]) + ' zu ' + say(nums[1]);
}

// Schnipsel-Folge abspielen; klappt das nicht, Text per Geräte-Stimme
async function speakKeysOrText(keys, fallbackText) {
  stopVoice();
  const myGen = clipGen;
  if (keys && settings.naturalVoice && clipsAvailable && ensureAudio()) {
    const entries = await Promise.all(keys.map((k) => loadClip(k)));
    if (myGen !== clipGen) return;
    if (entries.every(Boolean)) { playEntries(entries); return; }
  }
  speakText(fallbackText);
}

// Doppel-Paar (zwei Personen) -> Plural "gewinnen", sonst "gewinnt" ("Team A gewinnt")
function winnerVerb() { return parsePlayers(teamName(game.winner)).length >= 2 ? 'gewinnen' : 'gewinnt'; }
async function announce(event, force) {
  if (!settings.announce && !force) return;
  const phrases = [];
  if (game.over) {
    const wName = speakName(teamName(game.winner));
    if (settings.matchBestOf > 1 && match[game.winner] >= gamesNeeded()) {
      phrases.push('Match');
      phrases.push(wName + ' gewinnt das Match');
    } else if (settings.matchBestOf > 1) {
      phrases.push('Spiel für ' + wName);
      phrases.push('Satzstand ' + say(match.A) + ' zu ' + say(match.B));
    } else {
      phrases.push('Spiel');
      phrases.push(wName + ' ' + winnerVerb());
    }
  } else if (settings.scoreOnly) {
    // Nur der aktuelle Stand - ohne Seitenwechsel, Name, Verlängerung
    phrases.push(scorePhrase());
  } else {
    if (event === 'sideout') {
      phrases.push('Seitenwechsel');
      if (settings.announceTeam) {
        phrases.push('Aufschlag ' + speakName(settings.names[game.serving] || ('Team ' + game.serving)));
      }
    }
    phrases.push(scorePhrase());
    // Verlängerung (Deuce): bei Gleichstand ab "Spiel bis minus 1"
    const a = game.scores.A, b = game.scores.B;
    if (event === 'point' && settings.winBy2 && a === b && a >= settings.target - 1) {
      phrases.push('Verlängerung, es geht bis ' + say(a + 2));
    }
    if (settings.announceServer) {
      phrases.push('Aufschlag ' + speakName(servingPlayerName()));
    }
  }
  stopVoice();
  const myGen = clipGen;
  // 1) Voller Ruf als ein Schnipsel (natürlich), 2) Wort-Schnipsel, sonst Geräte-Stimme
  if (settings.naturalVoice && clipsAvailable && ensureAudio()) {
    for (const keys of [buildPhraseKeys(event), buildClipKeys(event)]) {
      if (!keys) continue;
      const entries = await Promise.all(keys.map((k) => loadClip(k)));
      if (myGen !== clipGen) return;           // ein neuerer Aufruf hat übernommen
      if (entries.every(Boolean)) { playEntries(entries); return; }
    }
  }
  // sonst Geräte-Stimme (fließender Komma-Satz; Punkt am Ende gegen Abschneiden)
  if (!('speechSynthesis' in window)) return;
  const text = phrases.join(', ') + '.';
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.9;
    u.pitch = 1;
    const v = pickVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* Ansage optional */ }
}
// ---- Stimmen-Auswahl (für klarere Ansagen) ----
function allVoices() {
  try { return speechSynthesis.getVoices() || []; } catch (e) { return []; }
}
function germanVoices() {
  return allVoices().filter((v) => /^de/i.test(v.lang));
}
// Wählt die eingestellte Stimme, sonst die beste verfügbare deutsche
function pickVoice() {
  const voices = allVoices();
  if (settings.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (chosen) return chosen;
  }
  const de = germanVoices();
  if (!de.length) return null;
  // bevorzugt natürliche/neuronale Stimmen (z.B. Edge "Online (Natural)")
  const tiers = [/natural|neural|online/i, /enhanced|premium/i, /google/i];
  for (const re of tiers) {
    const m = de.find((v) => re.test(v.name));
    if (m) return m;
  }
  return de[0];
}
// Namen sprechbar machen ("Silas + Niki" -> "Silas und Niki")
function speakName(name) {
  return String(name || '').replace(/\+/g, ' und ').replace(/\s+/g, ' ').trim();
}
// Beliebigen Text mit der gewählten Stimme sprechen
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = 0.9;
    const v = pickVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}

// ---- Tonsignale (Web Audio, ohne Audiodateien) ----
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
  return audioCtx;
}
// ---- Lautstärke: Master-GainNode + Limiter, durch den alle Töne/Schnipsel laufen ----
const VOLUME_GAIN = { normal: 1.0, laut: 1.6, 'sehr-laut': 2.3, maximal: 3.8 };
let masterGain = null;
let masterLimiter = null;
// Kette: Quelle -> masterGain (Boost) -> Limiter (verhindert hartes Clipping) -> Ausgang.
// Der Limiter erlaubt hohen Gain (laut auf BT-Lautsprechern) ohne übles Verzerren.
function masterNode() {
  const ctx = ensureAudio();
  if (!ctx) return null;
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    masterLimiter = ctx.createDynamicsCompressor();
    masterLimiter.threshold.value = -8;   // ab hier begrenzen
    masterLimiter.knee.value = 0;
    masterLimiter.ratio.value = 20;       // hohe Ratio = Limiter
    masterLimiter.attack.value = 0.003;
    masterLimiter.release.value = 0.25;
    masterGain.connect(masterLimiter);
    masterLimiter.connect(ctx.destination);
  }
  const g = VOLUME_GAIN[settings.volume];
  masterGain.gain.value = (g != null) ? g : 1.6;
  return masterGain;
}
function beep(freq, durMs, type, when) {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    const t = ctx.currentTime + (when || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    o.connect(g); g.connect(masterNode() || ctx.destination);
    o.start(t); o.stop(t + durMs / 1000 + 0.03);
  } catch (e) {}
}
function soundFor(event) {
  if (!settings.sound) return;
  if (event === 'point') beep(880, 110, 'triangle');
  else if (event === 'sideout') beep(420, 150, 'sine');
  else if (event === 'secondServer') beep(620, 110, 'sine');
}
function winJingle() {
  if (!settings.sound) return;
  beep(660, 130, 'triangle', 0);
  beep(880, 130, 'triangle', 0.14);
  beep(1175, 220, 'triangle', 0.28);
}

// Kurzer Bestätigungston beim Zurücknehmen eines Punkts (klar erkennbar, eigenständig)
function undoTone() { ensureAudio(); beep(440, 90, 'sine', 0); beep(300, 130, 'sine', 0.07); }

// ---- Natürliche Audio-Schnipsel (vorab mit edge-tts erzeugt) ----
const CLIP_KEYS = new Set([
  ...Array.from({ length: 31 }, (_, i) => String(i)),
  'zu', 'seitenwechsel', 'verlaengerung', 'es-geht-bis', 'aufschlag', 'spiel', 'gewinnt', 'gewinnen',
  'spiel-fuer', 'satzstand', 'match', 'gewinnt-das-match', 'team-a', 'team-b'
]);
let clipsAvailable = false;
let clipsPreloaded = false;
let clipGen = 0;
let clipNodes = [];
const clipBuffers = {};

function probeClips() {
  // fetch statt Audio-Element: funktioniert auf iOS auch ohne erste Nutzergeste
  fetch('voice/0.mp3').then((r) => { clipsAvailable = r.ok; }).catch(() => { clipsAvailable = false; });
}

// Schnipsel laden und als AudioBuffer dekodieren (für lückenloses Abspielen)
// Stille am Anfang/Ende eines Schnipsels finden, damit Wörter dicht aneinander liegen
function trimEntry(buf) {
  const data = buf.getChannelData(0);
  const n = data.length, thresh = 0.012;
  let s = 0, e = n - 1;
  while (s < n && Math.abs(data[s]) < thresh) s++;
  while (e > s && Math.abs(data[e]) < thresh) e--;
  const sr = buf.sampleRate;
  s = Math.max(0, s - Math.floor(sr * 0.04));   // etwas Vorlauf
  e = Math.min(n - 1, e + Math.floor(sr * 0.12)); // mehr Nachklang, damit nichts abgehackt klingt
  return { buf: buf, offset: s / sr, dur: Math.max(0.05, (e - s) / sr) };
}
async function loadClip(key) {
  if (clipBuffers[key]) return clipBuffers[key];
  const ctx = ensureAudio();
  if (!ctx) return null;
  try {
    const arr = await (await fetch('voice/' + key + '.mp3')).arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    const entry = trimEntry(buf);
    clipBuffers[key] = entry;
    return entry;
  } catch (e) { return null; }
}
function preloadClips() {
  if (clipsPreloaded) return;
  clipsPreloaded = true;
  CLIP_KEYS.forEach((k) => { loadClip(k); });
}

function stopClipNodes() {
  clipNodes.forEach((n) => { try { n.stop(); } catch (e) {} });
  clipNodes = [];
}
// Aktuelle Ansage (Schnipsel oder Sprache) stoppen
function stopVoice() {
  clipGen++;
  stopClipNodes();
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) {} }
}

// Schnipsel lückenlos nacheinander planen (Web Audio)
// Vorab geladene Schnipsel-Segmente lückenlos planen
function playEntries(entries) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const valid = entries.filter(Boolean);
  if (!valid.length) return;
  let t = ctx.currentTime + 0.08;
  // Aufwärm-Vorlauf: ein kurzes, nahezu unhörbares Tonstück, damit der Audioausgang/BT-Lautsprecher
  // schon "wach" ist. Manche Android-/Bluetooth-Geräte verschlucken sonst die ersten Zahlen, weil
  // der Lautsprecher nach Stille ~0,3-0,5 s zum Aufwachen braucht.
  try {
    const warmDur = 0.38;
    const len = Math.max(1, Math.ceil(ctx.sampleRate * warmDur));
    const wbuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const wch = wbuf.getChannelData(0);
    const inc = 2 * Math.PI * 55 / ctx.sampleRate; // tiefer 55-Hz-Ton (klein/unhörbar, aber "Signal")
    for (let i = 0; i < len; i++) wch[i] = Math.sin(i * inc) * 0.012;
    const wsrc = ctx.createBufferSource();
    wsrc.buffer = wbuf;
    wsrc.connect(masterNode() || ctx.destination);
    wsrc.start(t);
    clipNodes.push(wsrc);
    t += warmDur;
  } catch (e) {}
  const GAP = 0.22; // natürliche Pause zwischen den Segmenten
  valid.forEach((en, idx) => {
    const isLast = idx === valid.length - 1;
    // letztes Segment länger ausklingen lassen, damit es nicht abgehackt klingt
    const dur = isLast ? Math.min(en.buf.duration - en.offset, en.dur + 0.25) : en.dur;
    const src = ctx.createBufferSource();
    src.buffer = en.buf;
    src.connect(masterNode() || ctx.destination);
    src.start(t, en.offset, dur);
    clipNodes.push(src);
    t += dur + GAP;
  });
}

// Schnipsel-Schlüssel für die aktuelle Ansage; null, wenn nicht alles als Schnipsel da ist
function buildClipKeys(event) {
  const keys = [];
  let bad = false;
  const num = (n) => { if (n >= 0 && n <= 30) keys.push(String(n)); else bad = true; };
  const team = (t) => {
    const nm = teamName(t);
    if (nm === 'Team A') keys.push('team-a');
    else if (nm === 'Team B') keys.push('team-b');
    else bad = true; // eigener Name -> Geräte-Stimme
  };
  if (game.over) {
    if (settings.matchBestOf > 1 && match[game.winner] >= gamesNeeded()) {
      keys.push('match'); team(game.winner); keys.push('gewinnt-das-match');
    } else if (settings.matchBestOf > 1) {
      keys.push('spiel-fuer'); team(game.winner); keys.push('satzstand'); num(match.A); keys.push('zu'); num(match.B);
    } else {
      keys.push('spiel'); team(game.winner); keys.push(winnerVerb());
    }
  } else {
    if (!settings.scoreOnly && event === 'sideout') {
      keys.push('seitenwechsel');
      if (settings.announceTeam) { keys.push('aufschlag'); team(game.serving); }
    }
    const nums = callText();
    if (settings.callStyle === 'ziffern') {
      num(nums[0]); num(nums[1]);                 // "null null eins" (keine "zu")
    } else {
      num(nums[0]); keys.push('zu'); num(nums[1]);
    }
    if (settings.mode === 'doubles') num(nums[2]);
    const a = game.scores.A, b = game.scores.B;
    if (!settings.scoreOnly && event === 'point' && settings.winBy2 && a === b && a >= settings.target - 1) {
      keys.push('verlaengerung'); keys.push('es-geht-bis'); num(a + 2);
    }
    if (!settings.scoreOnly && settings.announceServer) { // "... Aufschlag <Name>"
      keys.push('aufschlag');
      const sk = servingPlayerKey();
      if (sk) keys.push(sk); else bad = true;      // unbekannter Name -> Geräte-Stimme
    }
  }
  if (bad || !keys.every((k) => CLIP_KEYS.has(k) || k.startsWith('name_'))) return null;
  return keys;
}

// ---- Vereins-Spielernamen (für natürliche Namens-Ansagen) ----
const CLUB_PLAYERS = ['Niki', 'Silas', 'Eric', 'Petra', 'Tobias', 'Yassine', 'Christoph',
  'Kamil', 'Luis', 'Simon', 'Sven', 'Uyen', 'Barbara', 'Inna', 'Serhi', 'Helena', 'Simone',
  'Kevin', 'Iris', 'Jürgen', 'Silke', 'Tilo', 'Jule', 'Vasilisa', 'Melli', 'Viktor', 'Matthias'];
function slug(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}
const CLUB_SLUGS = new Set(CLUB_PLAYERS.map(slug));
// Clip-Schlüssel für einen (Vereins-)Namen, sonst null
function clubNameKey(nm) {
  const parts = String(nm).split('+').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const slugs = parts.map(slug);
  if (slugs.some((s) => !CLUB_SLUGS.has(s))) return null;
  slugs.sort();
  return 'name_' + slugs.join('-');
}
function teamClipKey(t) {
  const nm = teamName(t);
  if (nm === 'Team A') return 'team-a';
  if (nm === 'Team B') return 'team-b';
  return clubNameKey(nm);
}

// ---- Aufschläger nach Name (volle Positions-Logik) ----
// Geordnete Spieler eines Teams ([gerade-Court, ungerade-Court]); Fallback aus dem Anzeige-Namen.
function rosterOf(team) {
  const r = (settings.roster && settings.roster[team]) || [];
  const list = r.filter(Boolean);
  if (list.length) return list.slice(0, 2);
  return parsePlayers(teamName(team)).slice(0, 2);
}
// Aktuell aufschlagender Spieler: gerade-Court-Spieler (Spieler 1) wenn srvEven, sonst Partner.
function servingPlayerName() {
  const team = game.serving;
  const pl = (game.players && game.players[team] && game.players[team].length)
    ? game.players[team] : rosterOf(team);
  if (settings.mode !== 'doubles') return pl[0] || teamName(team);
  if (pl.length < 2) return pl[0] || teamName(team);
  return game.srvEven ? pl[0] : pl[1];
}
// Clip-Schlüssel für den Aufschläger-Namen (Vereinsspieler), sonst null -> Geräte-Stimme.
function servingPlayerKey() {
  const nm = servingPlayerName();
  if (!nm) return null;
  const s = slug(nm);
  return CLUB_SLUGS.has(s) ? ('name_' + s) : null;
}
// Spieler, für die es den vollen Blocksatz "Spielstand + Aufschlag <Name>" als EINEN Clip gibt
// (dn_/dzn_-Dateien). Sonst wird der Name als eigener Schnipsel angehängt.
const BLOCK_PLAYER_SLUGS = new Set(['inna', 'tobias', 'silas', 'matthias', 'yassine', 'christoph', 'petra', 'iris', 'niki']);

// Volle Ansage-Schnipsel bevorzugen (ganze Phrasen = natürliche Betonung)
function buildPhraseKeys(event) {
  if (game.over) {
    const tk = teamClipKey(game.winner);
    if (!tk) return null;
    if (settings.matchBestOf > 1 && match[game.winner] >= gamesNeeded()) {
      return ['match', tk, 'gewinnt-das-match'];
    }
    if (settings.matchBestOf > 1) return null; // "Spiel für ..., Satzstand ..." -> Wort-Fallback
    return ['spiel', tk, winnerVerb()];
  }
  const nums = callText();
  if (nums[0] > 21 || nums[1] > 21) return null; // außerhalb des erzeugten Bereichs
  // Vollphrase je Stil: natürlich "d_/s_" ("a zu b, c"), Ziffern "dz_/sz_" ("a b c")
  const ziff = settings.callStyle === 'ziffern';
  const call = settings.mode === 'doubles'
    ? (ziff ? 'dz_' : 'd_') + nums[0] + '_' + nums[1] + '_' + nums[2]
    : (ziff ? 'sz_' : 's_') + nums[0] + '_' + nums[1];
  if (settings.scoreOnly) return [call]; // Nur Spielstand - kein Seitenwechsel/Name/Verlängerung
  const keys = [];
  if (event === 'sideout' && settings.announceTeam) {
    const nm = teamName(game.serving);
    if (nm === 'Team A') keys.push('so_a');       // "Seitenwechsel, Aufschlag Team A" am Stück
    else if (nm === 'Team B') keys.push('so_b');
    else {
      const tk = teamClipKey(game.serving);
      if (!tk) return null;                       // unbekannter Name -> Wort-Fallback/Stimme
      keys.push('so_pre', tk);                    // "Seitenwechsel, Aufschlag" + Name
    }
  } else if (event === 'sideout') {
    keys.push('seitenwechsel');
  }
  keys.push(call);
  const a = game.scores.A, b = game.scores.B;
  if (event === 'point' && settings.winBy2 && a === b && a >= settings.target - 1) {
    if (a + 2 <= 30) keys.push('verlaengerung', 'es-geht-bis', String(a + 2));
    else return null;
  }
  if (settings.announceServer) {                  // "... Aufschlag <Name>"
    const sk = servingPlayerKey();
    if (!sk) return null;                          // unbekannter Name -> Wort-Fallback/Stimme
    const sp = sk.replace('name_', '');
    // Voller Blocksatz als EIN Clip im einfachen Fall (Doppel, normaler Punkt ohne
    // Seitenwechsel-Vorspann/Verlängerung) -> klingt durchgehend statt 3-teilig.
    if (settings.mode === 'doubles' && keys.length === 1 && BLOCK_PLAYER_SLUGS.has(sp)) {
      return [(ziff ? 'dzn_' : 'dn_') + nums[0] + '_' + nums[1] + '_' + nums[2] + '_' + sp];
    }
    keys.push('aufschlag', sk);
  }
  return keys;
}

// Spieler-Auswahl pro Team (Spieler 1 / Spieler 2)
function fillPlayerSelect(sel, firstLabel, firstValue) {
  if (!sel) return;
  const ps = CLUB_PLAYERS.slice().sort((a, b) => a.localeCompare(b, 'de'));
  sel.innerHTML = '<option value="' + firstValue + '">' + firstLabel + '</option>' +
    ps.map((p) => '<option value="' + p + '">' + p + '</option>').join('');
}
function populateTeamSelects() {
  fillPlayerSelect(document.querySelector('#setA1'), 'Team A', 'Team A');
  fillPlayerSelect(document.querySelector('#setA2'), '— (kein Partner)', '');
  fillPlayerSelect(document.querySelector('#setB1'), 'Team B', 'Team B');
  fillPlayerSelect(document.querySelector('#setB2'), '— (kein Partner)', '');
}
// Team-Namen aus den beiden Auswahl-Menüs ableiten
function teamFromSelects(team) {
  const v1 = document.querySelector('#set' + team + '1').value;
  const v2 = document.querySelector('#set' + team + '2').value;
  const players = [];
  if (v1 && v1 !== 'Team A' && v1 !== 'Team B') players.push(v1);
  if (v2) players.push(v2);
  let name;
  if (!players.length) name = 'Team ' + team;
  else if (players.length === 1) name = players[0];
  else name = players.slice().sort((a, b) => slug(a).localeCompare(slug(b))).join(' + ');
  settings.names[team] = name;
  // Geordnetes Roster merken (Spieler 1 zuerst = startet rechts) - für Aufschläger-Ansage
  if (!settings.roster) settings.roster = { A: [], B: [] };
  settings.roster[team] = players.slice();
  saveSettings();
  // Roster auch im laufenden frischen Spiel aktualisieren (vor dem ersten Punkt)
  if (game && game.players && game.scores.A === 0 && game.scores.B === 0 && !game.over) {
    game.players[team] = rosterOf(team);
    saveGame();
  }
  render();
}
// Auswahl-Menüs auf den aktuellen Team-Namen einstellen (Roster-Reihenfolge bevorzugen)
function setSelectsFromName(team) {
  const r = (settings.roster && settings.roster[team]) || [];
  let known = r.filter((p) => CLUB_PLAYERS.indexOf(p) !== -1);
  if (!known.length) {
    const parts = teamName(team).split('+').map((s) => s.trim()).filter(Boolean);
    known = parts.filter((p) => CLUB_PLAYERS.indexOf(p) !== -1);
  }
  document.querySelector('#set' + team + '1').value = known.length ? known[0] : ('Team ' + team);
  document.querySelector('#set' + team + '2').value = known.length >= 2 ? known[1] : '';
}

/* =========================================================================
   Eingabe: feste Tastatur-Kürzel (Desktop-Komfort)
   ========================================================================= */
function keyId(e) { return e.code || e.key; }

document.addEventListener('keydown', (e) => {
  // Während die Einstellungen offen sind, keine Spielaktionen auslösen
  if ($('#settings').open) return;
  // In Eingabefeldern nichts abfangen
  if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;

  const id = keyId(e);
  if (id === KEYBOARD.A)    { e.preventDefault(); rallyWonBy('A'); }
  else if (id === KEYBOARD.B) { e.preventDefault(); rallyWonBy('B'); }
  else if (id === KEYBOARD.undo) { e.preventDefault(); undo(); }
  else if (id === KEYBOARD.repeat) { e.preventDefault(); ensureAudio(); announce(undefined, true); }
});

// Tippen auf die Spielfeld-Hälften
$$('.side').forEach((el) => {
  el.addEventListener('click', () => {
    if ($('#settings').open) return;
    if (settings.swipeControl) return; // bei Wisch-Steuerung übernimmt das Overlay
    if (settings.ringControl && lastPointerType === 'mouse') return; // Ring-Tipp = Wiederholen, nicht zählen
    rallyWonBy(el.dataset.team);
  });
});

// ---- #1 Ring-/Scroll-Steuerung (Mausrad) + Mittel-Knopf (Maus-Tipp = Wiederholen) ----
let lastPointerType = 'touch';
let lastWheel = 0;
function anyDialogOpen() {
  return ['#settings', '#statsDlg', '#historyDlg'].some((id) => { const d = $(id); return d && d.open; });
}
window.addEventListener('wheel', (e) => {
  if (!settings.ringControl || anyDialogOpen()) return; // Dialoge scrollbar lassen
  e.preventDefault();
  const now = Date.now();
  if (now - lastWheel < 400) return; // entprellen (ein Klick feuert viele Events)
  lastWheel = now;
  ensureAudio();
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { undo(); return; } // links/rechts-Wisch = Undo
  if (e.deltaY < 0) rallyWonBy('A');
  else if (e.deltaY > 0) rallyWonBy('B');
}, { passive: false });

document.addEventListener('pointerdown', (e) => {
  lastPointerType = e.pointerType || 'touch';
  if (settings.ringControl && e.pointerType === 'mouse' && !anyDialogOpen()) {
    if (e.target.closest('#bar') || e.target.closest('button') || e.target.closest('select') ||
        e.target.closest('input') || e.target.closest('#swipeLayer')) return;
    ensureAudio();
    announce(undefined, true); // Mittel-Knopf des Rings = Stand wiederholen
  }
}, true);

// ---- Wisch-Steuerung (Overlay): hoch=A, runter=B, seitlich=Undo, Tipp=Wiederholen ----
function updateSwipeLayer() {
  const l = $('#swipeLayer');
  if (l) l.classList.toggle('hidden', !settings.swipeControl);
}
(() => {
  const l = $('#swipeLayer');
  if (!l) return;
  let sx = 0, sy = 0, pressTimer = null, longPressed = false;
  const clearTimer = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
  l.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY; longPressed = false;
    clearTimer();
    // Lang drücken (~0,8s ruhig) = Punkt zurücknehmen (Undo)
    pressTimer = setTimeout(() => { pressTimer = null; longPressed = true; ensureAudio(); undo(); }, 800);
  });
  l.addEventListener('pointermove', (e) => {
    if (pressTimer && Math.hypot(e.clientX - sx, e.clientY - sy) > 14) clearTimer(); // Wisch -> kein Lang-Druck
  });
  l.addEventListener('pointercancel', clearTimer);
  l.addEventListener('pointerup', (e) => {
    clearTimer();
    if (longPressed) { longPressed = false; return; } // war Lang-Druck (Undo) -> sonst nichts
    if (anyDialogOpen()) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const dist = Math.hypot(dx, dy);
    ensureAudio();
    if (dist < 28) { announce(undefined, true); return; }   // Tipp = Stand wiederholen
    if (Math.abs(dx) > Math.abs(dy)) { undo(); return; }     // seitlich = Undo
    if (dy < 0) rallyWonBy('A'); else rallyWonBy('B');       // hoch = A, runter = B
  });
})();
updateSwipeLayer();

// ---- #2 Smartwatch-/Ring-Steuerung (Media Session) ----
//   oben/next ODER rechts/seekforward = Punkt A
//   unten/previoustrack               = Punkt B
//   Mitte/Play-Pause 1×               = Stand ansagen
//   Mitte/Play-Pause gleich nochmal   = letzten Punkt zurücknehmen (+ neuen Stand ansagen)
//   links/seekbackward                = Undo (falls die Uhr diese Taste überhaupt sendet)
const ECHO_MS = 250;   // < dies = Doppelsignal der Uhr pro physischem Druck -> ignorieren
const UNDO_MS = 2000;  // bewusster zweiter Druck innerhalb dieses Fensters = Undo
let lastMiddlePress = 0;
let lastUndoPress = 0;
function onMediaA() { ensureAudio(); rallyWonBy('A'); }
function onMediaB() { ensureAudio(); rallyWonBy('B'); }
function onMediaMiddle() {
  // 1. Druck = ansagen; schneller 2. Druck = Undo. Das Doppelsignal der Uhr (sehr kurz
  // hintereinander) wird ausgefiltert, damit es nicht versehentlich einen Punkt zurücknimmt.
  ensureAudio();
  const now = Date.now();
  const dt = now - lastMiddlePress;
  lastMiddlePress = now;
  if (dt < ECHO_MS) return;            // Uhr-Echo desselben Drucks
  if (dt < UNDO_MS) { undo(); return; } // bewusster zweiter Druck -> Punkt zurück (undo() sagt an)
  announce(undefined, true);            // einzelner Druck -> Stand ansagen
}
function onMediaUndo() {
  // links = Undo (Bonus, falls die Uhr seekbackward sendet). Entprellt gegen Doppelsignal.
  ensureAudio();
  const now = Date.now();
  if (now - lastUndoPress < ECHO_MS) return;
  lastUndoPress = now;
  undo();
}
function startMediaSession() {
  if (!settings.watchControl) return;
  const a = $('#silentAudio');
  // iOS blendet Wiedergabe mit volume=0 oft aus der "Now Playing"-Steuerung aus
  // (dann steuert die Uhr nichts). Daher ganz leise, aber NICHT null.
  if (a) { try { a.volume = 0.03; if (a.paused) a.play().catch(() => {}); } catch (e) {} }
  if ('mediaSession' in navigator) {
    try {
      if (window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: 'PicklePoints', artist: 'Punktezähler' });
      navigator.mediaSession.setActionHandler('nexttrack', onMediaA);       // oben = A
      navigator.mediaSession.setActionHandler('previoustrack', onMediaB);   // unten = B
      navigator.mediaSession.setActionHandler('play', onMediaMiddle);       // Mitte = ansagen
      navigator.mediaSession.setActionHandler('pause', onMediaMiddle);
      try { navigator.mediaSession.setActionHandler('seekforward', onMediaA); } catch (e) {} // rechts = A
      try { navigator.mediaSession.setActionHandler('seekbackward', onMediaUndo); } catch (e) {} // links = Undo
      navigator.mediaSession.playbackState = 'playing';
    } catch (e) {}
  }
}
function stopMediaSession() {
  const a = $('#silentAudio');
  if (a) { try { a.pause(); } catch (e) {} }
  if ('mediaSession' in navigator) {
    try {
      ['nexttrack', 'previoustrack', 'play', 'pause', 'seekforward', 'seekbackward'].forEach((x) => { try { navigator.mediaSession.setActionHandler(x, null); } catch (e) {} });
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}
// ---- Uhr-Recovery: nach Reconnect/Vordergrund Audio + Mediensteuerung neu scharf schalten ----
// Behebt NICHT den Bluetooth-Abbruch (Uhr/iOS), beschleunigt aber die Wiederaufnahme:
// oft reicht dann 1× tippen statt App-Neustart.
let lastRearm = 0;
function rearmMediaSession() {
  if (!settings.watchControl) return;
  const now = Date.now();
  if (now - lastRearm < 1500) return; // entprellen (keine Schleife)
  lastRearm = now;
  startMediaSession(); // spielt #silentAudio neu ab + setzt Handler + playbackState
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rearmMediaSession(); });
window.addEventListener('pageshow', rearmMediaSession);
window.addEventListener('focus', rearmMediaSession);
(() => {
  const a = $('#silentAudio');
  if (!a) return;
  const onInterrupt = () => { if (settings.watchControl) setTimeout(rearmMediaSession, 300); };
  a.addEventListener('pause', onInterrupt);   // iOS pausiert das Audio, wenn die Medienroute wegfällt
  a.addEventListener('stalled', onInterrupt);
})();

/* =========================================================================
   Bedien-Buttons + Einstellungen
   ========================================================================= */
$('#undoBtn').addEventListener('click', undo);
$('#menuBtn').addEventListener('click', openSettings);
$('#repeatBtn').addEventListener('click', () => { ensureAudio(); announce(undefined, true); });

$('#muteBtn').addEventListener('click', () => {
  settings.announce = !settings.announce;
  saveSettings();
  render();
  if (settings.announce) announce();
});

$('#introOk').addEventListener('click', () => {
  hide('intro');
  localStorage.setItem('pb-intro-seen', '1');
  primeSpeech();
  render(); // ggf. Start-Aufschlag-Auswahl zeigen
});

// #winnerNew wird in render() je nach Match-Situation belegt (Neues Spiel/Nächstes Spiel/Neues Match)
$('#winnerClose').addEventListener('click', () => { game.over = false; saveGame(); hide('winner'); render(); });

// Start-Aufschlag-Auswahl (Overlay zu Spielbeginn)
$('#ssA').addEventListener('click', () => { settings.startServer = 'A'; settings.lastStartServer = 'A'; saveSettings(); applyStartServer(); startChosen = true; render(); });
$('#ssB').addEventListener('click', () => { settings.startServer = 'B'; settings.lastStartServer = 'B'; saveSettings(); applyStartServer(); startChosen = true; render(); });
$('#ssToss').addEventListener('click', coinToss);
$('#ssStart').addEventListener('click', () => { startChosen = true; render(); });

function openSettings() {
  // Felder mit aktuellem Stand füllen
  $('#setMode').value = settings.mode;
  $('#setTarget').value = String(settings.target);
  $('#setWinBy2').checked = settings.winBy2;
  $('#setMatch').value = String(settings.matchBestOf);
  $('#setStartServer').options[0].text = teamName('A');
  $('#setStartServer').options[1].text = teamName('B');
  $('#setStartServer').value = settings.startServer;
  $('#setStartChooser').checked = settings.showStartChooser;
  $('#setAlternateServe').checked = settings.alternateServe;
  $('#setAnnounce').checked = settings.announce;
  $('#setCallStyle').value = settings.callStyle || 'natur';
  $('#setAnnounceServer').checked = settings.announceServer;
  $('#setScoreOnly').checked = settings.scoreOnly;
  $('#setSound').checked = settings.sound;
  $('#setVolume').value = settings.volume || 'laut';
  $('#setWatch').checked = settings.watchControl;
  $('#setSwipe').checked = settings.swipeControl;
  $('#setAnnounceTeam').checked = settings.announceTeam;
  $('#setSwap').checked = settings.swapSides;
  setSelectsFromName('A');
  setSelectsFromName('B');
  renderGroups();
  $('#settings').showModal();
}

// Änderungen in den Einstellungen sofort übernehmen
$('#setMode').addEventListener('change', (e) => {
  settings.mode = e.target.value; saveSettings();
  // Servernummer an Modus anpassen
  if (settings.mode === 'singles') game.server = 1;
  else if (game.server !== 1 && game.server !== 2) game.server = 2;
  saveGame(); render();
});
$('#setTarget').addEventListener('change', (e) => { settings.target = parseInt(e.target.value, 10); saveSettings(); });
$('#setWinBy2').addEventListener('change', (e) => { settings.winBy2 = e.target.checked; saveSettings(); });
$('#setMatch').addEventListener('change', (e) => { settings.matchBestOf = parseInt(e.target.value, 10); match = { A: 0, B: 0 }; saveMatch(); saveSettings(); render(); });
$('#setStartServer').addEventListener('change', (e) => { settings.startServer = e.target.value; settings.lastStartServer = settings.startServer; saveSettings(); applyStartServer(); render(); });
$('#setStartChooser').addEventListener('change', (e) => { settings.showStartChooser = e.target.checked; saveSettings(); render(); });
$('#setAlternateServe').addEventListener('change', (e) => { settings.alternateServe = e.target.checked; saveSettings(); });
$('#setCallStyle').addEventListener('change', (e) => { settings.callStyle = e.target.value; saveSettings(); });
$('#setAnnounceServer').addEventListener('change', (e) => { settings.announceServer = e.target.checked; saveSettings(); });
$('#setScoreOnly').addEventListener('change', (e) => { settings.scoreOnly = e.target.checked; saveSettings(); });
$('#coinTossBtn').addEventListener('click', coinToss);
$('#historyBtn').addEventListener('click', async () => {
  $('#viewAllHist').checked = viewAllGroups; renderHistory(); document.querySelector('#historyDlg').showModal();
  await fetchOnlineMatches(); renderHistory();
});
$('#historyClear').addEventListener('click', () => {
  const keep = loadHistory().filter((m) => !inActiveGroup(m)); // nur die angezeigten lokalen Spiele entfernen
  localStorage.setItem(KEY_HISTORY, JSON.stringify(keep)); renderHistory();
});
$('#historyClose').addEventListener('click', () => { document.querySelector('#historyDlg').close(); });
$('#viewAllHist').addEventListener('change', (e) => { viewAllGroups = e.target.checked; renderHistory(); });

// Gruppen & Speichern
$('#winnerSave').addEventListener('click', saveResult);
$('#setActiveGroup').addEventListener('change', async (e) => { settings.activeGroup = e.target.value; saveSettings(); renderGroups(); await fetchOnlineMatches(); });
$('#setAutoSave').addEventListener('change', (e) => { settings.autoSave = e.target.checked; saveSettings(); });
$('#newLocalGroup').addEventListener('click', () => {
  const n = ($('#newGroupName').value || '').trim(); if (!n) { flash('Name eingeben'); return; }
  const g = { id: 'g' + Date.now(), name: n, scope: 'local' };
  settings.groups.push(g); settings.activeGroup = g.id; saveSettings(); $('#newGroupName').value = ''; renderGroups();
});
$('#newOnlineGroup').addEventListener('click', () => { const n = ($('#newGroupName').value || '').trim(); $('#newGroupName').value = ''; createOnlineGroup(n); });
$('#joinGroupBtn').addEventListener('click', () => { const c = $('#joinCode').value; $('#joinCode').value = ''; joinOnlineGroup(c); });
$('#delGroupBtn').addEventListener('click', () => {
  if (settings.activeGroup === 'local') { flash('Die Gruppe „Lokal" bleibt'); return; }
  settings.groups = settings.groups.filter((g) => g.id !== settings.activeGroup);
  settings.activeGroup = 'local'; saveSettings(); renderGroups(); fetchOnlineMatches();
});
$('#groupOnlineBtn').addEventListener('click', convertGroupToOnline);
$('#delGroupServerBtn').addEventListener('click', async () => {
  const g = activeGroupObj();
  if (!g || g.scope !== 'online' || g.role !== 'owner' || !g.adminKey) return;
  if (!window.confirm('Gruppe „' + g.name + '" wirklich für ALLE endgültig löschen?\nDas kann nicht rückgängig gemacht werden.')) return;
  const ok = await deleteOnlineGroupServer(g);
  if (!ok) { flash('Löschen fehlgeschlagen (Worker aktualisiert?)'); return; }
  // aus eigener Liste + Warteschlange entfernen, zurück auf Lokal
  settings.groups = settings.groups.filter((x) => x.id !== g.id);
  settings.activeGroup = 'local';
  saveQueue(loadQueue().filter((it) => it.code !== g.code));
  saveSettings(); onlineMatches = []; renderGroups();
  const hd = document.querySelector('#historyDlg'); if (hd && hd.open) renderHistory();
  flash('Gruppe „' + g.name + '" endgültig gelöscht');
});

// Statistik-Dialog
$('#statsBtn').addEventListener('click', async () => { $('#viewAllStats').checked = viewAllGroups; renderStats(); $('#statsDlg').showModal(); await fetchOnlineMatches(); renderStats(); });
$('#viewAllStats').addEventListener('change', (e) => { viewAllGroups = e.target.checked; renderStats(); });
$('#statsClose').addEventListener('click', () => $('#statsDlg').close());
$('#mmBtn').addEventListener('click', runMatchmaker);
$('#statsExport').addEventListener('click', exportMatches);
$('#statsImport').addEventListener('click', () => $('#statsImportFile').click());
$('#statsImportFile').addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importMatches(e.target.files[0]); });
$('#setSound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); if (settings.sound) soundFor('point'); });
$('#setVolume').addEventListener('change', (e) => { settings.volume = e.target.value; saveSettings(); masterNode(); beep(880, 110, 'triangle'); });
$('#setWatch').addEventListener('change', (e) => { settings.watchControl = e.target.checked; saveSettings(); if (settings.watchControl) startMediaSession(); else stopMediaSession(); });
$('#setSwipe').addEventListener('change', (e) => { settings.swipeControl = e.target.checked; saveSettings(); updateSwipeLayer(); });
$('#setAnnounce').addEventListener('change', (e) => { settings.announce = e.target.checked; saveSettings(); render(); });
$('#setAnnounceTeam').addEventListener('change', (e) => { settings.announceTeam = e.target.checked; saveSettings(); });
$('#setSwap').addEventListener('change', (e) => { settings.swapSides = e.target.checked; saveSettings(); render(); });
$('#setA1').addEventListener('change', () => teamFromSelects('A'));
$('#setA2').addEventListener('change', () => teamFromSelects('A'));
$('#setB1').addEventListener('change', () => teamFromSelects('B'));
$('#setB2').addEventListener('change', () => teamFromSelects('B'));

$('#newGameBtn').addEventListener('click', () => { $('#settings').close(); resetGame(); });
$('#flipServe').addEventListener('click', flipServe);
$('#flipServer').addEventListener('click', flipServer);

/* =========================================================================
   Bildschirm wachhalten (Wake Lock)
   ========================================================================= */
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* nicht überall verfügbar */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});

/* Sprachausgabe braucht eine erste Nutzer-Interaktion, um zuverlässig zu starten */
function primeSpeech() {
  requestWakeLock();
  const ctx = ensureAudio();
  if (ctx) {
    // Stiller 1-Sample-Buffer schaltet Web Audio auf iOS zuverlässig frei
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
  }
  preloadClips();
  startMediaSession();
  if ('speechSynthesis' in window) {
    try { speechSynthesis.getVoices(); } catch (e) {}
  }
}
document.body.addEventListener('click', primeSpeech, { once: true });

/* =========================================================================
   Service Worker (Offline) – nur über https/localhost
   ========================================================================= */
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* =========================================================================
   Start
   ========================================================================= */
function init() {
  if (!localStorage.getItem('pb-intro-seen')) show('intro');
  buildThemeGrid();
  buildPaletteGrid();
  applyTheme(settings.theme); // markiert aktives Design + Palette
  populateTeamSelects();
  populateMatchmaker();
  renderGroups();
  fetchOnlineMatches();
  flushQueue();
  pruneDeletedGroups(); // gelöschte Online-Gruppen automatisch aus der Liste werfen
  probeClips();
  render();
}
window.addEventListener('online', () => { flushQueue(); pruneDeletedGroups(); });
init();
