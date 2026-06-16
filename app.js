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
function addHistory(entry) {
  entry.ts = Date.now();
  entry.names = { A: teamName('A'), B: teamName('B') };
  let h = loadHistory();
  h.unshift(entry);
  if (h.length > 50) h = h.slice(0, 50);
  localStorage.setItem(KEY_HISTORY, JSON.stringify(h));
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
  if (event === 'point') popScore(team);
  // Tonsignal
  if (game.over) winJingle(); else soundFor(event);
  announce(event);
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
  if (settings.announce) speakText('Aufschlag ' + speakName(teamName(settings.startServer)));
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

function announce(event, force) {
  if ((!settings.announce && !force) || !('speechSynthesis' in window)) return;
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
  // Phrasen mit Komma verbinden -> fließender Satz mit weichen Pausen;
  // Punkt am Ende verhindert, dass das letzte Wort abgeschnitten wird.
  const text = phrases.join(', ') + '.';
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.9;   // flüssig, aber nicht gehetzt
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
  return de.find((v) => /natural|neural|enhanced|premium|google/i.test(v.name)) || de[0];
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
    rallyWonBy(el.dataset.team);
  });
});

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

// Vollbild ein/aus (versteckt die Browser-Leisten; auf Android-Chrome zuverlässig)
function toggleFullscreen() {
  const el = document.documentElement;
  const enter = el.requestFullscreen || el.webkitRequestFullscreen;
  // iPhone/iOS-Safari unterstützt kein Web-Vollbild -> Hinweis geben
  if (!enter) {
    flash('iPhone: Teilen-Symbol → „Zum Home-Bildschirm", dann von dort öffnen', 4500);
    return;
  }
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      enter.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
  } catch (e) {}
}
$('#fsBtn').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const fs = !!document.fullscreenElement;
  $('#fsBtn').title = fs ? 'Vollbild beenden' : 'Vollbild';
});
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
  $('#setAnnounceTeam').checked = settings.announceTeam;
  populateVoices();
  $('#setSwap').checked = settings.swapSides;
  $('#setTipper').checked = settings.tipperMode;
  $('#setTipperSetup').checked = tipperSetup;
  $('#setNameA').value = settings.names.A;
  $('#setNameB').value = settings.names.B;
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
$('#setSound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); if (settings.sound) soundFor('point'); });
$('#setAnnounce').addEventListener('change', (e) => { settings.announce = e.target.checked; saveSettings(); render(); });
$('#setAnnounceTeam').addEventListener('change', (e) => { settings.announceTeam = e.target.checked; saveSettings(); });
$('#setVoice').addEventListener('change', (e) => { settings.voiceURI = e.target.value; saveSettings(); speakSample(); });
$('#setSwap').addEventListener('change', (e) => { settings.swapSides = e.target.checked; saveSettings(); render(); });
$('#setTipper').addEventListener('change', (e) => { settings.tipperMode = e.target.checked; if (!settings.tipperMode) tipperSetup = false; saveSettings(); render(); });
$('#setTipperSetup').addEventListener('change', (e) => { tipperSetup = e.target.checked; render(); });
$('#setNameA').addEventListener('input', (e) => { settings.names.A = e.target.value.trim() || 'Team A'; saveSettings(); render(); });
$('#setNameB').addEventListener('input', (e) => { settings.names.B = e.target.value.trim() || 'Team B'; saveSettings(); render(); });

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
  ensureAudio();
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
  render();
}
init();
