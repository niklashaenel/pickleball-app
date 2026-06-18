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

/* ---- Standard-Einstellungen ---- */
const DEFAULT_SETTINGS = {
  mode: 'doubles',        // 'doubles' | 'singles'
  target: 11,
  winBy2: true,
  announce: true,
  announceTeam: true,
  voiceURI: '',
  sound: true,
  naturalVoice: true,   // vorab erzeugte natürliche Audio-Schnipsel verwenden, wenn vorhanden
  ringControl: false,   // Bluetooth-Ring (Mausrad/Scroll)
  watchControl: false,  // Smartwatch über Media Session
  swipeControl: false,  // Wisch-Overlay (Finger): hoch=A, runter=B, seitlich=Undo, Tipp=Wiederholen
  matchBestOf: 1,   // 1 = Einzelspiel, 3 = Best of 3, 5 = Best of 5
  startServer: 'A', // welches Team zuerst aufschlägt
  showStartChooser: true, // Aufschlag-Auswahl beim Spielstart zeigen
  swapSides: false,
  theme: 'neon',     // Design-Stil
  palette: 'auto',   // Farbpalette ('auto' = Farben des Designs)
  names: { A: 'Team A', B: 'Team B' }
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
  entry.names = { A: teamName('A'), B: teamName('B') };
  entry.players = { A: parsePlayers(teamName('A')), B: parsePlayers(teamName('B')) };
  let h = loadHistory();
  h.unshift(entry);
  if (h.length > 200) h = h.slice(0, 200);
  localStorage.setItem(KEY_HISTORY, JSON.stringify(h));
}

// ---- #5a Statistik (Lesen) + Matchmaker + Export/Import ----
const MATCHES_URL = 'https://raw.githubusercontent.com/niklashaenel/pickleball-app/main/matches.json';
let onlineMatches = [];
async function fetchOnlineMatches() {
  try {
    const r = await fetch(MATCHES_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.ok) { const data = await r.json(); if (Array.isArray(data)) onlineMatches = data; }
  } catch (e) { /* offline / Datei fehlt noch */ }
}
function matchKey(m) { return (m.ts || '') + '|' + (m.names ? m.names.A + '/' + m.names.B : ''); }
function allMatches() {
  const seen = new Set(), out = [];
  onlineMatches.concat(loadHistory()).forEach((m) => {
    const k = matchKey(m); if (seen.has(k)) return; seen.add(k); out.push(m);
  });
  return out;
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
  return s;
}
function saveSettings() { localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); }

function loadGame() {
  try { return JSON.parse(localStorage.getItem(KEY_GAME)); }
  catch (e) { return null; }
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
      event = 'secondServer';
      flash('2. Aufschläger');
    } else {
      game.serving = other(game.serving);
      game.server = 1;
      event = 'sideout';
      flash('Seitenwechsel');
    }
  }
  // Spiel beendet -> Match (Satz) zählen und Verlauf speichern
  if (game.over && !game.counted) {
    game.counted = true;
    if (settings.matchBestOf > 1) {
      match[game.winner]++; saveMatch();
      if (match[game.winner] >= gamesNeeded()) {
        addHistory({ type: 'match', winner: game.winner, sets: match.A + ':' + match.B });
      }
    } else {
      addHistory({ type: 'game', winner: game.winner, score: game.scores.A + ':' + game.scores.B });
    }
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
}

