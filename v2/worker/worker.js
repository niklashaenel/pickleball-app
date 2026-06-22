// Pickleball – Gruppen-Backend (Cloudflare Worker + KV)
// Speichert Spiele pro Gruppe; Zugriff über einen kurzen Code.
// Voraussetzung: KV-Namespace als Binding "GROUPS" gebunden (siehe CLOUDFLARE.md).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-Admin-Master',
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

      // ---- Admin-Übersicht (nur mit Master-Key env.ADMIN_MASTER) ----
      const masterOk = env.ADMIN_MASTER && (req.headers.get('X-Admin-Master') || '') === env.ADMIN_MASTER;
      if (parts.length >= 2 && parts[0] === 'api' && parts[1] === 'admin') {
        if (!masterOk) return json({ error: 'forbidden' }, 403);
        // GET /api/admin/groups -> Liste aller Gruppen
        if (req.method === 'GET' && parts.length === 3 && parts[2] === 'groups') {
          const groups = [];
          let cursor;
          do {
            const list = await KV.list({ prefix: 'meta:', cursor });
            for (const k of list.keys) {
              const code = k.name.slice(5);
              const meta = JSON.parse((await KV.get('meta:' + code)) || '{}');
              const games = JSON.parse((await KV.get('games:' + code)) || '[]');
              groups.push({ code, name: meta.name || '', created: meta.created || 0, count: games.length });
            }
            cursor = list.list_complete ? null : list.cursor;
          } while (cursor);
          groups.sort((a, b) => b.created - a.created);
          return json({ groups });
        }
        // DELETE /api/admin/group/{code} -> beliebige Gruppe löschen
        if (req.method === 'DELETE' && parts.length === 4 && parts[2] === 'group') {
          await KV.delete('meta:' + parts[3]);
          await KV.delete('games:' + parts[3]);
          return json({ ok: true });
        }
        return json({ error: 'bad request' }, 400);
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

        // DELETE /api/group/{code}  -> ganze Gruppe löschen (nur Ersteller mit Admin-Key)
        if (req.method === 'DELETE' && parts.length === 3) {
          if ((req.headers.get('X-Admin-Key') || '') !== meta.adminKey) return json({ error: 'forbidden' }, 403);
          await KV.delete('meta:' + code);
          await KV.delete('games:' + code);
          return json({ ok: true });
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

        // DELETE /api/group/{code}/games/{gid}  -> ein Spiel löschen (jeder mit dem Code,
        // genau wie Hinzufügen: Code = gemeinsamer Schreibzugriff der Gruppe)
        if (req.method === 'DELETE' && parts.length === 5 && parts[3] === 'games') {
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
