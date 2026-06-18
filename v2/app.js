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
  matchBestOf: 1,   // 1 = Einzelspiel, 3 = Best of 3, 5 = Best of 5
  startServer: 'A', // welches Team zuerst aufschlägt
  showStartChooser: true, // Aufschlag-Auswahl beim Spielstart zeigen
  swapSides: false,
  tipperMode: false,
  tippers: { A: { x: 16, y: 55 }, B: { x: 84, y: 55 } }, // Positionen in % der Bildschirmgröße
  names: { A: 'Team A', B: 'Team B' },
  keys: { A: 'ArrowLeft', B: 'ArrowRight', undo: 'Backspace', repeat: 'Enter' } // Standard für Tastatur-Test
};

// Vorübergehende Zustände (nicht gespeichert)
let tipperSetup = false;
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
let learning = null; // welcher Tasten-Slot gerade angelernt wird ('A'|'B'|'undo'|null)

/* =========================================================================
   Persistenz
   ========================================================================= */
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_SETTINGS));
    if (raw) return Object.assign({}, DEFAULT_SETTINGS, raw,
      { names:   Object.assign({}, DEFAULT_SETTINGS.names,   raw.names),
        keys:    Object.assign({}, DEFAULT_SETTINGS.keys,    raw.keys),
        tippers: Object.assign({}, DEFAULT_SETTINGS.tippers, raw.tippers) });
  } catch (e) { /* ignorieren */ }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
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