function resetGame() {
  history = [];
  game = newGame();
  match = { A: 0, B: 0 };
  saveMatch();
  saveGame();
  startChosen = false;
  hide('winner');
  render();
}
// Nächstes Spiel im Match (Satzstand bleibt erhalten)
function nextGame() {
  history = [];
  game = newGame();
  saveGame();
  startChosen = false;
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
  const h = loadHistory();
  if (!h.length) { el.innerHTML = '<p class="muted">Noch keine Spiele gespeichert.</p>'; return; }
  el.innerHTML = h.map((e) => {
    const d = new Date(e.ts);
    const date = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const w = (e.names && e.names[e.winner]) || ('Team ' + e.winner);
    const res = e.type === 'match' ? ('Match ' + e.sets) : ('Spiel ' + e.score);
    const teams = e.names ? (e.names.A + ' vs ' + e.names.B) : '';
    return '<div class="hist-row"><span class="hist-date">' + date + '</span>' +
           '<span class="hist-teams">' + teams + '</span>' +
           '<span class="hist-res">' + res + ' · 🏆 ' + w + '</span></div>';
  }).join('');
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
  // Aufschlag von rechts bei geradem eigenen Punktestand, sonst links
  return game.scores[team] % 2 === 0 ? 'rechts' : 'links';
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
    show('winner');
  }

  // Start-Aufschlag-Auswahl (nur bei frischem Spiel, wenn Intro nicht offen ist)
  const fresh = !game.over && game.scores.A === 0 && game.scores.B === 0 && !history.length;
  const introHidden = $('#intro').classList.contains('hidden');
  const showChooser = fresh && introHidden && settings.showStartChooser && !startChosen;
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
      phrases.push(wName + ' gewinnt');
    }
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
    o.connect(g); g.connect(ctx.destination);
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
  'zu', 'seitenwechsel', 'verlaengerung', 'es-geht-bis', 'aufschlag', 'spiel', 'gewinnt',
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
  let t = ctx.currentTime + 0.04;
  const GAP = 0.22; // natürliche Pause zwischen den Segmenten
  valid.forEach((en, idx) => {
    const isLast = idx === valid.length - 1;
    // letztes Segment länger ausklingen lassen, damit es nicht abgehackt klingt
    const dur = isLast ? Math.min(en.buf.duration - en.offset, en.dur + 0.25) : en.dur;
    const src = ctx.createBufferSource();
    src.buffer = en.buf;
    src.connect(ctx.destination);
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
      keys.push('spiel'); team(game.winner); keys.push('gewinnt');
    }
  } else {
    if (event === 'sideout') {
      keys.push('seitenwechsel');
      if (settings.announceTeam) { keys.push('aufschlag'); team(game.serving); }
    }
    const nums = callText();
    num(nums[0]); keys.push('zu'); num(nums[1]);
    if (settings.mode === 'doubles') num(nums[2]);
    const a = game.scores.A, b = game.scores.B;
    if (event === 'point' && settings.winBy2 && a === b && a >= settings.target - 1) {
      keys.push('verlaengerung'); keys.push('es-geht-bis'); num(a + 2);
    }
  }
  if (bad || !keys.every((k) => CLIP_KEYS.has(k))) return null;
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

