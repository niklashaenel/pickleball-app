// Pickleball – Gruppen-Backend (Cloudflare Worker + KV)
// Speichert Spiele pro Gruppe; Zugriff über einen kurzen Code.
// Voraussetzung: KV-Namespace als Binding "GROUPS" gebunden (siehe CLOUDFLARE.md).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// Kurzer, gut lesbarer Code (ohne 0/O/1/I, um Verwechslungen zu vermeiden)
function randCode(n) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const KV = env.GROUPS;
    if (!KV) return json({ error: 'KV-Binding GROUPS fehlt' }, 500);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean); // z.B. ['api','group','ABC123','games']

    try {
      // POST /api/group  -> neue Gruppe anlegen
      if (req.method === 'POST' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'group') {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name || 'Gruppe').slice(0, 40);
        let code = randCode(6);
        for (let i = 0; i < 5 && (await KV.get('meta:' + code)); i++) code = randCode(6);
        const adminKey = randCode(20);
        await KV.put('meta:' + code, JSON.stringify({ name, created: Date.now(), adminKey }));
        await KV.put('games:' + code, '[]');
        return json({ code, adminKey, name });
      }

      // /api/group/{code}...
      if (parts.length >= 3 && parts[0] === 'api' && parts[1] === 'group') {
        const code = parts[2];
        const metaRaw = await KV.get('meta:' + code);
        if (!metaRaw) return json({ error: 'not found' }, 404);
        const meta = JSON.parse(metaRaw);

        // GET /api/group/{code}  -> Name + Spiele (adminKey wird NIE zurückgegeben)
        if (req.method === 'GET' && parts.length === 3) {
          const games = JSON.parse((await KV.get('games:' + code)) || '[]');
          return json({ name: meta.name, games });
        }

        // POST /api/group/{code}/games  -> ein Spiel anhängen
        if (req.method === 'POST' && parts.length === 4 && parts[3] === 'games') {
          const body = await req.json().catch(() => ({}));
          const game = body.game;
          if (!game) return json({ error: 'no game' }, 400);
          const games = JSON.parse((await KV.get('games:' + code)) || '[]');
          if (!game.gid) game.gid = Date.now() + '-' + randCode(4);
          if (!games.some((g) => g.gid && g.gid === game.gid)) {
            games.unshift(game);
            if (games.length > 1000) games.length = 1000;
            await KV.put('games:' + code, JSON.stringify(games));
          }
          return json({ ok: true, count: games.length });
        }

        // DELETE /api/group/{code}/games/{gid}  -> ein Spiel löschen (nur Ersteller)
        if (req.method === 'DELETE' && parts.length === 5 && parts[3] === 'games') {
          if ((req.headers.get('X-Admin-Key') || '') !== meta.adminKey) return json({ error: 'forbidden' }, 403);
          const gid = decodeURIComponent(parts[4]);
          let games = JSON.parse((await KV.get('games:' + code)) || '[]');
          games = games.filter((g) => String(g.gid) !== String(gid));
          await KV.put('games:' + code, JSON.stringify(games));
          return json({ ok: true, count: games.length });
        }
      }

      return json({ error: 'bad request' }, 400);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
  },
};