// Tipp-Flächen an ihre gespeicherten %-Positionen setzen
function positionTippers() {
  for (const t of ['A', 'B']) {
    const el = document.querySelector('#tipper' + t);
    const p = (settings.tippers && settings.tippers[t]) || { x: 50, y: 50 };
    el.style.left = p.x + '%';
    el.style.top = p.y + '%';
    el.textContent = t; // Beschriftung A / B
  }
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
  // Seiten ggf. tauschen (für Klicker-/Tipper-Belegung)
  document.querySelector('#court').classList.toggle('swapped', !!settings.swapSides);

  // Tipper-Modus: Tipp-Flächen ein-/ausblenden und positionieren
  const tippersEl = document.querySelector('#tippers');
  tippersEl.classList.toggle('hidden', !settings.tipperMode);
  tippersEl.classList.toggle('setup', !!tipperSetup);
  if (!(settings.tipperMode && tipperSetup)) clearCalibDots();
  positionTippers();

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
// Stimmen-Auswahlliste füllen
function populateVoices() {
  const sel = document.querySelector('#setVoice');
  if (!sel) return;
  const de = germanVoices();
  const list = de.length ? de : allVoices();
  sel.innerHTML = '<option value="">(automatisch)</option>' +
    list.map((v) => '<option value="' + v.voiceURI + '">' + v.name +
      (/^de/i.test(v.lang) ? '' : ' (' + v.lang + ')') + '</option>').join('');
  sel.value = settings.voiceURI || '';
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
// Kurze Hörprobe nach Stimmwechsel
function speakSample() {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Test. eins, null, zwei.');
    u.lang = 'de-DE'; u.rate = 0.9;
    const v = pickVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = populateVoices;

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
   Eingabe: Tippen + Funkknopf (Tastatur-Events)
   ========================================================================= */
function keyId(e) { return e.code || e.key; }

document.addEventListener('keydown', (e) => {
  // Anlern-Modus: nächste Taste merken
  if (learning) {
    e.preventDefault();
    settings.keys[learning] = keyId(e);
    saveSettings();
    const slot = learning;
    learning = null;
    updateKeyLabels();
    $$('.learn').forEach((b) => b.classList.remove('active'));
    $('#learnStatus').textContent = 'Gespeichert: ' + slot + ' = ' + settings.keys[slot];
    return;
  }
  // Während die Einstellungen offen sind, keine Spielaktionen auslösen
  if ($('#settings').open) return;
  // In Eingabefeldern nichts abfangen
  if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;

  const id = keyId(e);
  if (id === settings.keys.A)    { e.preventDefault(); rallyWonBy('A'); }
  else if (id === settings.keys.B) { e.preventDefault(); rallyWonBy('B'); }
  else if (id === settings.keys.undo) { e.preventDefault(); undo(); }
  else if (id === settings.keys.repeat) { e.preventDefault(); ensureAudio(); announce(undefined, true); }
});

// Tippen auf die Spielfeld-Hälften
$$('.side').forEach((el) => {
  el.addEventListener('click', () => {
    if ($('#settings').open) return;
    if (settings.tipperMode) return; // im Tipper-Modus zählen nur die Tipp-Flächen
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
        e.target.closest('input') || e.target.closest('.tipper')) return;
    ensureAudio();
    announce(undefined, true); // Mittel-Knopf des Rings = Stand wiederholen
  }
}, true);

// ---- #2 Smartwatch-Steuerung (Media Session) ----
function startMediaSession() {
  if (!settings.watchControl) return;
  const a = $('#silentAudio');
  if (a) { try { a.volume = 0; if (a.paused) a.play().catch(() => {}); } catch (e) {} }
  if ('mediaSession' in navigator) {
    try {
      if (window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: 'Pickleball', artist: 'Punktezähler' });
      navigator.mediaSession.setActionHandler('nexttrack', () => { ensureAudio(); rallyWonBy('A'); });
      navigator.mediaSession.setActionHandler('previoustrack', () => { ensureAudio(); rallyWonBy('B'); });
      navigator.mediaSession.setActionHandler('play', () => { ensureAudio(); announce(undefined, true); });
      navigator.mediaSession.setActionHandler('pause', () => { ensureAudio(); announce(undefined, true); });
      navigator.mediaSession.playbackState = 'playing';
    } catch (e) {}
  }
}
function stopMediaSession() {
  const a = $('#silentAudio');
  if (a) { try { a.pause(); } catch (e) {} }
  if ('mediaSession' in navigator) {
    try {
      ['nexttrack', 'previoustrack', 'play', 'pause'].forEach((x) => navigator.mediaSession.setActionHandler(x, null));
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}

// ---- Tipper-Modus: Tippen, Ziehen und Kalibrieren ----
// Im Einrichten-Modus bleibt an jeder Geräte-Tippstelle ein gelber Punkt liegen.
// Die letzten zwei bleiben sichtbar, damit man BEIDE Tipp-Stellen gleichzeitig sieht.
function addCalibDot(clientX, clientY) {
  const wrap = $('#tapMarkers');
  const dot = document.createElement('div');
  dot.className = 'cdot';
  dot.style.left = (clientX / window.innerWidth * 100) + '%';
  dot.style.top = (clientY / window.innerHeight * 100) + '%';
  wrap.appendChild(dot);
  while (wrap.children.length > 2) wrap.removeChild(wrap.firstChild);
}
function clearCalibDots() {
  const wrap = $('#tapMarkers');
  if (wrap) wrap.innerHTML = '';
}

document.addEventListener('pointerdown', (e) => {
  if (settings.tipperMode && tipperSetup && !$('#settings').open && !e.target.closest('.tipper')) {
    addCalibDot(e.clientX, e.clientY);
  }
}, true);

let drag = null;
['A', 'B'].forEach((team) => {
  const el = document.querySelector('#tipper' + team);

  // Tippen = Punkt (nur außerhalb des Einrichtens)
  el.addEventListener('click', () => {
    if (tipperSetup) return;
    rallyWonBy(team);
  });

  // Ziehen zum Positionieren (nur im Einrichten-Modus)
  el.addEventListener('pointerdown', (e) => {
    if (!tipperSetup) return;
    e.preventDefault();
    drag = team;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (drag !== team) return;
    const x = Math.max(2, Math.min(98, e.clientX / window.innerWidth * 100));
    const y = Math.max(6, Math.min(94, e.clientY / window.innerHeight * 100));
    settings.tippers[team] = { x, y };
    positionTippers();
  });
  el.addEventListener('pointerup', () => {
    if (drag !== team) return;
    drag = null;
    saveSettings();
  });
});

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
  $('#setNaturalVoice').checked = settings.naturalVoice;
  $('#setRing').checked = settings.ringControl;
  $('#setWatch').checked = settings.watchControl;
  $('#setAnnounceTeam').checked = settings.announceTeam;
  populateVoices();
  $('#setSwap').checked = settings.swapSides;
  $('#setTipper').checked = settings.tipperMode;
  $('#setTipperSetup').checked = tipperSetup;
  setSelectsFromName('A');
  setSelectsFromName('B');
  updateKeyLabels();
  $('#learnStatus').textContent = '';
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
$('#setNaturalVoice').addEventListener('change', (e) => { settings.naturalVoice = e.target.checked; saveSettings(); });
$('#setRing').addEventListener('change', (e) => { settings.ringControl = e.target.checked; saveSettings(); });
$('#setWatch').addEventListener('change', (e) => { settings.watchControl = e.target.checked; saveSettings(); if (settings.watchControl) startMediaSession(); else stopMediaSession(); });
$('#setAnnounce').addEventListener('change', (e) => { settings.announce = e.target.checked; saveSettings(); render(); });
$('#setAnnounceTeam').addEventListener('change', (e) => { settings.announceTeam = e.target.checked; saveSettings(); });
$('#setVoice').addEventListener('change', (e) => { settings.voiceURI = e.target.value; saveSettings(); speakSample(); });
$('#setSwap').addEventListener('change', (e) => { settings.swapSides = e.target.checked; saveSettings(); render(); });
$('#setTipper').addEventListener('change', (e) => { settings.tipperMode = e.target.checked; if (!settings.tipperMode) tipperSetup = false; saveSettings(); render(); });
$('#setTipperSetup').addEventListener('change', (e) => { tipperSetup = e.target.checked; render(); });
$('#setA1').addEventListener('change', () => teamFromSelects('A'));
$('#setA2').addEventListener('change', () => teamFromSelects('A'));
$('#setB1').addEventListener('change', () => teamFromSelects('B'));
$('#setB2').addEventListener('change', () => teamFromSelects('B'));

$('#newGameBtn').addEventListener('click', () => { $('#settings').close(); resetGame(); });
$('#flipServe').addEventListener('click', flipServe);
$('#flipServer').addEventListener('click', flipServer);

// Anlern-Buttons
$$('.learn').forEach((btn) => {
  btn.addEventListener('click', () => {
    learning = btn.dataset.learn;
    $$('.learn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $('#learnStatus').textContent = 'Jetzt den Knopf am Klicker drücken …';
  });
});

function updateKeyLabels() {
  for (const slot of ['A', 'B', 'undo', 'repeat']) {
    const el = $(`[data-keylabel="${slot}"]`);
    if (el) el.textContent = settings.keys[slot] || '—';
  }
}

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
  updateKeyLabels();
  populateVoices();
  populateTeamSelects();
  populateMatchmaker();
  fetchOnlineMatches();
  probeClips();
  render();
}
init();