// Volle Ansage-Schnipsel bevorzugen (ganze Phrasen = natürliche Betonung)
function buildPhraseKeys(event) {
  if (game.over) {
    const tk = teamClipKey(game.winner);
    if (!tk) return null;
    if (settings.matchBestOf > 1 && match[game.winner] >= gamesNeeded()) {
      return ['match', tk, 'gewinnt-das-match'];
    }
    if (settings.matchBestOf > 1) return null; // "Spiel für ..., Satzstand ..." -> Wort-Fallback
    return ['spiel', tk, 'gewinnt'];
  }
  const nums = callText();
  if (nums[0] > 21 || nums[1] > 21) return null; // außerhalb des erzeugten Bereichs
  const call = settings.mode === 'doubles'
    ? 'd_' + nums[0] + '_' + nums[1] + '_' + nums[2]
    : 's_' + nums[0] + '_' + nums[1];
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
  saveSettings();
  render();
}
// Auswahl-Menüs auf den aktuellen Team-Namen einstellen
function setSelectsFromName(team) {
  const parts = teamName(team).split('+').map((s) => s.trim()).filter(Boolean);
  const known = parts.filter((p) => CLUB_PLAYERS.indexOf(p) !== -1);
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
// Ganz einfach & zuverlässig (kein Doppel-Tipp, KEIN Undo auf der Uhr):
//   oben/next ODER rechts/seekforward = Punkt A
//   unten/previoustrack               = Punkt B
//   Mitte/Play-Pause                  = Stand ansagen
// Vertippt? Am Handy mit ↩︎ zurücknehmen.
const MID_MS = 1000;   // Entprellen der Mitte-Ansage (kein Gestotter bei Doppel-Signalen)
let lastMiddlePress = 0;
function onMediaA() { ensureAudio(); rallyWonBy('A'); }
function onMediaB() { ensureAudio(); rallyWonBy('B'); }
function onMediaMiddle() {
  // Mitte/Play-Pause = Stand ansagen. Entprellt, damit schnelle Folge-Tipps
  // (oder Doppel-Signale der Uhr pro Druck) die Ansage nicht ständig neu starten.
  ensureAudio();
  const now = Date.now();
  if (now - lastMiddlePress < MID_MS) return;
  lastMiddlePress = now;
  announce(undefined, true);
}
function startMediaSession() {
  if (!settings.watchControl) return;
  const a = $('#silentAudio');
  // iOS blendet Wiedergabe mit volume=0 oft aus der "Now Playing"-Steuerung aus
  // (dann steuert die Uhr nichts). Daher ganz leise, aber NICHT null.
  if (a) { try { a.volume = 0.03; if (a.paused) a.play().catch(() => {}); } catch (e) {} }
  if ('mediaSession' in navigator) {
    try {
      if (window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: 'Pickleball', artist: 'Punktezähler' });
      navigator.mediaSession.setActionHandler('nexttrack', onMediaA);       // oben = A
      navigator.mediaSession.setActionHandler('previoustrack', onMediaB);   // unten = B
      navigator.mediaSession.setActionHandler('play', onMediaMiddle);       // Mitte = ansagen
      navigator.mediaSession.setActionHandler('pause', onMediaMiddle);
      try { navigator.mediaSession.setActionHandler('seekforward', onMediaA); } catch (e) {} // rechts = A
      // seekbackward (links) bewusst NICHT belegt
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
$('#ssA').addEventListener('click', () => { settings.startServer = 'A'; saveSettings(); applyStartServer(); startChosen = true; render(); });
$('#ssB').addEventListener('click', () => { settings.startServer = 'B'; saveSettings(); applyStartServer(); startChosen = true; render(); });
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
  $('#setAnnounce').checked = settings.announce;
  $('#setSound').checked = settings.sound;
  $('#setWatch').checked = settings.watchControl;
  $('#setSwipe').checked = settings.swipeControl;
  $('#setAnnounceTeam').checked = settings.announceTeam;
  $('#setSwap').checked = settings.swapSides;
  setSelectsFromName('A');
  setSelectsFromName('B');
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
$('#setStartServer').addEventListener('change', (e) => { settings.startServer = e.target.value; saveSettings(); applyStartServer(); render(); });
$('#setStartChooser').addEventListener('change', (e) => { settings.showStartChooser = e.target.checked; saveSettings(); render(); });
$('#coinTossBtn').addEventListener('click', coinToss);
$('#historyBtn').addEventListener('click', () => { renderHistory(); document.querySelector('#historyDlg').showModal(); });
$('#historyClear').addEventListener('click', () => { localStorage.removeItem(KEY_HISTORY); renderHistory(); });
$('#historyClose').addEventListener('click', () => { document.querySelector('#historyDlg').close(); });

// Statistik-Dialog
$('#statsBtn').addEventListener('click', async () => { renderStats(); $('#statsDlg').showModal(); await fetchOnlineMatches(); renderStats(); });
$('#statsClose').addEventListener('click', () => $('#statsDlg').close());
$('#mmBtn').addEventListener('click', runMatchmaker);
$('#statsExport').addEventListener('click', exportMatches);
$('#statsImport').addEventListener('click', () => $('#statsImportFile').click());
$('#statsImportFile').addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importMatches(e.target.files[0]); });
$('#setSound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); if (settings.sound) soundFor('point'); });
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
  fetchOnlineMatches();
  probeClips();
  render();
}
init();
