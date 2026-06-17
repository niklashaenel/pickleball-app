# Erzeugt natürliche Audio-Schnipsel für die Pickleball-App mit edge-tts (gratis, ohne Schlüssel).
#
# Einmal ausführen:
#   pip install edge-tts
#   python generate_voice.py
#
# Erzeugt mp3-Dateien im Ordner "voice/".  Stimme: männlich (de-DE-ConradNeural).

import asyncio
import os
import edge_tts

VOICE = "de-DE-ConradNeural"
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
})


async def gen(name, text):
    path = os.path.join(OUT, name + ".mp3")
    await edge_tts.Communicate(text, VOICE).save(path)
    print("ok:", name, "->", text)


async def main():
    for name, text in clips.items():
        await gen(name, text)


if __name__ == "__main__":
    asyncio.run(main())
    print("Fertig:", len(clips), "Dateien in", OUT)
