# Erzeugt natürliche Audio-Schnipsel für die Pickleball-App mit edge-tts (gratis, ohne Schlüssel).
#
# Einmal ausführen:
#   pip install edge-tts
#   python generate_voice.py
#
# Erzeugt mp3-Dateien im Ordner "voice/".  Stimme: männlich (de-DE-ConradNeural).
# - Einzelwoerter (Fallback)  : 0..30, "zu", "seitenwechsel", ...
# - VOLLE Spielstand-Rufe      : "d_a_b_c" (Doppel) und "s_a_b" (Einzel) fuer a,b = 0..MAX
#   Diese klingen natuerlich, weil der ganze Ruf in EINEM Stueck gesprochen wird.

import asyncio
import os
import edge_tts

VOICE = "de-DE-ConradNeural"
MAX = 21  # Voll-Rufe fuer Staende 0..MAX
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice")
os.makedirs(OUT, exist_ok=True)

WORDS = [
    "null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
    "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn",
    "achtzehn", "neunzehn", "zwanzig", "einundzwanzig", "zweiundzwanzig", "dreiundzwanzig",
    "vierundzwanzig", "fünfundzwanzig", "sechsundzwanzig", "siebenundzwanzig",
    "achtundzwanzig", "neunundzwanzig", "dreißig",
]

clips = {str(i): WORDS[i] for i in range(len(WORDS))}
clips.update({
    "zu": "zu",
    "seitenwechsel": "Seitenwechsel",
    "verlaengerung": "Verlängerung",
    "es-geht-bis": "es geht bis",
    "aufschlag": "Aufschlag",
    "spiel": "Spiel",
    "gewinnt": "gewinnt",
    "spiel-fuer": "Spiel für",
    "satzstand": "Satzstand",
    "match": "Match",
    "gewinnt-das-match": "gewinnt das Match",
    "team-a": "Team A",
    "team-b": "Team B",
    "so_a": "Seitenwechsel, Aufschlag Team A",
    "so_b": "Seitenwechsel, Aufschlag Team B",
})

# Volle Spielstand-Rufe (ein Stück = natuerliche Betonung)
for a in range(MAX + 1):
    for b in range(MAX + 1):
        clips["s_%d_%d" % (a, b)] = "%s zu %s" % (WORDS[a], WORDS[b])
        for c in (1, 2):
            clips["d_%d_%d_%d" % (a, b, c)] = "%s zu %s, %s" % (WORDS[a], WORDS[b], WORDS[c])

# ---- Vereins-Spielernamen (Einzel + alle Doppel-Paarungen) ----
PLAYERS = [
    "Niki", "Silas", "Eric", "Petra", "Tobias", "Yassine", "Christoph", "Kamil", "Luis",
    "Simon", "Sven", "Uyen", "Barbara", "Inna", "Serhi", "Helena", "Simone", "Kevin",
    "Iris", "Jürgen", "Silke", "Tilo", "Jule", "Vasilisa", "Melli", "Viktor", "Matthias",
]

def slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return "".join(ch for ch in s if ch.isalnum())

_ps = sorted(PLAYERS, key=slug)
for _p in _ps:
    clips["name_" + slug(_p)] = _p
for _i in range(len(_ps)):
    for _j in range(_i + 1, len(_ps)):
        clips["name_" + slug(_ps[_i]) + "-" + slug(_ps[_j])] = _ps[_i] + " und " + _ps[_j]
clips["so_pre"] = "Seitenwechsel, Aufschlag"

sem = asyncio.Semaphore(10)
done = 0

async def gen(name, text):
    global done
    path = os.path.join(OUT, name + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        done += 1
        return
    async with sem:
        await edge_tts.Communicate(text, VOICE).save(path)
        done += 1
        if done % 100 == 0:
            print("...", done, "/", len(clips))

async def main():
    await asyncio.gather(*(gen(n, t) for n, t in clips.items()))

if __name__ == "__main__":
    asyncio.run(main())
    print("Fertig:", len(clips), "Schnipsel in", OUT)
